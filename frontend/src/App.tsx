import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChefHat, AlertCircle, X, Landmark, CalendarDays, Coins, Copy, Check, QrCode } from 'lucide-react';
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
  ThanhVien,
  BuaToi,
  NguoiTraTien,
  TongKetResponse,
} from './services/api';
import { DanhSachThanhVien } from './components/DanhSachThanhVien';
import { LichAnTuan } from './components/LichAnTuan';
import { FormNhapTien } from './components/FormNhapTien';
import { TongKetTuan } from './components/TongKetTuan';
import { ChiPhiKhac } from './components/ChiPhiKhac';
import { FormChiPhiKhac } from './components/FormChiPhiKhac';

interface DayConfig {
  thu: string;
  dateString: string;
  displayDate: string;
}

// Lấy ngày Thứ 2 của tuần hiện tại để làm giá trị khởi tạo
const getInitialMonday = (): string => {
  const current = new Date();
  const day = current.getDay();
  const distanceToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(current);
  monday.setDate(current.getDate() + distanceToMonday);
  
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const date = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

// Helper lấy danh sách 7 ngày trong tuần từ một ngày Thứ 2 chỉ định
const getDaysOfWeek = (startDateStr: string): DayConfig[] => {
  const start = new Date(startDateStr);
  const listThu = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  return listThu.map((thu, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    
    // Định dạng YYYY-MM-DD phù hợp với cơ sở dữ liệu
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    
    return {
      thu,
      dateString: `${year}-${month}-${date}`,
      displayDate: `${date}/${month}`,
    };
  });
};

function App() {
  const [thanhViens, setThanhViens] = useState<ThanhVien[]>([]);
  const [buaTois, setBuaTois] = useState<BuaToi[]>([]);
  const [tongKet, setTongKet] = useState<TongKetResponse | null>(null);

  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Quản lý tuần làm việc hiện tại
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(getInitialMonday());

  // Quản lý Modal Nhập Tiền
  const [selectedDay, setSelectedDay] = useState<DayConfig | null>(null);
  const [selectedBuaToi, setSelectedBuaToi] = useState<BuaToi | undefined>(undefined);

  // Quản lý Modal Chi Tiết Tổng Kết
  const [selectedCreditorId, setSelectedCreditorId] = useState<number | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Quản lý Modal Chi Phí Khác
  const [isChiPhiModalOpen, setIsChiPhiModalOpen] = useState(false);
  const [selectedChiPhi, setSelectedChiPhi] = useState<BuaToi | undefined>(undefined);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeQRData, setActiveQRData] = useState<{
    qrCodeImage: string;
    denTen: string;
    soTien: number;
    tuTen: string;
  } | null>(null);

  const daysOfWeek = useMemo(() => getDaysOfWeek(selectedWeekStart), [selectedWeekStart]);

  const fetchMembers = useCallback(async () => {
    setGlobalError(null);
    setLoadingMembers(true);
    try {
      const tvs = await getThanhViens();
      setThanhViens(tvs);
    } catch (err: any) {
      console.error(err);
      setGlobalError('Không thể kết nối đến Backend Server. Hãy chắc chắn backend đang chạy và cơ sở dữ liệu được thiết lập.');
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const fetchWeeklyData = useCallback(async (weekStart: string) => {
    setGlobalError(null);
    setLoadingSummary(true);
    try {
      const bts = await getBuaTois(weekStart);
      setBuaTois(bts);

      const tk = await getTongKetTuan(weekStart);
      setTongKet(tk);
    } catch (err: any) {
      console.error(err);
      setGlobalError('Lỗi khi tải dữ liệu tuần.');
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // Load danh sách thành viên một lần duy nhất lúc khởi tạo
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Load dữ liệu tuần khi thay đổi tuần
  useEffect(() => {
    fetchWeeklyData(selectedWeekStart);
  }, [fetchWeeklyData, selectedWeekStart]);

  const handleRefreshSummary = useCallback(async () => {
    await fetchWeeklyData(selectedWeekStart);
  }, [fetchWeeklyData, selectedWeekStart]);

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
      await fetchWeeklyData(selectedWeekStart);
    } catch (err) {
      console.error(err);
      alert('Không thể thêm thành viên.');
    }
  }, [fetchWeeklyData, selectedWeekStart]);

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
      await fetchWeeklyData(selectedWeekStart);
    } catch (err) {
      console.error(err);
      alert('Không thể cập nhật thành viên.');
    }
  }, [fetchWeeklyData, selectedWeekStart]);

  const handleDeleteMember = useCallback(async (id: number) => {
    try {
      await deleteThanhVien(id);
      setThanhViens((prev) => prev.filter((x) => x.id !== id));
      await fetchWeeklyData(selectedWeekStart);
    } catch (err) {
      console.error(err);
      alert('Không thể xóa thành viên.');
    }
  }, [fetchWeeklyData, selectedWeekStart]);

  // Các hàm xử lý Bữa ăn
  const handleSelectDay = useCallback((day: DayConfig, buaToi?: BuaToi) => {
    setSelectedDay(day);
    setSelectedBuaToi(buaToi);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedDay(null);
    setSelectedBuaToi(undefined);
  }, []);

  const handleSaveBuaToi = useCallback(async (buaToiMoi: BuaToi) => {
    try {
      const res = await addBuaToi(buaToiMoi);
      setBuaTois((prev) => {
        const check = prev.some((x) => x.thuTrongTuan === res.thuTrongTuan);
        if (check) {
          return prev.map((x) => (x.thuTrongTuan === res.thuTrongTuan ? res : x));
        } else {
          return [...prev, res].sort((a, b) => new Date(a.ngayAn).getTime() - new Date(b.ngayAn).getTime());
        }
      });
      await fetchWeeklyData(selectedWeekStart);
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi lưu thông tin bữa tối.');
    }
  }, [fetchWeeklyData, selectedWeekStart]);

  const handleDeleteBuaToi = useCallback(async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bữa tối này?')) return;
    try {
      await deleteBuaToi(id);
      setBuaTois((prev) => prev.filter((x) => x.id !== id));
      await fetchWeeklyData(selectedWeekStart);
      handleCloseModal();
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi xóa bữa tối.');
    }
  }, [fetchWeeklyData, selectedWeekStart, handleCloseModal]);

  // Các hàm xử lý Chi Phí Khác
  const handleOpenAddChiPhi = useCallback((dateString?: string) => {
    if (dateString) {
      setSelectedChiPhi({
        id: undefined,
        ngayAn: dateString,
        thuTrongTuan: '',
        tongTien: 0,
        loai: 'chi_phi_khac',
        moTa: '',
        nguoiAnIds: [],
        nguoiTraTien: []
      } as any);
    } else {
      setSelectedChiPhi(undefined);
    }
    setIsChiPhiModalOpen(true);
  }, []);

  const handleOpenEditChiPhi = useCallback((chiPhi: BuaToi) => {
    setSelectedChiPhi(chiPhi);
    setIsChiPhiModalOpen(true);
  }, []);

  const handleCloseChiPhiModal = useCallback(() => {
    setSelectedChiPhi(undefined);
    setIsChiPhiModalOpen(false);
  }, []);

  const handleSaveChiPhi = useCallback(async (payload: {
    id?: number;
    moTa: string;
    tongTien: number;
    ngayChi: string;
    nguoiChiaIds: number[];
    nguoiTraTien: NguoiTraTien[];
  }) => {
    try {
      const res = await addChiPhiKhac(payload);
      setBuaTois((prev) => {
        const otherFiltered = prev.filter((x) => x.id !== payload.id);
        return [...otherFiltered, res].sort((a, b) => new Date(a.ngayAn).getTime() - new Date(b.ngayAn).getTime());
      });
      await fetchWeeklyData(selectedWeekStart);
      handleCloseChiPhiModal();
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi lưu chi phí.');
    }
  }, [fetchWeeklyData, selectedWeekStart, handleCloseChiPhiModal]);

  const handleDeleteChiPhi = useCallback(async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa chi phí này?')) return;
    try {
      await deleteBuaToi(id);
      setBuaTois((prev) => prev.filter((x) => x.id !== id));
      await fetchWeeklyData(selectedWeekStart);
      handleCloseChiPhiModal();
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi xóa chi phí.');
    }
  }, [fetchWeeklyData, selectedWeekStart, handleCloseChiPhiModal]);

  const formatVND = useCallback((amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }, []);

  const getTenThanhVien = useCallback((id: number) => {
    return thanhViens.find((tv) => tv.id === id)?.ten || `Thành viên #${id}`;
  }, [thanhViens]);

  const handleCopyText = useCallback((tuTen: string, denTen: string, soTien: number, key: string) => {
    const formatNumber = new Intl.NumberFormat('vi-VN').format(soTien);
    const text = `${tuTen} chuyển khoản cho ${denTen} số tiền ${formatNumber}đ`;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey(null);
      }, 2000);
    }).catch(err => {
      console.error('Lỗi sao chép:', err);
    });
  }, []);

  const memberPaidBreakdown = useMemo(() => {
    if (!selectedCreditorId) return [];
    return buaTois
      .map((bt) => {
        const payerRecord = bt.nguoiTraTien?.find((p) => p.thanhVienId === selectedCreditorId);
        const soTienDaChi = payerRecord ? payerRecord.soTienDaTra : 0;

        if (soTienDaChi <= 0) return null;

        const countNguoiAn = bt.nguoiAnIds?.length || 0;
        const tienMoiNguoi = countNguoiAn > 0 ? bt.tongTien / countNguoiAn : 0;

        const nguoiNoBuaNay = bt.nguoiAnIds
          .filter((id) => id !== selectedCreditorId)
          .map((id) => ({
            thanhVienId: id,
            ten: getTenThanhVien(id),
            soTienNo: tienMoiNguoi,
          }));

        const displayName = bt.loai === 'chi_phi_khac' ? `Chi phí: ${bt.moTa}` : bt.thuTrongTuan;

        return {
          id: bt.id,
          thuTrongTuan: displayName || 'Chi phí khác',
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

        const creditors = bt.nguoiTraTien
          .filter((p) => p.soTienDaTra > 0)
          .map((p) => ({
            ten: getTenThanhVien(p.thanhVienId),
            soTienDaChi: p.soTienDaTra,
          }));

        const displayName = bt.loai === 'chi_phi_khac' ? `Chi phí: ${bt.moTa}` : bt.thuTrongTuan;

        return {
          id: bt.id,
          thuTrongTuan: displayName || 'Chi phí khác',
          tienAnNo,
          creditors,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [buaTois, selectedCreditorId, getTenThanhVien]);

  const handlePrevWeek = useCallback(() => {
    setSelectedWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d.toISOString().split('T')[0];
    });
  }, []);

  const handleNextWeek = useCallback(() => {
    setSelectedWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d.toISOString().split('T')[0];
    });
  }, []);

  const handleOpenDetail = useCallback((id: number) => {
    setSelectedCreditorId(id);
    setIsSummaryModalOpen(true);
  }, []);


  // Helper hiển thị ngày format DD/MM/YYYY
  const displayDateStr = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Tính ngày Chủ nhật của tuần (cộng 6 ngày vào ngày Thứ 2)
  const getSundayDateStr = (mondayStr: string) => {
    const d = new Date(mondayStr);
    d.setDate(d.getDate() + 6);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${date}`;
  };



  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8 md:py-12 flex flex-col min-h-screen">
      {/* Header chính */}
      <header className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10 pb-6 border-b border-slate-900">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <ChefHat className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-wide">
              QUẢN LÝ TIỀN ĂN TỐI
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Hệ thống theo dõi chi phí bữa tối & tối ưu chuyển tiền nhóm bạn sống chung
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs text-slate-400 font-medium font-mono">Phiên Bản 3.0 (Cloud Sync)</span>
        </div>
      </header>

      {/* Thanh Điều Hướng Tuần (Lịch sử các tuần) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/40 border border-slate-800 p-4 rounded-2xl mb-8 shadow-lg backdrop-blur-sm">
        <button
          onClick={handlePrevWeek}
          className="w-full sm:w-auto px-5 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-200 text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-slate-800"
        >
          &larr; Tuần trước
        </button>
        <div className="text-center">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Đang hiển thị dữ liệu tuần</span>
          <span className="text-sm md:text-base font-extrabold text-indigo-400 font-mono">
            {displayDateStr(selectedWeekStart)} &mdash; {displayDateStr(getSundayDateStr(selectedWeekStart))}
          </span>
        </div>
        <button
          onClick={handleNextWeek}
          className="w-full sm:w-auto px-5 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-200 text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-slate-800"
        >
          Tuần sau &rarr;
        </button>
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

      {/* Grid Layout 4 phần */}
      <main className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 items-start flex-1">
        {/* Phần 1: Danh sách thành viên */}
        <section className="lg:col-span-1">
          <DanhSachThanhVien
            thanhViens={thanhViens}
            onAdd={handleAddMember}
            onUpdate={handleUpdateMember}
            onDelete={handleDeleteMember}
            loading={loadingMembers}
          />
        </section>

        {/* Phần 2: Lịch ăn theo tuần */}
        <section className="lg:col-span-1">
          <LichAnTuan
            buaTois={buaTois.filter((b) => b.loai !== 'chi_phi_khac')}
            thanhViens={thanhViens}
            daysOfWeek={daysOfWeek}
            onSelectDay={handleSelectDay}
            onDeleteDay={handleDeleteBuaToi}
          />
        </section>

        {/* Phần 3: Chi phí khác */}
        <section className="lg:col-span-1">
          <ChiPhiKhac
            chiPhis={buaTois.filter((b) => b.loai === 'chi_phi_khac')}
            thanhViens={thanhViens}
            daysOfWeek={daysOfWeek}
            onAdd={handleOpenAddChiPhi}
            onEdit={handleOpenEditChiPhi}
            onDelete={handleDeleteChiPhi}
          />
        </section>

        {/* Phần 4: Tổng kết tuần & Tối ưu chuyển khoản */}
        <section className="lg:col-span-1">
          <TongKetTuan
            tongKet={tongKet}
            buaTois={buaTois}
            onRefresh={handleRefreshSummary}
            loading={loadingSummary}
            onOpenDetail={handleOpenDetail}
          />
        </section>
      </main>

      {/* Modal Nhập Bữa Tối */}
      {selectedDay && (
        <FormNhapTien
          day={selectedDay}
          buaToi={selectedBuaToi}
          thanhViens={thanhViens}
          onSave={handleSaveBuaToi}
          onDelete={handleDeleteBuaToi}
          onClose={handleCloseModal}
        />
      )}

      {/* Modal Bảng Chi Tiết Tổng Kết Nhận Tiền */}
      {isSummaryModalOpen && selectedCreditorId && (() => {
        const activeCreditor = tongKet?.chiTietTongKet.find(c => c.thanhVienId === selectedCreditorId);
        if (!activeCreditor) return null;

        const isDebtor = activeCreditor.netBalance < -0.01;
        const activeCreditorMember = thanhViens.find(tv => tv.id === activeCreditor.thanhVienId);
        const hasQrCode = !!activeCreditorMember?.qrCodeImage;

        // Tính toán các khoản nợ/có đối ứng trực tiếp (bilateral) giữa thành viên này và các thành viên khác
        const bilateralTransfers = (() => {
          const receivables: any[] = [];
          const payables: any[] = [];
          
          for (const other of thanhViens) {
            if (other.id === selectedCreditorId) continue;
            
            let netOwedToActive = 0;
            
            for (const bt of buaTois) {
              const countNguoiAn = bt.nguoiAnIds?.length || 0;
              if (countNguoiAn === 0) continue;
              const tienMoiNguoi = bt.tongTien / countNguoiAn;
              
              // 1. Nếu activeCreditor là người trả tiền
              const activePayer = bt.nguoiTraTien?.find(p => p.thanhVienId === selectedCreditorId);
              if (activePayer && activePayer.soTienDaTra > 0) {
                if (bt.nguoiAnIds.includes(other.id)) {
                  netOwedToActive += tienMoiNguoi;
                }
              }
              
              // 2. Nếu other là người trả tiền
              const otherPayer = bt.nguoiTraTien?.find(p => p.thanhVienId === other.id);
              if (otherPayer && otherPayer.soTienDaTra > 0) {
                if (bt.nguoiAnIds.includes(selectedCreditorId)) {
                  netOwedToActive -= tienMoiNguoi;
                }
              }
            }
            
            if (netOwedToActive > 0.01) {
              receivables.push({
                tuThanhVienId: other.id,
                tuTen: other.ten,
                denThanhVienId: selectedCreditorId,
                denTen: activeCreditor.ten,
                soTien: Math.round(netOwedToActive * 100) / 100
              });
            } else if (netOwedToActive < -0.01) {
              payables.push({
                tuThanhVienId: selectedCreditorId,
                tuTen: activeCreditor.ten,
                denThanhVienId: other.id,
                denTen: other.ten,
                soTien: Math.round(Math.abs(netOwedToActive) * 100) / 100
              });
            }
          }
          
          return {
            receivables: receivables.sort((a, b) => b.soTien - a.soTien),
            payables: payables.sort((a, b) => b.soTien - a.soTien)
          };
        })();

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
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isDebtor ? (
                      <>
                        Tổng tiền cần chuyển trả: <span className="text-rose-400 font-extrabold font-mono">{formatVND(Math.abs(activeCreditor.netBalance))}</span>
                      </>
                    ) : (
                      <>
                        Tổng tiền được nhận lại: <span className="text-emerald-400 font-extrabold font-mono">{formatVND(activeCreditor.netBalance)}</span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 bg-slate-950/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Cột trái: Chi tiết các khoản chuyển khoản trực tiếp */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                      <Coins className="w-4 h-4 text-indigo-400" />
                      1. Hướng dẫn chuyển khoản trực tiếp (Chưa đơn giản hóa chéo)
                    </h4>
                    
                    {/* Mục 1: Nhận tiền từ người khác */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider pl-1">
                        Thành viên khác cần chuyển trả cho {activeCreditor.ten}:
                      </div>
                      {bilateralTransfers.receivables.length === 0 ? (
                        <div className="bg-slate-900/20 border border-slate-850/60 rounded-xl p-3.5 text-center text-xs text-slate-500 italic">
                          Không có khoản cần nhận từ thành viên khác.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {bilateralTransfers.receivables.map((gd, idx) => {
                            const copyKey = `modal-rec-${activeCreditor.thanhVienId}-${gd.tuThanhVienId}-${idx}`;
                            const recipientMember = activeCreditorMember;
                            const recipientHasQr = hasQrCode;

                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/60 transition-colors"
                              >
                                <div className="flex items-center gap-2 text-sm text-slate-200">
                                  <span className="font-bold text-rose-300">{gd.tuTen}</span>
                                  <span className="text-slate-500 font-normal">chuyển cho</span>
                                  <span className="font-bold text-slate-100">{gd.denTen}</span>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <span className="font-mono font-extrabold text-indigo-300 text-sm">
                                    {formatVND(gd.soTien)}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {recipientHasQr && (
                                      <button
                                        onClick={() => {
                                          setActiveQRData({
                                            qrCodeImage: recipientMember?.qrCodeImage || '',
                                            denTen: gd.denTen,
                                            soTien: gd.soTien,
                                            tuTen: gd.tuTen,
                                          });
                                        }}
                                        className="p-2 rounded-lg border bg-slate-950 border-slate-850 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all duration-200 flex items-center justify-center cursor-pointer"
                                        title={`Mã QR nhận tiền của ${gd.denTen}`}
                                      >
                                        <QrCode className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleCopyText(gd.tuTen, gd.denTen, gd.soTien, copyKey)}
                                      className={`p-2 rounded-lg border transition-all duration-200 flex items-center justify-center cursor-pointer ${
                                        copiedKey === copyKey
                                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                          : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30'
                                      }`}
                                      title="Copy cú pháp chuyển khoản"
                                    >
                                      {copiedKey === copyKey ? (
                                        <Check className="w-3.5 h-3.5" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
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
                            const copyKey = `modal-pay-${activeCreditor.thanhVienId}-${gd.denThanhVienId}-${idx}`;
                            const recipientMember = thanhViens.find(tv => tv.id === gd.denThanhVienId);
                            const recipientHasQr = !!recipientMember?.qrCodeImage;

                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/60 transition-colors"
                              >
                                <div className="flex items-center gap-2 text-sm text-slate-200">
                                  <span className="font-bold text-slate-100">{gd.tuTen}</span>
                                  <span className="text-slate-500 font-normal">chuyển cho</span>
                                  <span className="font-bold text-emerald-300">{gd.denTen}</span>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <span className="font-mono font-extrabold text-indigo-300 text-sm">
                                    {formatVND(gd.soTien)}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {recipientHasQr && (
                                      <button
                                        onClick={() => {
                                          setActiveQRData({
                                            qrCodeImage: recipientMember.qrCodeImage!,
                                            denTen: gd.denTen,
                                            soTien: gd.soTien,
                                            tuTen: gd.tuTen,
                                          });
                                        }}
                                        className="p-2 rounded-lg border bg-slate-950 border-slate-850 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all duration-200 flex items-center justify-center cursor-pointer"
                                        title={`Mã QR nhận tiền của ${gd.denTen}`}
                                      >
                                        <QrCode className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleCopyText(gd.tuTen, gd.denTen, gd.soTien, copyKey)}
                                      className={`p-2 rounded-lg border transition-all duration-200 flex items-center justify-center cursor-pointer ${
                                        copiedKey === copyKey
                                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                          : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30'
                                      }`}
                                      title="Copy cú pháp chuyển khoản"
                                    >
                                      {copiedKey === copyKey ? (
                                        <Check className="w-3.5 h-3.5" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
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

                  {/* Cột phải: Giải trình các ngày chi */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-violet-400" />
                      2. Giải trình chi tiết các khoản trong tuần
                    </h4>
                    
                    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                      
                      {/* 2.1. Các khoản đã chi trả */}
                      {memberPaidBreakdown.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider pl-1">
                            Các khoản bạn đã trả tiền:
                          </div>
                          {memberPaidBreakdown.map((day, idx) => (
                            <div key={idx} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-3">
                              <div className="flex justify-between items-center text-xs border-b border-slate-800/60 pb-2">
                                <span className="font-bold text-indigo-400 text-xs">{day.thuTrongTuan}</span>
                                <span className="text-slate-400">
                                  Đã chi: <span className="font-extrabold text-slate-200 font-mono">{formatVND(day.soTienDaChi)}</span>
                                </span>
                              </div>
                              
                              <div className="space-y-2">
                                {day.nguoiNoBuaNay.map((nguoi, nIdx) => (
                                  <div key={nIdx} className="flex justify-between items-center text-xs">
                                    <span className="text-slate-350">{nguoi.ten}</span>
                                    <span className="font-mono text-slate-400 text-[11px]">
                                      Ăn nợ: <span className="text-rose-450 font-medium">{formatVND(nguoi.soTienNo)}</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 2.2. Các khoản ăn nợ / chung chia */}
                      {memberDebtorBreakdown.length > 0 && (
                        <div className="space-y-2 mt-4">
                          <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider pl-1">
                            Các khoản bạn ăn chung / nợ:
                          </div>
                          {memberDebtorBreakdown.map((day, idx) => (
                            <div key={idx} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-3">
                              <div className="flex justify-between items-center text-xs border-b border-slate-800/60 pb-2">
                                <span className="font-bold text-indigo-400 text-xs">{day.thuTrongTuan}</span>
                                <span className="text-slate-400">
                                  Phần ăn của bạn: <span className="font-extrabold text-rose-400 font-mono">{formatVND(day.tienAnNo)}</span>
                                </span>
                              </div>
                              
                              <div className="space-y-1.5">
                                {day.creditors.map((c, cIdx) => (
                                  <div key={cIdx} className="flex justify-between items-center text-[11px] text-slate-400">
                                    <span>Người trả: {c.ten}</span>
                                    <span>Tổng chi: {formatVND(c.soTienDaChi)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {memberPaidBreakdown.length === 0 && memberDebtorBreakdown.length === 0 && (
                        <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-4 text-center text-xs text-slate-500 italic">
                          Không có lịch sử chi tiêu hoặc ăn nợ tuần này.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-between items-center px-6 py-4 border-t border-slate-800 bg-slate-900/50">
                <div>
                  {hasQrCode && activeCreditor.netBalance > 0.01 && (
                    <button
                      onClick={() => {
                        setActiveQRData({
                          qrCodeImage: activeCreditorMember?.qrCodeImage || '',
                          denTen: activeCreditor.ten,
                          soTien: activeCreditor.netBalance,
                          tuTen: 'Thành viên nhóm',
                        });
                      }}
                      className="px-4 py-2.5 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20 text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2"
                    >
                      <QrCode className="w-4 h-4" />
                      Mã QR nhận tiền của {activeCreditor.ten}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-250 rounded-xl transition-all cursor-pointer"
                >
                  Đóng bảng chi tiết
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Sub-modal Mã QR Thanh Toán */}
      {activeQRData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-400" />
                Mã QR Thanh Toán
              </h3>
              <button
                onClick={() => setActiveQRData(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QR Image & Details */}
            <div className="p-6 flex flex-col items-center space-y-4">
              <div className="bg-slate-950 p-2 rounded-2xl border border-slate-800 shadow-inner flex justify-center items-center max-w-full overflow-hidden">
                <img
                  src={activeQRData.qrCodeImage}
                  alt="Mã QR Chuyển Khoản"
                  className="max-w-xs max-h-72 object-contain rounded-lg shadow-md"
                />
              </div>

              <div className="w-full space-y-2 text-xs border-t border-slate-800 pt-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">Người nhận:</span>
                  <span className="font-bold text-slate-200">{activeQRData.denTen}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Người gửi:</span>
                  <span className="font-bold text-slate-200">{activeQRData.tuTen}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Số tiền chuyển:</span>
                  <span className="font-mono font-extrabold text-emerald-400 text-sm">
                    {formatVND(activeQRData.soTien)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end px-6 py-4 border-t border-slate-800 bg-slate-900/50">
              <button
                onClick={() => setActiveQRData(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-250 rounded-xl transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nhập Bữa Tối */}
      {selectedDay && (
        <FormNhapTien
          day={selectedDay}
          buaToi={selectedBuaToi}
          thanhViens={thanhViens}
          onSave={handleSaveBuaToi}
          onDelete={handleDeleteBuaToi}
          onClose={handleCloseModal}
        />
      )}

      {/* Modal Nhập Chi Phí Khác */}
      {isChiPhiModalOpen && (
        <FormChiPhiKhac
          daysOfWeek={daysOfWeek}
          chiPhi={selectedChiPhi}
          thanhViens={thanhViens}
          onSave={handleSaveChiPhi}
          onDelete={handleDeleteChiPhi}
          onClose={handleCloseChiPhiModal}
        />
      )}

      {/* Footer */}
      <footer className="mt-16 text-center text-xs text-slate-650 pt-6 border-t border-slate-950">
        © 2026 Quản Lý Ăn Uống Nhóm. Phát triển bởi Google DeepMind Antigravity.
      </footer>
    </div>
  );
}

export default App;
