import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api',
});

export interface ThanhVien {
  id: number;
  ten: string;
}

export interface NguoiTraTien {
  thanhVienId: number;
  soTienDaTra: number;
}

export interface BuaToi {
  id?: number;
  thuTrongTuan: string;
  tongTien: number;
  ngayAn: string;
  nguoiAnIds: number[];
  nguoiTraTien: NguoiTraTien[];
}

export interface ChiTietThanhVienTongKet {
  thanhVienId: number;
  ten: string;
  tongNo: number;
  tongDuocNhan: number;
  netBalance: number;
}

export interface GiaoDich {
  tuThanhVienId: number;
  tuTen: string;
  denThanhVienId: number;
  denTen: string;
  soTien: number;
}

export interface TongKetResponse {
  chiTietTongKet: ChiTietThanhVienTongKet[];
  danhSachChuyenKhoan: GiaoDich[];
}

export const getThanhViens = async (): Promise<ThanhVien[]> => {
  const response = await api.get('/danh-sach-thanh-vien');
  return response.data;
};

export const addThanhVien = async (ten: string): Promise<ThanhVien> => {
  const response = await api.post('/them-thanh-vien', { ten });
  return response.data;
};

export const updateThanhVien = async (id: number, ten: string): Promise<ThanhVien> => {
  const response = await api.put(`/sua-thanh-vien/${id}`, { ten });
  return response.data;
};

export const deleteThanhVien = async (id: number): Promise<{ message: string }> => {
  const response = await api.delete(`/xoa-thanh-vien/${id}`);
  return response.data;
};

export const getBuaTois = async (ngayDauTuan?: string): Promise<BuaToi[]> => {
  const response = await api.get('/danh-sach-bua-toi', {
    params: { ngayDauTuan },
  });
  return response.data;
};

export const addBuaToi = async (buaToi: BuaToi): Promise<BuaToi> => {
  const response = await api.post('/them-bua-toi', buaToi);
  return response.data;
};

export const getTongKetTuan = async (ngayDauTuan?: string): Promise<TongKetResponse> => {
  const response = await api.get('/tong-ket-tuan', {
    params: { ngayDauTuan },
  });
  return response.data;
};

export default api;
