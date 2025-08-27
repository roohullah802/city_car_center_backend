import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';


// Use memory storage
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  fileFilter: (
    req: Express.Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ): void => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp","image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export const compressAndResize = async (req: any, res: any, next: any) => {
  if (!req.files || typeof req.files !== 'object') return next();

  const processedFiles: { [fieldname: string]: Express.Multer.File[] } = {};
  const BASE_PATH = path.join(__dirname, '../../../../../private_data/uploads');

  try {
    for (const field in req.files) {
      const fileArray = req.files[field];

      if (Array.isArray(fileArray)) {
        processedFiles[field] = [];

        for (const file of fileArray) {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
          const outputPath = path.join(BASE_PATH, uniqueName);

          await sharp(file.buffer)
            .resize({ width: 800 })
            .jpeg({ quality: 70 })
            .toFile(outputPath);

          processedFiles[field].push({
            ...file,
            filename: uniqueName,
            path: outputPath,
            size: fs.statSync(outputPath).size,
          } as Express.Multer.File);
        }
      }
    }

    req.files = processedFiles;
    next();
  } catch (err) {
    next(err);
  }
};

