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

export const compressAndResize = async (req: any, res: any, next: any) => {
  // Skip if no files
  if (!req.files || typeof req.files !== 'object') return next();

  const processedFiles: Express.Multer.File[] = [];

  try {
    // Iterate through each field in req.files
    for (const key in req.files) {
      const fileArray = req.files[key];

      if (Array.isArray(fileArray)) {
        for (const file of fileArray) {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
          const outputPath = path.join(uploadPath, uniqueName);

          // Resize and compress with sharp
          await sharp(file.buffer)
            .resize({ width: 800 }) // Resize to width 800px
            .jpeg({ quality: 70 })  // Compress to ~70% quality
            .toFile(outputPath);

          processedFiles.push({
            ...file,
            filename: uniqueName,
            path: outputPath,
            size: fs.statSync(outputPath).size,
          } as Express.Multer.File);
        }
      }
    }

    // Overwrite req.files with the processed files array
    req.files = processedFiles;
    next();
  } catch (err) {
    next(err);
  }
};
