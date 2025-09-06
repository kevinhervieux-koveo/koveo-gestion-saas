import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

/**
 * File upload middleware specifically for invoice processing.
 * Handles secure file upload with size and type validation.
 */

// Configure multer for memory storage (file processing without disk storage)
const storage = multer.memoryStorage();

// File filter for supported invoice file types
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const supportedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ];

  if (supportedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Supported types: ${supportedTypes.join(', ')}`));
  }
};

// Configure multer with limits and file filter
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (matching SharedUploader component)
    files: 1 // Only allow single file upload
  }
});

/**
 * Middleware for handling single invoice file upload.
 * Use this for the /api/invoices/extract-data endpoint.
 */
export const uploadInvoiceFile = upload.single('invoiceFile');

/**
 * Error handling middleware for multer file upload errors.
 */
export const handleUploadError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: 'File too large',
          message: 'File size must be less than 25MB',
          code: 'FILE_TOO_LARGE'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Unexpected file field',
          message: 'Only one file allowed in invoiceFile field',
          code: 'UNEXPECTED_FILE'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Too many files',
          message: 'Only one file allowed per request',
          code: 'TOO_MANY_FILES'
        });
      default:
        return res.status(400).json({
          error: 'File upload error',
          message: err.message,
          code: 'UPLOAD_ERROR'
        });
    }
  } else if (err.message.includes('Unsupported file type')) {
    return res.status(400).json({
      error: 'Unsupported file type',
      message: err.message,
      code: 'UNSUPPORTED_FILE_TYPE'
    });
  }
  
  // Pass other errors to the next error handler
  next(err);
};