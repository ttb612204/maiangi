import React, { useState } from 'react';
import { User, Trash2, Edit2, X, UserPlus, Loader2, QrCode, CreditCard, ChevronDown, ChevronUp, Image, Trash } from 'lucide-react';
import { ThanhVien } from '../services/api';

interface DanhSachThanhVienProps {
  thanhViens: ThanhVien[];
  onAdd: (ten: string, maNganHang?: string | null, soTaiKhoan?: string | null, tenTaiKhoan?: string | null, qrCodeImage?: string | null) => Promise<void>;
  onUpdate: (id: number, ten: string, maNganHang?: string | null, soTaiKhoan?: string | null, tenTaiKhoan?: string | null, qrCodeImage?: string | null) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  loading: boolean;
}

export const DanhSachThanhVien: React.FC<DanhSachThanhVienProps> = React.memo(({
  thanhViens,
  onAdd,
  onUpdate,
  onDelete,
  loading,
}) => {
  const [newTen, setNewTen] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTen, setEditingTen] = useState('');
  const [editingQrCodeImage, setEditingQrCodeImage] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // State thêm ảnh QR khi tạo mới
  const [showQrForm, setShowQrForm] = useState(false);
  const [newQrCodeImage, setNewQrCodeImage] = useState<string>('');

  const handleImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    callback: (base64: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Giới hạn ảnh QR tối đa 500px chiều dài/rộng để giảm kích thước lưu trữ
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 500;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Nén chất lượng JPEG xuống 70% (khoảng 20KB-40KB, quét cực nhạy và lưu siêu nhẹ)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          callback(compressedBase64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTen.trim()) return;
    setActionLoading('add');
    try {
      await onAdd(
        newTen.trim(),
        null,
        null,
        null,
        newQrCodeImage || null
      );
      setNewTen('');
      setNewQrCodeImage('');
      setShowQrForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartEdit = (tv: ThanhVien) => {
    setEditingId(tv.id);
    setEditingTen(tv.ten);
    setEditingQrCodeImage(tv.qrCodeImage || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTen('');
    setEditingQrCodeImage('');
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingTen.trim()) return;
    setActionLoading(`edit-${id}`);
    try {
      await onUpdate(
        id,
        editingTen.trim(),
        null,
        null,
        null,
        editingQrCodeImage || null
      );
      setEditingId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa thành viên này? Tất cả lịch sử ăn và trả tiền liên quan cũng sẽ bị xóa.')) {
      return;
    }
    setActionLoading(`delete-${id}`);
    try {
      await onDelete(id);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl border border-slate-800">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Thành Viên Nhóm</h2>
          <p className="text-xs text-slate-400">Quản lý người ăn chung & tải ảnh QR nhận tiền</p>
        </div>
      </div>

      {/* Form thêm thành viên */}
      <form onSubmit={handleAdd} className="space-y-3 mb-6 bg-slate-900/20 p-4 rounded-xl border border-slate-800/40">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTen}
            onChange={(e) => setNewTen(e.target.value)}
            placeholder="Nhập tên thành viên..."
            disabled={loading || actionLoading === 'add'}
            className="flex-1 bg-slate-900/60 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || actionLoading === 'add' || !newTen.trim()}
            className="gradient-btn text-white rounded-xl px-4 py-2.5 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {actionLoading === 'add' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <UserPlus className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Nút toggle thêm ảnh QR */}
        <button
          type="button"
          onClick={() => setShowQrForm(!showQrForm)}
          className="text-xs text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-1 cursor-pointer select-none font-medium"
        >
          {showQrForm ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showQrForm ? 'Ẩn thiết lập QR ngân hàng' : 'Thêm ảnh QR ngân hàng (Tùy chọn)'}
        </button>

        {/* Cấu hình thêm ảnh QR */}
        {showQrForm && (
          <div className="space-y-3 pt-3 border-t border-slate-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-4 transition-colors bg-slate-900/40 relative">
              {newQrCodeImage ? (
                <div className="flex flex-col items-center space-y-2 w-full">
                  <img
                    src={newQrCodeImage}
                    alt="Xem trước QR"
                    className="w-32 h-32 object-contain rounded-lg border border-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setNewQrCodeImage('')}
                    className="text-[10px] text-rose-450 hover:text-rose-400 flex items-center gap-1 font-semibold"
                  >
                    <Trash className="w-3 h-3" /> Xóa ảnh và chọn lại
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center cursor-pointer space-y-1.5 py-2 w-full">
                  <Image className="w-7 h-7 text-slate-500" />
                  <span className="text-xs text-slate-300 font-medium">Bấm để tải ảnh QR lên</span>
                  <span className="text-[9px] text-slate-500">Hỗ trợ PNG, JPG (Tối đa 1.5MB)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, setNewQrCodeImage)}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        )}
      </form>

      {/* Danh sách thành viên */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : thanhViens.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          Chưa có thành viên nào. Hãy thêm thành viên ở trên!
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
          {thanhViens.map((tv) => (
            <div
              key={tv.id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 hover:border-slate-700/50 hover:bg-slate-900/60 transition-all duration-200 group"
            >
              {editingId === tv.id ? (
                <div className="flex flex-col gap-2.5 flex-1 mr-2 p-3 bg-slate-950/40 rounded-xl border border-slate-800 animate-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1">
                    <span className="text-xs font-bold text-indigo-400">CHỈNH SỬA THÀNH VIÊN</span>
                    <button
                      onClick={handleCancelEdit}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">TÊN THÀNH VIÊN</label>
                    <input
                      type="text"
                      value={editingTen}
                      onChange={(e) => setEditingTen(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      placeholder="Tên thành viên"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">ẢNH QR THANH TOÁN</label>
                    <div className="flex items-center gap-3 border border-slate-750 bg-slate-900 rounded-lg p-2 mt-1">
                      {editingQrCodeImage ? (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <img
                              src={editingQrCodeImage}
                              alt="Xem trước QR sửa"
                              className="w-10 h-10 object-contain rounded border border-slate-800 bg-white"
                            />
                            <span className="text-[10px] text-emerald-400 font-medium">Đã tải ảnh lên</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingQrCodeImage('')}
                            className="p-1 rounded bg-slate-850 hover:bg-slate-800 text-rose-400 hover:text-rose-350 transition-colors"
                            title="Xóa ảnh QR"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 cursor-pointer py-1.5 w-full">
                          <Image className="w-4 h-4 text-slate-400" />
                          <span className="text-[11px] text-slate-300 font-medium">Bấm để tải ảnh QR lên</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageChange(e, setEditingQrCodeImage)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-1.5 mt-1 border-t border-slate-800/50 pt-2">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-[11px] font-semibold text-slate-300 hover:bg-slate-750 transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(tv.id)}
                      disabled={actionLoading === `edit-${tv.id}` || !editingTen.trim()}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-[11px] font-semibold text-white hover:bg-indigo-500 transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {actionLoading === `edit-${tv.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Lưu thay đổi'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                      {tv.ten}
                      {tv.qrCodeImage && (
                        <span className="p-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Đã cài đặt ảnh QR thanh toán">
                          <QrCode className="w-3 h-3" />
                        </span>
                      )}
                    </span>
                    {tv.qrCodeImage && (
                      <span className="block text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                        <CreditCard className="w-3.5 h-3.5 text-indigo-400/80" />
                        Đã cài đặt ảnh QR thanh toán
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartEdit(tv)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-all"
                      title="Sửa thông tin"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(tv.id)}
                      disabled={actionLoading === `delete-${tv.id}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all"
                      title="Xóa thành viên"
                    >
                      {actionLoading === `delete-${tv.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
