import { createDb, memberships, type Database } from '@clear-money/db';
import { and, eq, isNull } from 'drizzle-orm';
import type { SpaceRole } from '@clear-money/domain';
import { can, type PermissionAction } from '@clear-money/domain';
import { config } from './config.js';

let dbSingleton: Database | null = null;

export function db(): Database {
  if (!dbSingleton) dbSingleton = createDb(config.databaseUrl);
  return dbSingleton;
}

export async function requireMembership(userId: string, spaceId: string) {
  const rows = await db()
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.spaceId, spaceId),
        isNull(memberships.deletedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    const err = new Error('Not a member of this Space');
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return row as typeof row & { role: SpaceRole };
}

export async function requirePermission(
  userId: string,
  spaceId: string,
  action: PermissionAction,
) {
  const membership = await requireMembership(userId, spaceId);
  if (!can(membership.role as SpaceRole, action)) {
    const err = new Error(`Role ${membership.role} cannot ${action}`);
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return membership;
}
