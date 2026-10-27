import React, { useState, useEffect } from 'react';
import { X, Trash2, Save, Loader2, AlertCircle } from 'lucide-react';
import { BuaToi, NguoiTraTien, ThanhVien, NguoiAnChiTiet } from '../services/api';

export interface DayConfig {
  thu: string;
  dateString: string;
  displayDate: string;
}

interface FormChiPhiKhacProps {
  daysOfWeek?: DayConfig[];
  chiPhi?: BuaToi;
  thanhViens: ThanhVien[];
  onSave: (payload: {
    id?: number;
    moTa: string;
    tongTien: number;
    tienChung?: number;
    ngayChi: string;
    nguoiChiaIds: number[];
    chiTietNguoiChia?: NguoiAnChiTiet[];
    nguoiTraTien: NguoiTraTien[];
  }) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  onClose: () => void;
}

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

const formatVND = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const FormChiPhiKhac: React.FC<FormChiPhiKhacProps> = ({
  daysOfWeek,
  chiPhi,
  thanhViens,
  onSave,
  onDelete,
  onClose,
}) => {
  const [moTa, setMoTa] = useState('');
  const [selectedDateStr, setSelectedDateStr] = useState('');
  const [tienChung, setTienChung] = useState<number>(0);
  // Quản lý từng người chia sẻ: id -> { isSharing: boolean, soTien: number }
  const [shareMap, setShareMap] = useState<Record<number, { isSharing: boolean; soTien: number }>>({});
  const [nguoiTraTien, setNguoiTraTien] = useState<NguoiTraTien[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Số người chia sẻ
  const activeSharersList = thanhViens.filter((tv) => shareMap[tv.id]?.isSharing);
  const soNguoiChia = activeSharersList.length;

  // Tiền chung được chia đều cho mỗi người chia sẻ
  const tienChungMoiNguoi = soNguoiChia > 0 ? Math.round(Number(tienChung || 0) / soNguoiChia) : 0;

  // Tính tổng tiền riêng của từng người chia sẻ
  const tongTienRieng = Object.values(shareMap).reduce((sum, item) => {
    return sum + (item.isSharing ? (Number(item.soTien) || 0) : 0);
  }, 0);

  // Tổng tiền chi phí = Tổng tiền riêng + Tiền dùng chung
  const tongTienChi = tongTienRieng + Number(tienChung || 0);

  // Load dữ liệu cũ nếu đang chỉnh sửa
  useEffect(() => {
    if (chiPhi && chiPhi.id) {
      setMoTa(chiPhi.moTa || '');
      setSelectedDateStr(chiPhi.ngayAn.split('T')[0]);
      const savedTienChung = Number(chiPhi.tienChung || 0);
      setTienChung(savedTienChung);
      
      const newShareMap: Record<number, { isSharing: boolean; soTien: number }> = {};
      const chiPhiEaterIds = chiPhi.nguoiAnIds || [];
      const detailedShares = chiPhi.chiTietNguoiAn || [];
      const perEaterTienChung = chiPhiEaterIds.length > 0 ? Math.round(savedTienChung / chiPhiEaterIds.length) : 0;

      thanhViens.forEach((tv) => {
        const isSharing = chiPhiEaterIds.includes(tv.id);
        const detailed = detailedShares.find((d) => d.thanhVienId === tv.id);
        let individualAmount = 0;
        if (detailed && detailed.soTienRieng !== undefined && Number(detailed.soTienRieng) >= 0) {
          individualAmount = Number(detailed.soTienRieng);
        } else if (detailed && Number(detailed.soTien) > 0) {
          individualAmount = Math.max(0, Number(detailed.soTien) - perEaterTienChung);
        }
        newShareMap[tv.id] = { isSharing, soTien: individualAmount };
      });
      setShareMap(newShareMap);

      setNguoiTraTien(chiPhi.nguoiTraTien || []);
    } else {
      setMoTa('');
      setTienChung(0);
      if (chiPhi && chiPhi.ngayAn) {
        setSelectedDateStr(chiPhi.ngayAn.split('T')[0]);
      } else if (daysOfWeek && daysOfWeek.length > 0) {
        setSelectedDateStr(daysOfWeek[0].dateString);
      } else {
        setSelectedDateStr(getTodayDateString());
      }
      
      const newShareMap: Record<number, { isSharing: boolean; soTien: number }> = {};
      thanhViens.forEach((tv) => {
        newShareMap[tv.id] = { isSharing: true, soTien: 0 };
      });
      setShareMap(newShareMap);

      if (thanhViens.length > 0) {
        setNguoiTraTien([{ thanhVienId: thanhViens[0].id, soTienDaTra: 0 }]);
      } else {
        setNguoiTraTien([]);
      }
    }
    setErrorMsg(null);
  }, [chiPhi, daysOfWeek, thanhViens]);

  // Tự động gán số tiền người trả bằng tổng tiền
  useEffect(() => {
    if (nguoiTraTien.length > 0) {
      setNguoiTraTien([{ thanhVienId: nguoiTraTien[0].thanhVienId, soTienDaTra: tongTienChi }]);
    }
  }, [tongTienChi]);

  const handleToggleShare = (id: number) => {
    setShareMap((prev) => {
      const current = prev[id] || { isSharing: false, soTien: 0 };
      return {
        ...prev,
        [id]: { ...current, isSharing: !current.isSharing },
      };
    });
  };

  const handleChangeShareAmount = (id: number, amount: number) => {
    setShareMap((prev) => {
      const current = prev[id] || { isSharing: true, soTien: 0 };
      return {
        ...prev,
        [id]: { ...current, isSharing: true, soTien: amount },
      };
    });
  };

  const handleSelectAllShares = () => {
    setShareMap((prev) => {
      const updated: Record<number, { isSharing: boolean; soTien: number }> = {};
      thanhViens.forEach((tv) => {
        updated[tv.id] = { isSharing: true, soTien: prev[tv.id]?.soTien || 0 };
      });
      return updated;
    });
  };

  const handleDeselectAllShares = () => {
    setShareMap(() => {
      const updated: Record<number, { isSharing: boolean; soTien: number }> = {};
      thanhViens.forEach((tv) => {
        updated[tv.id] = { isSharing: false, soTien: 0 };
      });
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!moTa.trim()) {
      setErrorMsg('Vui lòng nhập mô tả chi phí.');
      return;
    }

    if (!selectedDateStr) {
      setErrorMsg('Vui lòng chọn ngày chi tiêu.');
      return;
    }

    const activeSharers: NguoiAnChiTiet[] = thanhViens
      .filter((tv) => shareMap[tv.id]?.isSharing)
      .map((tv) => {
        const individual = Number(shareMap[tv.id]?.soTien || 0);
        return {
          thanhVienId: tv.id,
          soTien: individual + tienChungMoiNguoi, // Chi phí thực tế người này phải chịu (riêng + chia đều chung)
          soTienRieng: individual,               // Tiền riêng của người này
        };
      });

    if (activeSharers.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất một người chia sẻ chi phí.');
      return;
    }

    if (tongTienChi <= 0) {
      setErrorMsg('Vui lòng nhập số tiền riêng hoặc tiền chung của chi phí.');
      return;
    }

    const finalNguoiTra = nguoiTraTien.length === 1
      ? [{ thanhVienId: nguoiTraTien[0].thanhVienId, soTienDaTra: tongTienChi }]
      : nguoiTraTien;

    if (finalNguoiTra.length === 0) {
      setErrorMsg('Vui lòng thêm ít nhất một người trả tiền.');
      return;
    }

    const tongTienNguoiTra = finalNguoiTra.reduce((sum, p) => sum + (Number(p.soTienDaTra) || 0), 0);
    if (tongTienNguoiTra <= 0) {
      setErrorMsg('Vui lòng nhập số tiền riêng hoặc tiền chung của chi phí.');
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
        id: chiPhi?.id,
        moTa: moTa.trim(),
        tongTien: tongTienChi,
        tienChung: Number(tienChung || 0),
        ngayChi: selectedDateStr,
        nguoiChiaIds: activeSharers.map((s) => s.thanhVienId),
        chiTietNguoiChia: activeSharers,
        nguoiTraTien: finalNguoiTra,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Lỗi khi lưu thông tin chi phí.');
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
              {chiPhi && chiPhi.id ? 'Cập Nhật Chi Phí Khác' : 'Thêm Chi Phí Khác'}
            </h3>
            <p className="text-xs text-slate-400">Gia vị, gạo, dầu ăn, xà phòng, quỹ chung...</p>
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

          {/* Mô tả chi phí */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-300">Mô tả khoản chi</label>
            <input
              type="text"
              value={moTa}
              onChange={(e) => setMoTa(e.target.value)}
              placeholder="Ví dụ: Mua gạo, gia vị, dầu ăn..."
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          {/* Ngày chi tiêu */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-300">Ngày chi tiêu</label>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={selectedDateStr}
                onChange={(e) => setSelectedDateStr(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
                required
              />
              <span className="text-sm font-bold text-fuchsia-400 bg-fuchsia-950/50 px-3 py-2 rounded-xl border border-fuchsia-500/20">
                {getDayOfWeekVietnamese(selectedDateStr)}
              </span>
            </div>
          </div>

          {/* Tiền chung chi phí (Tự động chia đều cho người chia sẻ) */}
          <div className="space-y-2 p-3.5 rounded-xl bg-fuchsia-950/20 border border-fuchsia-500/30">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-semibold text-fuchsia-300">
                  Tiền dùng chung (Gia vị, đồ dùng chung...)
                </label>
                <span className="block text-[11px] text-slate-400">
                  {soNguoiChia > 0 
                    ? `(Tự động chia đều cho ${soNguoiChia} người chia sẻ)` 
                    : '(Vui lòng chọn người chia sẻ bên dưới)'}
                </span>
              </div>
              {soNguoiChia > 0 && Number(tienChung || 0) > 0 && (
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
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-3.5 pr-8 py-2 text-sm text-amber-300 font-mono font-bold focus:outline-none focus:border-fuchsia-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                đ
              </span>
            </div>
          </div>

          {/* Tổng tiền tự động */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-300">
              Tổng tiền chi phí (Tổng thanh toán)
            </label>
            <div className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3 font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xl font-extrabold text-fuchsia-400">
                  {formatVND(tongTienChi)}
                </span>
                <span className="block text-[11px] text-slate-400 font-normal">
                  (Tiền riêng: {formatVND(tongTienRieng)} + Tiền chung: {formatVND(Number(tienChung || 0))})
                </span>
              </div>
              <span className="text-xs font-normal text-slate-400">
                {soNguoiChia} người chia sẻ
              </span>
            </div>
          </div>

          {/* Ai chia sẻ chi phí này & số tiền từng người */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-semibold text-slate-300">
                  Tiền riêng của từng người ({soNguoiChia}/{thanhViens.length})
                </label>
                <span className="block text-[11px] text-slate-500">
                  Nhập số tiền phần riêng của mỗi người (sẽ cộng thêm phần tiền chung)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllShares}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Tất cả
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllShares}
                  className="text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {thanhViens.map((tv) => {
                const shareInfo = shareMap[tv.id] || { isSharing: false, soTien: 0 };
                const isSelected = shareInfo.isSharing;
                const userRieng = Number(shareInfo.soTien || 0);
                const userTong = userRieng + (isSelected ? tienChungMoiNguoi : 0);

                return (
                  <div
                    key={tv.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border gap-2 transition-all ${
                      isSelected
                        ? 'bg-slate-900/80 border-fuchsia-500/40'
                        : 'bg-slate-950/30 border-slate-800/60 opacity-60'
                    }`}
                  >
                    <div 
                      onClick={() => handleToggleShare(tv.id)}
                      className="flex items-center gap-3 cursor-pointer select-none flex-1"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-fuchsia-600 focus:ring-fuchsia-500 pointer-events-none"
                      />
                      <div>
                        <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                          {tv.ten}
                        </span>
                        {isSelected && (userRieng > 0 || tienChungMoiNguoi > 0) && (
                          <span className="block text-[11px] text-fuchsia-300 font-mono">
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
                          value={shareInfo.soTien === 0 ? '' : shareInfo.soTien}
                          onChange={(e) => handleChangeShareAmount(tv.id, Number(e.target.value))}
                          disabled={!isSelected}
                          className={`w-full bg-slate-950/80 border rounded-xl pl-3 pr-7 py-1.5 text-xs text-right font-mono focus:outline-none transition-colors ${
                            isSelected
                              ? 'border-slate-700 text-fuchsia-300 focus:border-fuchsia-500'
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

          {/* Người chi trả tiền */}
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
                  setNguoiTraTien([{ thanhVienId: id, soTienDaTra: tongTienChi }]);
                }}
                className="flex-1 bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {thanhViens.map((tv) => (
                  <option key={tv.id} value={tv.id} className="bg-slate-900 text-white">
                    {tv.ten} (Người thanh toán)
                  </option>
                ))}
              </select>
              <div className="px-4 py-2.5 bg-fuchsia-950/40 border border-fuchsia-500/30 rounded-xl font-mono text-sm font-bold text-fuchsia-300 whitespace-nowrap select-none">
                {formatVND(tongTienChi)}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {chiPhi?.id && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(chiPhi.id!)}
                className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Xóa chi phí này
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
