export type SpaceRole = 'owner' | 'admin' | 'contributor' | 'viewer' | 'child';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit_own'
  | 'edit_all'
  | 'delete_own'
  | 'delete_all'
  | 'manage_members'
  | 'manage_settings'
  | 'export'
  | 'invite'
  | 'approve'
  | 'view_all_members_entries';

const ROLE_PERMISSIONS: Record<SpaceRole, ReadonlySet<PermissionAction>> = {
  owner: new Set([
    'view',
    'create',
    'edit_own',
    'edit_all',
    'delete_own',
    'delete_all',
    'manage_members',
    'manage_settings',
    'export',
    'invite',
    'approve',
    'view_all_members_entries',
  ]),
  admin: new Set([
    'view',
    'create',
    'edit_own',
    'edit_all',
    'delete_own',
    'delete_all',
    'manage_members',
    'manage_settings',
    'export',
    'invite',
    'approve',
    'view_all_members_entries',
  ]),
  contributor: new Set(['view', 'create', 'edit_own', 'delete_own', 'export']),
  viewer: new Set(['view']),
  child: new Set(['view', 'create', 'edit_own', 'delete_own']),
};

export function can(role: SpaceRole, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}

export function assertCan(role: SpaceRole, action: PermissionAction): void {
  if (!can(role, action)) {
    throw new Error(`Role ${role} cannot ${action}`);
  }
}

/** Child role only sees own entries. */
export function canViewEntry(
  role: SpaceRole,
  entryOwnerId: string,
  viewerId: string,
): boolean {
  if (role === 'child') return entryOwnerId === viewerId;
  return can(role, 'view') && (can(role, 'view_all_members_entries') || entryOwnerId === viewerId);
}

export function filterVisibleEntries<T extends { createdBy: string }>(
  role: SpaceRole,
  viewerId: string,
  entries: readonly T[],
): T[] {
  if (role === 'child') {
    return entries.filter((e) => e.createdBy === viewerId);
  }
  return [...entries];
}
