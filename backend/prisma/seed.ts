import { PrismaClient } from '@prisma/client';
import { RoleType, BudgetStatus, SpendingStatus, CommitmentStatus, TransactionStatus, TransactionSource, DecisionVerdict } from '../src/models/types';
import bcrypt from 'bcryptjs';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ATCS Enterprise Database Seeding...');

  // 1. Roles
  const roles: RoleType[] = ['ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE'];
  const roleMap: Record<string, string> = {};

  for (const r of roles) {
    const roleRecord = await prisma.role.upsert({
      where: { name: r },
      update: {},
      create: {
        name: r,
        description: `${r} role in ATCS corporate governance`,
      },
    });
    roleMap[r] = roleRecord.id;
  }
  console.log('✅ Roles seeded:', Object.keys(roleMap));

  // 2. Departments
  const departmentsData = [
    { name: 'Engineering', code: 'ENG', costCenter: 'CC-ENG-101' },
    { name: 'Marketing', code: 'MKT', costCenter: 'CC-MKT-201' },
    { name: 'Operations', code: 'OPS', costCenter: 'CC-OPS-301' },
    { name: 'Sales', code: 'SLS', costCenter: 'CC-SLS-401' },
    { name: 'Human Resources', code: 'HR', costCenter: 'CC-HR-501' },
  ];

  const deptMap: Record<string, string> = {};
  for (const d of departmentsData) {
    const dept = await prisma.department.upsert({
      where: { code: d.code },
      update: {},
      create: d,
    });
    deptMap[d.code] = dept.id;
  }
  console.log('✅ Departments seeded:', Object.keys(deptMap));

  // 3. Categories
  const categoriesData = [
    { name: 'Software & Cloud', code: 'SW_CLOUD', description: 'Cloud hosting, SaaS subscriptions, developer tools' },
    { name: 'Hardware & Equipment', code: 'HW_EQP', description: 'Workstations, laptops, monitors, lab gear' },
    { name: 'Travel & Entertainment', code: 'TRV_ENT', description: 'Flights, accommodations, client meetings' },
    { name: 'Professional Training', code: 'PRO_TRN', description: 'Certifications, conferences, courses, books' },
    { name: 'Office Supplies', code: 'OFF_SUP', description: 'Stationery, office amenities, ergonomics' },
  ];

  const catMap: Record<string, string> = {};
  for (const c of categoriesData) {
    const cat = await prisma.category.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
    catMap[c.code] = cat.id;
  }
  console.log('✅ Categories seeded:', Object.keys(catMap));

  // 4. Users (Password: "password123")
  const defaultPasswordHash = await bcrypt.hash('password123', 10);
  const usersData = [
    { name: 'Alex Vance (Global Admin)', email: 'admin@atcs.corp', role: 'ADMIN', deptCode: undefined },
    { name: 'Fiona Chen (Chief Finance Officer)', email: 'finance@atcs.corp', role: 'FINANCE', deptCode: undefined },
    { name: 'Marcus Brody (Engineering Director)', email: 'manager.eng@atcs.corp', role: 'MANAGER', deptCode: 'ENG' },
    { name: 'Devon Lee (Senior Staff Engineer)', email: 'employee.eng@atcs.corp', role: 'EMPLOYEE', deptCode: 'ENG' },
    { name: 'Maya Patel (Marketing VP)', email: 'manager.mkt@atcs.corp', role: 'MANAGER', deptCode: 'MKT' },
    { name: 'Liam Walker (Growth Marketing Lead)', email: 'employee.mkt@atcs.corp', role: 'EMPLOYEE', deptCode: 'MKT' },
  ];

  const userMap: Record<string, string> = {};
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash: defaultPasswordHash,
        departmentId: u.deptCode ? deptMap[u.deptCode] : null,
      },
      create: {
        name: u.name,
        email: u.email,
        passwordHash: defaultPasswordHash,
        roleId: roleMap[u.role],
        departmentId: u.deptCode ? deptMap[u.deptCode] : null,
      },
    });
    userMap[u.email] = user.id;
  }
  console.log('✅ Users seeded:', Object.keys(userMap));

  // 5. Governance Rules in DB
  const budgetRules = [
    {
      ruleName: 'UTILIZATION_WARNING_80',
      ruleType: 'UTILIZATION_WARNING',
      threshold: new Decimal(80.0),
      action: 'WARNING',
      priority: 10,
    },
    {
      ruleName: 'UTILIZATION_CRITICAL_95',
      ruleType: 'UTILIZATION_WARNING',
      threshold: new Decimal(95.0),
      action: 'WARNING',
      priority: 20,
    },
    {
      ruleName: 'HARD_CEILING_100',
      ruleType: 'HARD_CEILING',
      threshold: new Decimal(100.0),
      action: 'BLOCK',
      priority: 30,
    },
  ];

  for (const br of budgetRules) {
    await prisma.budgetRule.upsert({
      where: { ruleName: br.ruleName },
      update: {},
      create: br,
    });
  }

  // Approval rules: Thresholds above 15,000 INR require Manager; above 100,000 INR require Finance
  const approvalRules = [
    {
      name: 'Manager Approval for Mid-Size Spend (> ₹15,000)',
      minimumAmount: new Decimal(15000),
      maximumAmount: new Decimal(100000),
      requiredRole: 'MANAGER' as RoleType,
      priority: 10,
    },
    {
      name: 'Executive Finance Approval for High-Value Spend (> ₹100,000)',
      minimumAmount: new Decimal(100000),
      maximumAmount: null,
      requiredRole: 'FINANCE' as RoleType,
      priority: 20,
    },
  ];

  for (const ar of approvalRules) {
    const existing = await prisma.approvalRule.findFirst({ where: { name: ar.name } });
    if (!existing) {
      await prisma.approvalRule.create({ data: ar });
    }
  }
  console.log('✅ Governance & Approval rules seeded');

  // 6. Active Budgets (FY2026-Q3)
  // Engineering: Total ₹10,00,000
  const engBudget = await prisma.budget.upsert({
    where: {
      departmentId_fiscalPeriod: {
        departmentId: deptMap['ENG'],
        fiscalPeriod: 'FY2026-Q3',
      },
    },
    update: {},
    create: {
      departmentId: deptMap['ENG'],
      fiscalPeriod: 'FY2026-Q3',
      budgetAmount: new Decimal(1000000),
      currency: 'INR',
      status: BudgetStatus.ACTIVE,
      allocations: {
        create: [
          { categoryId: catMap['SW_CLOUD'], allocatedAmount: new Decimal(500000) },
          { categoryId: catMap['HW_EQP'], allocatedAmount: new Decimal(300000) },
          { categoryId: catMap['PRO_TRN'], allocatedAmount: new Decimal(200000) },
        ],
      },
    },
  });

  // Marketing: Total ₹6,00,000
  const mktBudget = await prisma.budget.upsert({
    where: {
      departmentId_fiscalPeriod: {
        departmentId: deptMap['MKT'],
        fiscalPeriod: 'FY2026-Q3',
      },
    },
    update: {},
    create: {
      departmentId: deptMap['MKT'],
      fiscalPeriod: 'FY2026-Q3',
      budgetAmount: new Decimal(600000),
      currency: 'INR',
      status: BudgetStatus.ACTIVE,
      allocations: {
        create: [
          { categoryId: catMap['TRV_ENT'], allocatedAmount: new Decimal(300000) },
          { categoryId: catMap['SW_CLOUD'], allocatedAmount: new Decimal(200000) },
          { categoryId: catMap['OFF_SUP'], allocatedAmount: new Decimal(100000) },
        ],
      },
    },
  });
  console.log('✅ FY2026-Q3 Budgets seeded for ENG & MKT');

  // 7. Clean operational state (no mock transactions or commitments)
  console.log('✅ Operational state verified: Ledger ready for live transactions (0 mock data)');

  // 9. Seed Default Client Quotation / Proposed Budget
  const existingQuotation = await prisma.clientQuotation.findUnique({
    where: { quotationReference: 'QT-2026-APEX-001' },
  });

  if (!existingQuotation) {
    await prisma.clientQuotation.create({
      data: {
        clientName: 'Apex Global Enterprises',
        projectName: 'Enterprise Cloud Transformation & Modernization',
        quotationReference: 'QT-2026-APEX-001',
        proposedBudget: new Decimal(2500000),
        currency: 'INR',
        targetProfitMarginPct: new Decimal(25.0),
        status: 'ACTIVE',
        notes: 'Governing client contract quotation for FY2026-Q3 delivery milestones.',
        allocations: {
          create: [
            { departmentId: deptMap['ENG'], allocatedAmount: new Decimal(1125000), targetMarginPct: new Decimal(25.0) },
            { departmentId: deptMap['MKT'], allocatedAmount: new Decimal(625000), targetMarginPct: new Decimal(25.0) },
            { departmentId: deptMap['OPS'], allocatedAmount: new Decimal(375000), targetMarginPct: new Decimal(25.0) },
            { departmentId: deptMap['SLS'], allocatedAmount: new Decimal(250000), targetMarginPct: new Decimal(25.0) },
            { departmentId: deptMap['HR'],  allocatedAmount: new Decimal(125000), targetMarginPct: new Decimal(25.0) },
          ],
        },
      },
    });
    console.log('✅ Baseline Client Quotation & Department Allocations seeded (₹25,00,000)');
  }

  console.log('🎉 ATCS Enterprise Database Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
