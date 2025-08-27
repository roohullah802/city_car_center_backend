import multer from 'multer';

const storage = multer.memoryStorage();

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
