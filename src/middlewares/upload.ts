import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { AppError } from './errorHandler';
import { Request } from 'express';

const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${id}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Only image files are allowed!', 'INVALID_FILE_TYPE'));
    }
  },
});

export const getFileUrl = (req: Request, file?: Express.Multer.File) => {
  if (!file) return undefined;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/public/uploads/${file.filename}`;
};
