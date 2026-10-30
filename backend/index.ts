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
    fs.appendFileSync('c:/Users/Pi/Music/quanlyanuong/backend/error.log', message);
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
let isDbInitialized = false;

app.use(async (req, res, next) => {
  if (isDbInitialized) {
    return next();
  }
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

      CREATE TABLE IF NOT EXISTS trang_thai_chuyen_khoan (
        id SERIAL PRIMARY KEY,
        ngay_dau_tuan DATE NOT NULL,
        tu_thanh_vien_id INT REFERENCES thanh_vien(id) ON DELETE CASCADE,
        den_thanh_vien_id INT REFERENCES thanh_vien(id) ON DELETE CASCADE,
        da_tra BOOLEAN DEFAULT FALSE,
        so_tien NUMERIC(12, 2) DEFAULT 0,
        UNIQUE(ngay_dau_tuan, tu_thanh_vien_id, den_thanh_vien_id)
      );

      ALTER TABLE trang_thai_chuyen_khoan
      ADD COLUMN IF NOT EXISTS so_tien NUMERIC(12, 2) DEFAULT 0;

      ALTER TABLE nguoi_an
      ADD COLUMN IF NOT EXISTS so_tien NUMERIC(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS so_tien_rieng NUMERIC(12, 2) DEFAULT 0;

      ALTER TABLE nguoi_chia_chi_phi
      ADD COLUMN IF NOT EXISTS so_tien NUMERIC(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS so_tien_rieng NUMERIC(12, 2) DEFAULT 0;

      ALTER TABLE bua_toi
      ADD COLUMN IF NOT EXISTS tien_chung NUMERIC(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS kem_bua_trua BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS cac_bua_kem JSONB DEFAULT '[]'::jsonb;

      ALTER TABLE chi_phi_khac
      ADD COLUMN IF NOT EXISTS tien_chung NUMERIC(12, 2) DEFAULT 0;
    `);

    // 2. Dọn dẹp bảng bua_toi: Xóa các cột loai và mo_ta thừa vì đã dùng bảng chi_phi_khac riêng biệt
    await pool.query(`
      ALTER TABLE bua_toi 
      DROP COLUMN IF EXISTS loai,
      DROP COLUMN IF EXISTS mo_ta;
    `);
    console.log('Database migration: Checked and initialized tables.');
    isDbInitialized = true;
    next();
  } catch (err) {
    console.error('Database migration error:', err);
    // Vẫn tiếp tục chạy để không block request
    next();
  }
});

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
  tatCaThanhVienIds: number[],
  chiTietNguoiAn?: { thanhVienId: number; soTien?: number }[]
): KetQuaChiaTien[] {
  const soNguoiAn = nguoiAnIds.length;
  const tienMoiNguoi = soNguoiAn > 0 ? tongTien / soNguoiAn : 0;

  return tatCaThanhVienIds.map((thanhVienId) => {
    const isNguoiAn = nguoiAnIds.includes(thanhVienId);
    const paidRecord = nguoiTraTien.find((p) => p.thanhVienId === thanhVienId);
    const soTienDaTra = paidRecord ? paidRecord.soTienDaTra : 0;
    
    let soTienPhaiTra = 0;
    if (isNguoiAn) {
      const detailed = chiTietNguoiAn?.find((c) => c.thanhVienId === thanhVienId);
      if (detailed && Number(detailed.soTien) > 0) {
        soTienPhaiTra = Number(detailed.soTien);
      } else {
        soTienPhaiTra = tienMoiNguoi;
      }
    }
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

function tinhChuyenKhoanSongPhuong(
  tatCaThanhVien: { id: number; ten: string }[],
  tatCaBuaToi: any[],
  paidMap?: Map<string, { daTra: boolean; soTien: number }>
): any[] {
  const netOwed = new Map<string, number>();
  const getOwedKey = (fromId: number, toId: number) => `${fromId}-${toId}`;
  
  for (const bt of tatCaBuaToi) {
    const countNguoiAn = bt.nguoiAnIds?.length || 0;
    if (countNguoiAn === 0) continue;
    const tienMoiNguoi = bt.tongTien / countNguoiAn;
    
    // Tính tổng số tiền đã trả thực tế của buổi này
    const totalPaid = bt.nguoiTraTien?.reduce((sum: number, p: any) => sum + p.soTienDaTra, 0) || 0;
    if (totalPaid === 0) continue;
    
    // Với mỗi người ăn B
    for (const B of bt.nguoiAnIds) {
      const detailed = bt.chiTietNguoiAn?.find((c: any) => c.thanhVienId === B);
      const tienMoiNguoi = (detailed && Number(detailed.soTien) > 0) ? Number(detailed.soTien) : (bt.tongTien / countNguoiAn);

      // Mỗi người trả tiền A tài trợ cho B một phần
      for (const p of bt.nguoiTraTien) {
        if (p.soTienDaTra <= 0) continue;
        const A = p.thanhVienId;
        if (A === B) continue; // Không nợ chính mình
        
        // A tài trợ: (p.soTienDaTra / totalPaid) * tienMoiNguoi
        const fundedAmount = (p.soTienDaTra / totalPaid) * tienMoiNguoi;
        const key = getOwedKey(B, A); // B nợ A
        netOwed.set(key, (netOwed.get(key) || 0) + fundedAmount);
      }
    }
  }
  
  // Tổng hợp và cấn trừ song phương
  const giaoDichs: any[] = [];
  for (let i = 0; i < tatCaThanhVien.length; i++) {
    for (let j = i + 1; j < tatCaThanhVien.length; j++) {
      const u = tatCaThanhVien[i];
      const v = tatCaThanhVien[j];
      
      const diff = netOwed.get(getOwedKey(u.id, v.id)) || 0;
      const vOwesU = netOwed.get(getOwedKey(v.id, u.id)) || 0;
      const netDiff = diff - vOwesU;
      
      const uPaidV_rec = paidMap?.get(`${u.id}-${v.id}`);
      const uPaidV_raw = uPaidV_rec?.daTra ? Number(uPaidV_rec.soTien || 0) : 0;
      const uPaidV_amount = uPaidV_raw > 0.01 ? uPaidV_raw : (uPaidV_rec?.daTra ? diff : 0);
      
      const vPaidU_rec = paidMap?.get(`${v.id}-${u.id}`);
      const vPaidU_raw = vPaidU_rec?.daTra ? Number(vPaidU_rec.soTien || 0) : 0;
      const vPaidU_amount = vPaidU_raw > 0.01 ? vPaidU_raw : (vPaidU_rec?.daTra ? vOwesU : 0);
      
      const uOwesV_unpaid = Math.max(0, diff - uPaidV_amount);
      const vOwesU_unpaid = Math.max(0, vOwesU - vPaidU_amount);
      
      const unpaidDiff = uOwesV_unpaid - vOwesU_unpaid;
      
      if (unpaidDiff > 0.01) {
        // Net unpaid direction is u -> v
        giaoDichs.push({
          tuThanhVienId: u.id,
          tuTen: u.ten,
          denThanhVienId: v.id,
          denTen: v.ten,
          soTien: Math.round(unpaidDiff * 100) / 100,
          tongTien: Math.round((uPaidV_amount + unpaidDiff) * 100) / 100,
          daTra: false,
          daTraTruoc: Math.round(uPaidV_amount * 100) / 100
        });
      } else if (unpaidDiff < -0.01) {
        // Net unpaid direction is v -> u
        const unpaidAmount = Math.abs(unpaidDiff);
        giaoDichs.push({
          tuThanhVienId: v.id,
          tuTen: v.ten,
          denThanhVienId: u.id,
          denTen: u.ten,
          soTien: Math.round(unpaidAmount * 100) / 100,
          tongTien: Math.round((vPaidU_amount + unpaidAmount) * 100) / 100,
          daTra: false,
          daTraTruoc: Math.round(vPaidU_amount * 100) / 100
        });
      } else {
        // Fully paid: unpaidDiff is zero. The direction of completed transaction matches the original meal debt direction netDiff.
        if (netDiff > 0.01) {
          giaoDichs.push({
            tuThanhVienId: u.id,
            tuTen: u.ten,
            denThanhVienId: v.id,
            denTen: v.ten,
            soTien: Math.round(netDiff * 100) / 100,
            tongTien: Math.round(netDiff * 100) / 100,
            daTra: true,
            daTraTruoc: Math.round(uPaidV_amount * 100) / 100
          });
        } else if (netDiff < -0.01) {
          const absDiff = Math.abs(netDiff);
          giaoDichs.push({
            tuThanhVienId: v.id,
            tuTen: v.ten,
            denThanhVienId: u.id,
            denTen: u.ten,
            soTien: Math.round(absDiff * 100) / 100,
            tongTien: Math.round(absDiff * 100) / 100,
            daTra: true,
            daTraTruoc: Math.round(vPaidU_amount * 100) / 100
          });
        }
      }
    }
  }
  
  return giaoDichs.sort((a, b) => b.soTien - a.soTien);
}

// ============================================================================
// API ROUTES
// ============================================================================

// Trang chủ hiển thị trạng thái hoạt động của Backend
app.get('/api', (req, res) => {
  res.send('Máy chủ Quản lý Ăn uống đang hoạt động mượt mà tại thư mục gốc!');
});

// Test Database Connection
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    return res.json({
      status: 'success',
      time: result.rows[0].now,
      envExisted: !!process.env.DATABASE_URL
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack,
      envExisted: !!process.env.DATABASE_URL
    });
  }
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
    return res.status(500).json({ 
      error: error.message || 'Lỗi hệ thống.',
      stack: error.stack,
      envExisted: !!process.env.DATABASE_URL
    });
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
    const { id, tongTien, ngayAn, nguoiAnIds, nguoiTraTien, tienChung, kemBuaTrua, cacBuaKem } = req.body;
    let thuTrongTuan = req.body.thuTrongTuan;
    if (!thuTrongTuan && ngayAn) {
      thuTrongTuan = getThuVietnamese(ngayAn);
    }

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

    if (id) {
      await client.query('DELETE FROM bua_toi WHERE id = $1', [Number(id)]);
    } else {
      // Kiểm tra xem đã có bữa tối vào ngày này chưa
      const existing = await client.query('SELECT id FROM bua_toi WHERE ngay_an = $1', [dateObj]);
      if (existing.rows.length > 0) {
        const oldId = existing.rows[0].id;
        await client.query('DELETE FROM bua_toi WHERE id = $1', [oldId]);
      }
    }

    // Chuẩn hóa danh sách các bữa kèm
    let jsonCacBuaKem = JSON.stringify([]);
    if (Array.isArray(cacBuaKem)) {
      jsonCacBuaKem = JSON.stringify(cacBuaKem);
    } else if (kemBuaTrua) {
      // Tương thích ngược nếu gửi cờ cũ
      jsonCacBuaKem = JSON.stringify([{ loaiBua: 'trua', ngay: ngayAn, moTa: 'Trưa hôm sau' }]);
    }

    // Thêm bữa tối mới kèm tiền chung và danh sách bữa kèm
    const insertRes = await client.query(
      'INSERT INTO bua_toi (thu_trong_tuan, tong_tien, ngay_an, tien_chung, kem_bua_trua, cac_bua_kem) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [thuTrongTuan, tongTien, dateObj, Number(tienChung || 0), !!kemBuaTrua, jsonCacBuaKem]
    );
    const buaToiId = insertRes.rows[0].id;

    // Thêm danh sách người ăn kèm số tiền
    const chiTietNguoiAn = req.body.chiTietNguoiAn;
    if (Array.isArray(chiTietNguoiAn) && chiTietNguoiAn.length > 0) {
      for (const item of chiTietNguoiAn) {
        await client.query(
          'INSERT INTO nguoi_an (bua_toi_id, thanh_vien_id, so_tien, so_tien_rieng) VALUES ($1, $2, $3, $4)',
          [buaToiId, Number(item.thanhVienId), Number(item.soTien || 0), Number(item.soTienRieng || 0)]
        );
      }
    } else {
      const perEater = nguoiAnIds.length > 0 ? tongTien / nguoiAnIds.length : 0;
      for (const tvId of nguoiAnIds) {
        await client.query(
          'INSERT INTO nguoi_an (bua_toi_id, thanh_vien_id, so_tien, so_tien_rieng) VALUES ($1, $2, $3, $4)',
          [buaToiId, Number(tvId), perEater, 0]
        );
      }
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
      tienChung: Number(tienChung || 0),
      kemBuaTrua: !!kemBuaTrua,
      cacBuaKem: Array.isArray(cacBuaKem) ? cacBuaKem : [],
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
    const { id, moTa, tongTien, ngayChi, nguoiChiaIds, nguoiTraTien, tienChung } = req.body;

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
      "INSERT INTO chi_phi_khac (mo_ta, tong_tien, ngay_chi, thu_trong_tuan, tien_chung) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [moTa.trim(), tongTien, dateObj, thuTrongTuan, Number(tienChung || 0)]
    );
    const chiPhiId = insertRes.rows[0].id;

    // Thêm danh sách người chia sẻ kèm số tiền
    const chiTietNguoiChia = req.body.chiTietNguoiChia;
    if (Array.isArray(chiTietNguoiChia) && chiTietNguoiChia.length > 0) {
      for (const item of chiTietNguoiChia) {
        await client.query(
          'INSERT INTO nguoi_chia_chi_phi (chi_phi_id, thanh_vien_id, so_tien, so_tien_rieng) VALUES ($1, $2, $3, $4)',
          [chiPhiId, Number(item.thanhVienId), Number(item.soTien || 0), Number(item.soTienRieng || 0)]
        );
      }
    } else {
      const perEater = nguoiChiaIds.length > 0 ? tongTien / nguoiChiaIds.length : 0;
      for (const tvId of nguoiChiaIds) {
        await client.query(
          'INSERT INTO nguoi_chia_chi_phi (chi_phi_id, thanh_vien_id, so_tien, so_tien_rieng) VALUES ($1, $2, $3, $4)',
          [chiPhiId, Number(tvId), perEater, 0]
        );
      }
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
      tienChung: Number(tienChung || 0),
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

// 6. Lấy danh sách bữa tối (Gồm cả Bữa Tối và Chi Phí Khác từ 2 bảng khác nhau)
app.get('/api/danh-sach-bua-toi', async (req, res) => {
  try {
    const { ngayDauTuan } = req.query;
    let whereClauseDinner = '';
    let whereClauseExpense = '';
    let params: any[] = [];

    if (ngayDauTuan && typeof ngayDauTuan === 'string' && ngayDauTuan !== 'all' && ngayDauTuan !== '1970-01-01') {
      const startDate = new Date(ngayDauTuan);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      whereClauseDinner = 'WHERE b.ngay_an >= $1 AND b.ngay_an <= $2';
      whereClauseExpense = 'WHERE c.ngay_chi >= $1 AND c.ngay_chi <= $2';
      params = [startDate, endDate];
    }

    // 1. SELECT raw dinners and expenses
    const dinnersRes = await pool.query(`
      SELECT b.id, b.thu_trong_tuan as "thuTrongTuan", b.tong_tien as "tongTien", b.ngay_an as "ngayAn", COALESCE(b.tien_chung, 0) as "tienChung", COALESCE(b.kem_bua_trua, false) as "kemBuaTrua", COALESCE(b.cac_bua_kem, '[]'::jsonb) as "cacBuaKem"
      FROM bua_toi b
      ${whereClauseDinner}
    `, params);

    const expensesRes = await pool.query(`
      SELECT c.id, c.thu_trong_tuan as "thuTrongTuan", c.tong_tien as "tongTien", c.ngay_chi as "ngayAn", c.mo_ta as "moTa", COALESCE(c.tien_chung, 0) as "tienChung"
      FROM chi_phi_khac c
      ${whereClauseExpense}
    `, params);

    // 2. SELECT relations for all meals/expenses
    const eatersRes = await pool.query('SELECT bua_toi_id, thanh_vien_id, COALESCE(so_tien, 0) as so_tien, COALESCE(so_tien_rieng, 0) as so_tien_rieng FROM nguoi_an');
    const payersRes = await pool.query('SELECT bua_toi_id, thanh_vien_id, so_tien_da_tra FROM nguoi_tra_tien');
    const cpEatersRes = await pool.query('SELECT chi_phi_id, thanh_vien_id, COALESCE(so_tien, 0) as so_tien, COALESCE(so_tien_rieng, 0) as so_tien_rieng FROM nguoi_chia_chi_phi');
    const cpPayersRes = await pool.query('SELECT chi_phi_id, thanh_vien_id, so_tien_da_tra FROM nguoi_tra_chi_phi');

    // 3. Map dinners
    const mappedDinners = dinnersRes.rows.map(row => {
      const buaToiId = row.id;
      const chiTietNguoiAn = eatersRes.rows
        .filter((r) => r.bua_toi_id === buaToiId)
        .map((r) => ({
          thanhVienId: Number(r.thanh_vien_id),
          soTien: Number(r.so_tien || 0),
          soTienRieng: Number(r.so_tien_rieng || 0),
        }));
      const nguoiAnIds = chiTietNguoiAn.map(r => r.thanhVienId);
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
        tienChung: Number(row.tienChung || 0),
        kemBuaTrua: !!row.kemBuaTrua,
        cacBuaKem: Array.isArray(row.cacBuaKem) ? row.cacBuaKem : [],
        ngayAn: row.ngayAn,
        loai: 'bua_toi',
        moTa: '',
        nguoiAnIds,
        chiTietNguoiAn,
        nguoiTraTien
      };
    });

    // 4. Map expenses
    const mappedExpenses = expensesRes.rows.map(row => {
      const chiPhiId = row.id;
      const chiTietNguoiAn = cpEatersRes.rows
        .filter((r) => r.chi_phi_id === chiPhiId)
        .map((r) => ({
          thanhVienId: Number(r.thanh_vien_id),
          soTien: Number(r.so_tien || 0),
          soTienRieng: Number(r.so_tien_rieng || 0),
        }));
      const nguoiAnIds = chiTietNguoiAn.map(r => r.thanhVienId);
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
        tienChung: Number(row.tienChung || 0),
        ngayAn: row.ngayAn,
        loai: 'chi_phi_khac',
        moTa: row.moTa || '',
        nguoiAnIds,
        chiTietNguoiAn,
        nguoiTraTien
      };
    });

    // Sắp xếp ngày mới nhất lên đầu
    const merged = [...mappedDinners, ...mappedExpenses].sort((a, b) => new Date(b.ngayAn).getTime() - new Date(a.ngayAn).getTime());
    return res.json(merged);
  } catch (error: any) {
    logErrorToFile(error);
    console.error(error);
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
});

// 7. Tổng kết (Tuần hoặc Toàn bộ) và tối ưu hóa chuyển khoản
app.get(['/api/tong-ket-tuan', '/api/tong-ket'], async (req, res) => {
  try {
    const { ngayDauTuan } = req.query;
    const isAllTime = !ngayDauTuan || ngayDauTuan === 'all' || ngayDauTuan === '1970-01-01';

    // 1. Lấy tất cả thành viên
    const membersRes = await pool.query('SELECT id, ten FROM thanh_vien ORDER BY id ASC');
    const tatCaThanhVien = membersRes.rows;

    let whereClauseDinner = '';
    let whereClauseExpense = '';
    let queryParams: any[] = [];

    if (!isAllTime && typeof ngayDauTuan === 'string') {
      const startDate = new Date(ngayDauTuan);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      whereClauseDinner = 'WHERE b.ngay_an >= $1 AND b.ngay_an <= $2';
      whereClauseExpense = 'WHERE c.ngay_chi >= $1 AND c.ngay_chi <= $2';
      queryParams = [startDate, endDate];
    }

    const dinnersRes = await pool.query(`
      SELECT b.id, b.thu_trong_tuan as "thuTrongTuan", b.tong_tien as "tongTien", b.ngay_an as "ngayAn", COALESCE(b.tien_chung, 0) as "tienChung", COALESCE(b.kem_bua_trua, false) as "kemBuaTrua", COALESCE(b.cac_bua_kem, '[]'::jsonb) as "cacBuaKem"
      FROM bua_toi b
      ${whereClauseDinner}
    `, queryParams);

    const expensesRes = await pool.query(`
      SELECT c.id, c.thu_trong_tuan as "thuTrongTuan", c.tong_tien as "tongTien", c.ngay_chi as "ngayAn", c.mo_ta as "moTa", COALESCE(c.tien_chung, 0) as "tienChung"
      FROM chi_phi_khac c
      ${whereClauseExpense}
    `, queryParams);

    // 3. Lấy tất cả quan hệ người ăn và người trả
    const eatersRes = await pool.query('SELECT bua_toi_id, thanh_vien_id, COALESCE(so_tien, 0) as so_tien, COALESCE(so_tien_rieng, 0) as so_tien_rieng FROM nguoi_an');
    const payersRes = await pool.query('SELECT bua_toi_id, thanh_vien_id, so_tien_da_tra FROM nguoi_tra_tien');
    const cpEatersRes = await pool.query('SELECT chi_phi_id, thanh_vien_id, COALESCE(so_tien, 0) as so_tien, COALESCE(so_tien_rieng, 0) as so_tien_rieng FROM nguoi_chia_chi_phi');
    const cpPayersRes = await pool.query('SELECT chi_phi_id, thanh_vien_id, so_tien_da_tra FROM nguoi_tra_chi_phi');

    const mappedDinners = dinnersRes.rows.map(row => {
      const buaToiId = row.id;
      const chiTietNguoiAn = eatersRes.rows
        .filter((r) => r.bua_toi_id === buaToiId)
        .map((r) => ({
          thanhVienId: Number(r.thanh_vien_id),
          soTien: Number(r.so_tien || 0),
          soTienRieng: Number(r.so_tien_rieng || 0),
        }));
      const nguoiAnIds = chiTietNguoiAn.map(r => r.thanhVienId);
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
        tienChung: Number(row.tienChung || 0),
        kemBuaTrua: !!row.kemBuaTrua,
        cacBuaKem: Array.isArray(row.cacBuaKem) ? row.cacBuaKem : [],
        ngayAn: row.ngayAn,
        loai: 'bua_toi',
        moTa: '',
        nguoiAnIds,
        chiTietNguoiAn,
        nguoiTraTien
      };
    });

    const mappedExpenses = expensesRes.rows.map(row => {
      const chiPhiId = row.id;
      const chiTietNguoiAn = cpEatersRes.rows
        .filter((r) => r.chi_phi_id === chiPhiId)
        .map((r) => ({
          thanhVienId: Number(r.thanh_vien_id),
          soTien: Number(r.so_tien || 0),
          soTienRieng: Number(r.so_tien_rieng || 0),
        }));
      const nguoiAnIds = chiTietNguoiAn.map(r => r.thanhVienId);
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
        tienChung: Number(row.tienChung || 0),
        ngayAn: row.ngayAn,
        loai: 'chi_phi_khac',
        moTa: row.moTa || '',
        nguoiAnIds,
        chiTietNguoiAn,
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
        tatCaThanhVienIds,
        buaToi.chiTietNguoiAn
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

    // Lấy trạng thái đã trả tiền từ DB
    const paidMap = new Map<string, { daTra: boolean; soTien: number }>();
    if (isAllTime) {
      const statusRes = await pool.query(
        `SELECT tu_thanh_vien_id, den_thanh_vien_id, bool_or(da_tra) as da_tra, SUM(COALESCE(so_tien, 0)) as so_tien 
         FROM trang_thai_chuyen_khoan 
         WHERE da_tra = true
         GROUP BY tu_thanh_vien_id, den_thanh_vien_id`
      );
      statusRes.rows.forEach((r) => {
        paidMap.set(`${r.tu_thanh_vien_id}-${r.den_thanh_vien_id}`, {
          daTra: !!r.da_tra,
          soTien: Number(r.so_tien || 0),
        });
      });
    } else {
      const statusRes = await pool.query(
        'SELECT tu_thanh_vien_id, den_thanh_vien_id, da_tra, COALESCE(so_tien, 0) as so_tien FROM trang_thai_chuyen_khoan WHERE ngay_dau_tuan = $1',
        [ngayDauTuan]
      );
      statusRes.rows.forEach((r) => {
        paidMap.set(`${r.tu_thanh_vien_id}-${r.den_thanh_vien_id}`, {
          daTra: !!r.da_tra,
          soTien: Number(r.so_tien || 0),
        });
      });
    }

    // Tính toán đối trừ chuyển khoản trực tiếp song phương có xét đến các khoản đã thanh toán trước
    const danhSachChuyenKhoan = tinhChuyenKhoanSongPhuong(tatCaThanhVien, tatCaBuaToi, paidMap);

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

// 9. Cập nhật trạng thái chuyển khoản (đã trả / chưa trả)
app.post('/api/toggle-chuyen-khoan', async (req, res) => {
  try {
    const { ngayDauTuan, tuThanhVienId, denThanhVienId, daTra, soTien } = req.body;
    if (!tuThanhVienId || !denThanhVienId) {
      return res.status(400).json({ error: 'Thiếu thông tin cập nhật.' });
    }

    const isAllTime = !ngayDauTuan || ngayDauTuan === 'all' || ngayDauTuan === '1970-01-01';

    if (isAllTime) {
      // Xóa các bản ghi cũ của cặp này để quản lý trạng thái gộp toàn bộ
      await pool.query(
        'DELETE FROM trang_thai_chuyen_khoan WHERE tu_thanh_vien_id = $1 AND den_thanh_vien_id = $2',
        [Number(tuThanhVienId), Number(denThanhVienId)]
      );
      if (daTra) {
        await pool.query(`
          INSERT INTO trang_thai_chuyen_khoan (ngay_dau_tuan, tu_thanh_vien_id, den_thanh_vien_id, da_tra, so_tien)
          VALUES ('1970-01-01', $1, $2, true, $3)
        `, [Number(tuThanhVienId), Number(denThanhVienId), Number(soTien || 0)]);
      }
    } else {
      // Upsert trạng thái đã trả tiền theo tuần
      await pool.query(`
        INSERT INTO trang_thai_chuyen_khoan (ngay_dau_tuan, tu_thanh_vien_id, den_thanh_vien_id, da_tra, so_tien)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (ngay_dau_tuan, tu_thanh_vien_id, den_thanh_vien_id)
        DO UPDATE SET da_tra = EXCLUDED.da_tra, so_tien = EXCLUDED.so_tien
      `, [ngayDauTuan, Number(tuThanhVienId), Number(denThanhVienId), !!daTra, Number(soTien || 0)]);
    }

    return res.json({ message: 'Cập nhật trạng thái chuyển khoản thành công.' });
  } catch (error: any) {
    logErrorToFile(error);
    console.error(error);
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
});

// 10. Xóa tất cả dữ liệu (Reset hệ thống)
app.post('/api/xoa-tat-ca-du-lieu', async (req, res) => {
  const client = await pool.connect();
  try {
    const { xoaThanhVien } = req.body;
    await client.query('BEGIN');

    await client.query('DELETE FROM bua_toi');
    await client.query('DELETE FROM chi_phi_khac');
    await client.query('DELETE FROM trang_thai_chuyen_khoan');

    if (xoaThanhVien) {
      await client.query('DELETE FROM thanh_vien');
    }

    await client.query('COMMIT');
    return res.json({ 
      message: xoaThanhVien 
        ? 'Đã xóa toàn bộ dữ liệu bao gồm thành viên thành công.' 
        : 'Đã xóa tất cả bữa ăn và chi phí thành công, giữ lại danh sách thành viên.' 
    });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    logErrorToFile(error);
    console.error(error);
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  } finally {
    if (client) client.release();
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
