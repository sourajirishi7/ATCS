import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding Budget Exception Rules & Employee Spending Analytics Data...');

  // 1. Ensure Categories exist
  const categories = await prisma.category.findMany();
  const catMap: Record<string, string> = {};
  for (const c of categories) {
    catMap[c.code] = c.id;
    catMap[c.name] = c.id;
  }

  // 2. Ensure Departments exist
  const departments = await prisma.department.findMany();
  const deptMap: Record<string, string> = {};
  for (const d of departments) {
    deptMap[d.code] = d.id;
  }

  // 3. Upsert Budget Exception & Hard Cap Rules
  const governanceRules = [
    {
      ruleName: 'RULE_HARD_CAP_100: Hard Budget Ceiling (100%)',
      ruleType: 'HARD_CEILING',
      threshold: new Decimal(100.0),
      action: 'BLOCK',
      enabled: true,
      priority: 10,
    },
    {
      ruleName: 'RULE_UTIL_WARN_80: High Utilization Warning (80%)',
      ruleType: 'UTILIZATION_WARNING',
      threshold: new Decimal(80.0),
      action: 'WARNING',
      enabled: true,
      priority: 20,
    },
    {
      ruleName: 'RULE_EX_04: Travel & Entertainment Ceiling (> ₹40,000)',
      ruleType: 'CATEGORY_EXCEPTION',
      threshold: new Decimal(40000.0),
      action: 'APPROVAL_REQUIRED',
      enabled: true,
      priority: 30,
    },
    {
      ruleName: 'RULE_EX_02: Hardware Single Equipment Limit (> ₹75,000)',
      ruleType: 'CATEGORY_EXCEPTION',
      threshold: new Decimal(75000.0),
      action: 'APPROVAL_REQUIRED',
      enabled: true,
      priority: 40,
    },
    {
      ruleName: 'RULE_EX_03: Department Aggressive Utilization Exception (> 90%)',
      ruleType: 'DEPARTMENT_EXCEPTION',
      threshold: new Decimal(90.0),
      action: 'APPROVAL_REQUIRED',
      enabled: true,
      priority: 50,
    },
  ];

  for (const rule of governanceRules) {
    const existing = await prisma.budgetRule.findFirst({
      where: {
        OR: [
          { ruleName: rule.ruleName },
          { ruleName: { startsWith: rule.ruleName.split(':')[0] } },
        ],
      },
    });

    if (existing) {
      await prisma.budgetRule.update({
        where: { id: existing.id },
        data: {
          ruleName: rule.ruleName,
          ruleType: rule.ruleType,
          threshold: rule.threshold,
          action: rule.action,
          enabled: true,
          priority: rule.priority,
        },
      });
    } else {
      await prisma.budgetRule.create({ data: rule });
    }
  }
  console.log('✅ Governance & Budget Exception Rules Seeded/Updated');
  console.log('✅ Zero mock operational transactions seeded (Clean production-ready state)');
  console.log('🎉 Budget Exception Rules Setup Complete!');
}


main()
  .catch((e) => {
    console.error('❌ Error seeding analytics rules:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
