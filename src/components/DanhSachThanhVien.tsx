import React, { useState, useEffect } from 'react';
import { User, Trash2, Edit2, X, UserPlus, Loader2, QrCode, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import { ThanhVien } from '../services/api';

interface DanhSachThanhVienProps {
  thanhViens: ThanhVien[];
  onAdd: (ten: string, maNganHang?: string | null, soTaiKhoan?: string | null, tenTaiKhoan?: string | null) => Promise<void>;
  onUpdate: (id: number, ten: string, maNganHang?: string | null, soTaiKhoan?: string | null, tenTaiKhoan?: string | null) => Promise<void>;
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
  const [editingMaNganHang, setEditingMaNganHang] = useState('');
  const [editingSoTaiKhoan, setEditingSoTaiKhoan] = useState('');
  const [editingTenTenTaiKhoan, setEditingTenTaiKhoan] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // State thêm ngân hàng khi tạo
  const [showBankForm, setShowBankForm] = useState(false);
  const [newMaNganHang, setNewMaNganHang] = useState('');
  const [newSoTaiKhoan, setNewSoTaiKhoan] = useState('');
  const [newTenTaiKhoan, setNewTenTaiKhoan] = useState('');

  // Danh sách ngân hàng
  const [banks, setBanks] = useState<{ code: string; name: string; shortName: string; bin: string }[]>([]);

  useEffect(() => {
    fetch('https://api.vietqr.io/v2/banks')
      .then((res) => res.json())
      .then((res) => {
        if (res && res.data) {
          setBanks(res.data);
        }
      })
      .catch((err) => {
        console.error('Lỗi khi tải danh sách ngân hàng:', err);
        // Fallback danh sách các ngân hàng phổ biến nhất
        setBanks([
          { code: 'VCB', name: 'Ngoại thương Việt Nam', shortName: 'Vietcombank', bin: '970436' },
          { code: 'TCB', name: 'Kỹ thương Việt Nam', shortName: 'Techcombank', bin: '970407' },
          { code: 'MB', name: 'Quân đội', shortName: 'MBBank', bin: '970422' },
          { code: 'BIDV', name: 'Đầu tư và Phát triển Việt Nam', shortName: 'BIDV', bin: '970418' },
          { code: 'CTG', name: 'Công thương Việt Nam', shortName: 'VietinBank', bin: '970415' },
          { code: 'ACB', name: 'Á Châu', shortName: 'ACB', bin: '970416' },
          { code: 'TPB', name: 'Tiên Phong', shortName: 'TPBank', bin: '970423' },
          { code: 'VPB', name: 'Việt Nam Thịnh Vượng', shortName: 'VPBank', bin: '970432' },
          { code: 'VIB', name: 'Quốc tế', shortName: 'VIB', bin: '970441' },
          { code: 'SHB', name: 'Sài Gòn - Hà Nội', shortName: 'SHB', bin: '970443' },
          { code: 'STB', name: 'Sài Gòn Thương Tín', shortName: 'Sacombank', bin: '970403' },
          { code: 'HDB', name: 'Phát triển Nhà TP.HCM', shortName: 'HDBank', bin: '970437' },
        ]);
      });
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTen.trim()) return;
    setActionLoading('add');
    try {
      await onAdd(
        newTen.trim(),
        newMaNganHang || null,
        newSoTaiKhoan || null,
        newTenTaiKhoan.toUpperCase().trim() || null
      );
      setNewTen('');
      setNewMaNganHang('');
      setNewSoTaiKhoan('');
      setNewTenTaiKhoan('');
      setShowBankForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartEdit = (tv: ThanhVien) => {
    setEditingId(tv.id);
    setEditingTen(tv.ten);
    setEditingMaNganHang(tv.maNganHang || '');
    setEditingSoTaiKhoan(tv.soTaiKhoan || '');
    setEditingTenTaiKhoan(tv.tenTaiKhoan || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTen('');
    setEditingMaNganHang('');
    setEditingSoTaiKhoan('');
    setEditingTenTaiKhoan('');
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingTen.trim()) return;
    setActionLoading(`edit-${id}`);
    try {
      await onUpdate(
        id,
        editingTen.trim(),
        editingMaNganHang || null,
        editingSoTaiKhoan || null,
        editingTenTenTaiKhoan.toUpperCase().trim() || null
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
          <p className="text-xs text-slate-400">Quản lý người ăn chung & tài khoản nhận tiền</p>
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

        {/* Nút toggle nhập ngân hàng */}
        <button
          type="button"
          onClick={() => setShowBankForm(!showBankForm)}
          className="text-xs text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-1 cursor-pointer select-none font-medium"
        >
          {showBankForm ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showBankForm ? 'Ẩn thiết lập QR ngân hàng' : 'Thêm thiết lập QR ngân hàng (Tùy chọn)'}
        </button>

        {/* Cấu hình ngân hàng mở rộng */}
        {showBankForm && (
          <div className="space-y-2.5 pt-2 border-t border-slate-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">NGÂN HÀNG</label>
                <select
                  value={newMaNganHang}
                  onChange={(e) => setNewMaNganHang(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-750 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Chọn ngân hàng --</option>
                  {banks.map((b) => (
                    <option key={b.bin} value={b.bin}>
                      {b.shortName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">SỐ TÀI KHOẢN</label>
                <input
                  type="text"
                  value={newSoTaiKhoan}
                  onChange={(e) => setNewSoTaiKhoan(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-750 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-550 focus:outline-none focus:border-indigo-500"
                  placeholder="Số tài khoản"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-bold block mb-1">TÊN TÀI KHOẢN (KHÔNG DẤU)</label>
              <input
                type="text"
                value={newTenTaiKhoan}
                onChange={(e) => setNewTenTaiKhoan(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-750 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-550 focus:outline-none focus:border-indigo-500 uppercase"
                placeholder="Ví dụ: NGUYEN VAN A"
              />
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
                      className="w-full bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      placeholder="Tên thành viên"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-1">NGÂN HÀNG</label>
                      <select
                        value={editingMaNganHang}
                        onChange={(e) => setEditingMaNganHang(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">-- Chọn --</option>
                        {banks.map((b) => (
                          <option key={b.bin} value={b.bin}>
                            {b.shortName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-1">SỐ TÀI KHOẢN</label>
                      <input
                        type="text"
                        value={editingSoTaiKhoan}
                        onChange={(e) => setEditingSoTaiKhoan(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                        placeholder="Số tài khoản"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">TÊN TÀI KHOẢN (KHÔNG DẤU)</label>
                    <input
                      type="text"
                      value={editingTenTenTaiKhoan}
                      onChange={(e) => setEditingTenTaiKhoan(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 uppercase"
                      placeholder="Ví dụ: NGUYEN VAN A"
                    />
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
                      {tv.soTaiKhoan && (
                        <span className="p-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Đã cấu hình mã QR ngân hàng">
                          <QrCode className="w-3 h-3" />
                        </span>
                      )}
                    </span>
                    {tv.soTaiKhoan && (
                      <span className="block text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                        <CreditCard className="w-3.5 h-3.5 text-indigo-400/80" />
                        {banks.find((b) => b.bin === tv.maNganHang)?.shortName || tv.maNganHang} - {tv.soTaiKhoan}
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
