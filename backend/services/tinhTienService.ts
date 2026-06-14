export interface NguoiTraTienInput {
  thanhVienId: number;
  soTienDaTra: number;
}

export interface KetQuaChiaTien {
  thanhVienId: number;
  balance: number;
  soTienNo: number;
  soTienDuocNhan: number;
}

/**
 * Tính toán tiền ăn cho một bữa tối cụ thể.
 * @param tongTien Tổng tiền hóa đơn bữa ăn
 * @param nguoiAnIds Danh sách ID các thành viên ăn bữa đó
 * @param nguoiTraTien Danh sách các khoản tiền các thành viên đã trả
 * @param tatCaThanhVienIds Danh sách ID của tất cả thành viên trong nhóm
 */
export function tinhTienBuoiToi(
  tongTien: number,
  nguoiAnIds: number[],
  nguoiTraTien: NguoiTraTienInput[],
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
