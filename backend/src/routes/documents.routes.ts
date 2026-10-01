import { Router } from 'express';
import multer from 'multer';
import { DocumentService } from '../services/DocumentService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { requireDatabase } from '../lib/dbHealth';
import { isSupabaseServerConfigured } from '../lib/supabase';

const router = Router();

// Files are held in memory only: they are streamed straight into the private
// Supabase Storage bucket and are never written to the ATCS server filesystem.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

function requireSupabaseStorage() {
  if (!isSupabaseServerConfigured()) {
    throw new AppError(
      'Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the backend environment.',
      503,
      'SUPABASE_NOT_CONFIGURED'
    );
  }
}

// Upload a supporting document against a spending request
router.post(
  '/spending-requests/:id/documents',
  authenticate,
  requireDatabase,
  (req, res, next) => {
    try {
      requireSupabaseStorage();
      next();
    } catch (err) {
      next(err);
    }
  },
  upload.single('file'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.file) {
        throw new AppError('No file provided. Attach a file under the field name "file".', 400, 'FILE_REQUIRED');
      }
      const document = await DocumentService.uploadDocument(
        req.params.id,
        req.user!,
        req.file,
        (req.body?.documentType as string) || 'SUPPORTING'
      );
      res.status(201).json({ success: true, data: document });
    } catch (err) {
      next(err);
    }
  }
);

// List document metadata for a spending request
router.get(
  '/spending-requests/:id/documents',
  authenticate,
  requireDatabase,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const documents = await DocumentService.listDocuments(req.params.id, req.user!);
      res.json({ success: true, data: documents });
    } catch (err) {
      next(err);
    }
  }
);

// Issue a short-lived signed download URL (RBAC checked server-side)
router.get(
  '/documents/:documentId/url',
  authenticate,
  requireDatabase,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await DocumentService.getSignedUrl(req.params.documentId, req.user!);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// Delete a document (uploader, Finance or Admin only)
router.delete(
  '/documents/:documentId',
  authenticate,
  requireDatabase,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await DocumentService.deleteDocument(req.params.documentId, req.user!);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
