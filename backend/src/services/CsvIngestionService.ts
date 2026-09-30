import { prisma, toDecimal } from '../prisma';
import { TransactionSource, TransactionStatus } from '../models/types';
import Decimal from 'decimal.js';
import { AuthUser } from '../middleware/auth';
import { AuditService } from './AuditService';
import { emitEvent } from '../socket';

export interface CsvTransactionRow {
  rowNumber: number;
  employeeEmail: string;
  departmentCode: string;
  categoryCode: string;
  amount: number | string;
  currency: string;
  transactionDate: string;
  vendor: string;
  referenceNumber: string;
}

export interface CsvRowError {
  rowNumber: number;
  referenceNumber?: string;
  field: string;
  message: string;
}

export interface CsvValidationPreview {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  errors: CsvRowError[];
  validRows: Array<{
    rowNumber: number;
    employeeId: string;
    employeeName: string;
    departmentId: string;
    departmentName: string;
    categoryId: string;
    categoryName: string;
    amount: number;
    currency: string;
    transactionDate: string;
    vendor: string;
    referenceNumber: string;
  }>;
}

export class CsvIngestionService {
  /**
   * Validates parsed CSV rows against schema and business state without persisting
   */
  public static async validateCsvRows(rows: CsvTransactionRow[]): Promise<CsvValidationPreview> {
    const errors: CsvRowError[] = [];
    const validRows: any[] = [];
    let duplicateCount = 0;

    // Load master lookups in bulk for ultra-fast validation
    const [users, departments, categories, existingTransactions] = await Promise.all([
      prisma.user.findMany({ select: { id: true, email: true, name: true } }),
      prisma.department.findMany({ select: { id: true, code: true, name: true } }),
      prisma.category.findMany({ select: { id: true, code: true, name: true } }),
      prisma.transaction.findMany({ select: { referenceNumber: true } }),
    ]);

    const userByEmail = new Map(users.map((u) => [u.email.toLowerCase().trim(), u]));
    const deptByCode = new Map(departments.map((d) => [d.code.toUpperCase().trim(), d]));
    const catByCode = new Map(categories.map((c) => [c.code.toUpperCase().trim(), c]));
    const dbRefs = new Set(existingTransactions.map((t) => t.referenceNumber.trim()));
    const seenRefsInBatch = new Set<string>();

    for (const row of rows) {
      let rowHasError = false;

      // 1. Reference Number & Duplicate Detection
      const ref = (row.referenceNumber || '').trim();
      if (!ref) {
        errors.push({ rowNumber: row.rowNumber, field: 'referenceNumber', message: 'Reference number is mandatory.' });
        rowHasError = true;
      } else if (dbRefs.has(ref)) {
        errors.push({ rowNumber: row.rowNumber, referenceNumber: ref, field: 'referenceNumber', message: `Reference number '${ref}' already exists in database.` });
        duplicateCount++;
        rowHasError = true;
      } else if (seenRefsInBatch.has(ref)) {
        errors.push({ rowNumber: row.rowNumber, referenceNumber: ref, field: 'referenceNumber', message: `Duplicate reference number '${ref}' encountered within the same CSV file.` });
        duplicateCount++;
        rowHasError = true;
      } else {
        seenRefsInBatch.add(ref);
      }

      // 2. Amount Validation
      let parsedAmount: Decimal;
      try {
        parsedAmount = new Decimal(row.amount);
        if (parsedAmount.isNaN() || parsedAmount.lessThanOrEqualTo(0)) {
          errors.push({ rowNumber: row.rowNumber, referenceNumber: ref, field: 'amount', message: 'Amount must be a positive number greater than 0.' });
          rowHasError = true;
        }
      } catch {
        errors.push({ rowNumber: row.rowNumber, referenceNumber: ref, field: 'amount', message: `Invalid numeric value '${row.amount}'.` });
        rowHasError = true;
        parsedAmount = new Decimal(0);
      }

      // 3. Employee Lookup
      const email = (row.employeeEmail || '').toLowerCase().trim();
      const userMatch = userByEmail.get(email);
      if (!userMatch) {
        errors.push({ rowNumber: row.rowNumber, referenceNumber: ref, field: 'employeeEmail', message: `Employee with email '${row.employeeEmail}' not found.` });
        rowHasError = true;
      }

      // 4. Department Lookup
      const deptCode = (row.departmentCode || '').toUpperCase().trim();
      const deptMatch = deptByCode.get(deptCode);
      if (!deptMatch) {
        errors.push({ rowNumber: row.rowNumber, referenceNumber: ref, field: 'departmentCode', message: `Department code '${row.departmentCode}' not found.` });
        rowHasError = true;
      }

      // 5. Category Lookup
      const catCode = (row.categoryCode || '').toUpperCase().trim();
      const catMatch = catByCode.get(catCode);
      if (!catMatch) {
        errors.push({ rowNumber: row.rowNumber, referenceNumber: ref, field: 'categoryCode', message: `Category code '${row.categoryCode}' not found.` });
        rowHasError = true;
      }

      // 6. Vendor
      const vendor = (row.vendor || '').trim();
      if (!vendor) {
        errors.push({ rowNumber: row.rowNumber, referenceNumber: ref, field: 'vendor', message: 'Vendor name is required.' });
        rowHasError = true;
      }

      // 7. Date check
      const txDate = new Date(row.transactionDate);
      if (isNaN(txDate.getTime())) {
        errors.push({ rowNumber: row.rowNumber, referenceNumber: ref, field: 'transactionDate', message: `Invalid date format '${row.transactionDate}'. Use ISO format (YYYY-MM-DD).` });
        rowHasError = true;
      }

      if (!rowHasError && userMatch && deptMatch && catMatch) {
        validRows.push({
          rowNumber: row.rowNumber,
          employeeId: userMatch.id,
          employeeName: userMatch.name,
          departmentId: deptMatch.id,
          departmentName: deptMatch.name,
          categoryId: catMatch.id,
          categoryName: catMatch.name,
          amount: parsedAmount.toNumber(),
          currency: (row.currency || 'INR').toUpperCase().trim(),
          transactionDate: txDate.toISOString(),
          vendor,
          referenceNumber: ref,
        });
      }
    }

    return {
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: errors.length - duplicateCount,
      duplicateCount,
      errors,
      validRows,
    };
  }

  /**
   * Commits validated CSV rows inside a single database transaction
   */
  public static async commitImport(validRows: CsvValidationPreview['validRows'], user: AuthUser) {
    if (validRows.length === 0) {
      throw new Error('No valid rows to import.');
    }

    const createdTransactions = await prisma.$transaction(async (tx) => {
      const records = [];
      for (const row of validRows) {
        const created = await tx.transaction.create({
          data: {
            employeeId: row.employeeId,
            departmentId: row.departmentId,
            categoryId: row.categoryId,
            amount: new Decimal(row.amount),
            currency: row.currency,
            transactionDate: new Date(row.transactionDate),
            vendor: row.vendor,
            referenceNumber: row.referenceNumber,
            source: TransactionSource.CSV_IMPORT,
            status: TransactionStatus.RECORDED,
          },
        });
        records.push(created);
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CSV_TRANSACTIONS_IMPORTED',
          entityType: 'TransactionBatch',
          entityId: `batch_${Date.now()}`,
          newValue: JSON.stringify({
            rowCount: records.length,
            sampleRef: records[0]?.referenceNumber,
          }),
        },
      });

      return records;
    });

    emitEvent('dashboard.updated', {});

    return {
      importedCount: createdTransactions.length,
    };
  }
}
