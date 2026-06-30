import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Loader2, AlertCircle } from 'lucide-react';
import { BuaToi, NguoiTraTien, ThanhVien } from '../services/api';

interface DayConfig {
  thu: string;
  dateString: string;
  displayDate: string;
}

interface FormChiPhiKhacProps {
  daysOfWeek: DayConfig[];
  chiPhi?: BuaToi;
  thanhViens: ThanhVien[];
  onSave: (payload: {
    id?: number;
    moTa: string;
    tongTien: number;
    ngayChi: string;
    nguoiChiaIds: number[];
    nguoiTraTien: NguoiTraTien[];
  }) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  onClose: () => void;
}

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
  const [nguoiChiaIds, setNguoiChiaIds] = useState<number[]>([]);
  const [nguoiTraTien, setNguoiTraTien] = useState<NguoiTraTien[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Tính tổng tiền dựa trên các khoản tiền người trả
  const tongTien = nguoiTraTien.reduce((sum, curr) => sum + (Number(curr.soTienDaTra) || 0), 0);

  // Load dữ liệu cũ nếu đang chỉnh sửa
  useEffect(() => {
    if (chiPhi && chiPhi.id) {
      setMoTa(chiPhi.moTa || '');
      setSelectedDateStr(chiPhi.ngayAn.split('T')[0]);
      setNguoiChiaIds(chiPhi.nguoiAnIds);
      setNguoiTraTien(chiPhi.nguoiTraTien);
    } else {
      setMoTa('');
      if (chiPhi && chiPhi.ngayAn) {
        setSelectedDateStr(chiPhi.ngayAn.split('T')[0]);
      } else if (daysOfWeek.length > 0) {
        setSelectedDateStr(daysOfWeek[0].dateString);
      }
      // Mặc định chọn tất cả mọi người chia sẻ
      setNguoiChiaIds(thanhViens.map((tv) => tv.id));
      // Mặc định tạo một dòng thanh toán trống cho người đầu tiên
      if (thanhViens.length > 0) {
        setNguoiTraTien([{ thanhVienId: thanhViens[0].id, soTienDaTra: 0 }]);
      } else {
        setNguoiTraTien([]);
      }
    }
    setErrorMsg(null);
  }, [chiPhi, daysOfWeek, thanhViens]);

  const handleToggleNguoiChia = (id: number) => {
    if (nguoiChiaIds.includes(id)) {
      setNguoiChiaIds(nguoiChiaIds.filter((x) => x !== id));
    } else {
      setNguoiChiaIds([...nguoiChiaIds, id]);
    }
  };

  const handleSelectAllNguoiChia = () => {
    setNguoiChiaIds(thanhViens.map((tv) => tv.id));
  };

  const handleDeselectAllNguoiChia = () => {
    setNguoiChiaIds([]);
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

    if (!moTa.trim()) {
      setErrorMsg('Vui lòng nhập mô tả chi phí.');
      return;
    }

    if (tongTien <= 0) {
      setErrorMsg('Vui lòng nhập số tiền cho ít nhất một người thanh toán.');
      return;
    }

    if (nguoiChiaIds.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất một người chia sẻ chi phí.');
      return;
    }

    if (nguoiTraTien.length === 0) {
      setErrorMsg('Vui lòng thêm ít nhất một người trả tiền.');
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
        nguoiChiaIds,
        nguoiTraTien,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Lỗi khi lưu thông tin chi phí.');
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
              {chiPhi && chiPhi.id ? 'Cập Nhật Chi Phí Khác' : 'Thêm Chi Phí Khác'}
            </h3>
            <p className="text-xs text-slate-400">Gia vị, dầu ăn, quỹ nhóm, chi phí dùng chung...</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
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
            <label className="block text-sm font-semibold text-slate-300">Mô tả chi phí</label>
            <input
              type="text"
              value={moTa}
              onChange={(e) => setMoTa(e.target.value)}
              placeholder="Ví dụ: Mua gia vị, bột giặt, nước mắm..."
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Ngày chi tiêu */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-400">Ngày chi tiêu</label>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 font-medium">
              {(() => {
                const matched = daysOfWeek.find((d) => d.dateString === selectedDateStr);
                return matched ? `${matched.thu} (${matched.displayDate})` : selectedDateStr;
              })()}
            </div>
          </div>

          {/* Tổng tiền tự động */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-300">
              Tổng tiền chi phí (Tự động tính từ người trả)
            </label>
            <div className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3.5 text-lg font-extrabold text-pink-400 font-mono">
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(tongTien)}
            </div>
          </div>

          {/* Ai chia sẻ chi phí này */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-300">Ai chia sẻ chi phí này?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllNguoiChia}
                  className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
                >
                  Chọn tất cả
                </button>
                <span className="text-slate-700 text-xs">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllNguoiChia}
                  className="text-xs text-rose-400 hover:text-rose-300 hover:underline"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            </div>

            {thanhViens.length === 0 ? (
              <div className="text-sm text-slate-500 italic">Hãy tạo thành viên trước!</div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {thanhViens.map((tv) => {
                  const isChecked = nguoiChiaIds.includes(tv.id);
                  return (
                    <label
                      key={tv.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer select-none transition-all ${
                        isChecked
                          ? 'bg-pink-950/15 border-pink-500/30 text-pink-200'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-950/60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleNguoiChia(tv.id)}
                        className="rounded border-slate-800 text-pink-600 focus:ring-pink-500/30 bg-slate-950 w-4 h-4"
                      />
                      <span className="text-sm font-medium">{tv.ten}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ai trả tiền */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-300">Ai trả tiền?</label>

            {thanhViens.length === 0 ? (
              <div className="text-sm text-slate-500 italic">Không có thành viên.</div>
            ) : (
              <div className="space-y-2.5">
                {nguoiTraTien.map((ntt, idx) => (
                  <div key={idx} className="flex gap-2 items-start bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                    <select
                      value={ntt.thanhVienId}
                      onChange={(e) => handleChangeNguoiTraId(idx, Number(e.target.value))}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 min-w-[130px]"
                    >
                      {thanhViens.map((tv) => (
                        <option key={tv.id} value={tv.id}>
                          {tv.ten}
                        </option>
                      ))}
                    </select>

                    <div className="flex-1 flex flex-col">
                      <input
                        type="number"
                        value={ntt.soTienDaTra || ''}
                        onChange={(e) => handleChangeNguoiTraTien(idx, Number(e.target.value))}
                        placeholder="Số tiền trả"
                        required
                        min="0"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                      {Number(ntt.soTienDaTra) > 0 && (
                        <span className="text-[10px] text-pink-400 font-mono mt-1 pl-1">
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(ntt.soTienDaTra)}
                        </span>
                      )}
                    </div>

                    {nguoiTraTien.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveNguoiTra(idx)}
                        className="p-2.5 mt-0.5 text-slate-500 hover:text-rose-450 hover:bg-rose-550/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddNguoiTra}
                  disabled={nguoiTraTien.length >= thanhViens.length}
                  className="w-full py-2.5 border border-dashed border-slate-800 hover:border-pink-500/50 hover:bg-pink-950/10 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-pink-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Thêm người trả tiền
                </button>
              </div>
            )}
          </div>

          {/* Footer nút */}
          <div className="flex gap-3 justify-end pt-4 border-t border-slate-800">
            {chiPhi && chiPhi.id && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(chiPhi.id!)}
                className="mr-auto px-5 py-2.5 bg-rose-950/20 border border-rose-900/30 hover:bg-rose-900/20 text-sm font-semibold text-rose-350 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Xóa chi phí
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-sm font-semibold text-slate-300 rounded-xl transition-all cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || tongTien <= 0}
              className="gradient-btn px-5 py-2.5 text-white font-semibold rounded-xl text-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Lưu chi phí
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
