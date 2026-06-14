import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { tinhTongKetTuan } from '../services/tongKetService';

const prisma = new PrismaClient();

const getMondayStr = (dateInput: string) => {
  const d = new Date(dateInput);
  const day = d.getDay();
  // Nếu là Chủ nhật (0), chuyển ngày lùi lại 6 ngày để về Thứ 2
  // Nếu từ Thứ 2 đến Thứ 7, chuyển lùi (day - 1) ngày
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  const mon = new Date(d.setDate(diff));
  
  const y = mon.getFullYear();
  const m = String(mon.getMonth() + 1).padStart(2, '0');
  const date = String(mon.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
};

export const themBuaToi = async (req: Request, res: Response) => {
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

    // Validation tổng tiền người trả phải bằng tổng hóa đơn
    const tongTienDaTra = nguoiTraTien.reduce((sum, current) => sum + Number(current.soTienDaTra || 0), 0);
    
    // So sánh làm tròn để tránh sai số dấu phẩy động
    if (Math.abs(tongTienDaTra - tongTien) > 0.01) {
      return res.status(400).json({ error: 'Tổng tiền thanh toán không khớp' });
    }

    // Sử dụng transaction để tạo hoặc cập nhật bữa tối
    const result = await prisma.$transaction(async (tx) => {
      // Tìm xem ngày này đã có bữa tối chưa
      const buaToiHienTai = await tx.buaToi.findFirst({
        where: {
          ngayAn: new Date(ngayAn),
        },
      });

      // Nếu đã có, xóa bữa tối cũ để ghi đè (onDelete: Cascade sẽ tự động xóa nguoi_an và nguoi_tra_tien)
      if (buaToiHienTai) {
        await tx.buaToi.delete({
          where: {
            id: buaToiHienTai.id,
          },
        });
      }

      // Tạo bữa tối mới
      const buaToiMoi = await tx.buaToi.create({
        data: {
          thuTrongTuan,
          tongTien,
          ngayAn: new Date(ngayAn),
          nguoiAn: {
            create: nguoiAnIds.map((thanhVienId: number) => ({
              thanhVienId,
            })),
          },
          nguoiTraTien: {
            create: nguoiTraTien.map((ntt: any) => ({
              thanhVienId: ntt.thanhVienId,
              soTienDaTra: ntt.soTienDaTra,
            })),
          },
        },
        include: {
          nguoiAn: true,
          nguoiTraTien: true,
        },
      });

      return buaToiMoi;
    });

    // Sau khi thêm/sửa bữa tối, tự động tính lại tổng kết tuần cho đúng tuần đó
    await tinhTongKetTuan(getMondayStr(ngayAn));

    // Format kết quả đồng bộ với danhSachBuaToi để tránh lỗi crash React
    const formattedResult = {
      id: result.id,
      thuTrongTuan: result.thuTrongTuan,
      tongTien: Number(result.tongTien),
      ngayAn: result.ngayAn,
      nguoiAnIds: result.nguoiAn.map((na) => na.thanhVienId),
      nguoiTraTien: result.nguoiTraTien.map((ntt) => ({
        thanhVienId: ntt.thanhVienId,
        soTienDaTra: Number(ntt.soTienDaTra),
      })),
    };

    return res.status(201).json(formattedResult);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
};

export const danhSachBuaToi = async (req: Request, res: Response) => {
  try {
    const { ngayDauTuan } = req.query;
    let whereClause = {};

    if (ngayDauTuan && typeof ngayDauTuan === 'string') {
      const startDate = new Date(ngayDauTuan);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      whereClause = {
        ngayAn: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    const danhSach = await prisma.buaToi.findMany({
      where: whereClause,
      include: {
        nguoiAn: {
          select: {
            thanhVienId: true,
          },
        },
        nguoiTraTien: {
          select: {
            thanhVienId: true,
            soTienDaTra: true,
          },
        },
      },
      orderBy: {
        ngayAn: 'asc',
      },
    });

    // Format kết quả cho frontend dễ dùng
    const formatted = danhSach.map((bt) => ({
      id: bt.id,
      thuTrongTuan: bt.thuTrongTuan,
      tongTien: Number(bt.tongTien),
      ngayAn: bt.ngayAn,
      nguoiAnIds: bt.nguoiAn.map((na) => na.thanhVienId),
      nguoiTraTien: bt.nguoiTraTien.map((ntt) => ({
        thanhVienId: ntt.thanhVienId,
        soTienDaTra: Number(ntt.soTienDaTra),
      })),
    }));

    return res.json(formatted);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
};

export const layTongKetTuan = async (req: Request, res: Response) => {
  try {
    const { ngayDauTuan } = req.query;
    const result = await tinhTongKetTuan(ngayDauTuan as string | undefined);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
};
