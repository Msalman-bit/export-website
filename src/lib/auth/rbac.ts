import type { StaffRole } from '../db/schema';

/* Role-based permissions for staff. Customers never reach /admin: their sessions are a different kind. */

export const PERMISSIONS = [
  'inquiries.read', 'inquiries.write', 'inquiries.delete', 'quotations.write', 'quotations.delete', 'customers.read', 'customers.write',
  'orders.read', 'orders.write', 'production.write', 'shipping.write',
  'catalogue.write', 'catalogue.delete', 'media.write', 'content.write', 'seo.write', 'translations.write',
  'certificates.write', 'testimonials.write', 'markets.write', 'facts.write',
  'users.manage', 'settings.write', 'export.data', 'analytics.read', 'analytics.reset', 'audit.read', 'outbox.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  admin: PERMISSIONS,
  sales: [
    'inquiries.read', 'inquiries.write', 'quotations.write', 'customers.read', 'customers.write',
    'orders.read', 'orders.write', 'shipping.write', 'export.data', 'analytics.read', 'outbox.read',
  ],
  content: [
    'catalogue.write', 'media.write', 'content.write', 'seo.write', 'translations.write',
    'testimonials.write', 'certificates.write', 'analytics.read',
  ],
  production: ['inquiries.read', 'orders.read', 'production.write', 'shipping.write'],
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Administrator', sales: 'Sales manager', content: 'Content editor', production: 'Production manager',
};

export function can(role: string, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role as StaffRole] ?? []).includes(permission);
}
