import { PrismaClient } from '@prisma/client';
import { tinhTienBuoiToi } from './tinhTienService';

const prisma = new PrismaClient();

export interface GiaoDich {
  tuThanhVienId: number;
  tuTen: string;
  denThanhVienId: number;
  denTen: string;
  soTien: number;
}

export interface ChiTietThanhVienTongKet {
  thanhVienId: number;
  ten: string;
  tongNo: number;
  tongDuocNhan: number;
  netBalance: number;
}

/**
 * Tối ưu hóa các giao dịch chuyển khoản giữa các thành viên.
 * @param balances Danh sách số dư ròng của các thành viên (netBalance = thực trả - thực ăn)
 */
export function toiUuChuyenKhoan(
  balances: { thanhVienId: number; ten: string; netBalance: number }[]
): GiaoDich[] {
  // Tách thành 2 nhóm: Chủ nợ (netBalance > 0.01) và Con nợ (netBalance < -0.01)
  const creditors = balances
    .filter((b) => b.netBalance > 0.01)
    .map((b) => ({ ...b, amount: b.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter((b) => b.netBalance < -0.01)
    .map((b) => ({ ...b, amount: Math.abs(b.netBalance) }))
    .sort((a, b) => b.amount - a.amount);

  const giaoDichs: GiaoDich[] = [];

  let cIdx = 0;
  let dIdx = 0;

  while (cIdx < creditors.length && dIdx < debtors.length) {
    const creditor = creditors[cIdx];
    const debtor = debtors[dIdx];

    const transferAmount = Math.min(creditor.amount, debtor.amount);
    
    if (transferAmount > 0.01) {
      giaoDichs.push({
        tuThanhVienId: debtor.thanhVienId,
        tuTen: debtor.ten,
        denThanhVienId: creditor.thanhVienId,
        denTen: creditor.ten,
        soTien: Math.round(transferAmount * 100) / 100, // Làm tròn đến 2 chữ số thập phân
      });
    }

    creditor.amount -= transferAmount;
    debtor.amount -= transferAmount;

    if (creditor.amount <= 0.01) {
      cIdx++;
    }
    if (debtor.amount <= 0.01) {
      dIdx++;
    }
  }

  return giaoDichs;
}

/**
 * Tính toán tổng kết tuần và cập nhật bảng tong_ket_tuan
 */
export async function tinhTongKetTuan(ngayDauTuanStr?: string) {
  const tatCaThanhVien = await prisma.thanhVien.findMany();
  
  let whereClause = {};
  if (ngayDauTuanStr) {
    const startDate = new Date(ngayDauTuanStr);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    whereClause = {
      ngayAn: {
        gte: startDate,
        lte: endDate,
      },
    };
  }

  const tatCaBuaToi = await prisma.buaToi.findMany({
    where: whereClause,
    include: {
      nguoiAn: true,
      nguoiTraTien: true,
    },
  });

  const tatCaThanhVienIds = tatCaThanhVien.map((tv) => tv.id);
  const thanhVienBalancesMap = new Map<number, { tongNo: number; tongDuocNhan: number; netBalance: number }>();

  // Khởi tạo balance cho mỗi thành viên
  tatCaThanhVienIds.forEach((id) => {
    thanhVienBalancesMap.set(id, { tongNo: 0, tongDuocNhan: 0, netBalance: 0 });
  });

  // Cộng dồn kết quả chia tiền từ từng bữa tối
  for (const buaToi of tatCaBuaToi) {
    const tongTien = Number(buaToi.tongTien);
    const nguoiAnIds = buaToi.nguoiAn.map((na) => na.thanhVienId);
    const nguoiTraTienInputs = buaToi.nguoiTraTien.map((ntt) => ({
      thanhVienId: ntt.thanhVienId,
      soTienDaTra: Number(ntt.soTienDaTra),
    }));

    const result = tinhTienBuoiToi(tongTien, nguoiAnIds, nguoiTraTienInputs, tatCaThanhVienIds);

    result.forEach((res) => {
      const current = thanhVienBalancesMap.get(res.thanhVienId)!;
      thanhVienBalancesMap.set(res.thanhVienId, {
        tongNo: current.tongNo + res.soTienNo,
        tongDuocNhan: current.tongDuocNhan + res.soTienDuocNhan,
        netBalance: current.netBalance + res.balance,
      });
    });
  }

  // Cập nhật cơ sở dữ liệu bảng tong_ket_tuan
  await prisma.$transaction(async (tx) => {
    // Xóa dữ liệu cũ
    await tx.tongKetTuan.deleteMany();

    // Tạo dữ liệu tổng kết mới
    const dataToInsert = tatCaThanhVien.map((tv) => {
      const balance = thanhVienBalancesMap.get(tv.id)!;
      return {
        thanhVienId: tv.id,
        tongNo: balance.tongNo,
        tongDuocNhan: balance.tongDuocNhan,
      };
    });

    if (dataToInsert.length > 0) {
      await tx.tongKetTuan.createMany({
        data: dataToInsert,
      });
    }
  });

  // Định dạng dữ liệu trả về cho controller kèm theo tối ưu chuyển khoản
  const chiTietTongKet: ChiTietThanhVienTongKet[] = tatCaThanhVien.map((tv) => {
    const balance = thanhVienBalancesMap.get(tv.id)!;
    return {
      thanhVienId: tv.id,
      ten: tv.ten,
      tongNo: Math.round(balance.tongNo * 100) / 100,
      tongDuocNhan: Math.round(balance.tongDuocNhan * 100) / 100,
      netBalance: Math.round(balance.netBalance * 100) / 100,
    };
  });

  const danhSachChuyenKhoan = toiUuChuyenKhoan(
    chiTietTongKet.map((ct) => ({
      thanhVienId: ct.thanhVienId,
      ten: ct.ten,
      netBalance: ct.netBalance,
    }))
  );

  return {
    chiTietTongKet,
    danhSachChuyenKhoan,
  };
}
