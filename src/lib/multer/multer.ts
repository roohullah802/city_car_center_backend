import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const uploadPath = path.join(__dirname, '../../../../../private_data/uploads');

// Use memory storage
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  fileFilter: (
    req: Express.Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ): void => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Middleware to compress and resize images
export const compressAndResize = async (req: any, res: any, next: any) => {
  if (!req.files) return next();

  const processedFiles: Express.Multer.File[] = [];

  for (const file of req.files) {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    const outputPath = path.join(uploadPath, uniqueName);

    // Resize & compress with Sharp
    await sharp(file.buffer)
      .resize({ width: 800 })       // Resize width to 800px (height auto)
      .jpeg({ quality: 70 })        // Compress to ~70% quality
      .toFile(outputPath);

    // Replace buffer & path info for request
    processedFiles.push({
      ...file,
      filename: uniqueName,
      path: outputPath,
      size: fs.statSync(outputPath).size,
    } as Express.Multer.File);
  }

  req.files = processedFiles;
  next();
};
