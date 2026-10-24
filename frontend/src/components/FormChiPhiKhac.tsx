import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Loader2, AlertCircle, Calculator } from 'lucide-react';
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
  // Quản lý từng người chia sẻ: id -> { isSharing: boolean, soTien: number }
  const [shareMap, setShareMap] = useState<Record<number, { isSharing: boolean; soTien: number }>>({});
  const [nguoiTraTien, setNguoiTraTien] = useState<NguoiTraTien[]>([]);
  const [isManualPayerAmount, setIsManualPayerAmount] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Tính tổng tiền dựa trên tiền của từng người chia sẻ
  const tongTienChi = Object.values(shareMap).reduce((sum, item) => {
    return sum + (item.isSharing ? (Number(item.soTien) || 0) : 0);
  }, 0);

  // Load dữ liệu cũ nếu đang chỉnh sửa
  useEffect(() => {
    if (chiPhi && chiPhi.id) {
      setMoTa(chiPhi.moTa || '');
      setSelectedDateStr(chiPhi.ngayAn.split('T')[0]);
      
      const newShareMap: Record<number, { isSharing: boolean; soTien: number }> = {};
      const chiPhiEaterIds = chiPhi.nguoiAnIds || [];
      const detailedShares = chiPhi.chiTietNguoiAn || [];
      const defaultPerPerson = chiPhiEaterIds.length > 0 ? Math.round(chiPhi.tongTien / chiPhiEaterIds.length) : 0;

      thanhViens.forEach((tv) => {
        const isSharing = chiPhiEaterIds.includes(tv.id);
        const detailed = detailedShares.find((d) => d.thanhVienId === tv.id);
        const amount = detailed && Number(detailed.soTien) > 0 ? Number(detailed.soTien) : (isSharing ? defaultPerPerson : 0);
        newShareMap[tv.id] = { isSharing, soTien: amount };
      });
      setShareMap(newShareMap);

      setNguoiTraTien(chiPhi.nguoiTraTien || []);
      setIsManualPayerAmount(true);
    } else {
      setMoTa('');
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
      setIsManualPayerAmount(false);
    }
    setErrorMsg(null);
  }, [chiPhi, daysOfWeek, thanhViens]);

  // Tự động gán số tiền người trả bằng tổng tiền nếu chỉ có 1 người trả và chưa sửa tay
  useEffect(() => {
    if (!isManualPayerAmount && nguoiTraTien.length === 1 && tongTienChi > 0) {
      setNguoiTraTien([{ thanhVienId: nguoiTraTien[0].thanhVienId, soTienDaTra: tongTienChi }]);
    }
  }, [tongTienChi, isManualPayerAmount, nguoiTraTien.length]);

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

  const handleSplitEqually = () => {
    const checkedMembers = thanhViens.filter((tv) => shareMap[tv.id]?.isSharing);
    if (checkedMembers.length === 0) {
      alert('Vui lòng chọn ít nhất một người chia sẻ chi phí.');
      return;
    }
    const inputTotal = prompt('Nhập tổng số tiền chi phí để chia đều:', tongTienChi > 0 ? String(tongTienChi) : '');
    if (!inputTotal) return;
    const totalNum = Number(inputTotal);
    if (isNaN(totalNum) || totalNum <= 0) {
      alert('Số tiền không hợp lệ.');
      return;
    }

    const perPerson = Math.round(totalNum / checkedMembers.length);
    setShareMap((prev) => {
      const updated = { ...prev };
      checkedMembers.forEach((tv) => {
        updated[tv.id] = { isSharing: true, soTien: perPerson };
      });
      return updated;
    });

    if (nguoiTraTien.length === 1) {
      setNguoiTraTien([{ thanhVienId: nguoiTraTien[0].thanhVienId, soTienDaTra: totalNum }]);
    }
  };

  const handleAddNguoiTra = () => {
    const available = thanhViens.find((tv) => !nguoiTraTien.some((ntt) => ntt.thanhVienId === tv.id));
    const nextId = available ? available.id : (thanhViens[0]?.id || 0);
    setNguoiTraTien([...nguoiTraTien, { thanhVienId: nextId, soTienDaTra: 0 }]);
    setIsManualPayerAmount(true);
  };

  const handleRemoveNguoiTra = (index: number) => {
    setNguoiTraTien(nguoiTraTien.filter((_, idx) => idx !== index));
    setIsManualPayerAmount(true);
  };

  const handleChangeNguoiTraId = (index: number, newId: number) => {
    const updated = [...nguoiTraTien];
    updated[index].thanhVienId = newId;
    setNguoiTraTien(updated);
  };

  const handleChangeNguoiTraTien = (index: number, amount: number) => {
    const updated = [...nguoiTraTien];
    updated[index].soTienDaTra = amount;
    setNguoiTraTien(updated);
    setIsManualPayerAmount(true);
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
      .map((tv) => ({
        thanhVienId: tv.id,
        soTien: Number(shareMap[tv.id]?.soTien || 0),
      }));

    if (activeSharers.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất một người chia sẻ chi phí.');
      return;
    }

    const tongTien = activeSharers.reduce((sum, s) => sum + s.soTien, 0);
    if (tongTien <= 0) {
      setErrorMsg('Vui lòng nhập số tiền cho ít nhất một người chia sẻ.');
      return;
    }

    if (nguoiTraTien.length === 0) {
      setErrorMsg('Vui lòng thêm ít nhất một người trả tiền.');
      return;
    }

    const tongTienNguoiTra = nguoiTraTien.reduce((sum, p) => sum + (Number(p.soTienDaTra) || 0), 0);
    if (tongTienNguoiTra <= 0) {
      setErrorMsg('Vui lòng nhập số tiền người chi trả.');
      return;
    }

    // Kiểm tra trùng lặp người trả tiền
    const listPayerIds = nguoiTraTien.map((p) => p.thanhVienId);
    if (new Set(listPayerIds).size !== listPayerIds.length) {
      setErrorMsg('Danh sách người trả tiền không được trùng lặp.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: chiPhi?.id,
        moTa: moTa.trim(),
        tongTien,
        ngayChi: selectedDateStr,
        nguoiChiaIds: activeSharers.map((s) => s.thanhVienId),
        chiTietNguoiChia: activeSharers,
        nguoiTraTien,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Lỗi khi lưu thông tin chi phí.');
    } finally {
      setSaving(false);
    }
  };

  const checkedCount = thanhViens.filter((tv) => shareMap[tv.id]?.isSharing).length;

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

          {/* Tổng tiền tự động */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-300">
                Tổng tiền chi phí (Tự động cộng tiền của từng người)
              </label>
              <button
                type="button"
                onClick={handleSplitEqually}
                className="text-xs text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                title="Nhập tổng tiền để chia đều cho mọi người"
              >
                <Calculator className="w-3.5 h-3.5" />
                Chia đều số tiền
              </button>
            </div>
            <div className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3 text-lg font-extrabold text-fuchsia-400 font-mono flex items-center justify-between">
              <span>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(tongTienChi)}</span>
              <span className="text-xs font-normal text-slate-500">
                {checkedCount} người chia sẻ
              </span>
            </div>
          </div>

          {/* Ai chia sẻ chi phí này & số tiền từng người */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-semibold text-slate-300">
                  Số tiền chia của từng người ({checkedCount}/{thanhViens.length})
                </label>
                <span className="block text-[11px] text-slate-500">
                  Nhập số tiền phần chia của mỗi thành viên
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

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {thanhViens.map((tv) => {
                const shareInfo = shareMap[tv.id] || { isSharing: false, soTien: 0 };
                const isSelected = shareInfo.isSharing;

                return (
                  <div
                    key={tv.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
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
                      <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                        {tv.ten}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 w-44">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          placeholder="0"
                          min="0"
                          step="1000"
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
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-slate-300">
                  Người chi trả tiền
                </label>
                <span className="block text-[11px] text-slate-500">
                  Ai đứng ra thanh toán tổng số tiền trên
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddNguoiTra}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm người trả
              </button>
            </div>

            <div className="space-y-2.5">
              {nguoiTraTien.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={item.thanhVienId}
                    onChange={(e) => handleChangeNguoiTraId(idx, Number(e.target.value))}
                    className="flex-1 bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {thanhViens.map((tv) => (
                      <option key={tv.id} value={tv.id} className="bg-slate-900 text-white">
                        {tv.ten} (Người trả)
                      </option>
                    ))}
                  </select>

                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={item.soTienDaTra === 0 ? '' : item.soTienDaTra}
                      onChange={(e) => handleChangeNguoiTraTien(idx, Number(e.target.value))}
                      placeholder="0"
                      min="0"
                      step="1000"
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-3.5 pr-8 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                      đ
                    </span>
                  </div>

                  {nguoiTraTien.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveNguoiTra(idx)}
                      className="p-2.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
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
