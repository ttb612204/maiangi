import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Loader2, AlertCircle } from 'lucide-react';
import { BuaToi, NguoiTraTien, ThanhVien } from '../services/api';

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

export const FormNhapTien: React.FC<FormNhapTienProps> = ({
  day,
  buaToi,
  thanhViens,
  onSave,
  onDelete,
  onClose,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [nguoiAnIds, setNguoiAnIds] = useState<number[]>([]);
  const [nguoiTraTien, setNguoiTraTien] = useState<NguoiTraTien[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Tính tổng tiền dựa trên các khoản tiền người trả
  const tongTien = nguoiTraTien.reduce((sum, curr) => sum + (Number(curr.soTienDaTra) || 0), 0);

  // Load dữ liệu cũ nếu đang chỉnh sửa
  useEffect(() => {
    if (buaToi) {
      setSelectedDate(buaToi.ngayAn.split('T')[0]);
      setNguoiAnIds(buaToi.nguoiAnIds || []);
      setNguoiTraTien(buaToi.nguoiTraTien || []);
    } else if (day) {
      setSelectedDate(day.dateString);
      setNguoiAnIds(thanhViens.map((tv) => tv.id));
      if (thanhViens.length > 0) {
        setNguoiTraTien([{ thanhVienId: thanhViens[0].id, soTienDaTra: 0 }]);
      } else {
        setNguoiTraTien([]);
      }
    } else {
      setSelectedDate(getTodayString());
      setNguoiAnIds(thanhViens.map((tv) => tv.id));
      if (thanhViens.length > 0) {
        setNguoiTraTien([{ thanhVienId: thanhViens[0].id, soTienDaTra: 0 }]);
      } else {
        setNguoiTraTien([]);
      }
    }
    setErrorMsg(null);
  }, [buaToi, day, thanhViens]);

  const handleToggleNguoiAn = (id: number) => {
    if (nguoiAnIds.includes(id)) {
      setNguoiAnIds(nguoiAnIds.filter((x) => x !== id));
    } else {
      setNguoiAnIds([...nguoiAnIds, id]);
    }
  };

  const handleSelectAllNguoiAn = () => {
    setNguoiAnIds(thanhViens.map((tv) => tv.id));
  };

  const handleDeselectAllNguoiAn = () => {
    setNguoiAnIds([]);
  };

  const handleAddNguoiTra = () => {
    const available = thanhViens.find((tv) => !nguoiTraTien.some((ntt) => ntt.thanhVienId === tv.id));
    const nextId = available ? available.id : (thanhViens[0]?.id || 0);
    setNguoiTraTien([...nguoiTraTien, { thanhVienId: nextId, soTienDaTra: 0 }]);
  };

  const handleRemoveNguoiTra = (index: number) => {
    setNguoiTraTien(nguoiTraTien.filter((_, idx) => idx !== index));
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedDate) {
      setErrorMsg('Vui lòng chọn ngày ăn.');
      return;
    }

    if (tongTien <= 0) {
      setErrorMsg('Vui lòng nhập số tiền cho ít nhất một người thanh toán.');
      return;
    }

    if (nguoiAnIds.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất một người ăn.');
      return;
    }

    if (nguoiTraTien.length === 0) {
      setErrorMsg('Vui lòng thêm ít nhất một người trả tiền.');
      return;
    }

    // Kiểm tra xem có trùng lặp người trả tiền không
    const listPayerIds = nguoiTraTien.map((p) => p.thanhVienId);
    if (new Set(listPayerIds).size !== listPayerIds.length) {
      setErrorMsg('Danh sách người trả tiền không được trùng lặp.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: buaToi?.id,
        thuTrongTuan: getDayOfWeekVietnamese(selectedDate),
        tongTien,
        ngayAn: selectedDate,
        nguoiAnIds,
        nguoiTraTien,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Lỗi khi lưu thông tin.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
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
                className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
                required
              />
              <span className="text-sm font-bold text-indigo-400 bg-indigo-950/50 px-3 py-2 rounded-xl border border-indigo-500/20">
                {getDayOfWeekVietnamese(selectedDate)}
              </span>
            </div>
          </div>

          {/* Tổng tiền hiển thị tự động */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-300">
              Tổng tiền bữa tối (Tự động tính từ người trả)
            </label>
            <div className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3.5 text-lg font-extrabold text-indigo-400 font-mono">
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(tongTien)}
            </div>
          </div>

          {/* Danh sách người ăn */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-300">
                Người tham gia ăn ({nguoiAnIds.length}/{thanhViens.length})
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllNguoiAn}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Tất cả
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllNguoiAn}
                  className="text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {thanhViens.map((tv) => {
                const isSelected = nguoiAnIds.includes(tv.id);
                return (
                  <button
                    key={tv.id}
                    type="button"
                    onClick={() => handleToggleNguoiAn(tv.id)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-900/60 hover:text-slate-300'
                    }`}
                  >
                    <span className="truncate">{tv.ten}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? 'bg-indigo-400' : 'bg-slate-700'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Danh sách người trả tiền */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-300">
                Người chi trả tiền
              </label>
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
                        {tv.ten}
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
