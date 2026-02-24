import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { authMiddleware } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import fs from 'fs';

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
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

const upload = multer({
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

router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    throw new AppError(400, 'No file uploaded', 'NO_FILE_UPLOADED');
  }

  // Construct URL
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const fileUrl = `${baseUrl}/public/uploads/${req.file.filename}`;

  res.status(200).json({
    success: true,
    data: {
      url: fileUrl,
      filename: req.file.filename,
    }
  });
});

export default router;
