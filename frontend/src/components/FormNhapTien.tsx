import React, { useState, useEffect } from 'react';
import { X, Trash2, Save, Loader2, AlertCircle, Plus, Sun, Moon, ChevronDown, ChevronUp } from 'lucide-react';
import { BuaToi, NguoiTraTien, ThanhVien, NguoiAnChiTiet, BuaKemChiTiet } from '../services/api';

export interface DayConfig {
  thu: string;
  dateString: string;
  displayDate: string;
}

interface FormNhapTienProps {
  day?: DayConfig;
  buaToi?: BuaToi;
  thanhViens: ThanhVien[];
  onSave: (buaToi: BuaToi) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  onClose: () => void;
}

const getDayOfWeekVietnamese = (dateStr: string) => {
  if (!dateStr) return 'Thứ 2';
  try {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const date = parseInt(parts[2], 10);
      const d = new Date(year, month, date);
      const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      return days[d.getDay()] || 'Thứ 2';
    }
    const d = new Date(dateStr);
    const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return days[d.getDay()] || 'Thứ 2';
  } catch {
    return 'Thứ 2';
  }
};

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatVND = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

interface EaterState {
  isEating: boolean;
  soTien: number;
  cacBuaKem: BuaKemChiTiet[];
}

export const FormNhapTien: React.FC<FormNhapTienProps> = ({
  day,
  buaToi,
  thanhViens,
  onSave,
  onDelete,
  onClose,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [tienChung, setTienChung] = useState<number>(0);
  // Quản lý từng người ăn: id -> { isEating: boolean, soTien: number, cacBuaKem: BuaKemChiTiet[] }
  const [eaterMap, setEaterMap] = useState<Record<number, EaterState>>({});
  const [expandedEaterId, setExpandedEaterId] = useState<number | null>(null);
  const [nguoiTraTien, setNguoiTraTien] = useState<NguoiTraTien[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Số người tham gia ăn
  const activeEatersList = thanhViens.filter((tv) => eaterMap[tv.id]?.isEating);
  const soNguoiAn = activeEatersList.length;

  // Tiền chung được chia đều cho mỗi người tham gia ăn
  const tienChungMoiNguoi = soNguoiAn > 0 ? Math.round(Number(tienChung || 0) / soNguoiAn) : 0;

  // Tính tổng tiền thức ăn riêng của từng người
  const tongTienRieng = Object.values(eaterMap).reduce((sum, item) => {
    return sum + (item.isEating ? (Number(item.soTien) || 0) : 0);
  }, 0);

  // Tổng tiền đi chợ / Tổng thanh toán = Tổng tiền riêng + Tiền dùng chung
  const tongTienBuaAn = tongTienRieng + Number(tienChung || 0);

  // Load dữ liệu ban đầu
  useEffect(() => {
    if (buaToi) {
      setSelectedDate(buaToi.ngayAn.split('T')[0]);
      const savedTienChung = Number(buaToi.tienChung || 0);
      setTienChung(savedTienChung);
      
      const newEaterMap: Record<number, EaterState> = {};
      const buaToiEaterIds = buaToi.nguoiAnIds || [];
      const detailedEaters = buaToi.chiTietNguoiAn || [];
      const perEaterTienChung = buaToiEaterIds.length > 0 ? Math.round(savedTienChung / buaToiEaterIds.length) : 0;

      thanhViens.forEach((tv) => {
        const isEating = buaToiEaterIds.includes(tv.id);
        const detailed = detailedEaters.find((d) => d.thanhVienId === tv.id);
        let individualAmount = 0;
        let memberBuaKem: BuaKemChiTiet[] = [];

        if (detailed) {
          if (detailed.soTienRieng !== undefined && Number(detailed.soTienRieng) >= 0) {
            individualAmount = Number(detailed.soTienRieng);
          } else if (Number(detailed.soTien) > 0) {
            individualAmount = Math.max(0, Number(detailed.soTien) - perEaterTienChung);
          }
          if (Array.isArray(detailed.cacBuaKem) && detailed.cacBuaKem.length > 0) {
            memberBuaKem = detailed.cacBuaKem;
          } else if (Array.isArray(buaToi.cacBuaKem) && buaToi.cacBuaKem.length > 0) {
            // Kế thừa bữa kèm chung nếu trước đó chưa tách riêng
            memberBuaKem = buaToi.cacBuaKem;
          } else if (buaToi.kemBuaTrua) {
            memberBuaKem = [{ loaiBua: 'trua', ngay: buaToi.ngayAn.split('T')[0], moTa: 'Trưa hôm sau' }];
          }
        }
        newEaterMap[tv.id] = { isEating, soTien: individualAmount, cacBuaKem: memberBuaKem };
      });
      setEaterMap(newEaterMap);

      setNguoiTraTien(buaToi.nguoiTraTien || []);
    } else {
      setSelectedDate(day ? day.dateString : getTodayString());
      setTienChung(0);
      
      const newEaterMap: Record<number, EaterState> = {};
      thanhViens.forEach((tv) => {
        newEaterMap[tv.id] = { isEating: true, soTien: 0, cacBuaKem: [] };
      });
      setEaterMap(newEaterMap);

      if (thanhViens.length > 0) {
        setNguoiTraTien([{ thanhVienId: thanhViens[0].id, soTienDaTra: 0 }]);
      } else {
        setNguoiTraTien([]);
      }
    }
    setErrorMsg(null);
  }, [buaToi, day, thanhViens]);

  // Tự động gán số tiền người trả bằng tổng tiền ăn
  useEffect(() => {
    if (nguoiTraTien.length > 0) {
      setNguoiTraTien([{ thanhVienId: nguoiTraTien[0].thanhVienId, soTienDaTra: tongTienBuaAn }]);
    }
  }, [tongTienBuaAn]);

  const handleToggleEater = (id: number) => {
    setEaterMap((prev) => {
      const current = prev[id] || { isEating: false, soTien: 0, cacBuaKem: [] };
      return {
        ...prev,
        [id]: { ...current, isEating: !current.isEating },
      };
    });
  };

  const handleChangeEaterAmount = (id: number, amount: number) => {
    setEaterMap((prev) => {
      const current = prev[id] || { isEating: true, soTien: 0, cacBuaKem: [] };
      return {
        ...prev,
        [id]: { ...current, isEating: true, soTien: amount },
      };
    });
  };

  const handleAddMemberBuaKem = (id: number, loaiBua: 'trua' | 'toi', ngay: string, moTa?: string) => {
    setEaterMap((prev) => {
      const current = prev[id] || { isEating: true, soTien: 0, cacBuaKem: [] };
      return {
        ...prev,
        [id]: {
          ...current,
          isEating: true,
          cacBuaKem: [...current.cacBuaKem, { loaiBua, ngay, moTa }],
        },
      };
    });
  };

  const handleUpdateMemberBuaKem = (id: number, index: number, updated: Partial<BuaKemChiTiet>) => {
    setEaterMap((prev) => {
      const current = prev[id] || { isEating: true, soTien: 0, cacBuaKem: [] };
      const updatedList = current.cacBuaKem.map((item, idx) => (idx === index ? { ...item, ...updated } : item));
      return {
        ...prev,
        [id]: {
          ...current,
          cacBuaKem: updatedList,
        },
      };
    });
  };

  const handleRemoveMemberBuaKem = (id: number, index: number) => {
    setEaterMap((prev) => {
      const current = prev[id] || { isEating: true, soTien: 0, cacBuaKem: [] };
      return {
        ...prev,
        [id]: {
          ...current,
          cacBuaKem: current.cacBuaKem.filter((_, idx) => idx !== index),
        },
      };
    });
  };

  const handleSelectAllEaters = () => {
    setEaterMap((prev) => {
      const updated: Record<number, EaterState> = {};
      thanhViens.forEach((tv) => {
        updated[tv.id] = { 
          isEating: true, 
          soTien: prev[tv.id]?.soTien || 0,
          cacBuaKem: prev[tv.id]?.cacBuaKem || []
        };
      });
      return updated;
    });
  };

  const handleDeselectAllEaters = () => {
    setEaterMap((prev) => {
      const updated: Record<number, EaterState> = {};
      thanhViens.forEach((tv) => {
        updated[tv.id] = { 
          isEating: false, 
          soTien: 0,
          cacBuaKem: prev[tv.id]?.cacBuaKem || []
        };
      });
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedDate) {
      setErrorMsg('Vui lòng chọn ngày ăn.');
      return;
    }

    const activeEaters: NguoiAnChiTiet[] = thanhViens
      .filter((tv) => eaterMap[tv.id]?.isEating)
      .map((tv) => {
        const itemState = eaterMap[tv.id];
        const individual = Number(itemState?.soTien || 0);
        return {
          thanhVienId: tv.id,
          soTien: individual + tienChungMoiNguoi, // Chi phí thực tế người này phải chịu (riêng + chia đều chung)
          soTienRieng: individual,               // Tiền thức ăn riêng của người này
          cacBuaKem: itemState?.cacBuaKem || [], // Danh sách bữa kèm riêng của người này
        };
      });

    if (activeEaters.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất một người tham gia ăn.');
      return;
    }

    if (tongTienBuaAn <= 0) {
      setErrorMsg('Vui lòng nhập tiền thức ăn riêng hoặc tiền chung bữa ăn.');
      return;
    }

    const finalNguoiTra = nguoiTraTien.length === 1
      ? [{ thanhVienId: nguoiTraTien[0].thanhVienId, soTienDaTra: tongTienBuaAn }]
      : nguoiTraTien;

    if (finalNguoiTra.length === 0) {
      setErrorMsg('Vui lòng thêm ít nhất một người trả tiền.');
      return;
    }

    // Đảm bảo người trả tiền có số tiền > 0
    const tongTienNguoiTra = finalNguoiTra.reduce((sum, p) => sum + (Number(p.soTienDaTra) || 0), 0);
    if (tongTienNguoiTra <= 0) {
      setErrorMsg('Vui lòng nhập tiền thức ăn riêng hoặc tiền chung bữa ăn.');
      return;
    }

    // Kiểm tra trùng lặp người trả tiền
    const listPayerIds = finalNguoiTra.map((p) => p.thanhVienId);
    if (new Set(listPayerIds).size !== listPayerIds.length) {
      setErrorMsg('Danh sách người trả tiền không được trùng lặp.');
      return;
    }

    setSaving(true);
    // Gom tất cả các bữa kèm của các thành viên để lưu vào cấp bữa nếu cần
    const allCacBuaKem = activeEaters.flatMap((e) => e.cacBuaKem || []);

    try {
      await onSave({
        id: buaToi?.id,
        thuTrongTuan: getDayOfWeekVietnamese(selectedDate),
        tongTien: tongTienBuaAn,
        tienChung: Number(tienChung || 0),
        kemBuaTrua: allCacBuaKem.length > 0,
        cacBuaKem: allCacBuaKem,
        ngayAn: selectedDate,
        nguoiAnIds: activeEaters.map((e) => e.thanhVienId),
        chiTietNguoiAn: activeEaters,
        nguoiTraTien: finalNguoiTra,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Lỗi khi lưu thông tin.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h3 className="text-lg font-bold text-white">
              {buaToi ? 'Cập Nhật Bữa Tối' : 'Nhập Bữa Tối'}
            </h3>
            <p className="text-xs text-slate-400">
              {getDayOfWeekVietnamese(selectedDate)} - {selectedDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Chọn ngày ăn */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-300">
              Ngày ăn tối
            </label>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
                required
              />
              <span className="text-sm font-bold text-indigo-400 bg-indigo-950/50 px-3 py-2 rounded-xl border border-indigo-500/20">
                {getDayOfWeekVietnamese(selectedDate)}
              </span>
            </div>
          </div>

          {/* Tiền dùng chung (Gia vị, dầu ăn, rau...) */}
          <div className="space-y-2 p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-semibold text-indigo-300">
                  Tiền dùng chung (Gia vị, rau, dầu ăn...)
                </label>
                <span className="block text-[11px] text-slate-400">
                  {soNguoiAn > 0 
                    ? `(Tự động chia đều cho ${soNguoiAn} người ăn)` 
                    : '(Vui lòng chọn người tham gia ăn bên dưới)'}
                </span>
              </div>
              {soNguoiAn > 0 && Number(tienChung || 0) > 0 && (
                <span className="text-xs font-bold text-amber-400 bg-amber-950/70 px-2.5 py-1 rounded-lg border border-amber-500/30 font-mono">
                  Mỗi người: +{formatVND(tienChungMoiNguoi)}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={tienChung === 0 ? '' : tienChung}
                onChange={(e) => setTienChung(Number(e.target.value) || 0)}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-3.5 pr-8 py-2 text-sm text-amber-300 font-mono font-bold focus:outline-none focus:border-indigo-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                đ
              </span>
            </div>
          </div>

          {/* Tổng tiền đi chợ (Tổng thanh toán) */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-300">
              Tổng tiền đi chợ (Tổng thanh toán)
            </label>
            <div className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3 font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xl font-extrabold text-emerald-400">
                  {formatVND(tongTienBuaAn)}
                </span>
                <span className="block text-[11px] text-slate-400 font-normal">
                  (Tiền riêng: {formatVND(tongTienRieng)} + Tiền gia vị chung: {formatVND(Number(tienChung || 0))})
                </span>
              </div>
              <span className="text-xs font-normal text-slate-400">
                {soNguoiAn} người tham gia
              </span>
            </div>
          </div>

          {/* Danh sách người ăn & số tiền từng người */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-slate-300">
                  Phần ăn & Số bữa của từng người ({soNguoiAn}/{thanhViens.length})
                </label>
                <span className="block text-[11px] text-slate-500">
                  Nhập tiền riêng và chọn các bữa ăn kèm riêng (ví dụ người ăn 2 bữa, người ăn 3 bữa...)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllEaters}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Tất cả
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllEaters}
                  className="text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            {/* Danh sách thành viên kèm ô nhập tiền & cài đặt số bữa riêng */}
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {thanhViens.map((tv) => {
                const eaterInfo = eaterMap[tv.id] || { isEating: false, soTien: 0, cacBuaKem: [] };
                const isSelected = eaterInfo.isEating;
                const userRieng = Number(eaterInfo.soTien || 0);
                const userTong = userRieng + (isSelected ? tienChungMoiNguoi : 0);
                const memberTotalMeals = isSelected ? 1 + eaterInfo.cacBuaKem.length : 0;
                const isExpanded = expandedEaterId === tv.id;

                return (
                  <div
                    key={tv.id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isSelected
                        ? 'bg-slate-900/90 border-indigo-500/40 shadow-sm'
                        : 'bg-slate-950/30 border-slate-800/60 opacity-60'
                    }`}
                  >
                    {/* Hàng thông tin chính của người này */}
                    <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div 
                        onClick={() => handleToggleEater(tv.id)}
                        className="flex items-center gap-3 cursor-pointer select-none flex-1"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 pointer-events-none"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                              {tv.ten}
                            </span>
                            {isSelected && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                                🍱 {memberTotalMeals} bữa
                              </span>
                            )}
                          </div>
                          {isSelected && (userRieng > 0 || tienChungMoiNguoi > 0) && (
                            <span className="block text-[11px] text-indigo-300 font-mono mt-0.5">
                              Phần phải chịu: <span className="font-bold text-emerald-400">{formatVND(userTong)}</span>
                              {tienChungMoiNguoi > 0 && (
                                <span className="text-slate-500 text-[10px]"> ({formatVND(userRieng)} riêng + {formatVND(tienChungMoiNguoi)} chung)</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <div className="relative w-36">
                          <input
                            type="number"
                            placeholder="Tiền riêng"
                            min="0"
                            step="any"
                            value={eaterInfo.soTien === 0 ? '' : eaterInfo.soTien}
                            onChange={(e) => handleChangeEaterAmount(tv.id, Number(e.target.value))}
                            disabled={!isSelected}
                            className={`w-full bg-slate-950/80 border rounded-xl pl-3 pr-7 py-1.5 text-xs text-right font-mono focus:outline-none transition-colors ${
                              isSelected
                                ? 'border-slate-700 text-emerald-400 focus:border-indigo-500'
                                : 'border-slate-850 text-slate-600 cursor-not-allowed'
                            }`}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono pointer-events-none">
                            đ
                          </span>
                        </div>

                        {isSelected && (
                          <button
                            type="button"
                            onClick={() => setExpandedEaterId(isExpanded ? null : tv.id)}
                            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                              isExpanded 
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border-slate-700'
                            }`}
                            title="Tùy chỉnh số bữa ăn của người này"
                          >
                            <span className="text-[11px]">Bữa ăn</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Vùng mở rộng: Tùy chỉnh các bữa ăn kèm riêng của người này */}
                    {isSelected && isExpanded && (
                      <div className="p-3 bg-slate-950/70 border-t border-slate-800 space-y-2.5 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                            🍱 Các bữa ăn kèm riêng của {tv.ten}:
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Bữa tối chính + {eaterInfo.cacBuaKem.length} bữa kèm = {memberTotalMeals} bữa
                          </span>
                        </div>

                        {/* Danh sách bữa kèm của người này */}
                        {eaterInfo.cacBuaKem.length === 0 ? (
                          <div className="text-[11px] text-slate-500 italic py-1">
                            Chỉ tính 1 bữa tối này (chưa có bữa kèm thêm).
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {eaterInfo.cacBuaKem.map((bk, kIdx) => (
                              <div
                                key={kIdx}
                                className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-xs"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-slate-500 text-[10px]">#{kIdx + 1}</span>
                                  <select
                                    value={bk.loaiBua}
                                    onChange={(e) => handleUpdateMemberBuaKem(tv.id, kIdx, { loaiBua: e.target.value as 'trua' | 'toi' })}
                                    className="bg-slate-950 border border-slate-700 text-white rounded px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                                  >
                                    <option value="trua">☀️ Bữa trưa</option>
                                    <option value="toi">🌙 Bữa tối</option>
                                  </select>

                                  <input
                                    type="date"
                                    value={bk.ngay}
                                    onChange={(e) => handleUpdateMemberBuaKem(tv.id, kIdx, { ngay: e.target.value })}
                                    style={{ colorScheme: 'dark' }}
                                    className="bg-slate-950 border border-slate-700 text-white rounded px-2 py-0.5 text-xs font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
                                  />
                                  <span className="text-[10px] font-semibold text-amber-400/90 font-mono">
                                    {getDayOfWeekVietnamese(bk.ngay)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 justify-end">
                                  <input
                                    type="text"
                                    placeholder="Ghi chú (VD: trưa mai...)"
                                    value={bk.moTa || ''}
                                    onChange={(e) => handleUpdateMemberBuaKem(tv.id, kIdx, { moTa: e.target.value })}
                                    className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded px-2 py-0.5 flex-1 sm:w-36 focus:outline-none focus:border-amber-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMemberBuaKem(tv.id, kIdx)}
                                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                    title="Xóa bữa kèm này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Nút thêm nhanh bữa cho riêng người này */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const d = new Date(selectedDate);
                                d.setDate(d.getDate() + 1);
                                handleAddMemberBuaKem(tv.id, 'trua', d.toISOString().split('T')[0], 'Trưa hôm sau');
                              } catch {
                                handleAddMemberBuaKem(tv.id, 'trua', selectedDate, 'Bữa trưa');
                              }
                            }}
                            className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Sun className="w-3 h-3" />
                            + Trưa hôm sau
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const d = new Date(selectedDate);
                                d.setDate(d.getDate() + 1);
                                handleAddMemberBuaKem(tv.id, 'toi', d.toISOString().split('T')[0], 'Tối hôm sau');
                              } catch {
                                handleAddMemberBuaKem(tv.id, 'toi', selectedDate, 'Bữa tối');
                              }
                            }}
                            className="px-2 py-1 rounded bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Moon className="w-3 h-3" />
                            + Tối hôm sau
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAddMemberBuaKem(tv.id, 'trua', selectedDate, '')}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            + Thêm bữa khác
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Danh sách người trả tiền */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-300">
                Người chi trả tiền
              </label>
              <span className="text-[11px] text-slate-400">
                (Tự động thanh toán tổng tiền bên trên)
              </span>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={nguoiTraTien[0]?.thanhVienId || thanhViens[0]?.id || 0}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setNguoiTraTien([{ thanhVienId: id, soTienDaTra: tongTienBuaAn }]);
                }}
                className="flex-1 bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {thanhViens.map((tv) => (
                  <option key={tv.id} value={tv.id} className="bg-slate-900 text-white">
                    {tv.ten} (Người thanh toán)
                  </option>
                ))}
              </select>
              <div className="px-4 py-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl font-mono text-sm font-bold text-emerald-400 whitespace-nowrap select-none">
                {formatVND(tongTienBuaAn)}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {buaToi?.id && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(buaToi.id!)}
                className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Xóa bữa tối
              </button>
            ) : <div />}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-sm font-semibold rounded-xl transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="gradient-btn px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Lưu thông tin
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
