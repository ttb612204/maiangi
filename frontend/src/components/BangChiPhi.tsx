import React, { useState, useMemo, useRef } from 'react';
import { 
  Receipt, 
  Utensils, 
  Edit3, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  Calendar
} from 'lucide-react';
import { BuaToi, ThanhVien } from '../services/api';

interface BangChiPhiProps {
  buaTois: BuaToi[];
  thanhViens: ThanhVien[];
  onEditItem: (item: BuaToi) => void;
  onDeleteItem: (id: number) => void;
  onOpenAddBuaToi: () => void;
  onOpenAddChiPhi: () => void;
  onOpenClearModal: () => void;
}

export const BangChiPhi: React.FC<BangChiPhiProps> = React.memo(({
  buaTois,
  thanhViens,
  onEditItem,
  onDeleteItem,
  onOpenAddBuaToi,
  onOpenAddChiPhi,
  onOpenClearModal,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'bua_toi' | 'chi_phi_khac'>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const ITEMS_PER_PAGE = 10;

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatDateDisplay = (dateString: string) => {
    try {
      const parts = dateString.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dateString);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return dateString;
    }
  };

  const getTenThanhVien = (id: number) => {
    return thanhViens.find((tv) => tv.id === id)?.ten || `TV #${id}`;
  };

  // Lọc theo loại và chọn ngày
  const filteredItems = useMemo(() => {
    return buaTois.filter((item) => {
      // Lọc theo loại
      const isExpense = item.loai === 'chi_phi_khac';
      if (filterType === 'bua_toi' && isExpense) return false;
      if (filterType === 'chi_phi_khac' && !isExpense) return false;

      // Lọc theo chọn ngày
      if (filterDate) {
        const itemDateStr = item.ngayAn.split('T')[0];
        if (itemDateStr !== filterDate) return false;
      }

      return true;
    });
  }, [buaTois, filterType, filterDate]);

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col h-full">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-wide">
                Bảng Chi Phí & Bữa Ăn
              </h2>
              <span className="text-xs bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-full border border-slate-700">
                {buaTois.length} khoản
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Toàn bộ danh sách chi phí phân trang (tối đa 10 dòng / trang)
            </p>
          </div>
        </div>

        {/* Buttons thao tác: Thêm mới & Xóa dữ liệu */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenAddBuaToi}
            className="gradient-btn px-3.5 py-2 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Utensils className="w-3.5 h-3.5" />
            + Nhập bữa tối
          </button>
          <button
            onClick={onOpenAddChiPhi}
            className="px-3.5 py-2 rounded-xl bg-fuchsia-600/20 border border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-600/30 text-xs font-semibold flex items-center gap-1.5 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            + Thêm chi phí khác
          </button>
          <button
            onClick={onOpenClearModal}
            className="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1.5 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            title="Xóa toàn bộ dữ liệu"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Xóa dữ liệu
          </button>
        </div>
      </div>

      {/* Bộ lọc loại & Lọc theo chọn ngày */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => { setFilterType('all'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tất cả ({buaTois.length})
          </button>
          <button
            onClick={() => { setFilterType('bua_toi'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filterType === 'bua_toi'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bữa tối ({buaTois.filter(b => b.loai !== 'chi_phi_khac').length})
          </button>
          <button
            onClick={() => { setFilterType('chi_phi_khac'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filterType === 'chi_phi_khac'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Chi phí khác ({buaTois.filter(b => b.loai === 'chi_phi_khac').length})
          </button>
        </div>

        {/* Lọc theo chọn ngày */}
        <div className="flex items-center gap-2">
          <div 
            onClick={() => {
              try {
                dateInputRef.current?.showPicker?.();
              } catch {}
            }}
            className="relative flex items-center bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-xl px-3 py-1.5 focus-within:border-indigo-500 transition-colors cursor-pointer shadow-sm group"
          >
            <Calendar className="w-4 h-4 text-indigo-400 mr-2 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-xs text-slate-300 mr-2 whitespace-nowrap select-none">Chọn ngày:</span>
            <input
              ref={dateInputRef}
              type="date"
              value={filterDate}
              onClick={(e) => {
                e.stopPropagation();
                try {
                  e.currentTarget.showPicker?.();
                } catch {}
              }}
              onChange={(e) => { setFilterDate(e.target.value); setCurrentPage(1); }}
              style={{ colorScheme: 'dark' }}
              className="bg-transparent text-xs text-white focus:outline-none font-mono cursor-pointer"
            />
            {filterDate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterDate('');
                  setCurrentPage(1);
                }}
                className="ml-2 text-slate-400 hover:text-rose-400 text-xs px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-750 font-medium transition-colors cursor-pointer border border-slate-700 whitespace-nowrap"
                title="Bỏ chọn ngày để xem tất cả"
              >
                Tất cả ngày
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bảng Dữ Liệu (Table View) */}
      <div className="flex-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/70 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
              <th className="py-3 px-4 w-36">Ngày & Thứ</th>
              <th className="py-3 px-4 w-44">Khoản Chi</th>
              <th className="py-3 px-4 w-32">Tổng Tiền</th>
              <th className="py-3 px-4">Người Ăn / Chia Sẻ</th>
              <th className="py-3 px-4">Người Đã Chi Trả</th>
              <th className="py-3 px-3 text-center w-24">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {currentItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <Receipt className="w-10 h-10 mx-auto text-slate-700 mb-2 opacity-60" />
                  Không tìm thấy khoản chi nào{filterDate ? ` vào ngày ${formatDateDisplay(filterDate)}` : ''}.
                </td>
              </tr>
            ) : (
              currentItems.map((item) => {
                const isExpense = item.loai === 'chi_phi_khac';

                return (
                  <tr
                    key={`${isExpense ? 'cp' : 'bt'}-${item.id}`}
                    className="hover:bg-slate-900/40 transition-colors group"
                  >
                    {/* Ngày & Thứ */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-200">
                          {item.thuTrongTuan || 'Thứ ?'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {formatDateDisplay(item.ngayAn)}
                        </span>
                      </div>
                    </td>

                    {/* Khoản Chi / Loại */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide shrink-0 ${
                            isExpense
                              ? 'bg-fuchsia-950/60 text-fuchsia-300 border border-fuchsia-500/20'
                              : 'bg-indigo-950/60 text-indigo-300 border border-indigo-500/20'
                          }`}
                        >
                          {isExpense ? 'Chi phí khác' : 'Bữa tối'}
                        </span>
                        {!isExpense && (
                          item.cacBuaKem && item.cacBuaKem.length > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0" title={`Gồm ${1 + item.cacBuaKem.length} bữa ăn`}>
                              🍱 {1 + item.cacBuaKem.length} bữa (+{item.cacBuaKem.map(b => (b.loaiBua === 'trua' ? 'trưa' : 'tối')).join(', ')})
                            </span>
                          ) : item.kemBuaTrua ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0" title="Đã nấu ăn cho cả bữa trưa hôm sau">
                              🍱 + Bữa trưa (2 bữa)
                            </span>
                          ) : null
                        )}
                        {isExpense && item.moTa && (
                          <span className="text-slate-300 font-medium truncate max-w-[140px]" title={item.moTa}>
                            {item.moTa}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Tổng Tiền */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold font-mono text-emerald-400 text-sm">
                        {formatVND(item.tongTien)}
                      </span>
                    </td>

                    {/* Người Ăn / Chia Sẻ */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {item.nguoiAnIds && item.nguoiAnIds.length > 0 ? (
                          item.nguoiAnIds.map((id) => {
                            const detail = item.chiTietNguoiAn?.find((d) => d.thanhVienId === id);
                            const hasPrivate = detail && detail.soTienRieng !== undefined && detail.soTienRieng > 0;
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 bg-slate-900 text-slate-300 border border-slate-800 text-[10px] px-1.5 py-0.5 rounded"
                              >
                                <span>{getTenThanhVien(id)}:</span>
                                {detail && detail.soTien > 0 && (
                                  <span className="font-mono text-emerald-400 font-bold" title="Tổng phần phải chịu">
                                    {formatVND(detail.soTien)}
                                  </span>
                                )}
                                {hasPrivate && (
                                  <span className="font-mono text-slate-400 text-[9px]" title="Tiền thức ăn riêng">
                                    (riêng {formatVND(detail.soTienRieng!)})
                                  </span>
                                )}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-slate-600 italic text-[11px]">Chưa chọn</span>
                        )}
                      </div>
                      {item.tienChung && Number(item.tienChung) > 0 ? (
                        <div className="mt-1 text-[10px] text-amber-400 font-mono">
                          Tiền gia vị chung: {formatVND(Number(item.tienChung))}
                        </div>
                      ) : null}
                    </td>

                    {/* Người Đã Chi Trả */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {item.nguoiTraTien && item.nguoiTraTien.length > 0 ? (
                          item.nguoiTraTien
                            .filter((p) => p.soTienDaTra > 0)
                            .map((p) => (
                              <span
                                key={p.thanhVienId}
                                className="inline-flex items-center gap-1 bg-emerald-950/40 text-emerald-300 border border-emerald-500/20 text-[10px] px-1.5 py-0.5 rounded"
                              >
                                <span>{getTenThanhVien(p.thanhVienId)}:</span>
                                <span className="font-mono font-bold">{formatVND(p.soTienDaTra)}</span>
                              </span>
                            ))
                        ) : (
                          <span className="text-slate-600 italic text-[11px]">Chưa nhập</span>
                        )}
                      </div>
                    </td>

                    {/* Thao Tác */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEditItem(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => item.id && onDeleteItem(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer (10 items / page) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400">
        <div>
          {filteredItems.length > 0 ? (
            <span>
              Hiển thị <span className="font-semibold text-slate-200">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> -{' '}
              <span className="font-semibold text-slate-200">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)}
              </span>{' '}
              trong tổng số <span className="font-semibold text-slate-200">{filteredItems.length}</span> khoản
            </span>
          ) : (
            <span>0 khoản chi</span>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                return (
                  page === 1 ||
                  page === totalPages ||
                  Math.abs(page - currentPage) <= 1
                );
              })
              .map((page, idx, arr) => {
                const prev = arr[idx - 1];
                return (
                  <React.Fragment key={page}>
                    {prev && page - prev > 1 && (
                      <span className="px-1 text-slate-600">...</span>
                    )}
                    <button
                      onClick={() => handlePageChange(page)}
                      className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        currentPage === page
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
