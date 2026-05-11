import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = /\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip)$/i;
  if (allowed.test(file.originalname)) { cb(null, true); }
  else { cb(new Error('File type not allowed')); }
};

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10);

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024, files: parseInt(process.env.MAX_FILES_PER_TICKET ?? '5', 10) },
});
