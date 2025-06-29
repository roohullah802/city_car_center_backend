// src/middleware/upload.ts
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { cloudinary } from '../cloudinary/cloudinary';

const storage = new CloudinaryStorage({
    cloudinary,
    params: async () => ({
      allowed_formats: ['webp', 'jpeg', 'png', 'jpg'],
      transformation: [{ width: 800, height: 800, crop: 'limit' }],
    }),
  });
  
  const upload = multer({ storage });
  export default upload;

