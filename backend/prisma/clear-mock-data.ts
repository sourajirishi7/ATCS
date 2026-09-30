import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Purging all mock operational data from ATCS database...');

  // Delete all mock operational records while preserving master configuration
  // (Departments, Categories, Governance Rules, Budgets, Users, Client Quotations)
  const delSnapshots = await prisma.decisionSnapshot.deleteMany();
  const delAlerts = await prisma.alert.deleteMany();
  const delExceptions = await prisma.exception.deleteMany();
  const delApprovals = await prisma.approval.deleteMany();
  const delTransactions = await prisma.transaction.deleteMany();
  const delCommitments = await prisma.commitment.deleteMany();
  const delSpendingRequests = await prisma.spendingRequest.deleteMany();
  const delForecasts = await prisma.forecast.deleteMany();

  console.log(`✅ Deleted ${delTransactions.count} mock transactions`);
  console.log(`✅ Deleted ${delCommitments.count} mock commitments`);
  console.log(`✅ Deleted ${delSpendingRequests.count} mock spending requests`);
  console.log(`✅ Deleted ${delSnapshots.count} mock decision snapshots`);
  console.log(`✅ Deleted ${delAlerts.count} mock alerts`);
  console.log(`✅ Deleted ${delExceptions.count} mock exceptions`);
  console.log(`✅ Deleted ${delApprovals.count} mock approvals`);
  console.log(`✅ Deleted ${delForecasts.count} mock forecasts`);
  console.log('✨ ATCS database is now 100% clean of all mock operational data!');
}

main()
  .catch((e) => {
    console.error('❌ Failed to purge mock data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
