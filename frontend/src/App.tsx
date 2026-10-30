import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChefHat, AlertCircle, X, Landmark, Coins, Check, QrCode, Receipt, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import {
  getThanhViens,
  addThanhVien,
  updateThanhVien,
  deleteThanhVien,
  getBuaTois,
  addBuaToi,
  addChiPhiKhac,
  deleteBuaToi,
  getTongKetTuan,
  toggleChuyenKhoan,
  clearAllData,
  ThanhVien,
  BuaToi,
  NguoiTraTien,
  NguoiAnChiTiet,
  TongKetResponse,
} from './services/api';
import { DanhSachThanhVien } from './components/DanhSachThanhVien';
import { BangChiPhi } from './components/BangChiPhi';
import { TongKetTuan } from './components/TongKetTuan';
import { TongChiPhiThanhVien } from './components/TongChiPhiThanhVien';
import { FormNhapTien } from './components/FormNhapTien';
import { FormChiPhiKhac } from './components/FormChiPhiKhac';

function App() {
  const [thanhViens, setThanhViens] = useState<ThanhVien[]>([]);
  const [buaTois, setBuaTois] = useState<BuaToi[]>([]);
  const [tongKet, setTongKet] = useState<TongKetResponse | null>(null);

  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Quản lý Modal Nhập Tiền Bữa Tối
  const [isBuaToiModalOpen, setIsBuaToiModalOpen] = useState(false);
  const [selectedBuaToi, setSelectedBuaToi] = useState<BuaToi | undefined>(undefined);

  // Quản lý Modal Chi Phí Khác
  const [isChiPhiModalOpen, setIsChiPhiModalOpen] = useState(false);
  const [selectedChiPhi, setSelectedChiPhi] = useState<BuaToi | undefined>(undefined);

  // Quản lý Modal Chi Tiết Phân Chia
  const [selectedCreditorId, setSelectedCreditorId] = useState<number | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Lightbox QR Code
  const [activeQRData, setActiveQRData] = useState<{
    qrCodeImage: string;
    denTen: string;
    soTien: number;
    tuTen: string;
  } | null>(null);

  // Quản lý Modal Xóa Dữ Liệu
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [deleteMembersOption, setDeleteMembersOption] = useState(false);
  const [clearingData, setClearingData] = useState(false);

  const fetchMembers = useCallback(async () => {
    setGlobalError(null);
    setLoadingMembers(true);
    try {
      const tvs = await getThanhViens();
      setThanhViens(tvs);
    } catch (err: any) {
      console.error(err);
      setGlobalError('Không thể kết nối đến Backend Server. Hãy chắc chắn backend đang hoạt động.');
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    setGlobalError(null);
    setLoadingSummary(true);
    try {
      const [bts, tk] = await Promise.all([
        getBuaTois('all'),
        getTongKetTuan('all'),
      ]);
      setBuaTois(bts);
      setTongKet(tk);
    } catch (err: any) {
      console.error(err);
      setGlobalError('Lỗi khi tải dữ liệu chi phí và tổng kết.');
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
    fetchAllData();
  }, [fetchMembers, fetchAllData]);

  const handleRefreshSummary = useCallback(async () => {
    await fetchAllData();
  }, [fetchAllData]);

  // Các hàm xử lý Thành viên
  const handleAddMember = useCallback(async (
    ten: string,
    maNganHang?: string | null,
    soTaiKhoan?: string | null,
    tenTaiKhoan?: string | null,
    qrCodeImage?: string | null
  ) => {
    try {
      const tv = await addThanhVien(ten, maNganHang, soTaiKhoan, tenTaiKhoan, qrCodeImage);
      setThanhViens((prev) => [...prev, tv]);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      alert('Không thể thêm thành viên.');
    }
  }, [fetchAllData]);

  const handleUpdateMember = useCallback(async (
    id: number,
    ten: string,
    maNganHang?: string | null,
    soTaiKhoan?: string | null,
    tenTaiKhoan?: string | null,
    qrCodeImage?: string | null
  ) => {
    try {
      const updated = await updateThanhVien(id, ten, maNganHang, soTaiKhoan, tenTaiKhoan, qrCodeImage);
      setThanhViens((prev) => prev.map((x) => (x.id === id ? updated : x)));
      await fetchAllData();
    } catch (err) {
      console.error(err);
      alert('Không thể cập nhật thành viên.');
    }
  }, [fetchAllData]);

  const handleDeleteMember = useCallback(async (id: number) => {
    try {
      await deleteThanhVien(id);
      setThanhViens((prev) => prev.filter((x) => x.id !== id));
      await fetchAllData();
    } catch (err) {
      console.error(err);
      alert('Không thể xóa thành viên.');
    }
  }, [fetchAllData]);

  // Các hàm xử lý Bữa ăn tối
  const handleOpenAddBuaToi = useCallback(() => {
    setSelectedBuaToi(undefined);
    setIsBuaToiModalOpen(true);
  }, []);

  const handleSaveBuaToi = useCallback(async (buaToiMoi: BuaToi) => {
    try {
      await addBuaToi(buaToiMoi);
      await fetchAllData();
      setIsBuaToiModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi lưu thông tin bữa tối.');
    }
  }, [fetchAllData]);

  const handleDeleteBuaToi = useCallback(async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bữa tối này?')) return;
    try {
      await deleteBuaToi(id);
      await fetchAllData();
      setIsBuaToiModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi xóa bữa tối.');
    }
  }, [fetchAllData]);

  // Các hàm xử lý Chi Phí Khác
  const handleOpenAddChiPhi = useCallback(() => {
    setSelectedChiPhi(undefined);
    setIsChiPhiModalOpen(true);
  }, []);

  const handleSaveChiPhi = useCallback(async (payload: {
    id?: number;
    moTa: string;
    tongTien: number;
    ngayChi: string;
    nguoiChiaIds: number[];
    chiTietNguoiChia?: NguoiAnChiTiet[];
    nguoiTraTien: NguoiTraTien[];
  }) => {
    try {
      await addChiPhiKhac(payload);
      await fetchAllData();
      setIsChiPhiModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi lưu chi phí.');
    }
  }, [fetchAllData]);

  const handleDeleteChiPhi = useCallback(async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa chi phí này?')) return;
    try {
      await deleteBuaToi(id);
      await fetchAllData();
      setIsChiPhiModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi xóa chi phí.');
    }
  }, [fetchAllData]);

  // Hành động sửa và xóa chung từ Bảng Chi Phí
  const handleEditItem = useCallback((item: BuaToi) => {
    if (item.loai === 'chi_phi_khac') {
      setSelectedChiPhi(item);
      setIsChiPhiModalOpen(true);
    } else {
      setSelectedBuaToi(item);
      setIsBuaToiModalOpen(true);
    }
  }, []);

  const handleDeleteItem = useCallback(async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa khoản chi này?')) return;
    try {
      await deleteBuaToi(id);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi xóa.');
    }
  }, [fetchAllData]);

  const handleOpenDetail = useCallback((id: number) => {
    setSelectedCreditorId(id);
    setIsSummaryModalOpen(true);
  }, []);

  const handleConfirmClearData = useCallback(async () => {
    setClearingData(true);
    try {
      await clearAllData(deleteMembersOption);
      await fetchAllData();
      if (deleteMembersOption) {
        await fetchMembers();
      }
      setIsClearModalOpen(false);
      setDeleteMembersOption(false);
      alert('Đã xóa dữ liệu thành công!');
    } catch (err: any) {
      console.error(err);
      alert('Lỗi khi xóa dữ liệu: ' + (err.response?.data?.error || err.message));
    } finally {
      setClearingData(false);
    }
  }, [deleteMembersOption, fetchAllData, fetchMembers]);

  const formatVND = useCallback((amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }, []);

  const getTenThanhVien = useCallback((id: number) => {
    return thanhViens.find((tv) => tv.id === id)?.ten || `Thành viên #${id}`;
  }, [thanhViens]);

  // Thống kê nhanh toàn bộ
  const tongChiPhiTatCa = useMemo(() => {
    return buaTois.reduce((sum, item) => sum + (Number(item.tongTien) || 0), 0);
  }, [buaTois]);

  const memberPaidBreakdown = useMemo(() => {
    if (!selectedCreditorId) return [];
    return buaTois
      .map((bt) => {
        const payerRecord = bt.nguoiTraTien?.find((p) => p.thanhVienId === selectedCreditorId);
        const soTienDaChi = payerRecord ? payerRecord.soTienDaTra : 0;
        if (soTienDaChi <= 0) return null;

        const countNguoiAn = bt.nguoiAnIds?.length || 0;
        const tienMoiNguoi = countNguoiAn > 0 ? bt.tongTien / countNguoiAn : 0;

        const nguoiNoBuaNay = (bt.nguoiAnIds || [])
          .filter((id) => id !== selectedCreditorId)
          .map((id) => ({
            thanhVienId: id,
            ten: getTenThanhVien(id),
            soTienNo: tienMoiNguoi,
          }));

        const displayName = bt.loai === 'chi_phi_khac' ? `Chi phí: ${bt.moTa}` : bt.thuTrongTuan;

        return {
          id: bt.id,
          thuTrongTuan: displayName || 'Bữa ăn/Chi phí',
          soTienDaChi,
          nguoiNoBuaNay,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [buaTois, selectedCreditorId, getTenThanhVien]);

  const memberDebtorBreakdown = useMemo(() => {
    if (!selectedCreditorId) return [];
    return buaTois
      .map((bt) => {
        const isEater = bt.nguoiAnIds?.includes(selectedCreditorId);
        if (!isEater) return null;

        const payerRecord = bt.nguoiTraTien?.find((p) => p.thanhVienId === selectedCreditorId);
        const soTienDaChi = payerRecord ? payerRecord.soTienDaTra : 0;

        const countNguoiAn = bt.nguoiAnIds?.length || 0;
        const tienMoiNguoi = countNguoiAn > 0 ? bt.tongTien / countNguoiAn : 0;

        const tienAnNo = tienMoiNguoi - soTienDaChi;
        if (tienAnNo <= 0.01) return null;

        const creditors = (bt.nguoiTraTien || [])
          .filter((p) => p.soTienDaTra > 0)
          .map((p) => ({
            ten: getTenThanhVien(p.thanhVienId),
            soTienDaChi: p.soTienDaTra,
          }));

        const displayName = bt.loai === 'chi_phi_khac' ? `Chi phí: ${bt.moTa}` : bt.thuTrongTuan;

        return {
          id: bt.id,
          thuTrongTuan: displayName || 'Bữa ăn/Chi phí',
          tienAnNo,
          creditors,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [buaTois, selectedCreditorId, getTenThanhVien]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8 md:py-10 flex flex-col min-h-screen">
      {/* Header chính */}
      <header className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-900">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
            <ChefHat className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-wide">
              QUẢN LÝ TIỀN ĂN TỐI
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Theo dõi chi phí bữa ăn, tối ưu & cấn trừ công nợ nhóm bạn sống chung
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs text-slate-400 font-medium font-mono">Chế độ Toàn bộ (Cloud Sync)</span>
        </div>
      </header>

      {/* Thanh Thống Kê Tổng Quan (Quick Stats Bar) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 shadow-sm backdrop-blur-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Tổng chi tiêu tất cả
          </span>
          <span className="text-lg md:text-xl font-extrabold text-emerald-400 font-mono">
            {formatVND(tongChiPhiTatCa)}
          </span>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 shadow-sm backdrop-blur-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Tổng số bữa ăn
          </span>
          {(() => {
            const dinnerCount = buaTois.filter(b => b.loai !== 'chi_phi_khac').length;
            const lunchCount = buaTois.filter(b => b.loai !== 'chi_phi_khac' && b.kemBuaTrua).length;
            const totalMeals = dinnerCount + lunchCount;
            return (
              <div>
                <span className="text-lg md:text-xl font-extrabold text-indigo-300 font-mono">
                  {totalMeals} bữa
                </span>
                {lunchCount > 0 && (
                  <span className="text-[10px] text-amber-400 block font-medium">
                    ({dinnerCount} tối + {lunchCount} trưa)
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 shadow-sm backdrop-blur-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Chi phí khác
          </span>
          <span className="text-lg md:text-xl font-extrabold text-fuchsia-300 font-mono">
            {buaTois.filter(b => b.loai === 'chi_phi_khac').length} khoản
          </span>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 shadow-sm backdrop-blur-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Thành viên nhóm
          </span>
          <span className="text-lg md:text-xl font-extrabold text-white font-mono">
            {thanhViens.length} người
          </span>
        </div>
      </div>

      {globalError && (
        <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl mb-8 animate-bounce">
          <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm">Lỗi hệ thống</div>
            <div className="text-xs text-rose-400/90 mt-1">{globalError}</div>
          </div>
        </div>
      )}

      {/* Bố Cục Chính: Bảng Chi Phí (Tối đa 10 dòng/trang) & Tổng Kết / Thành Viên */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1">
        {/* Cột Trái: Tổng Kết Số Dư & Danh Sách Thành Viên (4/12 cột trên màn lớn) */}
        <div className="lg:col-span-4 xl:col-span-4 space-y-6">
          <TongKetTuan
            tongKet={tongKet}
            buaTois={buaTois}
            onRefresh={handleRefreshSummary}
            loading={loadingSummary}
            onOpenDetail={handleOpenDetail}
          />
          <TongChiPhiThanhVien
            thanhViens={thanhViens}
            buaTois={buaTois}
          />
          <DanhSachThanhVien
            thanhViens={thanhViens}
            onAdd={handleAddMember}
            onUpdate={handleUpdateMember}
            onDelete={handleDeleteMember}
            loading={loadingMembers}
          />
        </div>

        {/* Cột Phải: Bảng Danh Sách Bữa Ăn & Chi Phí (8/12 cột trên màn lớn) */}
        <div className="lg:col-span-8 xl:col-span-8">
          <BangChiPhi
            buaTois={buaTois}
            thanhViens={thanhViens}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
            onOpenAddBuaToi={handleOpenAddBuaToi}
            onOpenAddChiPhi={handleOpenAddChiPhi}
            onOpenClearModal={() => setIsClearModalOpen(true)}
          />
        </div>
      </main>

      {/* Modal Nhập/Sửa Bữa Tối */}
      {isBuaToiModalOpen && (
        <FormNhapTien
          buaToi={selectedBuaToi}
          thanhViens={thanhViens}
          onSave={handleSaveBuaToi}
          onDelete={handleDeleteBuaToi}
          onClose={() => setIsBuaToiModalOpen(false)}
        />
      )}

      {/* Modal Nhập/Sửa Chi Phí Khác */}
      {isChiPhiModalOpen && (
        <FormChiPhiKhac
          chiPhi={selectedChiPhi}
          thanhViens={thanhViens}
          onSave={handleSaveChiPhi}
          onDelete={handleDeleteChiPhi}
          onClose={() => setIsChiPhiModalOpen(false)}
        />
      )}

      {/* Modal Chi Tiết Phân Chia & Cấn Trừ Chuyển Khoản */}
      {isSummaryModalOpen && selectedCreditorId && (() => {
        const activeCreditor = tongKet?.chiTietTongKet.find(c => c.thanhVienId === selectedCreditorId);
        if (!activeCreditor) return null;

        const isDebtor = activeCreditor.netBalance < -0.01;
        const activeCreditorMember = thanhViens.find(tv => tv.id === activeCreditor.thanhVienId);
        const hasQrCode = !!activeCreditorMember?.qrCodeImage;

        const bilateralTransfers = {
          receivables: tongKet?.danhSachChuyenKhoan.filter(ck => ck.denThanhVienId === selectedCreditorId) || [],
          payables: tongKet?.danhSachChuyenKhoan.filter(ck => ck.tuThanhVienId === selectedCreditorId) || [],
        };

        const allPaid = bilateralTransfers.payables.every(p => p.daTra);
        const allReceived = bilateralTransfers.receivables.every(r => r.daTra);

        const remainingPayable = bilateralTransfers.payables
          .filter(p => !p.daTra)
          .reduce((sum, p) => sum + p.soTien, 0);
        const displayRemainingPayable = Math.max(0, remainingPayable);
        const paidAmount = Math.max(0, Math.abs(activeCreditor.netBalance) - displayRemainingPayable);

        const remainingReceivable = bilateralTransfers.receivables
          .filter(r => !r.daTra)
          .reduce((sum, r) => sum + r.soTien, 0);
        const displayRemainingReceivable = Math.max(0, remainingReceivable);
        const receivedAmount = Math.max(0, activeCreditor.netBalance - displayRemainingReceivable);

        const handleToggleAllPayables = async () => {
          const nextStatus = !allPaid;
          try {
            for (const p of bilateralTransfers.payables) {
              await toggleChuyenKhoan({
                ngayDauTuan: 'all',
                tuThanhVienId: p.tuThanhVienId,
                denThanhVienId: p.denThanhVienId,
                daTra: nextStatus,
                soTien: nextStatus ? p.tongTien : 0
              });
            }
            await handleRefreshSummary();
          } catch (err: any) {
            console.error(err);
            alert('Lỗi: ' + (err.response?.data?.error || err.message));
          }
        };

        const handleToggleAllReceivables = async () => {
          const nextStatus = !allReceived;
          try {
            for (const r of bilateralTransfers.receivables) {
              await toggleChuyenKhoan({
                ngayDauTuan: 'all',
                tuThanhVienId: r.tuThanhVienId,
                denThanhVienId: r.denThanhVienId,
                daTra: nextStatus,
                soTien: nextStatus ? r.tongTien : 0
              });
            }
            await handleRefreshSummary();
          } catch (err: any) {
            console.error(err);
            alert('Lỗi: ' + (err.response?.data?.error || err.message));
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Landmark className={`w-5 h-5 ${isDebtor ? 'text-rose-400' : 'text-emerald-400'}`} />
                    BẢNG CHI TIẾT PHÂN CHIA - {activeCreditor.ten}
                  </h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-400">
                      {isDebtor ? (
                        <>
                          Cần chuyển trả: <span className="text-rose-400 font-extrabold font-mono">{formatVND(displayRemainingPayable)}</span>
                          {paidAmount > 0.01 && (
                            <span className="text-[10px] text-slate-500 font-semibold ml-2">
                              (Đã trả: {formatVND(paidAmount)} / Tổng: {formatVND(Math.abs(activeCreditor.netBalance))})
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          Được nhận lại: <span className="text-emerald-400 font-extrabold font-mono">{formatVND(displayRemainingReceivable)}</span>
                          {receivedAmount > 0.01 && (
                            <span className="text-[10px] text-slate-500 font-semibold ml-2">
                              (Đã nhận: {formatVND(receivedAmount)} / Tổng: {formatVND(activeCreditor.netBalance)})
                            </span>
                          )}
                        </>
                      )}
                    </span>
                    {isDebtor ? (
                      bilateralTransfers.payables.length > 0 && (
                        <button
                          onClick={handleToggleAllPayables}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all cursor-pointer flex items-center gap-1 ${
                            allPaid
                              ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                          {allPaid ? 'Đã trả tiền' : 'Đánh dấu đã trả'}
                        </button>
                      )
                    ) : (
                      bilateralTransfers.receivables.length > 0 && (
                        <button
                          onClick={handleToggleAllReceivables}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all cursor-pointer flex items-center gap-1 ${
                            allReceived
                              ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                          {allReceived ? 'Đã nhận đủ' : 'Đánh dấu đã nhận'}
                        </button>
                      )
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 bg-slate-950/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Cột 1: Hướng dẫn chuyển tiền */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-400" />
                      1. HƯỚNG DẪN CHUYỂN KHOẢN TRỰC TIẾP
                    </h4>
                    
                    {/* Mục 1: Nhận tiền từ người khác */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider pl-1">
                        Thành viên khác cần chuyển trả cho {activeCreditor.ten}:
                      </div>
                      {bilateralTransfers.receivables.length === 0 ? (
                        <div className="bg-slate-900/20 border border-slate-850/60 rounded-xl p-3.5 text-center text-xs text-slate-500 italic">
                          Không có ai cần chuyển tiền cho thành viên này.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {bilateralTransfers.receivables.map((gd, idx) => {
                            const recipientMember = activeCreditorMember;
                            const recipientHasQr = hasQrCode;

                            return (
                              <div
                                key={idx}
                                className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
                                  gd.daTra 
                                    ? 'bg-slate-900/20 border-slate-950/60 opacity-60' 
                                    : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/60'
                                }`}
                              >
                                <div className="flex items-center gap-2 text-sm text-slate-200">
                                  <div className="flex items-center gap-1">
                                    <span className={`font-bold ${gd.daTra ? 'text-slate-500 line-through' : 'text-rose-300'}`}>{gd.tuTen}</span>
                                    <span className="text-slate-555 font-normal">chuyển cho</span>
                                    <span className={`font-bold ${gd.daTra ? 'text-slate-500 line-through' : 'text-slate-100'}`}>{gd.denTen}</span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col items-end">
                                    <span className={`font-mono font-extrabold text-sm ${
                                      gd.daTra ? 'text-slate-500 line-through' : 'text-indigo-300'
                                    }`}>
                                      {formatVND(gd.soTien)}
                                    </span>
                                    {!!gd.daTraTruoc && gd.daTraTruoc > 0.01 && !gd.daTra && (
                                      <span className="text-[9px] text-slate-500 font-semibold mt-0.5">
                                        (Đã trả trước: {formatVND(gd.daTraTruoc)})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {recipientHasQr && (
                                      <button
                                        onClick={() => {
                                          if (gd.daTra) return;
                                          setActiveQRData({
                                            qrCodeImage: recipientMember?.qrCodeImage || '',
                                            denTen: gd.denTen,
                                            soTien: gd.soTien,
                                            tuTen: gd.tuTen,
                                          });
                                        }}
                                        disabled={gd.daTra}
                                        className={`px-3 py-1.5 rounded-lg border transition-all duration-200 flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                                          gd.daTra
                                            ? 'bg-slate-900 border-slate-950 text-slate-650 cursor-not-allowed opacity-50'
                                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/30'
                                        }`}
                                      >
                                        <QrCode className="w-3.5 h-3.5" />
                                        Mã QR nhận tiền của {gd.denTen}
                                      </button>
                                    )}
                                    <button
                                      onClick={async () => {
                                        try {
                                          await toggleChuyenKhoan({
                                            ngayDauTuan: 'all',
                                            tuThanhVienId: gd.tuThanhVienId,
                                            denThanhVienId: gd.denThanhVienId,
                                            daTra: !gd.daTra,
                                            soTien: !gd.daTra ? gd.tongTien : 0,
                                          });
                                          await handleRefreshSummary();
                                        } catch (err: any) {
                                          console.error(err);
                                          alert('Lỗi: ' + (err.response?.data?.error || err.message));
                                        }
                                      }}
                                      className={`px-3 py-1.5 rounded-lg border transition-all duration-200 flex items-center gap-1 text-xs font-semibold cursor-pointer ${
                                        gd.daTra
                                          ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                                          : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/30'
                                      }`}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      Đã nhận
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Mục 2: Chuyển tiền cho người khác */}
                    <div className="space-y-2 pt-2">
                      <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider pl-1">
                        {activeCreditor.ten} cần chuyển trả cho thành viên khác:
                      </div>
                      {bilateralTransfers.payables.length === 0 ? (
                        <div className="bg-slate-900/20 border border-slate-850/60 rounded-xl p-3.5 text-center text-xs text-slate-500 italic">
                          Không cần chuyển trả thêm tiền cho ai.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {bilateralTransfers.payables.map((gd, idx) => {
                            const recipientMember = thanhViens.find(tv => tv.id === gd.denThanhVienId);
                            const recipientHasQr = !!recipientMember?.qrCodeImage;

                            return (
                              <div
                                key={idx}
                                className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
                                  gd.daTra 
                                    ? 'bg-slate-900/20 border-slate-950/60 opacity-60' 
                                    : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/60'
                                }`}
                              >
                                <div className="flex items-center gap-2 text-sm text-slate-200">
                                  <div className="flex items-center gap-1">
                                    <span className={`font-bold ${gd.daTra ? 'text-slate-500 line-through' : 'text-slate-100'}`}>{gd.tuTen}</span>
                                    <span className="text-slate-555 font-normal">chuyển cho</span>
                                    <span className={`font-bold ${gd.daTra ? 'text-slate-500 line-through' : 'text-emerald-300'}`}>{gd.denTen}</span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col items-end">
                                    <span className={`font-mono font-extrabold text-sm ${
                                      gd.daTra ? 'text-slate-500 line-through' : 'text-indigo-300'
                                    }`}>
                                      {formatVND(gd.soTien)}
                                    </span>
                                    {!!gd.daTraTruoc && gd.daTraTruoc > 0.01 && !gd.daTra && (
                                      <span className="text-[9px] text-slate-500 font-semibold mt-0.5">
                                        (Đã trả trước: {formatVND(gd.daTraTruoc)})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {recipientHasQr && (
                                      <button
                                        onClick={() => {
                                          if (gd.daTra) return;
                                          setActiveQRData({
                                            qrCodeImage: recipientMember?.qrCodeImage || '',
                                            denTen: gd.denTen,
                                            soTien: gd.soTien,
                                            tuTen: gd.tuTen,
                                          });
                                        }}
                                        disabled={gd.daTra}
                                        className={`px-3 py-1.5 rounded-lg border transition-all duration-200 flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                                          gd.daTra
                                            ? 'bg-slate-900 border-slate-950 text-slate-650 cursor-not-allowed opacity-50'
                                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/30'
                                        }`}
                                      >
                                        <QrCode className="w-3.5 h-3.5" />
                                        Mã QR nhận tiền của {gd.denTen}
                                      </button>
                                    )}
                                    <button
                                      onClick={async () => {
                                        try {
                                          await toggleChuyenKhoan({
                                            ngayDauTuan: 'all',
                                            tuThanhVienId: gd.tuThanhVienId,
                                            denThanhVienId: gd.denThanhVienId,
                                            daTra: !gd.daTra,
                                            soTien: !gd.daTra ? gd.tongTien : 0,
                                          });
                                          await handleRefreshSummary();
                                        } catch (err: any) {
                                          console.error(err);
                                          alert('Lỗi: ' + (err.response?.data?.error || err.message));
                                        }
                                      }}
                                      className={`px-3 py-1.5 rounded-lg border transition-all duration-200 flex items-center gap-1 text-xs font-semibold cursor-pointer ${
                                        gd.daTra
                                          ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                                          : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/30'
                                      }`}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      Đã trả
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cột 2: Giải trình chi tiết */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-indigo-400" />
                      2. GIẢI TRÌNH CHI TIẾT
                    </h4>

                    {/* Các khoản đã chi trả */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider pl-1">
                        Các khoản bạn đã trả tiền:
                      </div>
                      {memberPaidBreakdown.length === 0 ? (
                        <div className="bg-slate-900/20 border border-slate-850/60 rounded-xl p-3.5 text-center text-xs text-slate-500 italic">
                          Bạn chưa chi trả cho khoản nào.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {memberPaidBreakdown.map((item) => (
                            <div key={item.id} className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-2">
                              <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="text-indigo-300 font-bold">{item.thuTrongTuan}</span>
                                <span className="text-emerald-400 font-mono">Đã chi: {formatVND(item.soTienDaChi)}</span>
                              </div>
                              <div className="space-y-1 pl-2 border-l border-slate-800">
                                {item.nguoiNoBuaNay.map((no) => (
                                  <div key={no.thanhVienId} className="flex items-center justify-between text-[11px] text-slate-400">
                                    <span>{no.ten}</span>
                                    <span className="font-mono text-slate-300">Ăn nợ: {formatVND(no.soTienNo)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Các khoản ăn nợ */}
                    <div className="space-y-2 pt-2">
                      <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider pl-1">
                        Các khoản bạn ăn nợ người khác:
                      </div>
                      {memberDebtorBreakdown.length === 0 ? (
                        <div className="bg-slate-900/20 border border-slate-850/60 rounded-xl p-3.5 text-center text-xs text-slate-500 italic">
                          Bạn không nợ tiền khoản nào.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {memberDebtorBreakdown.map((item) => (
                            <div key={item.id} className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-2">
                              <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="text-rose-300 font-bold">{item.thuTrongTuan}</span>
                                <span className="text-rose-400 font-mono">Nợ: {formatVND(item.tienAnNo)}</span>
                              </div>
                              <div className="space-y-1 pl-2 border-l border-slate-800">
                                {item.creditors.map((cr, cIdx) => (
                                  <div key={cIdx} className="flex items-center justify-between text-[11px] text-slate-400">
                                    <span>Chủ chi: {cr.ten}</span>
                                    <span className="font-mono text-slate-300">Đã trả: {formatVND(cr.soTienDaChi)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
                {hasQrCode && (
                  <button
                    onClick={() => {
                      setActiveQRData({
                        qrCodeImage: activeCreditorMember?.qrCodeImage || '',
                        denTen: activeCreditor.ten,
                        soTien: displayRemainingReceivable,
                        tuTen: 'Thành viên nhóm',
                      });
                    }}
                    className="px-3.5 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    Mã QR nhận tiền của {activeCreditor.ten}
                  </button>
                )}
                <button
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer ml-auto"
                >
                  Đóng bảng chi tiết
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lightbox QR Code */}
      {activeQRData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 text-center space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">
                Quét Mã QR Chuyển Tiền
              </h3>
              <button
                onClick={() => setActiveQRData(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white p-3 rounded-xl inline-block shadow-lg">
              <img
                src={activeQRData.qrCodeImage}
                alt="QR Code"
                className="w-56 h-56 object-contain mx-auto"
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-200">
                {activeQRData.tuTen} &rarr; {activeQRData.denTen}
              </p>
              <p className="text-lg font-extrabold text-emerald-400 font-mono">
                {formatVND(activeQRData.soTien)}
              </p>
            </div>

            <button
              onClick={() => setActiveQRData(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Đóng mã QR
            </button>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Dữ Liệu */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-white text-base">
                  Xác Nhận Xóa Dữ Liệu
                </h3>
              </div>
              <button
                onClick={() => { if (!clearingData) setIsClearModalOpen(false); }}
                disabled={clearingData}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cảnh báo */}
            <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3 text-xs text-rose-300 space-y-1">
              <p className="font-bold">⚠️ Dữ liệu sau khi xóa sẽ không thể khôi phục!</p>
              <p className="text-rose-300/80">Vui lòng chọn phạm vi bạn muốn xóa:</p>
            </div>

            {/* Các tùy chọn */}
            <div className="space-y-3">
              <div 
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  !deleteMembersOption 
                    ? 'bg-indigo-950/30 border-indigo-500/40 text-indigo-200 shadow-sm' 
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
                onClick={() => setDeleteMembersOption(false)}
              >
                <input
                  type="radio"
                  name="clearOption"
                  checked={!deleteMembersOption}
                  onChange={() => setDeleteMembersOption(false)}
                  className="mt-1 accent-indigo-500 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    Chỉ xóa các khoản chi
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-mono font-normal">Khuyên dùng</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Xóa sạch toàn bộ bữa tối, chi phí khác & công nợ về 0. Giữ nguyên danh sách thành viên và mã QR.
                  </p>
                </div>
              </div>

              <div 
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  deleteMembersOption 
                    ? 'bg-rose-950/30 border-rose-500/40 text-rose-200 shadow-sm' 
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
                onClick={() => setDeleteMembersOption(true)}
              >
                <input
                  type="radio"
                  name="clearOption"
                  checked={deleteMembersOption}
                  onChange={() => setDeleteMembersOption(true)}
                  className="mt-1 accent-rose-500 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-rose-300">
                    Xóa tất cả (Bao gồm cả thành viên)
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Reset sạch trắng hệ thống về như lúc mới cài đặt, xóa cả tài khoản thành viên nhóm.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                disabled={clearingData}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmClearData}
                disabled={clearingData}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-rose-950/50 disabled:opacity-50"
              >
                {clearingData ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang xóa...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Xác nhận xóa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
