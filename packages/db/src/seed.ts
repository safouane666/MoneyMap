import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createId, defaultCategoryRows } from '@clear-money/domain';
import { hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { createDb } from './client.js';
import {
  user,
  account,
  spaces,
  memberships,
  categories,
  transactions,
  goals,
  usageCounters,
} from './schema/index.js';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../../.env') });
loadEnv();

/** DEV ONLY — documented in README. Never use in production. */
const DEMO_PASSWORD = 'Demo123!';

const DEMO_USERS = [
  {
    id: 'user_demo_owner_clear_money_01',
    accountId: 'acc_demo_owner_credential_01',
    name: 'Demo Owner',
    email: 'demo@clearmoney.app',
    locale: 'en',
    defaultCurrency: 'USD',
    timezone: 'America/New_York',
    plan: 'shared',
  },
  {
    id: 'user_demo_child_clear_money_01',
    accountId: 'acc_demo_child_credential_01',
    name: 'Demo Child',
    email: 'child@clearmoney.app',
    locale: 'en',
    defaultCurrency: 'USD',
    timezone: 'America/New_York',
    plan: 'free',
  },
  {
    id: 'user_demo_member_clear_money01',
    accountId: 'acc_demo_member_credential01',
    name: 'Demo Member',
    email: 'member@clearmoney.app',
    locale: 'fr',
    defaultCurrency: 'EUR',
    timezone: 'Europe/Paris',
    plan: 'plus',
  },
] as const;

async function ensureCredentialAccounts(
  db: ReturnType<typeof createDb>,
  passwordHash: string,
) {
  for (const demo of DEMO_USERS) {
    const existing = await db
      .select({ id: account.id })
      .from(account)
      .where(
        and(eq(account.userId, demo.id), eq(account.providerId, 'credential')),
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(account)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(eq(account.id, existing[0].id));
      continue;
    }

    await db.insert(account).values({
      id: demo.accountId,
      accountId: demo.id,
      providerId: 'credential',
      userId: demo.id,
      password: passwordHash,
    });
  }
}

async function main() {
  const db = createDb();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const demoUserId = DEMO_USERS[0].id;
  const childId = DEMO_USERS[1].id;
  const memberId = DEMO_USERS[2].id;

  const existing = await db.select().from(user).where(eq(user.id, demoUserId)).limit(1);
  if (existing.length) {
    await ensureCredentialAccounts(db, passwordHash);
    console.log('Seed already applied (credential passwords refreshed)');
    return;
  }

  await db.insert(user).values(
    DEMO_USERS.map((demo) => ({
      id: demo.id,
      name: demo.name,
      email: demo.email,
      emailVerified: true,
      locale: demo.locale,
      defaultCurrency: demo.defaultCurrency,
      timezone: demo.timezone,
      plan: demo.plan,
      setupCompletedAt: new Date(),
    })),
  );

  await ensureCredentialAccounts(db, passwordHash);

  const personalId = 'space_demo_personal_clear_m01';
  const projectId = 'space_demo_project_clear_mo01';
  const familyId = 'space_demo_family_clear_mon01';
  const companyId = 'space_demo_company_clear_m01';

  await db.insert(spaces).values([
    {
      id: personalId,
      name: 'Personal',
      type: 'personal',
      currency: 'USD',
      timezone: 'America/New_York',
      ownerId: demoUserId,
    },
    {
      id: projectId,
      name: 'Website Redesign',
      type: 'project',
      currency: 'USD',
      timezone: 'UTC',
      ownerId: demoUserId,
    },
    {
      id: familyId,
      name: 'Family Home',
      type: 'family',
      currency: 'TND',
      timezone: 'Africa/Tunis',
      ownerId: demoUserId,
    },
    {
      id: companyId,
      name: 'Clear Labs SARL',
      type: 'company',
      currency: 'EUR',
      timezone: 'Europe/Paris',
      ownerId: demoUserId,
    },
  ]);

  await db.insert(memberships).values([
    { id: createId('mem'), spaceId: personalId, userId: demoUserId, role: 'owner' },
    { id: createId('mem'), spaceId: projectId, userId: demoUserId, role: 'owner' },
    { id: createId('mem'), spaceId: projectId, userId: memberId, role: 'contributor' },
    { id: createId('mem'), spaceId: familyId, userId: demoUserId, role: 'owner' },
    { id: createId('mem'), spaceId: familyId, userId: childId, role: 'child' },
    { id: createId('mem'), spaceId: familyId, userId: memberId, role: 'viewer' },
    { id: createId('mem'), spaceId: companyId, userId: demoUserId, role: 'owner' },
    { id: createId('mem'), spaceId: companyId, userId: memberId, role: 'admin' },
  ]);

  await db.insert(categories).values(
    defaultCategoryRows().map((c) => ({
      id: c.id,
      spaceId: null,
      stableKey: c.stableKey,
      name: c.name,
      type: c.type,
    })),
  );

  const catGroceries = 'cat_groceries';
  const catSalary = 'cat_salary';
  const catTransport = 'cat_transport';

  const now = new Date();
  const mkTxn = (
    spaceId: string,
    type: string,
    amountMinor: number,
    currency: string,
    hoursAgo: number,
    createdBy: string,
    categoryId?: string,
  ) => {
    const occurred = new Date(now.getTime() - hoursAgo * 3600_000);
    return {
      id: createId('txn'),
      spaceId,
      type,
      amountMinor,
      currency,
      categoryId: categoryId ?? null,
      description: type,
      occurredAt: occurred,
      occurredOffset: '+00:00',
      createdBy,
      source: 'manual' as const,
      status: 'confirmed' as const,
      idempotencyKey: createId('txn'),
    };
  };

  await db.insert(transactions).values([
    {
      ...mkTxn(personalId, 'income', 500000, 'USD', 72, demoUserId, catSalary),
      description: 'Salary',
    },
    {
      ...mkTxn(personalId, 'expense', 4500, 'USD', 5, demoUserId, catGroceries),
      description: 'Weekly groceries',
    },
    {
      ...mkTxn(personalId, 'expense', 1200, 'USD', 4, demoUserId, catTransport),
      description: 'Transit pass',
    },
    {
      ...mkTxn(personalId, 'transfer', 10000, 'USD', 3, demoUserId),
      description: 'Savings transfer',
    },
    {
      ...mkTxn(familyId, 'expense', 25000, 'TND', 10, demoUserId, catGroceries),
      description: 'Family groceries',
    },
    {
      ...mkTxn(familyId, 'expense', 5000, 'TND', 8, childId, catTransport),
      description: 'School bus',
    },
    {
      ...mkTxn(projectId, 'expense', 15000, 'USD', 20, memberId),
      description: 'Design contractor',
    },
    {
      ...mkTxn(companyId, 'income', 200000, 'EUR', 40, demoUserId, catSalary),
      description: 'Client retainer',
    },
    {
      ...mkTxn(companyId, 'expense', 33000, 'EUR', 12, memberId),
      description: 'Software tools',
    },
  ]);

  await db.insert(goals).values({
    id: createId('goal'),
    spaceId: personalId,
    name: 'Emergency fund',
    targetMinor: 100000,
    savedMinor: 42000,
    currency: 'USD',
    targetDate: '2027-06-30',
    plannedContributionMinor: 10000,
    notificationPolicy: 'weekly',
    status: 'active',
    createdBy: demoUserId,
  });

  await db.insert(usageCounters).values([
    { id: createId('user'), userId: demoUserId, receiptScans: 2, aiRequests: 1, generatedReports: 1, activeMembers: 3 },
    { id: createId('user'), userId: childId },
    { id: createId('user'), userId: memberId },
  ]);

  console.log('Seed complete: Personal, Project, Family, Company spaces');
  console.log(`Demo login (DEV ONLY): demo@clearmoney.app / ${DEMO_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
