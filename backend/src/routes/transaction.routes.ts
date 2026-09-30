import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { TransactionService } from '../services/TransactionService';
import { CsvIngestionService } from '../services/CsvIngestionService';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { RoleType } from '@prisma/client';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const createTxSchema = z.object({
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid(),
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default('INR'),
  transactionDate: z.string().optional(),
  vendor: z.string().min(2),
  referenceNumber: z.string().min(3),
  commitmentId: z.string().uuid().optional().nullable(),
});

const reverseTxSchema = z.object({
  reason: z.string().min(5),
});

// List transactions
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const departmentId =
      req.user?.role === RoleType.MANAGER && req.user.departmentId
        ? req.user.departmentId
        : (req.query.departmentId as string | undefined);

    const result = await TransactionService.getTransactions({
      departmentId,
      categoryId: req.query.categoryId as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Manual transaction settlement
router.post('/', authenticate, validateBody(createTxSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await TransactionService.recordTransaction(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// CSV Import Preview (Validates without mutating DB)
router.post(
  '/import-preview',
  authenticate,
  authorizeRoles(RoleType.FINANCE, RoleType.ADMIN),
  upload.single('file'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      let rawRows: any[] = [];

      if (req.file) {
        const stream = Readable.from(req.file.buffer.toString('utf-8'));
        let rowIdx = 1;
        await new Promise((resolve, reject) => {
          stream
            .pipe(csvParser())
            .on('data', (data) => {
              rawRows.push({
                rowNumber: rowIdx++,
                employeeEmail: data.employeeEmail || data.EmployeeEmail || data.email,
                departmentCode: data.departmentCode || data.DepartmentCode || data.department,
                categoryCode: data.categoryCode || data.CategoryCode || data.category,
                amount: data.amount || data.Amount,
                currency: data.currency || data.Currency || 'INR',
                transactionDate: data.transactionDate || data.TransactionDate || data.date,
                vendor: data.vendor || data.Vendor,
                referenceNumber: data.referenceNumber || data.ReferenceNumber || data.ref,
              });
            })
            .on('end', resolve)
            .on('error', reject);
        });
      } else if (req.body.rows && Array.isArray(req.body.rows)) {
        rawRows = req.body.rows;
      } else {
        res.status(400).json({ success: false, message: 'Provide a CSV file or JSON rows array' });
        return;
      }

      const preview = await CsvIngestionService.validateCsvRows(rawRows);
      res.json({ success: true, data: preview });
    } catch (err) {
      next(err);
    }
  }
);

// CSV Import Commit (Executes inside single DB transaction)
router.post(
  '/import-commit',
  authenticate,
  authorizeRoles(RoleType.FINANCE, RoleType.ADMIN),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { validRows } = req.body;
      if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
        res.status(400).json({ success: false, message: 'No valid rows provided for import.' });
        return;
      }

      const result = await CsvIngestionService.commitImport(validRows, req.user!);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// Reverse transaction
router.post(
  '/:id/reverse',
  authenticate,
  authorizeRoles(RoleType.FINANCE, RoleType.ADMIN),
  validateBody(reverseTxSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const reversed = await TransactionService.reverseTransaction(req.params.id, req.body.reason, req.user!);
      res.json({ success: true, data: reversed });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
