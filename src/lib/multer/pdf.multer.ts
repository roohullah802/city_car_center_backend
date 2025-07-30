import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { cloudinary } from '../cloudinary/cloudinary';

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => {
    return {
      folder: 'uploads',
      format: file.mimetype.split('/')[1], // preserve original file format
      allowed_formats: ['pdf'],
      public_id: file.originalname.split('.')[0], // optional
    };
  },
});

const uploadPDF = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ['application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // Optional: 10 MB limit
});

export default uploadPDF;
