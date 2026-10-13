/**
 * Idempotent screenshot demo account for Play Store / marketing captures.
 * Does NOT wipe other users. Safe to re-run (refreshes password + demo ledger).
 *
 * Login: pennyaitracker@gmail.com / safsafsaf
 */
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createId, defaultCategoryRows } from '@clear-money/domain';
import { hashPassword } from 'better-auth/crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { createDb } from './client.js';
import {
  user,
  account,
  spaces,
  memberships,
  categories,
  transactions,
  goals,
  contributions,
  scheduledExpenses,
  pennyTurns,
  usageCounters,
} from './schema/index.js';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../../.env') });
loadEnv();

const EMAIL = 'pennyaitracker@gmail.com';
const PASSWORD = 'safsafsaf';
const USER_ID = 'user_penny_screenshot_01';
const PARTNER_ID = 'user_penny_screenshot_roommate';
const PARTNER_EMAIL = 'maya.screenshot@penny.local';
const ACC_ID = 'acc_penny_screenshot_cred_01';
const ACC_PARTNER = 'acc_penny_screenshot_roommate';
const PERSONAL_ID = 'space_penny_shot_personal_01';
const SHARED_ID = 'space_penny_shot_shared_01';
const SESSION_ID = 'psess_penny_screenshot_demo_01';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const db = createDb();
  const passwordHash = await hashPassword(PASSWORD);

  // Ensure global default categories exist (ignore collisions).
  for (const row of defaultCategoryRows()) {
    const existing = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, row.id)).limit(1);
    if (!existing[0]) {
      await db.insert(categories).values({
        id: row.id,
        spaceId: null,
        stableKey: row.stableKey,
        name: row.name,
        type: row.type,
      });
    }
  }

  // Wipe only THIS demo ledger (fixed space ids), never other accounts' data.
  await db.delete(pennyTurns).where(eq(pennyTurns.userId, USER_ID));
  await db.delete(contributions).where(inArray(contributions.goalId, ['goal_penny_shot_emergency_01']));
  await db.delete(transactions).where(inArray(transactions.spaceId, [PERSONAL_ID, SHARED_ID]));
  await db.delete(scheduledExpenses).where(inArray(scheduledExpenses.spaceId, [PERSONAL_ID, SHARED_ID]));
  await db.delete(goals).where(inArray(goals.spaceId, [PERSONAL_ID, SHARED_ID]));
  await db.delete(memberships).where(inArray(memberships.spaceId, [PERSONAL_ID, SHARED_ID]));
  await db.delete(spaces).where(inArray(spaces.id, [PERSONAL_ID, SHARED_ID]));

  // Upsert partner (shared-space member)
  const partnerExisting = await db.select().from(user).where(eq(user.id, PARTNER_ID)).limit(1);
  if (!partnerExisting[0]) {
    await db.insert(user).values({
      id: PARTNER_ID,
      name: 'Maya Chen',
      email: PARTNER_EMAIL,
      emailVerified: true,
      locale: 'en',
      defaultCurrency: 'USD',
      timezone: 'America/New_York',
      plan: 'free',
      setupCompletedAt: new Date(),
    });
  }
  const partnerAcc = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, PARTNER_ID), eq(account.providerId, 'credential')))
    .limit(1);
  if (partnerAcc[0]) {
    await db.update(account).set({ password: passwordHash, updatedAt: new Date() }).where(eq(account.id, partnerAcc[0].id));
  } else {
    await db.insert(account).values({
      id: ACC_PARTNER,
      accountId: PARTNER_ID,
      providerId: 'credential',
      userId: PARTNER_ID,
      password: passwordHash,
    });
  }

  // Upsert main screenshot user — prefer fixed id; migrate if email already exists elsewhere
  const byEmail = await db.select().from(user).where(eq(user.email, EMAIL)).limit(1);
  let userId = USER_ID;
  if (byEmail[0] && byEmail[0].id !== USER_ID) {
    userId = byEmail[0].id;
    console.log('Using existing user id for email:', userId);
  } else if (!byEmail[0]) {
    await db.insert(user).values({
      id: USER_ID,
      name: 'Alex Rivera',
      email: EMAIL,
      emailVerified: true,
      locale: 'en',
      defaultCurrency: 'USD',
      timezone: 'America/New_York',
      weekStartsOn: 1,
      plan: 'plus',
      setupCompletedAt: daysAgo(90),
    });
  } else {
    await db
      .update(user)
      .set({
        name: 'Alex Rivera',
        emailVerified: true,
        locale: 'en',
        defaultCurrency: 'USD',
        timezone: 'America/New_York',
        plan: 'plus',
        setupCompletedAt: daysAgo(90),
        updatedAt: new Date(),
        deletedAt: null,
      })
      .where(eq(user.id, USER_ID));
  }

  const cred = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
    .limit(1);
  if (cred[0]) {
    await db.update(account).set({ password: passwordHash, updatedAt: new Date() }).where(eq(account.id, cred[0].id));
  } else {
    await db.insert(account).values({
      id: userId === USER_ID ? ACC_ID : createId('user').replace('user_', 'acc_'),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: passwordHash,
    });
  }

  // If we had to use a different userId, re-key space constants ownership still works via userId var
  await db.insert(spaces).values([
    {
      id: PERSONAL_ID,
      name: 'Personal',
      type: 'personal',
      currency: 'USD',
      timezone: 'America/New_York',
      ownerId: userId,
    },
    {
      id: SHARED_ID,
      name: 'Home & bills',
      type: 'household',
      currency: 'USD',
      timezone: 'America/New_York',
      ownerId: userId,
    },
  ]);

  await db.insert(memberships).values([
    { id: 'mem_penny_shot_personal_owner', spaceId: PERSONAL_ID, userId, role: 'owner' },
    { id: 'mem_penny_shot_shared_owner', spaceId: SHARED_ID, userId, role: 'owner' },
    { id: 'mem_penny_shot_shared_maya', spaceId: SHARED_ID, userId: PARTNER_ID, role: 'contributor' },
  ]);

  const cat = {
    salary: 'cat_salary',
    freelance: 'cat_freelance',
    groceries: 'cat_groceries',
    food: 'cat_food_drinks',
    transport: 'cat_transport',
    housing: 'cat_housing',
    bills: 'cat_bills',
    shopping: 'cat_shopping',
    entertainment: 'cat_entertainment',
    health: 'cat_health',
    travel: 'cat_travel',
  };

  const mk = (
    spaceId: string,
    type: 'income' | 'expense',
    amountMinor: number,
    days: number,
    description: string,
    categoryId: string | null,
    createdBy = userId,
  ) => ({
    id: createId('txn'),
    spaceId,
    type,
    amountMinor,
    currency: 'USD',
    categoryId,
    description,
    occurredAt: daysAgo(days),
    occurredOffset: '-04:00',
    createdBy,
    source: 'manual' as const,
    status: 'confirmed' as const,
    idempotencyKey: createId('txn'),
  });

  // ~3 months of personal history
  const personalTxns = [
    mk(PERSONAL_ID, 'income', 485000, 85, 'Salary — July', cat.salary),
    mk(PERSONAL_ID, 'income', 485000, 55, 'Salary — August', cat.salary),
    mk(PERSONAL_ID, 'income', 485000, 25, 'Salary — September', cat.salary),
    mk(PERSONAL_ID, 'income', 485000, 2, 'Salary — October', cat.salary),
    mk(PERSONAL_ID, 'income', 65000, 40, 'Freelance design', cat.freelance),
    mk(PERSONAL_ID, 'income', 42000, 12, 'Side project payout', cat.freelance),
    mk(PERSONAL_ID, 'expense', 12850, 80, 'Trader Joe’s run', cat.groceries),
    mk(PERSONAL_ID, 'expense', 9420, 72, 'Weekly groceries', cat.groceries),
    mk(PERSONAL_ID, 'expense', 11200, 61, 'Farmers market + staples', cat.groceries),
    mk(PERSONAL_ID, 'expense', 8750, 48, 'Groceries', cat.groceries),
    mk(PERSONAL_ID, 'expense', 10440, 33, 'Costco haul', cat.groceries),
    mk(PERSONAL_ID, 'expense', 6890, 18, 'Groceries', cat.groceries),
    mk(PERSONAL_ID, 'expense', 9120, 6, 'Weekend groceries', cat.groceries),
    mk(PERSONAL_ID, 'expense', 2450, 70, 'Coffee & lunch', cat.food),
    mk(PERSONAL_ID, 'expense', 3800, 44, 'Dinner out', cat.food),
    mk(PERSONAL_ID, 'expense', 1650, 9, 'Lunch with team', cat.food),
    mk(PERSONAL_ID, 'expense', 9800, 66, 'Metro monthly pass', cat.transport),
    mk(PERSONAL_ID, 'expense', 9800, 36, 'Metro monthly pass', cat.transport),
    mk(PERSONAL_ID, 'expense', 9800, 5, 'Metro monthly pass', cat.transport),
    mk(PERSONAL_ID, 'expense', 4200, 28, 'Uber to airport', cat.transport),
    mk(PERSONAL_ID, 'expense', 5400, 52, 'New headphones', cat.shopping),
    mk(PERSONAL_ID, 'expense', 3200, 21, 'Running shoes sale', cat.shopping),
    mk(PERSONAL_ID, 'expense', 1599, 58, 'Netflix', cat.entertainment),
    mk(PERSONAL_ID, 'expense', 1599, 28, 'Netflix', cat.entertainment),
    mk(PERSONAL_ID, 'expense', 1099, 57, 'Spotify', cat.entertainment),
    mk(PERSONAL_ID, 'expense', 1099, 27, 'Spotify', cat.entertainment),
    mk(PERSONAL_ID, 'expense', 4500, 39, 'Pharmacy', cat.health),
    mk(PERSONAL_ID, 'expense', 18600, 15, 'Weekend trip — train', cat.travel),
  ];

  const sharedTxns = [
    mk(SHARED_ID, 'expense', 210000, 70, 'Rent — August', cat.housing, userId),
    mk(SHARED_ID, 'expense', 210000, 40, 'Rent — September', cat.housing, userId),
    mk(SHARED_ID, 'expense', 210000, 8, 'Rent — October', cat.housing, userId),
    mk(SHARED_ID, 'expense', 14500, 62, 'Electric + water', cat.bills, PARTNER_ID),
    mk(SHARED_ID, 'expense', 13200, 31, 'Utilities', cat.bills, userId),
    mk(SHARED_ID, 'expense', 12800, 4, 'Utilities', cat.bills, PARTNER_ID),
    mk(SHARED_ID, 'expense', 8600, 50, 'Household supplies', cat.shopping, PARTNER_ID),
    mk(SHARED_ID, 'expense', 5400, 22, 'Internet', cat.bills, userId),
    mk(SHARED_ID, 'expense', 5400, 3, 'Internet', cat.bills, userId),
    mk(SHARED_ID, 'expense', 7200, 14, 'Shared groceries', cat.groceries, PARTNER_ID),
    mk(SHARED_ID, 'income', 105000, 8, 'Roommate rent share', 'cat_other_income', PARTNER_ID),
  ];

  await db.insert(transactions).values([...personalTxns, ...sharedTxns]);

  // Salary + subscriptions (scheduled)
  const nextSalary = new Date();
  nextSalary.setUTCDate(1);
  nextSalary.setUTCMonth(nextSalary.getUTCMonth() + 1);
  nextSalary.setUTCHours(9, 0, 0, 0);

  await db.insert(scheduledExpenses).values([
    {
      id: 'sched_penny_shot_salary',
      spaceId: PERSONAL_ID,
      name: 'Salary',
      amountMinor: 485000,
      currency: 'USD',
      kind: 'income',
      dayOfMonth: 1,
      nextDueAt: nextSalary,
      active: true,
      notifyHoursBefore: 24,
      createdBy: userId,
    },
    {
      id: 'sched_penny_shot_netflix',
      spaceId: PERSONAL_ID,
      name: 'Netflix',
      amountMinor: 1599,
      currency: 'USD',
      kind: 'expense',
      dayOfMonth: 12,
      nextDueAt: daysAgo(-5),
      active: true,
      notifyHoursBefore: 24,
      createdBy: userId,
    },
    {
      id: 'sched_penny_shot_spotify',
      spaceId: PERSONAL_ID,
      name: 'Spotify',
      amountMinor: 1099,
      currency: 'USD',
      kind: 'expense',
      dayOfMonth: 14,
      nextDueAt: daysAgo(-3),
      active: true,
      notifyHoursBefore: 24,
      createdBy: userId,
    },
    {
      id: 'sched_penny_shot_gym',
      spaceId: PERSONAL_ID,
      name: 'Gym membership',
      amountMinor: 4900,
      currency: 'USD',
      kind: 'expense',
      dayOfMonth: 3,
      nextDueAt: daysAgo(-20),
      active: true,
      notifyHoursBefore: 48,
      createdBy: userId,
    },
    {
      id: 'sched_penny_shot_rent',
      spaceId: SHARED_ID,
      name: 'Rent',
      amountMinor: 210000,
      currency: 'USD',
      kind: 'expense',
      dayOfMonth: 1,
      nextDueAt: nextSalary,
      active: true,
      notifyHoursBefore: 72,
      createdBy: userId,
    },
  ]);

  const goalId = 'goal_penny_shot_emergency_01';
  const target = new Date();
  target.setUTCMonth(target.getUTCMonth() + 8);
  await db.insert(goals).values({
    id: goalId,
    spaceId: PERSONAL_ID,
    name: 'Emergency fund',
    targetMinor: 500000,
    savedMinor: 185000,
    currency: 'USD',
    startDate: isoDate(daysAgo(60)),
    durationMonths: 8,
    targetDate: isoDate(target),
    plannedContributionMinor: 40000,
    paceStatus: 'on_track',
    notificationPolicy: 'weekly',
    status: 'active',
    createdBy: userId,
  });

  await db.insert(contributions).values([
    {
      id: 'contrib_penny_shot_01',
      goalId,
      amountMinor: 50000,
      currency: 'USD',
      kind: 'contribution',
      createdBy: userId,
      createdAt: daysAgo(55),
    },
    {
      id: 'contrib_penny_shot_02',
      goalId,
      amountMinor: 75000,
      currency: 'USD',
      kind: 'contribution',
      createdBy: userId,
      createdAt: daysAgo(28),
    },
    {
      id: 'contrib_penny_shot_03',
      goalId,
      amountMinor: 60000,
      currency: 'USD',
      kind: 'contribution',
      createdBy: userId,
      createdAt: daysAgo(7),
    },
  ]);

  // Penny conversation (visible in AI history / abuse log — used for screenshots context)
  const turns: Array<{ role: 'user' | 'assistant'; content: string; hoursAgo: number }> = [
    {
      role: 'user',
      hoursAgo: 50,
      content: 'How much can I safely spend this week?',
    },
    {
      role: 'assistant',
      hoursAgo: 50,
      content:
        'Looking at Personal this month: income is strong after salary, and your recurring bills are covered. Safe-to-spend on Home is about $2,180 after goals and subscriptions. Keep groceries under ~$90 this week and you’re still on track for the emergency fund.',
    },
    {
      role: 'user',
      hoursAgo: 26,
      content: 'Where did most of my money go last month?',
    },
    {
      role: 'assistant',
      hoursAgo: 26,
      content:
        'In Personal, the biggest slices were groceries, transit pass, and entertainment (Netflix + Spotify). In Home & bills, rent dominates — as expected. Want me to flag any category that jumped vs the month before?',
    },
    {
      role: 'user',
      hoursAgo: 3,
      content: 'Am I on pace for my emergency fund?',
    },
    {
      role: 'assistant',
      hoursAgo: 3,
      content:
        'Yes — Emergency fund is on track. You’ve saved $1,850 of $5,000 with about 8 months planned. Keep the ~$400/month contributions and you’ll hit the target without squeezing safe-to-spend too hard.',
    },
  ];

  await db.insert(pennyTurns).values(
    turns.map((t, i) => ({
      id: `pturn_penny_shot_${String(i + 1).padStart(2, '0')}`,
      userId,
      spaceId: PERSONAL_ID,
      sessionId: SESSION_ID,
      role: t.role,
      content: t.content,
      source: 'text',
      locale: 'en',
      model: t.role === 'assistant' ? 'penny-demo' : null,
      latencyMs: t.role === 'assistant' ? 820 + i * 40 : null,
      status: 'ok',
      flags: {},
      createdAt: new Date(Date.now() - t.hoursAgo * 3600_000),
    })),
  );

  const usage = await db.select().from(usageCounters).where(eq(usageCounters.userId, userId)).limit(1);
  if (usage[0]) {
    await db
      .update(usageCounters)
      .set({ aiRequests: 12, generatedReports: 3, activeMembers: 2, receiptScans: 1 })
      .where(eq(usageCounters.userId, userId));
  } else {
    await db.insert(usageCounters).values({
      id: createId('user'),
      userId,
      receiptScans: 1,
      aiRequests: 12,
      generatedReports: 3,
      activeMembers: 2,
    });
  }

  console.log('Screenshot seed OK');
  console.log(`Login: ${EMAIL} / ${PASSWORD}`);
  console.log(`Spaces: Personal (${PERSONAL_ID}), Home & bills shared (${SHARED_ID})`);
  console.log(`Partner member: ${PARTNER_EMAIL} (same password)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
