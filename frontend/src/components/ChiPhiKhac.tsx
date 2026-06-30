import React from 'react';
import { Coins, Users, CreditCard, Edit, Trash2, PlusCircle } from 'lucide-react';
import { BuaToi, ThanhVien } from '../services/api';

interface DayConfig {
  thu: string;
  dateString: string;
  displayDate: string;
}

interface ChiPhiKhacProps {
  chiPhis: BuaToi[];
  thanhViens: ThanhVien[];
  daysOfWeek: DayConfig[];
  onAdd: (dateString: string) => void;
  onEdit: (chiPhi: BuaToi) => void;
  onDelete: (id: number) => void;
}

export const ChiPhiKhac: React.FC<ChiPhiKhacProps> = React.memo(({
  chiPhis,
  thanhViens,
  daysOfWeek,
  onAdd,
  onEdit,
  onDelete,
}) => {

  
  const getTenThanhVien = (id: number) => {
    return thanhViens.find((tv) => tv.id === id)?.ten || `Thành viên #${id}`;
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl border border-slate-800">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
          <Coins className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Chi Phí Khác</h2>
          <p className="text-xs text-slate-400">Gia vị, dầu ăn, xà phòng, quỹ chung... (bấm để thêm)</p>
        </div>
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
        {daysOfWeek.map((day) => {
          // Lọc các chi phí thuộc ngày này theo thứ trong tuần
          const dayChiPhis = chiPhis.filter(
            (cp) => cp && cp.thuTrongTuan === day.thu
          );
          const hasChiPhi = dayChiPhis.length > 0;
          const tongTienNgay = dayChiPhis.reduce((sum, curr) => sum + curr.tongTien, 0);

          return (
            <div
              key={day.thu}
              onClick={() => {
                if (!hasChiPhi) {
                  onAdd(day.dateString);
                }
              }}
              className={`group relative flex flex-col p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                hasChiPhi
                  ? 'bg-slate-900/60 border-pink-500/20 hover:border-pink-500/40 hover:shadow-pink-950/5'
                  : 'bg-slate-900/20 border-slate-800/80 hover:border-slate-700/60 hover:bg-slate-900/35'
              } hover:shadow-lg`}
            >
              {/* Header của Day Card */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200 group-hover:text-pink-400 transition-colors">
                    {day.thu}
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-full font-mono">
                    {day.displayDate}
                  </span>
                </div>
                {hasChiPhi ? (
                  <span className="text-sm font-bold text-pink-400">
                    {formatVND(tongTienNgay)}
                  </span>
                ) : (
                  <span className="text-xs text-slate-600 italic">Chưa có chi phí</span>
                )}
              </div>

              {/* Danh sách các chi phí trong ngày */}
              {hasChiPhi && (
                <div className="space-y-3 pt-2">
                  {dayChiPhis.map((cp) => (
                    <div
                      key={cp.id}
                      className="relative group/item p-3 bg-slate-950/40 rounded-xl border border-slate-850 hover:border-pink-500/20 transition-all"
                    >
                      {/* Tiêu đề & Tiền của chi phí */}
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="font-bold text-xs text-slate-200 group-hover/item:text-pink-300 transition-colors">
                          {cp.moTa}
                        </span>
                        <span className="font-mono font-extrabold text-[11px] text-pink-400/90">
                          {formatVND(cp.tongTien)}
                        </span>
                      </div>

                      {/* Chi tiết người chi & người chia */}
                      <div className="space-y-1.5 pt-1.5 border-t border-slate-850/50">
                        {/* Người chi */}
                        <div className="flex items-start gap-1 text-[10px] text-slate-400">
                          <CreditCard className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            {cp.nguoiTraTien?.map((ntt) => (
                              <span key={ntt.thanhVienId} className="text-slate-350">
                                {getTenThanhVien(ntt.thanhVienId)}:{' '}
                                <span className="font-semibold text-slate-250">
                                  {formatVND(ntt.soTienDaTra)}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Người chia */}
                        <div className="flex items-start gap-1 text-[10px] text-slate-400">
                          <Users className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                          <div className="flex flex-wrap gap-1">
                            {cp.nguoiAnIds?.map((id) => (
                              <span
                                key={id}
                                className="bg-pink-950/15 text-pink-300 px-1.5 py-0.2 rounded border border-pink-500/10 text-[9px] font-medium"
                              >
                                {getTenThanhVien(id)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Nút Sửa/Xóa của chi phí này */}
                      <div className="absolute right-2 top-2 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 flex gap-1 bg-slate-900/90 p-0.5 rounded border border-slate-800">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(cp);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-400 rounded hover:bg-slate-800 transition-all cursor-pointer"
                          title="Sửa chi phí"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Bạn có chắc muốn xóa chi phí này?')) {
                              onDelete(cp.id!);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-450 rounded hover:bg-slate-800 transition-all cursor-pointer"
                          title="Xóa chi phí"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Nút Thêm mới chi phí khi hover */}
              <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd(day.dateString);
                  }}
                  className="p-1 rounded-lg bg-slate-800 text-slate-450 hover:text-pink-400 hover:bg-slate-700 transition-all cursor-pointer"
                  title="Thêm chi phí cho ngày này"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
