import React, { useState } from 'react';
import { User, Trash2, Edit2, Check, X, UserPlus, Loader2 } from 'lucide-react';
import { ThanhVien } from '../services/api';

interface DanhSachThanhVienProps {
  thanhViens: ThanhVien[];
  onAdd: (ten: string) => Promise<void>;
  onUpdate: (id: number, ten: string) => Promise<void>;
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
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTen.trim()) return;
    setActionLoading('add');
    try {
      await onAdd(newTen.trim());
      setNewTen('');
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartEdit = (tv: ThanhVien) => {
    setEditingId(tv.id);
    setEditingTen(tv.ten);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTen('');
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingTen.trim()) return;
    setActionLoading(`edit-${id}`);
    try {
      await onUpdate(id, editingTen.trim());
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
          <p className="text-xs text-slate-400">Quản lý những người ăn chung</p>
        </div>
      </div>

      {/* Form thêm thành viên */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
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
        <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
          {thanhViens.map((tv) => (
            <div
              key={tv.id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 hover:border-slate-700/50 hover:bg-slate-900/60 transition-all duration-200 group"
            >
              {editingId === tv.id ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <input
                    type="text"
                    value={editingTen}
                    onChange={(e) => setEditingTen(e.target.value)}
                    className="flex-1 bg-slate-950 border border-indigo-500 rounded-lg px-2.5 py-1 text-sm text-slate-100 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(tv.id)}
                    disabled={actionLoading === `edit-${tv.id}` || !editingTen.trim()}
                    className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  >
                    {actionLoading === `edit-${tv.id}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium text-slate-200">{tv.ten}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartEdit(tv)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-all"
                      title="Sửa tên"
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
