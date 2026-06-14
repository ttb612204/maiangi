// ============================================================================
// FILE DỊCH VỤ CLIENT-SIDE (LOCALSTORAGE + THUẬT TOÁN TÍNH TOÁN TRỰC TIẾP)
// Dự án: Quản Lý Tiền Ăn Tối Nhóm (Offline Mode)
// ============================================================================

export interface ThanhVien {
  id: number;
  ten: string;
}

export interface NguoiTraTien {
  thanhVienId: number;
  soTienDaTra: number;
}

export interface BuaToi {
  id?: number;
  thuTrongTuan: string;
  tongTien: number;
  ngayAn: string; // Định dạng YYYY-MM-DD
  nguoiAnIds: number[];
  nguoiTraTien: NguoiTraTien[];
}

export interface ChiTietThanhVienTongKet {
  thanhVienId: number;
  ten: string;
  tongNo: number;
  tongDuocNhan: number;
  netBalance: number;
}

export interface GiaoDich {
  tuThanhVienId: number;
  tuTen: string;
  denThanhVienId: number;
  denTen: string;
  soTien: number;
}

export interface TongKetResponse {
  chiTietTongKet: ChiTietThanhVienTongKet[];
  danhSachChuyenKhoan: GiaoDich[];
}

// Keys của localStorage
const KEY_THANH_VIEN = 'tv_danh_sach';
const KEY_BUA_TOI = 'bt_danh_sach';

// Helper: Đọc dữ liệu từ localStorage
const docThanhViens = (): ThanhVien[] => {
  const data = localStorage.getItem(KEY_THANH_VIEN);
  return data ? JSON.parse(data) : [];
};

const docBuaTois = (): BuaToi[] => {
  const data = localStorage.getItem(KEY_BUA_TOI);
  return data ? JSON.parse(data) : [];
};

// Helper: Ghi dữ liệu vào localStorage
const ghiThanhViens = (list: ThanhVien[]) => {
  localStorage.setItem(KEY_THANH_VIEN, JSON.stringify(list));
};

const ghiBuaTois = (list: BuaToi[]) => {
  localStorage.setItem(KEY_BUA_TOI, JSON.stringify(list));
};

// Helper: Kiểm tra ngày có thuộc tuần chỉ định hay không
const isDateInWeek = (dateStr: string, mondayStr: string): boolean => {
  const date = new Date(dateStr);
  const start = new Date(mondayStr);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  // Chuẩn hóa thời gian về 0h để so sánh ngày chính xác
  date.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
};

// ============================================================================
// THUẬT TOÁN CHIA TIỀN BỮA ĂN (TỪ TINHTIENSERVICE)
// ============================================================================
export interface KetQuaChiaTien {
  thanhVienId: number;
  balance: number;
  soTienNo: number;
  soTienDuocNhan: number;
}

export function tinhTienBuoiToi(
  tongTien: number,
  nguoiAnIds: number[],
  nguoiTraTien: NguoiTraTien[],
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

// ============================================================================
// THUẬT TOÁN TỐI ƯU HÓA GIAO DỊCH CHUYỂN KHOẢN (TỪ TONGKETSERVICE)
// ============================================================================
export function toiUuChuyenKhoan(
  balances: { thanhVienId: number; ten: string; netBalance: number }[]
): GiaoDich[] {
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
        soTien: Math.round(transferAmount * 100) / 100,
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

// ============================================================================
// CÁC HÀM API GIẢ LẬP TRÊN LOCALSTORAGE
// ============================================================================

export const getThanhViens = async (): Promise<ThanhVien[]> => {
  return docThanhViens();
};

export const addThanhVien = async (ten: string): Promise<ThanhVien> => {
  const current = docThanhViens();
  const maxId = current.reduce((max, item) => (item.id > max ? item.id : max), 0);
  const tvMoi: ThanhVien = {
    id: maxId + 1,
    ten: ten.trim(),
  };
  current.push(tvMoi);
  ghiThanhViens(current);
  return tvMoi;
};

export const updateThanhVien = async (id: number, ten: string): Promise<ThanhVien> => {
  const current = docThanhViens();
  const index = current.findIndex((x) => x.id === id);
  if (index === -1) throw new Error('Không tìm thấy thành viên.');

  current[index].ten = ten.trim();
  ghiThanhViens(current);
  return current[index];
};

export const deleteThanhVien = async (id: number): Promise<{ message: string }> => {
  // 1. Xóa thành viên
  const members = docThanhViens().filter((x) => x.id !== id);
  ghiThanhViens(members);

  // 2. Cascade Clean up các bữa ăn (Xóa người ăn, xóa người trả tiền tương ứng)
  const dinners = docBuaTois();
  const updatedDinners = dinners
    .map((bt) => {
      const nguoiAnIds = bt.nguoiAnIds.filter((x) => x !== id);
      const nguoiTraTien = bt.nguoiTraTien.filter((x) => x.thanhVienId !== id);
      const tongTien = nguoiTraTien.reduce((sum, curr) => sum + curr.soTienDaTra, 0);

      return {
        ...bt,
        nguoiAnIds,
        nguoiTraTien,
        tongTien,
      };
    })
    .filter((bt) => bt.nguoiAnIds.length > 0 && bt.tongTien > 0); // Xóa bữa ăn nếu không còn ai ăn hoặc không có tiền

  ghiBuaTois(updatedDinners);

  return { message: 'Đã xóa thành viên thành công.' };
};

export const getBuaTois = async (ngayDauTuan?: string): Promise<BuaToi[]> => {
  const all = docBuaTois();
  if (!ngayDauTuan) return all;
  return all.filter((bt) => isDateInWeek(bt.ngayAn, ngayDauTuan));
};

export const addBuaToi = async (buaToi: BuaToi): Promise<BuaToi> => {
  const all = docBuaTois();
  
  // Format ngày để so sánh
  const dateStr = buaToi.ngayAn;
  const index = all.findIndex((x) => x.ngayAn === dateStr);

  const buaToiLuu = {
    ...buaToi,
    id: index !== -1 ? all[index].id : all.reduce((max, item) => ((item.id || 0) > max ? (item.id || 0) : max), 0) + 1,
  };

  if (index !== -1) {
    all[index] = buaToiLuu;
  } else {
    all.push(buaToiLuu);
  }

  // Sắp xếp lại theo thời gian ăn
  all.sort((a, b) => new Date(a.ngayAn).getTime() - new Date(b.ngayAn).getTime());
  ghiBuaTois(all);

  return buaToiLuu;
};

export const getTongKetTuan = async (ngayDauTuan?: string): Promise<TongKetResponse> => {
  const tatCaThanhVien = docThanhViens();
  const tatCaBuaToi = await getBuaTois(ngayDauTuan);

  const tatCaThanhVienIds = tatCaThanhVien.map((tv) => tv.id);
  const thanhVienBalancesMap = new Map<number, { tongNo: number; tongDuocNhan: number; netBalance: number }>();

  // Khởi tạo số dư
  tatCaThanhVienIds.forEach((id) => {
    thanhVienBalancesMap.set(id, { tongNo: 0, tongDuocNhan: 0, netBalance: 0 });
  });

  // Tính toán cộng dồn kết quả cho từng bữa ăn
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

  // Gom kết quả chi tiết
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

  // Tối ưu hóa chuyển khoản
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
};

// ============================================================================
// HÀM BACKUP & RESTORE DỮ LIỆU
// ============================================================================
export const exportBackupData = (): string => {
  const data = {
    thanhViens: docThanhViens(),
    buaTois: docBuaTois(),
    version: '1.0',
    exportAt: new Date().toISOString()
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
};

export const importBackupData = (backupStr: string): void => {
  try {
    const decoded = decodeURIComponent(escape(atob(backupStr.trim())));
    const parsed = JSON.parse(decoded);
    
    if (!parsed || !Array.isArray(parsed.thanhViens) || !Array.isArray(parsed.buaTois)) {
      throw new Error('Định dạng dữ liệu không hợp lệ.');
    }
    
    ghiThanhViens(parsed.thanhViens);
    ghiBuaTois(parsed.buaTois);
  } catch (err) {
    console.error(err);
    throw new Error('Mã sao lưu không hợp lệ hoặc bị lỗi. Vui lòng kiểm tra lại!');
  }
};
