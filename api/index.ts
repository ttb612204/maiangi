import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Cấu hình Middleware
app.use(cors());
app.use(express.json());

// Khởi tạo PostgreSQL connection pool kết nối tới Supabase (fallback về chuỗi dummy nếu thiếu env để tránh crash khởi tạo)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
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

function tinhChuyenKhoanTrucTiep(
  tatCaThanhVien: { id: number; ten: string }[],
  tatCaBuaToi: any[]
): any[] {
  // map lưu trữ số tiền nợ song phương: pairwiseDebts[tuThanhVienId][denThanhVienId] = số tiền nợ dồn tích
  const pairwiseDebts: { [key: number]: { [key: number]: number } } = {};

  // Khởi tạo map nợ song phương bằng 0
  for (const tv1 of tatCaThanhVien) {
    pairwiseDebts[tv1.id] = {};
    for (const tv2 of tatCaThanhVien) {
      pairwiseDebts[tv1.id][tv2.id] = 0;
    }
  }

  // Duyệt qua từng bữa ăn
  for (const buaToi of tatCaBuaToi) {
    const tongTien = buaToi.tongTien;
    const nguoiAnIds = buaToi.nguoiAnIds;
    const nguoiTraTienList = buaToi.nguoiTraTien; // { thanhVienId: number; soTienDaTra: number }[]

    if (!nguoiAnIds || nguoiAnIds.length === 0 || tongTien <= 0) {
      continue;
    }

    const soNguoiAn = nguoiAnIds.length;
    const tienMoiNguoi = tongTien / soNguoiAn;

    // Tính balance của từng người cho bữa này
    // balance = số tiền đã trả - số tiền phải trả (nếu ăn)
    const dinnerBalances: { [key: number]: number } = {};
    for (const tv of tatCaThanhVien) {
      dinnerBalances[tv.id] = 0;
    }

    // Cộng số tiền đã trả
    for (const p of nguoiTraTienList) {
      dinnerBalances[p.thanhVienId] = (dinnerBalances[p.thanhVienId] || 0) + p.soTienDaTra;
    }

    // Trừ số tiền ăn
    for (const eaterId of nguoiAnIds) {
      dinnerBalances[eaterId] = (dinnerBalances[eaterId] || 0) - tienMoiNguoi;
    }

    // Phân loại chủ nợ (balance > 0) và con nợ (balance < 0) của bữa này
    const creditors: { id: number; amount: number }[] = [];
    const debtors: { id: number; amount: number }[] = [];

    for (const tv of tatCaThanhVien) {
      const bal = dinnerBalances[tv.id];
      if (bal > 0.01) {
        creditors.push({ id: tv.id, amount: bal });
      } else if (bal < -0.01) {
        debtors.push({ id: tv.id, amount: Math.abs(bal) });
      }
    }

    const sumCredits = creditors.reduce((sum, c) => sum + c.amount, 0);

    if (sumCredits > 0.01) {
      // Phân bổ nợ của từng debtor cho từng creditor theo tỷ lệ đóng góp của creditor
      for (const d of debtors) {
        for (const c of creditors) {
          const debtShare = d.amount * (c.amount / sumCredits);
          pairwiseDebts[d.id][c.id] += debtShare;
        }
      }
    }
  }

  // Thực hiện đối trừ song phương (A nợ B vs B nợ A)
  const giaoDichs: any[] = [];
  const ids = tatCaThanhVien.map(tv => tv.id);

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const u1 = ids[i];
      const u2 = ids[j];

      const u1OwesU2 = pairwiseDebts[u1][u2] || 0;
      const u2OwesU1 = pairwiseDebts[u2][u1] || 0;

      const tv1 = tatCaThanhVien.find(tv => tv.id === u1)!;
      const tv2 = tatCaThanhVien.find(tv => tv.id === u2)!;

      if (u1OwesU2 > u2OwesU1) {
        const netDebt = u1OwesU2 - u2OwesU1;
        if (netDebt > 0.01) {
          giaoDichs.push({
            tuThanhVienId: u1,
            tuTen: tv1.ten,
            denThanhVienId: u2,
            denTen: tv2.ten,
            soTien: Math.round(netDebt * 100) / 100,
          });
        }
      } else if (u2OwesU1 > u1OwesU2) {
        const netDebt = u2OwesU1 - u1OwesU2;
        if (netDebt > 0.01) {
          giaoDichs.push({
            tuThanhVienId: u2,
            tuTen: tv2.ten,
            denThanhVienId: u1,
            denTen: tv1.ten,
            soTien: Math.round(netDebt * 100) / 100,
          });
        }
      }
    }
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
    const { ten, maNganHang, soTaiKhoan, tenTaiKhoan } = req.body;
    if (!ten || typeof ten !== 'string' || ten.trim() === '') {
      return res.status(400).json({ error: 'Tên thành viên không hợp lệ.' });
    }

    const result = await pool.query(
      'INSERT INTO thanh_vien (ten, ma_ngan_hang, so_tai_khoan, ten_tai_khoan) VALUES ($1, $2, $3, $4) RETURNING id, ten, ma_ngan_hang as "maNganHang", so_tai_khoan as "soTaiKhoan", ten_tai_khoan as "tenTaiKhoan"',
      [ten.trim(), maNganHang || null, soTaiKhoan || null, tenTaiKhoan || null]
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
      'SELECT id, ten, ma_ngan_hang as "maNganHang", so_tai_khoan as "soTaiKhoan", ten_tai_khoan as "tenTaiKhoan" FROM thanh_vien ORDER BY id ASC'
    );
    return res.json(result.rows);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
});

// 3. Cập nhật thành viên
app.put('/api/sua-thanh-vien/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ten, maNganHang, soTaiKhoan, tenTaiKhoan } = req.body;

    if (!ten || typeof ten !== 'string' || ten.trim() === '') {
      return res.status(400).json({ error: 'Tên thành viên không hợp lệ.' });
    }

    const result = await pool.query(
      'UPDATE thanh_vien SET ten = $1, ma_ngan_hang = $2, so_tai_khoan = $3, ten_tai_khoan = $4 WHERE id = $5 RETURNING id, ten, ma_ngan_hang as "maNganHang", so_tai_khoan as "soTaiKhoan", ten_tai_khoan as "tenTaiKhoan"',
      [ten.trim(), maNganHang || null, soTaiKhoan || null, tenTaiKhoan || null, Number(id)]
    );
    return res.json(result.rows[0]);
  } catch (error: any) {
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
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  } finally {
    client.release();
  }
});

// 6. Lấy danh sách bữa tối theo tuần
app.get('/api/danh-sach-bua-toi', async (req, res) => {
  try {
    const { ngayDauTuan } = req.query;
    let whereClause = '';
    let params: any[] = [];

    if (ngayDauTuan && typeof ngayDauTuan === 'string') {
      const startDate = new Date(ngayDauTuan);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      whereClause = 'WHERE b.ngay_an >= $1 AND b.ngay_an <= $2';
      params = [startDate, endDate];
    }

    const sql = `
      SELECT 
        b.id,
        b.thu_trong_tuan as "thuTrongTuan",
        b.tong_tien as "tongTien",
        b.ngay_an as "ngayAn",
        COALESCE(
          (SELECT JSON_AGG(na.thanh_vien_id) FROM nguoi_an na WHERE na.bua_toi_id = b.id),
          '[]'::json
        ) as "nguoiAnIds",
        COALESCE(
          (SELECT JSON_AGG(JSON_BUILD_OBJECT('thanhVienId', ntt.thanh_vien_id, 'soTienDaTra', ntt.so_tien_da_tra)) 
           FROM nguoi_tra_tien ntt WHERE ntt.bua_toi_id = b.id),
          '[]'::json
        ) as "nguoiTraTien"
      FROM bua_toi b
      ${whereClause}
      ORDER BY b.ngay_an ASC
    `;

    const result = await pool.query(sql, params);
    
    // Format kiểu dữ liệu trả về cho chuẩn với frontend
    const formatted = result.rows.map(row => ({
      id: row.id,
      thuTrongTuan: row.thuTrongTuan,
      tongTien: Number(row.tongTien),
      ngayAn: row.ngayAn,
      nguoiAnIds: Array.isArray(row.nguoiAnIds) ? row.nguoiAnIds.map(Number) : [],
      nguoiTraTien: Array.isArray(row.nguoiTraTien) ? row.nguoiTraTien.map((ntt: any) => ({
        thanhVienId: Number(ntt.thanhVienId),
        soTienDaTra: Number(ntt.soTienDaTra)
      })) : []
    }));

    return res.json(formatted);
  } catch (error: any) {
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

    // 2. Lấy tất cả bữa ăn trong tuần
    const startDate = new Date(ngayDauTuan);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const dinnersSql = `
      SELECT 
        b.id,
        b.thu_trong_tuan as "thuTrongTuan",
        b.tong_tien as "tongTien",
        b.ngay_an as "ngayAn",
        COALESCE(
          (SELECT JSON_AGG(na.thanh_vien_id) FROM nguoi_an na WHERE na.bua_toi_id = b.id),
          '[]'::json
        ) as "nguoiAnIds",
        COALESCE(
          (SELECT JSON_AGG(JSON_BUILD_OBJECT('thanhVienId', ntt.thanh_vien_id, 'soTienDaTra', ntt.so_tien_da_tra)) 
           FROM nguoi_tra_tien ntt WHERE ntt.bua_toi_id = b.id),
          '[]'::json
        ) as "nguoiTraTien"
      FROM bua_toi b
      WHERE b.ngay_an >= $1 AND b.ngay_an <= $2
    `;
    const dinnersRes = await pool.query(dinnersSql, [startDate, endDate]);
    const tatCaBuaToi = dinnersRes.rows.map(row => ({
      id: row.id,
      thuTrongTuan: row.thuTrongTuan,
      tongTien: Number(row.tongTien),
      ngayAn: row.ngayAn,
      nguoiAnIds: Array.isArray(row.nguoiAnIds) ? row.nguoiAnIds.map(Number) : [],
      nguoiTraTien: Array.isArray(row.nguoiTraTien) ? row.nguoiTraTien.map((ntt: any) => ({
        thanhVienId: Number(ntt.thanhVienId),
        soTienDaTra: Number(ntt.soTienDaTra)
      })) : []
    }));

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

    // Tính toán đối trừ chuyển khoản trực tiếp song phương
    const danhSachChuyenKhoan = tinhChuyenKhoanTrucTiep(tatCaThanhVien, tatCaBuaToi);

    return res.json({
      chiTietTongKet,
      danhSachChuyenKhoan,
    });
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
