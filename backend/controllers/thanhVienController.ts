import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const themThanhVien = async (req: Request, res: Response) => {
  try {
    const { ten } = req.body;
    if (!ten || typeof ten !== 'string' || ten.trim() === '') {
      return res.status(400).json({ error: 'Tên thành viên không hợp lệ.' });
    }

    const thanhVienMoi = await prisma.thanhVien.create({
      data: {
        ten: ten.trim(),
      },
    });

    return res.status(201).json(thanhVienMoi);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
};

export const danhSachThanhVien = async (req: Request, res: Response) => {
  try {
    const danhSach = await prisma.thanhVien.findMany({
      orderBy: {
        id: 'asc',
      },
    });
    return res.json(danhSach);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
};

export const suaThanhVien = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { ten } = req.body;

    if (!ten || typeof ten !== 'string' || ten.trim() === '') {
      return res.status(400).json({ error: 'Tên thành viên không hợp lệ.' });
    }

    const item = await prisma.thanhVien.update({
      where: { id: parseInt(id) },
      data: { ten: ten.trim() },
    });

    return res.json(item);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
};

export const xoaThanhVien = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.thanhVien.delete({
      where: {
        id: parseInt(id),
      },
    });
    return res.json({ message: 'Đã xóa thành viên thành công.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  }
};
