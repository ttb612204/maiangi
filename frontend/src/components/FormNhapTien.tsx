import React, { useState, useEffect } from 'react';
import { X, Trash2, Save, Loader2, AlertCircle } from 'lucide-react';
import { BuaToi, NguoiTraTien, ThanhVien, NguoiAnChiTiet } from '../services/api';

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
  const [kemBuaTrua, setKemBuaTrua] = useState<boolean>(false);
  // Quản lý từng người ăn: id -> { isEating: boolean, soTien: number }
  const [eaterMap, setEaterMap] = useState<Record<number, { isEating: boolean; soTien: number }>>({});
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
      setKemBuaTrua(!!buaToi.kemBuaTrua);
      
      const newEaterMap: Record<number, { isEating: boolean; soTien: number }> = {};
      const buaToiEaterIds = buaToi.nguoiAnIds || [];
      const detailedEaters = buaToi.chiTietNguoiAn || [];
      const perEaterTienChung = buaToiEaterIds.length > 0 ? Math.round(savedTienChung / buaToiEaterIds.length) : 0;

      thanhViens.forEach((tv) => {
        const isEating = buaToiEaterIds.includes(tv.id);
        const detailed = detailedEaters.find((d) => d.thanhVienId === tv.id);
        let individualAmount = 0;
        if (detailed && detailed.soTienRieng !== undefined && Number(detailed.soTienRieng) >= 0) {
          individualAmount = Number(detailed.soTienRieng);
        } else if (detailed && Number(detailed.soTien) > 0) {
          individualAmount = Math.max(0, Number(detailed.soTien) - perEaterTienChung);
        }
        newEaterMap[tv.id] = { isEating, soTien: individualAmount };
      });
      setEaterMap(newEaterMap);

      setNguoiTraTien(buaToi.nguoiTraTien || []);
    } else {
      setSelectedDate(day ? day.dateString : getTodayString());
      setTienChung(0);
      setKemBuaTrua(false);
      
      const newEaterMap: Record<number, { isEating: boolean; soTien: number }> = {};
      thanhViens.forEach((tv) => {
        newEaterMap[tv.id] = { isEating: true, soTien: 0 };
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
      const current = prev[id] || { isEating: false, soTien: 0 };
      return {
        ...prev,
        [id]: { ...current, isEating: !current.isEating },
      };
    });
  };

  const handleChangeEaterAmount = (id: number, amount: number) => {
    setEaterMap((prev) => {
      const current = prev[id] || { isEating: true, soTien: 0 };
      return {
        ...prev,
        [id]: { ...current, isEating: true, soTien: amount },
      };
    });
  };

  const handleSelectAllEaters = () => {
    setEaterMap((prev) => {
      const updated: Record<number, { isEating: boolean; soTien: number }> = {};
      thanhViens.forEach((tv) => {
        updated[tv.id] = { isEating: true, soTien: prev[tv.id]?.soTien || 0 };
      });
      return updated;
    });
  };

  const handleDeselectAllEaters = () => {
    setEaterMap(() => {
      const updated: Record<number, { isEating: boolean; soTien: number }> = {};
      thanhViens.forEach((tv) => {
        updated[tv.id] = { isEating: false, soTien: 0 };
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
        const individual = Number(eaterMap[tv.id]?.soTien || 0);
        return {
          thanhVienId: tv.id,
          soTien: individual + tienChungMoiNguoi, // Chi phí thực tế người này phải chịu (riêng + chia đều chung)
          soTienRieng: individual,               // Tiền thức ăn riêng của người này
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
    try {
      await onSave({
        id: buaToi?.id,
        thuTrongTuan: getDayOfWeekVietnamese(selectedDate),
        tongTien: tongTienBuaAn,
        tienChung: Number(tienChung || 0),
        kemBuaTrua,
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

          {/* Tùy chọn nấu ăn luôn cho cả bữa trưa hôm sau (Tính là 2 bữa ăn) */}
          <div 
            onClick={() => setKemBuaTrua(!kemBuaTrua)}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              kemBuaTrua 
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-200' 
                : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="kemBuaTruaCheckbox"
                checked={kemBuaTrua}
                onChange={(e) => setKemBuaTrua(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 focus:ring-offset-slate-900 border-slate-700 bg-slate-900 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              />
              <div>
                <label 
                  htmlFor="kemBuaTruaCheckbox" 
                  className="text-sm font-bold block cursor-pointer flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  🍱 Ăn luôn cho trưa hôm sau (Tính là 2 bữa)
                </label>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Thức ăn tối dư dùng tiếp cho bữa trưa hôm sau. Tiền không đổi, nhưng số bữa thống kê sẽ tính là 2 bữa (Tối + Trưa).
                </span>
              </div>
            </div>
            <span className={`text-[11px] font-bold px-2 py-1 rounded-md shrink-0 ${
              kemBuaTrua ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-500'
            }`}>
              {kemBuaTrua ? '+ 1 Bữa trưa' : '1 Bữa tối'}
            </span>
          </div>

          {/* Danh sách người ăn & số tiền từng người */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-slate-300">
                  Tiền thức ăn riêng từng người ({soNguoiAn}/{thanhViens.length})
                </label>
                <span className="block text-[11px] text-slate-500">
                  Nhập tiền thức ăn riêng của mỗi người (sẽ cộng thêm nửa tiền gia vị)
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

            {/* Danh sách thành viên kèm ô nhập tiền từng người */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {thanhViens.map((tv) => {
                const eaterInfo = eaterMap[tv.id] || { isEating: false, soTien: 0 };
                const isSelected = eaterInfo.isEating;
                const userRieng = Number(eaterInfo.soTien || 0);
                const userTong = userRieng + (isSelected ? tienChungMoiNguoi : 0);

                return (
                  <div
                    key={tv.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border gap-2 transition-all ${
                      isSelected
                        ? 'bg-slate-900/80 border-indigo-500/40'
                        : 'bg-slate-950/30 border-slate-800/60 opacity-60'
                    }`}
                  >
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
                        <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                          {tv.ten}
                        </span>
                        {isSelected && (userRieng > 0 || tienChungMoiNguoi > 0) && (
                          <span className="block text-[11px] text-indigo-300 font-mono">
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
                    </div>
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
