import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import thanhVienRoutes from './routes/thanhVienRoutes';
import buaToiRoutes from './routes/buaToiRoutes';

// Load variables from .env
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Cấu hình Middleware
app.use(cors());
app.use(express.json());

// Định tuyến API
app.use('/api', thanhVienRoutes);
app.use('/api', buaToiRoutes);

// Trang chủ máy chủ hiển thị trạng thái hoạt động
app.get('/', (req, res) => {
  res.send('Máy chủ Quản lý Ăn uống đang hoạt động mượt mà!');
});

// Khởi chạy máy chủ
app.listen(port, () => {
  console.log(`Backend server is running on port ${port}`);
});
