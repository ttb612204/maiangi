import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();
import fs from 'fs';

function logErrorToFile(error: any) {
  try {
    const time = new Date().toLocaleString('vi-VN');
    const message = `[${time}] ${error.stack || error.message || error}\n\n`;
    fs.appendFileSync('./error.log', message);
  } catch (err) {
    console.error('Không thể ghi file log:', err);
  }
}

const app = express();

// Cấu hình Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Khởi tạo PostgreSQL connection pool kết nối tới Supabase (fallback về chuỗi dummy nếu thiếu env để tránh crash khởi tạo)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Tự động kiểm tra và khởi tạo các bảng mới (chi_phi_khac, nguoi_chia_chi_phi, nguoi_tra_chi_phi)
async function initializeDatabase() {
  try {
    // 1. Tạo các bảng mới nếu chưa tồn tại
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chi_phi_khac (
        id SERIAL PRIMARY KEY,
        mo_ta TEXT NOT NULL,
        tong_tien NUMERIC(12, 2) NOT NULL,
        ngay_chi DATE NOT NULL,
        thu_trong_tuan VARCHAR(20) NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS nguoi_chia_chi_phi (
        id SERIAL PRIMARY KEY,
        chi_phi_id INT REFERENCES chi_phi_khac(id) ON DELETE CASCADE,
        thanh_vien_id INT REFERENCES thanh_vien(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS nguoi_tra_chi_phi (
        id SERIAL PRIMARY KEY,
        chi_phi_id INT REFERENCES chi_phi_khac(id) ON DELETE CASCADE,
        thanh_vien_id INT REFERENCES thanh_vien(id) ON DELETE CASCADE,
        so_tien_da_tra NUMERIC(12, 2) NOT NULL
      );
    `);

    // 2. Dọn dẹp bảng bua_toi: Xóa các cột loai và mo_ta thừa vì đã dùng bảng chi_phi_khac riêng biệt
    await pool.query(`
      ALTER TABLE bua_toi 
      DROP COLUMN IF EXISTS loai,
      DROP COLUMN IF EXISTS mo_ta;
    `);
  } catch (err) {
    console.error('Database migration error:', err);
  }
}

initializeDatabase();

// Middleware kiểm tra cấu hình biến môi trường
app.use((req, res, next) => {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({
      error: 'Chưa cấu hình biến môi trường DATABASE_URL trên Vercel. Vui lòng vào Settings -> Environment Variables của dự án maiangi-two và thêm DATABASE_URL với chuỗi kết nối từ Supabase.',
    });
  }
  next();
});

// ============================================================================
// THUẬT TOÁN CHIA TIỀN & TỐI ƯU CHUYỂN KHOẢN (CHẠY TRÊN SERVERLESS FUNCTION)
// ============================================================================

interface KetQuaChiaTien {
  thanhVienId: number;
  balance: number;
  soTienNo: number;
  soTienDuocNhan: number;
}

function tinhTienBuoiToi(
  tongTien: number,
  nguoiAnIds: number[],
  nguoiTraTien: { thanhVienId: number; soTienDaTra: number }[],
  tatCaThanhVienIds: number[]
): KetQuaChiaTien[] {
  const soNguoiAn = nguoiAnIds.length;
  const tienMoiNguoi = soNguoiAn > 0 ? tongTien / soNguoiAn : 0;

  return tatCaThanhVienIds.map((thanhVienId) => {
    const isNguoiAn = nguoiAnIds.includes(thanhVienId);
    const paidRecord = nguoiTraTien.find((p) => p.thanhVienId === thanhVienId);
    const soTienDaTra = paidRecord ? paidRecord.soTienDaTra : 0;
    const soTienPhaiTra = isNguoiAn ? tienMoiNguoi : 0;
    const balance = soTienDaTra - soTienPhaiTra;

    return {
      thanhVienId,
      balance,
      soTienNo: balance < 0 ? Math.abs(balance) : 0,
      soTienDuocNhan: balance > 0 ? balance : 0,
    };
  });
}

function getThuVietnamese(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const date = parseInt(parts[2], 10);
    const d = new Date(year, month, date);
    const day = d.getDay();
    const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return days[day];
  }
  return 'Thứ 2';
}

function tinhChuyenKhoanTuUu(
  tatCaThanhVien: { id: number; ten: string }[],
  chiTietTongKet: { thanhVienId: number; netBalance: number }[]
): any[] {
  // Phân loại creditors (netBalance > 0.01) và debtors (netBalance < -0.01)
  const creditors = chiTietTongKet
    .filter(b => b.netBalance > 0.01)
    .map(b => ({
      id: b.thanhVienId,
      ten: tatCaThanhVien.find(tv => tv.id === b.thanhVienId)?.ten || `Thành viên #${b.thanhVienId}`,
      amount: b.netBalance
    }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = chiTietTongKet
    .filter(b => b.netBalance < -0.01)
    .map(b => ({
      id: b.thanhVienId,
      ten: tatCaThanhVien.find(tv => tv.id === b.thanhVienId)?.ten || `Thành viên #${b.thanhVienId}`,
      amount: Math.abs(b.netBalance)
    }))
    .sort((a, b) => b.amount - a.amount);

  const giaoDichs: any[] = [];
  let cIdx = 0;
  let dIdx = 0;

  // Bản sao để tránh đột biến
  const creditorAmounts = creditors.map(c => ({ ...c }));
  const debtorAmounts = debtors.map(d => ({ ...d }));

  while (cIdx < creditorAmounts.length && dIdx < debtorAmounts.length) {
    const creditor = creditorAmounts[cIdx];
    const debtor = debtorAmounts[dIdx];

    const soTien = Math.min(creditor.amount, debtor.amount);
    if (soTien > 0.01) {
      giaoDichs.push({
        tuThanhVienId: debtor.id,
        tuTen: debtor.ten,
        denThanhVienId: creditor.id,
        denTen: creditor.ten,
        soTien: Math.round(soTien * 100) / 100
      });
    }

    creditor.amount -= soTien;
    debtor.amount -= soTien;

    if (creditor.amount <= 0.01) cIdx++;
    if (debtor.amount <= 0.01) dIdx++;
  }

  return giaoDichs;
}

// ============================================================================
// API ROUTES
// ============================================================================

// Trang chủ hiển thị trạng thái hoạt động của Backend
app.get('/api', (req, res) => {
  res.send('Máy chủ Quản lý Ăn uống đang hoạt động mượt mà tại thư mục gốc!');
});

// 1. Thêm thành viên
app.post('/api/them-thanh-vien', async (req, res) => {
  try {
    const { ten, maNganHang, soTaiKhoan, tenTaiKhoan, qrCodeImage } = req.body;
    if (!ten || typeof ten !== 'string' || ten.trim() === '') {
      return res.status(400).json({ error: 'Tên thành viên không hợp lệ.' });
    }

    const result = await pool.query(
      'INSERT INTO thanh_vien (ten, ma_ngan_hang, so_tai_khoan, ten_tai_khoan, qr_code_image) VALUES ($1, $2, $3, $4, $5) RETURNING id, ten, ma_ngan_hang as "maNganHang", so_tai_khoan as "soTaiKhoan", ten_tai_khoan as "tenTaiKhoan", qr_code_image as "qrCodeImage"',
      [ten.trim(), maNganHang || null, soTaiKhoan || null, tenTaiKhoan || null, qrCodeImage || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
});

// 2. Lấy danh sách thành viên
app.get('/api/danh-sach-thanh-vien', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, ten, ma_ngan_hang as "maNganHang", so_tai_khoan as "soTaiKhoan", ten_tai_khoan as "tenTaiKhoan", qr_code_image as "qrCodeImage" FROM thanh_vien ORDER BY id ASC'
    );
    return res.json(result.rows);
  } catch (error: any) {
    logErrorToFile(error);
    console.error(error);
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
});

// 3. Cập nhật thành viên
app.put('/api/sua-thanh-vien/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ten, maNganHang, soTaiKhoan, tenTaiKhoan, qrCodeImage } = req.body;

    if (!ten || typeof ten !== 'string' || ten.trim() === '') {
      return res.status(400).json({ error: 'Tên thành viên không hợp lệ.' });
    }

    const result = await pool.query(
      'UPDATE thanh_vien SET ten = $1, ma_ngan_hang = $2, so_tai_khoan = $3, ten_tai_khoan = $4, qr_code_image = $5 WHERE id = $6 RETURNING id, ten, ma_ngan_hang as "maNganHang", so_tai_khoan as "soTaiKhoan", ten_tai_khoan as "tenTaiKhoan", qr_code_image as "qrCodeImage"',
      [ten.trim(), maNganHang || null, soTaiKhoan || null, tenTaiKhoan || null, qrCodeImage || null, Number(id)]
    );
    return res.json(result.rows[0]);
  } catch (error: any) {
    logErrorToFile(error);
    console.error(error);
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
});

// 4. Xóa thành viên
app.delete('/api/xoa-thanh-vien/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Database schema có ON DELETE CASCADE nên sẽ tự động xóa người ăn và người trả
    await pool.query('DELETE FROM thanh_vien WHERE id = $1', [Number(id)]);
    return res.json({ message: 'Đã xóa thành viên thành công.' });
  } catch (error: any) {
    logErrorToFile(error);
    console.error(error);
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
});

// 5. Thêm/Cập nhật bữa ăn tối (Transaction)
app.post('/api/them-bua-toi', async (req, res) => {
  const client = await pool.connect();
  try {
    const { thuTrongTuan, tongTien, ngayAn, nguoiAnIds, nguoiTraTien } = req.body;

    // Validation cơ bản
    if (!thuTrongTuan || typeof tongTien !== 'number' || tongTien < 0 || !ngayAn) {
      return res.status(400).json({ error: 'Dữ liệu đầu vào không hợp lệ.' });
    }
    if (!Array.isArray(nguoiAnIds) || nguoiAnIds.length === 0) {
      return res.status(400).json({ error: 'Phải có ít nhất một người ăn.' });
    }
    if (!Array.isArray(nguoiTraTien) || nguoiTraTien.length === 0) {
      return res.status(400).json({ error: 'Phải có ít nhất một người trả tiền.' });
    }

    await client.query('BEGIN');

    // So khớp ngày ăn bằng Date
    const dateObj = new Date(ngayAn);

    // Kiểm tra xem đã có bữa tối vào ngày này chưa
    const existing = await client.query('SELECT id FROM bua_toi WHERE ngay_an = $1', [dateObj]);
    if (existing.rows.length > 0) {
      const oldId = existing.rows[0].id;
      // Xóa bữa ăn cũ (ON DELETE CASCADE sẽ tự động xóa bản ghi ở bảng nguoi_an và nguoi_tra_tien)
      await client.query('DELETE FROM bua_toi WHERE id = $1', [oldId]);
    }

    // Thêm bữa tối mới
    const insertRes = await client.query(
      'INSERT INTO bua_toi (thu_trong_tuan, tong_tien, ngay_an) VALUES ($1, $2, $3) RETURNING id',
      [thuTrongTuan, tongTien, dateObj]
    );
    const buaToiId = insertRes.rows[0].id;

    // Thêm danh sách người ăn
    for (const tvId of nguoiAnIds) {
      await client.query(
        'INSERT INTO nguoi_an (bua_toi_id, thanh_vien_id) VALUES ($1, $2)',
        [buaToiId, tvId]
      );
    }

    // Thêm danh sách người trả tiền
    for (const ntt of nguoiTraTien) {
      await client.query(
        'INSERT INTO nguoi_tra_tien (bua_toi_id, thanh_vien_id, so_tien_da_tra) VALUES ($1, $2, $3)',
        [buaToiId, ntt.thanhVienId, ntt.soTienDaTra]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      id: buaToiId,
      thuTrongTuan,
      tongTien,
      ngayAn,
      nguoiAnIds,
      nguoiTraTien
    });
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK');
    }
    logErrorToFile(error);
    console.error(error);
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// 5.5. Thêm/Cập nhật chi phí khác (Transaction)
app.post('/api/them-chi-phi-khac', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id, moTa, tongTien, ngayChi, nguoiChiaIds, nguoiTraTien } = req.body;

    // Validation cơ bản
    if (!moTa || typeof tongTien !== 'number' || tongTien < 0 || !ngayChi) {
      return res.status(400).json({ error: 'Dữ liệu đầu vào không hợp lệ.' });
    }
    if (!Array.isArray(nguoiChiaIds) || nguoiChiaIds.length === 0) {
      return res.status(400).json({ error: 'Phải có ít nhất một người chia sẻ chi phí.' });
    }
    if (!Array.isArray(nguoiTraTien) || nguoiTraTien.length === 0) {
      return res.status(400).json({ error: 'Phải có ít nhất một người trả tiền.' });
    }

    await client.query('BEGIN');

    const dateObj = new Date(ngayChi);

    // Nếu sửa đổi chi phí cũ, xóa trước
    if (id) {
      await client.query('DELETE FROM chi_phi_khac WHERE id = $1', [Number(id)]);
    }

    const thuTrongTuan = getThuVietnamese(ngayChi);

    // Thêm chi phí khác mới vào bảng chi_phi_khac
    const insertRes = await client.query(
      "INSERT INTO chi_phi_khac (mo_ta, tong_tien, ngay_chi, thu_trong_tuan) VALUES ($1, $2, $3, $4) RETURNING id",
      [moTa.trim(), tongTien, dateObj, thuTrongTuan]
    );
    const chiPhiId = insertRes.rows[0].id;

    // Thêm danh sách người chia sẻ
    for (const tvId of nguoiChiaIds) {
      await client.query(
        'INSERT INTO nguoi_chia_chi_phi (chi_phi_id, thanh_vien_id) VALUES ($1, $2)',
        [chiPhiId, tvId]
      );
    }

    // Thêm danh sách người trả tiền
    for (const ntt of nguoiTraTien) {
      await client.query(
        'INSERT INTO nguoi_tra_chi_phi (chi_phi_id, thanh_vien_id, so_tien_da_tra) VALUES ($1, $2, $3)',
        [chiPhiId, ntt.thanhVienId, ntt.soTienDaTra]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      id: chiPhiId,
      moTa,
      tongTien,
      ngayAn: dateObj.toISOString(),
      nguoiAnIds: nguoiChiaIds,
      nguoiTraTien,
      loai: 'chi_phi_khac',
      thuTrongTuan
    });
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK');
    }
    logErrorToFile(error);
    console.error(error);
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// 6. Lấy danh sách bữa tối theo tuần (Gồm cả Bữa Tối và Chi Phí Khác từ 2 bảng khác nhau)
app.get('/api/danh-sach-bua-toi', async (req, res) => {
  try {
    const { ngayDauTuan } = req.query;
    let whereClauseDinner = '';
    let whereClauseExpense = '';
    let params: any[] = [];

    if (ngayDauTuan && typeof ngayDauTuan === 'string') {
      const startDate = new Date(ngayDauTuan);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      whereClauseDinner = 'WHERE b.ngay_an >= $1 AND b.ngay_an <= $2';
      whereClauseExpense = 'WHERE c.ngay_chi >= $1 AND c.ngay_chi <= $2';
      params = [startDate, endDate];
    }

    // 1. SELECT raw dinners and expenses
    const dinnersRes = await pool.query(`
      SELECT b.id, b.thu_trong_tuan as "thuTrongTuan", b.tong_tien as "tongTien", b.ngay_an as "ngayAn"
      FROM bua_toi b
      ${whereClauseDinner}
    `, params);

    const expensesRes = await pool.query(`
      SELECT c.id, c.thu_trong_tuan as "thuTrongTuan", c.tong_tien as "tongTien", c.ngay_chi as "ngayAn", c.mo_ta as "moTa"
      FROM chi_phi_khac c
      ${whereClauseExpense}
    `, params);

    // 2. SELECT relations for all meals/expenses
    const eatersRes = await pool.query('SELECT bua_toi_id, thanh_vien_id FROM nguoi_an');
    const payersRes = await pool.query('SELECT bua_toi_id, thanh_vien_id, so_tien_da_tra FROM nguoi_tra_tien');
    const cpEatersRes = await pool.query('SELECT chi_phi_id, thanh_vien_id FROM nguoi_chia_chi_phi');
    const cpPayersRes = await pool.query('SELECT chi_phi_id, thanh_vien_id, so_tien_da_tra FROM nguoi_tra_chi_phi');

    // 3. Map dinners
    const mappedDinners = dinnersRes.rows.map(row => {
      const buaToiId = row.id;
      const nguoiAnIds = eatersRes.rows
        .filter((r) => r.bua_toi_id === buaToiId)
        .map((r) => Number(r.thanh_vien_id));
      const nguoiTraTien = payersRes.rows
        .filter((r) => r.bua_toi_id === buaToiId)
        .map((r) => ({
          thanhVienId: Number(r.thanh_vien_id),
          soTienDaTra: Number(r.so_tien_da_tra)
        }));

      return {
        id: buaToiId,
        thuTrongTuan: row.thuTrongTuan || '',
        tongTien: Number(row.tongTien),
        ngayAn: row.ngayAn,
        loai: 'bua_toi',
        moTa: '',
        nguoiAnIds,
        nguoiTraTien
      };
    });

    // 4. Map expenses
    const mappedExpenses = expensesRes.rows.map(row => {
      const chiPhiId = row.id;
      const nguoiAnIds = cpEatersRes.rows
        .filter((r) => r.chi_phi_id === chiPhiId)
        .map((r) => Number(r.thanh_vien_id));
      const nguoiTraTien = cpPayersRes.rows
        .filter((r) => r.chi_phi_id === chiPhiId)
        .map((r) => ({
          thanhVienId: Number(r.thanh_vien_id),
          soTienDaTra: Number(r.so_tien_da_tra)
        }));

      return {
        id: chiPhiId,
        thuTrongTuan: row.thuTrongTuan || '',
        tongTien: Number(row.tongTien),
        ngayAn: row.ngayAn,
        loai: 'chi_phi_khac',
        moTa: row.moTa || '',
        nguoiAnIds,
        nguoiTraTien
      };
    });

    const merged = [...mappedDinners, ...mappedExpenses].sort((a, b) => new Date(a.ngayAn).getTime() - new Date(b.ngayAn).getTime());
    return res.json(merged);
  } catch (error: any) {
    logErrorToFile(error);
    console.error(error);
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
});

// 7. Tổng kết tuần và tối ưu hóa chuyển khoản
app.get('/api/tong-ket-tuan', async (req, res) => {
  try {
    const { ngayDauTuan } = req.query;
    if (!ngayDauTuan || typeof ngayDauTuan !== 'string') {
      return res.status(400).json({ error: 'Thiếu tham số ngayDauTuan.' });
    }

    // 1. Lấy tất cả thành viên
    const membersRes = await pool.query('SELECT id, ten FROM thanh_vien ORDER BY id ASC');
    const tatCaThanhVien = membersRes.rows;

    // 2. Lấy tất cả bữa ăn/chi phí trong tuần
    const startDate = new Date(ngayDauTuan);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const dinnersRes = await pool.query(`
      SELECT b.id, b.thu_trong_tuan as "thuTrongTuan", b.tong_tien as "tongTien", b.ngay_an as "ngayAn"
      FROM bua_toi b
      WHERE b.ngay_an >= $1 AND b.ngay_an <= $2
    `, [startDate, endDate]);

    const expensesRes = await pool.query(`
      SELECT c.id, c.thu_trong_tuan as "thuTrongTuan", c.tong_tien as "tongTien", c.ngay_chi as "ngayAn", c.mo_ta as "moTa"
      FROM chi_phi_khac c
      WHERE c.ngay_chi >= $1 AND c.ngay_chi <= $2
    `, [startDate, endDate]);

    // 3. Lấy tất cả quan hệ người ăn và người trả
    const eatersRes = await pool.query('SELECT bua_toi_id, thanh_vien_id FROM nguoi_an');
    const payersRes = await pool.query('SELECT bua_toi_id, thanh_vien_id, so_tien_da_tra FROM nguoi_tra_tien');
    const cpEatersRes = await pool.query('SELECT chi_phi_id, thanh_vien_id FROM nguoi_chia_chi_phi');
    const cpPayersRes = await pool.query('SELECT chi_phi_id, thanh_vien_id, so_tien_da_tra FROM nguoi_tra_chi_phi');

    const mappedDinners = dinnersRes.rows.map(row => {
      const buaToiId = row.id;
      const nguoiAnIds = eatersRes.rows
        .filter((r) => r.bua_toi_id === buaToiId)
        .map((r) => Number(r.thanh_vien_id));
      const nguoiTraTien = payersRes.rows
        .filter((r) => r.bua_toi_id === buaToiId)
        .map((r) => ({
          thanhVienId: Number(r.thanh_vien_id),
          soTienDaTra: Number(r.so_tien_da_tra)
        }));

      return {
        id: buaToiId,
        thuTrongTuan: row.thuTrongTuan || '',
        tongTien: Number(row.tongTien),
        ngayAn: row.ngayAn,
        loai: 'bua_toi',
        moTa: '',
        nguoiAnIds,
        nguoiTraTien
      };
    });

    const mappedExpenses = expensesRes.rows.map(row => {
      const chiPhiId = row.id;
      const nguoiAnIds = cpEatersRes.rows
        .filter((r) => r.chi_phi_id === chiPhiId)
        .map((r) => Number(r.thanh_vien_id));
      const nguoiTraTien = cpPayersRes.rows
        .filter((r) => r.chi_phi_id === chiPhiId)
        .map((r) => ({
          thanhVienId: Number(r.thanh_vien_id),
          soTienDaTra: Number(r.so_tien_da_tra)
        }));

      return {
        id: chiPhiId,
        thuTrongTuan: row.thuTrongTuan || '',
        tongTien: Number(row.tongTien),
        ngayAn: row.ngayAn,
        loai: 'chi_phi_khac',
        moTa: row.moTa || '',
        nguoiAnIds,
        nguoiTraTien
      };
    });

    const tatCaBuaToi = [...mappedDinners, ...mappedExpenses];

    const tatCaThanhVienIds = tatCaThanhVien.map((tv) => tv.id);
    const thanhVienBalancesMap = new Map<number, { tongNo: number; tongDuocNhan: number; netBalance: number }>();

    // Khởi tạo
    tatCaThanhVienIds.forEach((id) => {
      thanhVienBalancesMap.set(id, { tongNo: 0, tongDuocNhan: 0, netBalance: 0 });
    });

    // Cộng dồn kết quả phân chia
    for (const buaToi of tatCaBuaToi) {
      const result = tinhTienBuoiToi(
        buaToi.tongTien,
        buaToi.nguoiAnIds,
        buaToi.nguoiTraTien,
        tatCaThanhVienIds
      );

      result.forEach((res) => {
        const current = thanhVienBalancesMap.get(res.thanhVienId)!;
        thanhVienBalancesMap.set(res.thanhVienId, {
          tongNo: current.tongNo + res.soTienNo,
          tongDuocNhan: current.tongDuocNhan + res.soTienDuocNhan,
          netBalance: current.netBalance + res.balance,
        });
      });
    }

    // Gom kết quả chi tiết thành viên
    const chiTietTongKet = tatCaThanhVien.map((tv) => {
      const balance = thanhVienBalancesMap.get(tv.id)!;
      return {
        thanhVienId: tv.id,
        ten: tv.ten,
        tongNo: Math.round(balance.tongNo * 100) / 100,
        tongDuocNhan: Math.round(balance.tongDuocNhan * 100) / 100,
        netBalance: Math.round(balance.netBalance * 100) / 100,
      };
    });

    // Tính toán đối trừ chuyển khoản tối ưu (Simplify Debts)
    const danhSachChuyenKhoan = tinhChuyenKhoanTuUu(tatCaThanhVien, chiTietTongKet);

    return res.json({
      chiTietTongKet,
      danhSachChuyenKhoan,
    });
  } catch (error: any) {
    logErrorToFile(error);
    console.error(error);
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
});

// 8. Xóa bữa tối / Chi phí khác
app.delete('/api/xoa-bua-toi/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM bua_toi WHERE id = $1', [Number(id)]);
    await pool.query('DELETE FROM chi_phi_khac WHERE id = $1', [Number(id)]);
    return res.json({ message: 'Đã xóa bữa tối/chi phí thành công.' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
});


// Khởi chạy server nội bộ (khi dev offline)
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Express API server is running on port ${port}`);
  });
}

export default app;
