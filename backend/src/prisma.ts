import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

// Configure Decimal precision (28 digits, ROUND_HALF_UP for financial standards)
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * Safely converts Decimal or number to a rounded 2-decimal number for JSON serialization
 */
export function toDecimalNumber(val: Decimal | number | string | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return new Decimal(val.toString()).toDecimalPlaces(2).toNumber();
}

/**
 * Safely converts value to Decimal instance
 */
export function toDecimal(val: Decimal | number | string): Decimal {
  return new Decimal(val.toString());
}
