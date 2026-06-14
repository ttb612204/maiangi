import { Router } from 'express';
import {
  themThanhVien,
  danhSachThanhVien,
  suaThanhVien,
  xoaThanhVien,
} from '../controllers/thanhVienController';

const router = Router();

router.post('/them-thanh-vien', themThanhVien);
router.get('/danh-sach-thanh-vien', danhSachThanhVien);
router.put('/sua-thanh-vien/:id', suaThanhVien);
router.delete('/xoa-thanh-vien/:id', xoaThanhVien);

export default router;
