-- ============================================================================
-- FILE KHỞI TẠO CƠ SỞ DỮ LIỆU POSTGRESQL (FULL SOURCE CODE)
-- Dự án: Quản Lý Tiền Ăn Tối Nhóm
-- ============================================================================

-- 1. XÓA CÁC BẢNG NẾU ĐÃ TỒN TẠI (Theo đúng thứ tự ràng buộc khóa ngoại)
DROP TABLE IF EXISTS tong_ket_tuan CASCADE;
DROP TABLE IF EXISTS nguoi_tra_tien CASCADE;
DROP TABLE IF EXISTS nguoi_an CASCADE;
DROP TABLE IF EXISTS bua_toi CASCADE;
DROP TABLE IF EXISTS thanh_vien CASCADE;

-- 2. TẠO BẢNG THANH_VIÊN (Danh sách thành viên sống chung)
CREATE TABLE thanh_vien (
    id SERIAL PRIMARY KEY,
    ten VARCHAR(100) NOT NULL
);

-- 3. TẠO BẢNG BỮA_TỐI (Theo dõi tổng tiền ăn từng ngày trong tuần)
CREATE TABLE bua_toi (
    id SERIAL PRIMARY KEY,
    thu_trong_tuan VARCHAR(20) NOT NULL,
    tong_tien DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    ngay_an DATE NOT NULL
);

-- 4. TẠO BẢNG NGƯỜI_ĂN (Bảng trung gian theo dõi ai ăn bữa tối nào)
CREATE TABLE nguoi_an (
    id SERIAL PRIMARY KEY,
    bua_toi_id INT NOT NULL,
    thanh_vien_id INT NOT NULL,
    CONSTRAINT fk_nguoi_an_bua_toi FOREIGN KEY (bua_toi_id) REFERENCES bua_toi(id) ON DELETE CASCADE,
    CONSTRAINT fk_nguoi_an_thanh_vien FOREIGN KEY (thanh_vien_id) REFERENCES thanh_vien(id) ON DELETE CASCADE
);

-- 5. TẠO BẢNG NGƯỜI_TRẢ_TIỀN (Lưu vết số tiền mỗi thành viên thực tế đã trả cho bữa ăn)
CREATE TABLE nguoi_tra_tien (
    id SERIAL PRIMARY KEY,
    bua_toi_id INT NOT NULL,
    thanh_vien_id INT NOT NULL,
    so_tien_da_tra DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_nguoi_tra_tien_bua_toi FOREIGN KEY (bua_toi_id) REFERENCES bua_toi(id) ON DELETE CASCADE,
    CONSTRAINT fk_nguoi_tra_tien_thanh_vien FOREIGN KEY (thanh_vien_id) REFERENCES thanh_vien(id) ON DELETE CASCADE
);

-- 6. TẠO BẢNG TỔNG_KẾT_TUẦN (Lưu kết quả tính toán cộng dồn nợ / nhận của tuần)
CREATE TABLE tong_ket_tuan (
    id SERIAL PRIMARY KEY,
    thanh_vien_id INT NOT NULL,
    tong_no DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tong_duoc_nhan DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_tong_ket_tuan_thanh_vien FOREIGN KEY (thanh_vien_id) REFERENCES thanh_vien(id) ON DELETE CASCADE
);

-- 7. TẠO CÁC CHỈ MỤC (INDEX) ĐỂ TỐI ƯU HÓA TRUY VẤN
CREATE INDEX idx_nguoi_an_bua_toi ON nguoi_an(bua_toi_id);
CREATE INDEX idx_nguoi_an_thanh_vien ON nguoi_an(thanh_vien_id);
CREATE INDEX idx_nguoi_tra_tien_bua_toi ON nguoi_tra_tien(bua_toi_id);
CREATE INDEX idx_nguoi_tra_tien_thanh_vien ON nguoi_tra_tien(thanh_vien_id);
CREATE INDEX idx_tong_ket_tuan_thanh_vien ON tong_ket_tuan(thanh_vien_id);
CREATE INDEX idx_bua_toi_ngay_an ON bua_toi(ngay_an);

