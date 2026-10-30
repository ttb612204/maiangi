import React, { useState, useMemo } from 'react';
import { 
  UtensilsCrossed, 
  Calendar, 
  ChevronRight, 
  X, 
  ChefHat
} from 'lucide-react';
import { BuaToi, ThanhVien } from '../services/api';

interface TongChiPhiThanhVienProps {
  thanhViens: ThanhVien[];
  buaTois: BuaToi[];
}

interface BuaAnCuaNguoi {
  id?: number;
  ngayAn: string;
  thuTrongTuan: string;
  loai: string;
  moTa?: string;
  soTienRieng: number;
  tienChungPhanMinh: number;
  tongTienPhanMinh: number;
  tongTienBuaAn: number;
  nguoiTraText: string;
  kemBuaTrua?: boolean;
}

export const TongChiPhiThanhVien: React.FC<TongChiPhiThanhVienProps> = React.memo(({
  thanhViens,
  buaTois,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

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

  // Tính chi phí ăn uống tiêu thụ của từng thành viên
  const chiPhiTungThanhVien = useMemo(() => {
    return thanhViens.map((tv) => {
      let tongTienRieng = 0;
      let tongTienChung = 0;
      let tongTienAn = 0;
      const danhSachBuaAn: BuaAnCuaNguoi[] = [];

      buaTois.forEach((bt) => {
        // Kiểm tra xem người này có tham gia ăn không
        let daThamGia = false;
        let soTienRieng = 0;
        let soTienTong = 0;
        let tienChungPhan = 0;

        const detailed = bt.chiTietNguoiAn?.find((c) => c.thanhVienId === tv.id);
        const isInNguoiAnIds = bt.nguoiAnIds?.includes(tv.id);

        if (detailed) {
          daThamGia = true;
          if (detailed.soTien > 0) {
            soTienTong = Number(detailed.soTien);
            soTienRieng = Number(detailed.soTienRieng || 0);
            tienChungPhan = Math.max(0, soTienTong - soTienRieng);
          } else {
            // Trường hợp chi tiết chưa có số tiền (dữ liệu cũ), chia đều
            const soNguoi = bt.nguoiAnIds?.length || 1;
            soTienTong = bt.tongTien / soNguoi;
            tienChungPhan = Number(bt.tienChung || 0) / soNguoi;
            soTienRieng = Math.max(0, soTienTong - tienChungPhan);
          }
        } else if (isInNguoiAnIds) {
          daThamGia = true;
          const soNguoi = bt.nguoiAnIds?.length || 1;
          soTienTong = bt.tongTien / soNguoi;
          tienChungPhan = Number(bt.tienChung || 0) / soNguoi;
          soTienRieng = Math.max(0, soTienTong - tienChungPhan);
        }

        if (daThamGia) {
          tongTienRieng += soTienRieng;
          tongTienChung += tienChungPhan;
          tongTienAn += soTienTong;

          // Tạo chuỗi mô tả người trả tiền
          const nguoiTraText = (bt.nguoiTraTien || [])
            .filter((p) => p.soTienDaTra > 0)
            .map((p) => `${getTenThanhVien(p.thanhVienId)} (${formatVND(p.soTienDaTra)})`)
            .join(', ') || 'Chưa rõ';

          danhSachBuaAn.push({
            id: bt.id,
            ngayAn: bt.ngayAn,
            thuTrongTuan: bt.thuTrongTuan,
            loai: bt.loai || 'bua_toi',
            moTa: bt.moTa,
            soTienRieng,
            tienChungPhanMinh: tienChungPhan,
            tongTienPhanMinh: soTienTong,
            tongTienBuaAn: bt.tongTien,
            nguoiTraText,
            kemBuaTrua: !!bt.kemBuaTrua,
          });
        }
      });

      // Sắp xếp ngày mới nhất lên trước
      danhSachBuaAn.sort((a, b) => new Date(b.ngayAn).getTime() - new Date(a.ngayAn).getTime());

      // Tính tổng số suất/bữa ăn: nếu bữa tối có kèm bữa trưa thì tính 2 bữa
      const soBuaAn = danhSachBuaAn.reduce((acc, item) => {
        if (item.loai !== 'chi_phi_khac') {
          return acc + (item.kemBuaTrua ? 2 : 1);
        }
        return acc + 1; // Chi phí khác tính 1 khoản
      }, 0);

      const soBuaToi = danhSachBuaAn.filter(i => i.loai !== 'chi_phi_khac').length;
      const soBuaTrua = danhSachBuaAn.filter(i => i.loai !== 'chi_phi_khac' && i.kemBuaTrua).length;

      return {
        id: tv.id,
        ten: tv.ten,
        tongTienAn,
        tongTienRieng,
        tongTienChung,
        soBuaAn,
        soBuaToi,
        soBuaTrua,
        danhSachBuaAn,
      };
    });
  }, [thanhViens, buaTois]);

  // Thành viên đang được chọn xem chi tiết
  const selectedMemberData = useMemo(() => {
    if (!selectedMemberId) return null;
    return chiPhiTungThanhVien.find((item) => item.id === selectedMemberId) || null;
  }, [selectedMemberId, chiPhiTungThanhVien]);

  // Tổng chi phí ăn của cả nhóm
  const tongChiPhiNhom = useMemo(() => {
    return chiPhiTungThanhVien.reduce((sum, item) => sum + item.tongTienAn, 0);
  }, [chiPhiTungThanhVien]);

  return (
    <>
      {/* Bảng / Card Tổng Chi Phí Tiền Ăn Từng Người */}
      <div className="glass-panel rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                Tổng Chi Phí Từng Người
              </h2>
              <p className="text-xs text-slate-400">
                Thực tế mỗi người đã ăn hết bao nhiêu
              </p>
            </div>
          </div>
          {tongChiPhiNhom > 0 && (
            <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Tổng ăn: {formatVND(tongChiPhiNhom)}
            </span>
          )}
        </div>

        {/* Danh sách từng thành viên */}
        {chiPhiTungThanhVien.length === 0 ? (
          <div className="bg-slate-900/20 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
            Chưa có thành viên nào.
          </div>
        ) : (
          <div className="space-y-3">
            {chiPhiTungThanhVien.map((item) => {
              const phanTram = tongChiPhiNhom > 0 ? Math.round((item.tongTienAn / tongChiPhiNhom) * 100) : 0;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedMemberId(item.id)}
                  className="p-4 rounded-xl bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800/90 hover:border-amber-500/40 transition-all duration-200 cursor-pointer group shadow-sm relative overflow-hidden"
                >
                  {/* Thanh phần trăm ngầm nhẹ ở đáy */}
                  <div 
                    className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-60 rounded-full transition-all duration-500"
                    style={{ width: `${phanTram}%` }}
                  />

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300 font-bold flex items-center justify-center shrink-0 text-sm shadow-inner">
                        {item.ten.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                            {item.ten}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center gap-1">
                            <span>{item.soBuaAn} bữa</span>
                            {item.soBuaTrua > 0 && (
                              <span className="text-amber-400 font-normal">({item.soBuaToi} tối + {item.soBuaTrua} trưa)</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                          <span>Riêng: <strong className="text-slate-300 font-mono">{formatVND(item.tongTienRieng)}</strong></span>
                          <span>•</span>
                          <span>Chung: <strong className="text-slate-300 font-mono">{formatVND(item.tongTienChung)}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-base font-black text-amber-400 font-mono group-hover:scale-105 transition-transform">
                          {formatVND(item.tongTienAn)}
                        </div>
                        {tongChiPhiNhom > 0 && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            Chiếm {phanTram}% tổng ăn
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="text-amber-400/90 group-hover:underline flex items-center gap-1">
                      👉 Bấm xem chi tiết từng ngày
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL CHI TIẾT TỪNG NGÀY KHI ẤN VÀO THÀNH VIÊN */}
      {selectedMemberData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-black text-lg">
                  {selectedMemberData.ten.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                    Chi Tiết Tiền Ăn Từng Ngày: <span className="text-amber-400">{selectedMemberData.ten}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Lịch sử các bữa ăn & khoản chi phí đã tham gia tiêu dùng
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMemberId(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Đóng bảng chi tiết"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Stat Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-slate-950/40 border-b border-slate-800/80">
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Số bữa / khoản
                </span>
                <span className="text-base md:text-lg font-extrabold text-white font-mono flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  {selectedMemberData.soBuaAn} bữa
                </span>
                {selectedMemberData.soBuaTrua > 0 && (
                  <span className="text-[10px] text-amber-400 block mt-0.5 font-medium">
                    ({selectedMemberData.soBuaToi} tối + {selectedMemberData.soBuaTrua} trưa hôm sau)
                  </span>
                )}
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Tiền phần riêng
                </span>
                <span className="text-base md:text-lg font-extrabold text-sky-400 font-mono">
                  {formatVND(selectedMemberData.tongTienRieng)}
                </span>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Tiền chung được chia
                </span>
                <span className="text-base md:text-lg font-extrabold text-purple-400 font-mono">
                  {formatVND(selectedMemberData.tongTienChung)}
                </span>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">
                  TỔNG TIỀN ĐÃ ĂN
                </span>
                <span className="text-base md:text-lg font-black text-amber-300 font-mono">
                  {formatVND(selectedMemberData.tongTienAn)}
                </span>
              </div>
            </div>

            {/* Modal Body: Bảng Chi Tiết Từng Ngày */}
            <div className="flex-1 overflow-y-auto p-5">
              {selectedMemberData.danhSachBuaAn.length === 0 ? (
                <div className="py-16 text-center text-slate-500 flex flex-col items-center">
                  <ChefHat className="w-12 h-12 text-slate-700 mb-3" />
                  <span className="text-sm">Chưa có ghi nhận bữa ăn nào của {selectedMemberData.ten}.</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400">
                        <th className="py-3 px-3.5 font-semibold">Ngày & Thứ</th>
                        <th className="py-3 px-3.5 font-semibold">Bữa ăn / Khoản chi</th>
                        <th className="py-3 px-3.5 font-semibold text-right">Tiền phần riêng</th>
                        <th className="py-3 px-3.5 font-semibold text-right">Tiền chung</th>
                        <th className="py-3 px-3.5 font-semibold text-right">Tổng phần người này</th>
                        <th className="py-3 px-3.5 font-semibold">Người thanh toán</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                      {selectedMemberData.danhSachBuaAn.map((bua, idx) => {
                        const isExpense = bua.loai === 'chi_phi_khac';
                        return (
                          <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="font-semibold text-white">
                                {formatDateDisplay(bua.ngayAn)}
                              </span>
                              <span className="block text-[11px] text-slate-400">
                                {bua.thuTrongTuan}
                              </span>
                            </td>

                            <td className="py-3 px-3.5">
                              {isExpense ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 whitespace-nowrap">
                                    Chi phí khác
                                  </span>
                                  <span className="text-slate-300 font-medium">
                                    {bua.moTa || 'Không có mô tả'}
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                                      Bữa tối
                                    </span>
                                    {bua.kemBuaTrua && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap flex items-center gap-1">
                                        🍱 + 1 Bữa trưa (2 bữa)
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-slate-400 text-[11px] block">
                                    (Tổng bữa: {formatVND(bua.tongTienBuaAn)})
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-sky-400 whitespace-nowrap">
                              {bua.soTienRieng > 0 ? formatVND(bua.soTienRieng) : '-'}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono text-purple-400 whitespace-nowrap">
                              {bua.tienChungPhanMinh > 0 ? formatVND(bua.tienChungPhanMinh) : '-'}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-amber-300 whitespace-nowrap">
                              {formatVND(bua.tongTienPhanMinh)}
                            </td>

                            <td className="py-3 px-3.5 text-slate-300">
                              <span className="text-[11px] px-2 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 inline-block">
                                💳 {bua.nguoiTraText}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-950/80 font-bold border-t border-slate-700 text-slate-200">
                        <td colSpan={2} className="py-3 px-3.5 text-right text-xs uppercase tracking-wider text-slate-400">
                          Tổng cộng ({selectedMemberData.soBuaAn} bữa):
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-sky-400 whitespace-nowrap">
                          {formatVND(selectedMemberData.tongTienRieng)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-purple-400 whitespace-nowrap">
                          {formatVND(selectedMemberData.tongTienChung)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-amber-300 text-sm whitespace-nowrap">
                          {formatVND(selectedMemberData.tongTienAn)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-800 bg-slate-900/80">
              <button
                onClick={() => setSelectedMemberId(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
