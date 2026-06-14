import { Router } from 'express';
import {
  themBuaToi,
  danhSachBuaToi,
  layTongKetTuan,
} from '../controllers/buaToiController';

const router = Router();

router.post('/them-bua-toi', themBuaToi);
router.get('/danh-sach-bua-toi', danhSachBuaToi);
router.get('/tong-ket-tuan', layTongKetTuan);

export default router;
