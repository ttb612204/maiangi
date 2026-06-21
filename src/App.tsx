import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChefHat, AlertCircle, X, Landmark, CalendarDays, Coins, Copy, Check, QrCode } from 'lucide-react';
import {
  getThanhViens,
  addThanhVien,
  updateThanhVien,
  deleteThanhVien,
  getBuaTois,
  addBuaToi,
  getTongKetTuan,
  ThanhVien,
  BuaToi,
  TongKetResponse,
} from './services/api';
import { DanhSachThanhVien } from './components/DanhSachThanhVien';
import { LichAnTuan } from './components/LichAnTuan';
import { FormNhapTien } from './components/FormNhapTien';
import { TongKetTuan } from './components/TongKetTuan';

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

  const activeDailyPaidBreakdown = useMemo(() => {
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

        return {
          thuTrongTuan: bt.thuTrongTuan,
          soTienDaChi,
          nguoiNoBuaNay,
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
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 flex flex-col min-h-screen">
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

      {/* Grid Layout 3 phần */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start flex-1">
        {/* Phần 1: Danh sách thành viên (Bên trái) */}
        <section className="lg:col-span-1">
          <DanhSachThanhVien
            thanhViens={thanhViens}
            onAdd={handleAddMember}
            onUpdate={handleUpdateMember}
            onDelete={handleDeleteMember}
            loading={loadingMembers}
          />
        </section>

        {/* Phần 2: Lịch ăn theo tuần (Ở giữa) */}
        <section className="lg:col-span-1">
          <LichAnTuan
            buaTois={buaTois}
            thanhViens={thanhViens}
            daysOfWeek={daysOfWeek}
            onSelectDay={handleSelectDay}
          />
        </section>

        {/* Phần 3: Tổng kết tuần & Tối ưu chuyển khoản (Bên phải) */}
        <section className="lg:col-span-1">
          <TongKetTuan
            tongKet={tongKet}
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
          onClose={handleCloseModal}
        />
      )}

      {/* Modal Bảng Chi Tiết Tổng Kết Nhận Tiền */}
      {isSummaryModalOpen && selectedCreditorId && (() => {
        const activeCreditor = tongKet?.chiTietTongKet.find(c => c.thanhVienId === selectedCreditorId);
        const activeDanhSachNhan = tongKet?.danhSachChuyenKhoan.filter(
          (gd) => gd.denThanhVienId === selectedCreditorId
        ) || [];

        if (!activeCreditor) return null;

        const creditorMember = thanhViens.find(tv => tv.id === activeCreditor.thanhVienId);
        const hasQrCode = !!creditorMember?.qrCodeImage;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-emerald-400" />
                    BẢNG CHI TIẾT PHÂN CHIA - {activeCreditor.ten}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tổng tiền được nhận lại: <span className="text-emerald-400 font-extrabold font-mono">{formatVND(activeCreditor.netBalance)}</span>
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
                  
                  {/* Cột trái: Ai cần chuyển khoản */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-400" />
                      1. Các thành viên cần chuyển trả cho {activeCreditor.ten}
                    </h4>
                    
                    {activeDanhSachNhan.length === 0 ? (
                      <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-4 text-center text-xs text-slate-500">
                        Không có ai cần chuyển trả thêm tiền.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {activeDanhSachNhan.map((gd, idx) => {
                          const copyKey = `modal-${activeCreditor.thanhVienId}-receive-from-${gd.tuThanhVienId}-${idx}`;
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/60 transition-colors"
                            >
                              <div className="flex items-center gap-2 text-sm text-slate-200">
                                <span className="font-bold text-rose-300">{gd.tuTen}</span>
                                <span className="text-slate-500 font-normal">chuyển cho</span>
                                <span className="font-bold text-slate-100">{activeCreditor.ten}</span>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-extrabold text-indigo-300 text-sm">
                                  {formatVND(gd.soTien)}
                                </span>
                                 <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleCopyText(gd.tuTen, activeCreditor.ten, gd.soTien, copyKey)}
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

                  {/* Cột phải: Giải trình các ngày chi */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-violet-400" />
                      2. Giải trình chi tiết các ngày {activeCreditor.ten} đã chi
                    </h4>
                    
                    {activeDailyPaidBreakdown.length === 0 ? (
                      <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-4 text-center text-xs text-slate-500">
                        Không có lịch sử chi tiền.
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                        {activeDailyPaidBreakdown.map((day, idx) => (
                          <div key={idx} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-3">
                            <div className="flex justify-between items-center text-xs border-b border-slate-800/60 pb-2">
                              <span className="font-bold text-indigo-400 text-sm">{day.thuTrongTuan}</span>
                              <span className="text-slate-400">
                                Đã chi: <span className="font-extrabold text-slate-200 font-mono">{formatVND(day.soTienDaChi)}</span>
                              </span>
                            </div>
                            
                            <div className="space-y-2">
                              {day.nguoiNoBuaNay.map((nguoi, nIdx) => (
                                <div key={nIdx} className="flex justify-between items-center text-xs">
                                  <span className="text-slate-350">{nguoi.ten}</span>
                                  <span className="font-mono text-slate-400 text-[11px]">
                                    Ăn nợ: <span className="text-rose-400/90 font-medium">{formatVND(nguoi.soTienNo)}</span>
                                  </span>
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

              {/* Modal Footer */}
              <div className="flex justify-between items-center px-6 py-4 border-t border-slate-800 bg-slate-900/50">
                <div>
                  {hasQrCode && (
                    <button
                      onClick={() => {
                        setActiveQRData({
                          qrCodeImage: creditorMember.qrCodeImage!,
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

      {/* Footer */}
      <footer className="mt-16 text-center text-xs text-slate-650 pt-6 border-t border-slate-950">
        © 2026 Quản Lý Ăn Uống Nhóm. Phát triển bởi Google DeepMind Antigravity.
      </footer>
    </div>
  );
}

export default App;
