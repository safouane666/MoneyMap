/** Mask invitee email for unauthenticated / non-matching callers (P3.1). */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const keep = local.length <= 1 ? 1 : Math.min(2, local.length);
  return `${local.slice(0, keep)}***@${domain}`;
}
