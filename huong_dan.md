# HƯỚNG DẪN CHẠY & DEPLOY WEBSITE QUẢN LÝ TIỀN ĂN TỐI (SỬ DỤNG SUPABASE)

Tài liệu này hướng dẫn chi tiết cách thiết lập cơ sở dữ liệu **Supabase (PostgreSQL)** miễn phí, khởi chạy ứng dụng cục bộ (localhost) và triển khai (deploy) lên **Vercel**.

---

## 1. CẤU TRÚC THƯ MỤC DỰ ÁN
* `/backend`: Máy chủ API (Node.js, Express, TypeScript, Prisma ORM).
* `/frontend`: Giao diện người dùng (React, Vite, TypeScript, Tailwind CSS).

---

## 2. THIẾT LẬP DATABASE ONLINE TRÊN SUPABASE (MIỄN PHÍ)

Vì ứng dụng sử dụng cơ sở dữ liệu PostgreSQL, **Supabase** là dịch vụ lưu trữ đám mây dễ nhất để kết nối và hoàn toàn miễn phí.

### Bước 2.1: Tạo Project Supabase
1. Truy cập [supabase.com](https://supabase.com) và đăng nhập bằng tài khoản GitHub của bạn.
2. Bấm **New Project** -> Chọn tổ chức (Organization) -> Nhập thông tin:
   * **Name**: `quanlyanuong`
   * **Database Password**: Nhập mật khẩu của bạn (Hãy lưu lại mật khẩu này).
   * **Region**: Chọn vùng gần Việt Nam nhất (ví dụ: `Singapore`).
3. Bấm **Create New Project** và đợi 1 - 2 phút để hệ thống khởi tạo.

### Bước 2.2: Lấy chuỗi kết nối (Connection String)
1. Trong giao diện Supabase, bấm vào biểu tượng bánh răng **Project Settings** ở menu bên trái.
2. Chọn mục **Database**.
3. Cuộn xuống phần **Connection string**, chọn tab **URI**.
4. Sao chép đường dẫn kết nối dạng:
   `postgresql://postgres.[username]:[password]@[host]:6543/postgres`

---

## 3. HƯỚNG DẪN CHẠY CỤC BỘ (LOCALHOST)

### Bước 3.1: Khởi chạy Backend (Port 5000)
1. Mở terminal và di chuyển vào thư mục `/backend`.
2. Tạo/Mở file `.env` và dán chuỗi kết nối Supabase vào biến `DATABASE_URL` (thay thế `[password]` bằng mật khẩu thực tế bạn đặt ở bước 2.1):
   ```env
   PORT=5000
   DATABASE_URL="postgresql://postgres.xxx:mat_khau_cua_ban@aws-0-xxx.pooler.supabase.com:6543/postgres?pgbouncer=true"
   ```
3. Cài đặt các gói thư viện:
   ```bash
   npm install
   ```
4. Đẩy cấu trúc bảng lên cơ sở dữ liệu Supabase:
   ```bash
   npx prisma db push
   ```
   *(Lệnh này sẽ tự động tạo các bảng thanh_vien, bua_toi, nguoi_an, nguoi_tra_tien, tong_ket_tuan trực tiếp trên Supabase)*
5. Khởi chạy máy chủ phát triển Backend:
   ```bash
   npm run dev
   ```
   *Backend hoạt động tại địa chỉ: `http://localhost:5000`*

### Bước 3.2: Khởi chạy Frontend (Port 3000)
1. Mở terminal mới và di chuyển vào thư mục `/frontend`.
2. Cài đặt các thư viện liên quan:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Khởi chạy giao diện phát triển Frontend:
   ```bash
   npm run dev
   ```
4. Mở trình duyệt và truy cập: `http://localhost:3000`

---

## 4. HƯỚNG DẪN DEPLOY LÊN VERCEL

### Bước 4.1: Deploy Backend (Express Server)
1. Truy cập [vercel.com](https://vercel.com) và tạo một Project mới.
2. Kết nối kho lưu trữ Git của bạn và chọn thư mục gốc là `/backend`.
3. Trong phần cấu hình **Environment Variables** trên Vercel, thêm biến:
   * **Key**: `DATABASE_URL`
   * **Value**: Dán chuỗi kết nối Supabase của bạn vào.
4. Bấm **Deploy**. Vercel sẽ tự động build file `server.ts` thông qua cấu hình `vercel.json` có sẵn.
5. Khi hoàn tất, bạn sẽ nhận được địa chỉ API của bạn (Ví dụ: `https://quanlyanuong-backend.vercel.app`).

### Bước 4.2: Deploy Frontend (React Web App)
1. Tạo một Project mới khác trên Vercel cho Frontend.
2. Chọn thư mục gốc là `/frontend`.
3. Trong phần cấu hình **Environment Variables** trên Vercel, thêm biến:
   * **Key**: `VITE_API_URL`
   * **Value**: Địa chỉ API Backend vừa tạo ở bước 4.1 cộng với hậu tố `/api` (Ví dụ: `https://quanlyanuong-backend.vercel.app/api`).
4. Bấm **Deploy**.
5. Truy cập địa chỉ web của Frontend để sử dụng ứng dụng chính thức cùng nhóm bạn!
