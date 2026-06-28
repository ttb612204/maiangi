import React from 'react';
import { Calendar, PlusCircle, Edit, Users, CreditCard, Trash2 } from 'lucide-react';
import { BuaToi, ThanhVien } from '../services/api';

interface DayConfig {
  thu: string;
  dateString: string;
  displayDate: string;
}

interface LichAnTuanProps {
  buaTois: BuaToi[];
  thanhViens: ThanhVien[];
  daysOfWeek: DayConfig[];
  onSelectDay: (day: DayConfig, buaToi?: BuaToi) => void;
  onDeleteDay: (id: number) => void;
}

export const LichAnTuan: React.FC<LichAnTuanProps> = React.memo(({
  buaTois,
  thanhViens,
  daysOfWeek,
  onSelectDay,
  onDeleteDay,
}) => {
  // Tìm thông tin bữa tối theo thứ trong tuần
  const getBuaToiForDay = (thu: string) => {
    return buaTois.find((bt) => bt.thuTrongTuan === thu);
  };

  const getTenThanhVien = (id: number) => {
    return thanhViens.find((tv) => tv.id === id)?.ten || `Thành viên #${id}`;
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl border border-slate-800">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
          <Calendar className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Lịch Ăn Trong Tuần</h2>
          <p className="text-xs text-slate-400">Từ Thứ 2 đến Chủ nhật (bấm để cập nhật chi phí)</p>
        </div>
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
        {daysOfWeek.map((day) => {
          const buaToi = getBuaToiForDay(day.thu);
          const hasBuaToi = !!buaToi;

          return (
            <div
              key={day.thu}
              onClick={() => onSelectDay(day, buaToi)}
              className={`group relative flex flex-col p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                hasBuaToi
                  ? 'bg-slate-900/60 border-indigo-500/30 hover:border-indigo-500/60 hover:shadow-indigo-950/20'
                  : 'bg-slate-900/20 border-slate-800/80 hover:border-slate-700/60 hover:bg-slate-900/35'
              } hover:shadow-lg`}
            >
              {/* Header của Day Card */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors">
                    {day.thu}
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-full font-mono">
                    {day.displayDate}
                  </span>
                </div>
                {hasBuaToi ? (
                  <span className="text-sm font-bold text-emerald-400">
                    {formatVND(buaToi.tongTien)}
                  </span>
                ) : (
                  <span className="text-xs text-slate-600 italic">Chưa nhập bữa tối</span>
                )}
              </div>

              {/* Chi tiết bữa ăn nếu có */}
              {hasBuaToi && (
                <div className="space-y-2.5">
                  {/* Người ăn */}
                  <div className="flex items-start gap-1.5 text-xs text-slate-400">
                    <Users className="w-3.5 h-3.5 mt-0.5 text-indigo-400/80 shrink-0" />
                    <div className="flex flex-wrap gap-1">
                      {buaToi.nguoiAnIds?.map((id) => (
                        <span
                          key={id}
                          className="bg-indigo-950/50 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/10"
                        >
                          {getTenThanhVien(id)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Người trả tiền */}
                  <div className="flex items-start gap-1.5 text-xs text-slate-400">
                    <CreditCard className="w-3.5 h-3.5 mt-0.5 text-violet-400/80 shrink-0" />
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {buaToi.nguoiTraTien?.map((ntt) => (
                        <span key={ntt.thanhVienId} className="text-slate-300 font-medium">
                          {getTenThanhVien(ntt.thanhVienId)}: <span className="text-violet-300">{formatVND(ntt.soTienDaTra)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Nút tác vụ hiện khi hover */}
              <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                {hasBuaToi ? (
                  <>
                    <div className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-indigo-400">
                      <Edit className="w-3.5 h-3.5" />
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDay(buaToi.id!);
                      }}
                      className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400"
                      title="Xóa bữa tối"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </div>
                  </>
                ) : (
                  <div className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-indigo-400">
                    <PlusCircle className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
