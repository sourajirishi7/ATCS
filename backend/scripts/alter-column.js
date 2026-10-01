const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "BudgetRule" ALTER COLUMN "threshold" TYPE numeric(14, 2);');
  console.log('✅ Altered BudgetRule.threshold to numeric(14, 2)');
}

main().catch(console.error).finally(() => prisma.$disconnect());
