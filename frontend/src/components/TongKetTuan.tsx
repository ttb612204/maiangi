import React from 'react';
import { RefreshCw, TrendingUp, HelpCircle, Landmark, Info } from 'lucide-react';
import { TongKetResponse } from '../services/api';

interface TongKetTuanProps {
  tongKet: TongKetResponse | null;
  onRefresh: () => Promise<void>;
  loading: boolean;
  onOpenDetail: (id: number) => void;
}

export const TongKetTuan: React.FC<TongKetTuanProps> = React.memo(({
  tongKet,
  onRefresh,
  loading,
  onOpenDetail,
}) => {
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // Chỉ lấy danh sách những người đã chi tiền trả (netBalance > 0.01)
  const nguoiNhanList = tongKet
    ? tongKet.chiTietTongKet.filter((ct) => ct.netBalance > 0.01)
    : [];

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Tổng Kết Tuần</h2>
            <p className="text-xs text-slate-400">Xem nhanh số dư & chi tiết nợ</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="gradient-btn p-2 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"
          title="Tổng kết tuần"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Tổng kết tuần
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
          <span className="text-sm text-slate-500">Đang tổng hợp dữ liệu...</span>
        </div>
      ) : !tongKet || tongKet.chiTietTongKet.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-500 text-center text-sm">
          <HelpCircle className="w-12 h-12 text-slate-700 mb-3" />
          Chưa có dữ liệu tổng kết. Hãy bấm nút "Tổng kết tuần" hoặc nhập dữ liệu bữa ăn.
        </div>
      ) : (
        <div className="space-y-6 flex-1 overflow-y-auto pr-1">
          {/* Danh sách người nhận tiền rút gọn ở sidebar */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-emerald-400" />
              Người chi tiền tuần này ({nguoiNhanList.length})
            </h3>
            
            {nguoiNhanList.length === 0 ? (
              <div className="bg-slate-900/20 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
                Chưa có ai chi tiền trả trong tuần hoặc các chi phí đã hòa nhau.
              </div>
            ) : (
              <div className="space-y-2.5">
                {nguoiNhanList.map((ct) => (
                  <div
                    key={ct.thanhVienId}
                    onClick={() => onOpenDetail(ct.thanhVienId)}
                    className="flex items-center justify-between p-4 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-900/60 transition-all duration-200 cursor-pointer group"
                  >
                    <div>
                      <span className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">
                        {ct.ten}
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Info className="w-3 h-3 text-indigo-400/80" /> Bấm để xem bảng chi tiết
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-emerald-400">
                        +{formatVND(ct.netBalance)}
                      </span>
                      <span className="block text-[9px] text-slate-500 mt-0.5 font-normal">Nhận lại tổng</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
