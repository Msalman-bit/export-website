import { headers } from 'next/headers';
import { KIT_VERSION } from '@/lib/kit-version';
import { readSession } from '@/lib/auth/session';
import { can, ROLE_LABELS, type Permission } from '@/lib/auth/rbac';
import type { StaffRole } from '@/lib/db/schema';
import { staffLogout } from './actions';
import { AdminDrawer } from './drawer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Monolith Sports admin', robots: { index: false, follow: false } };

const ROOT = `:root{--p-bg:#ffffff;--p-surface:#eef0f2;--p-ink:#080808;--p-muted:#6a6a6a;--p-accent:#c5f900;--p-accent-ink:#080808;--p-action:#080808;--p-action-ink:#ffffff;--p-inv-bg:#080808;--p-inv-surface:#151515;--p-inv-ink:#ffffff;--p-inv-muted:#959595;--p-inv-accent:#c5f900;--p-inv-accent-ink:#080808;--p-inv-action:#c5f900;--p-inv-action-ink:#080808;--font-display:"Archivo",system-ui,sans-serif;--font-text:"Archivo",system-ui,sans-serif;--display-weight:400;--display-tracking:-0.025em;--display-tracking-xl:-0.035em;--display-stretch:82%;--ly-scale:0.9}`;

const NAV: { path: string; label: string; perm?: Permission; group: string }[] = [
  { path: '/admin', label: 'Dashboard', group: 'Sales' },
  { path: '/admin/inquiries', label: 'Inquiries', perm: 'inquiries.read', group: 'Sales' },
  { path: '/admin/orders', label: 'Orders and production', perm: 'orders.read', group: 'Sales' },
  { path: '/admin/customers', label: 'Customers', perm: 'customers.read', group: 'Sales' },
  { path: '/admin/products', label: 'Products', perm: 'catalogue.write', group: 'Catalogue' },
  { path: '/admin/categories', label: 'Categories', perm: 'catalogue.write', group: 'Catalogue' },
  { path: '/admin/media', label: 'Media library', perm: 'media.write', group: 'Catalogue' },
  { path: '/admin/pages', label: 'Pages and SEO', perm: 'content.write', group: 'Content' },
  { path: '/admin/articles', label: 'Articles', perm: 'content.write', group: 'Content' },
  { path: '/admin/proof', label: 'Testimonials and certificates', perm: 'testimonials.write', group: 'Content' },
  { path: '/admin/facts', label: 'Business facts', perm: 'facts.write', group: 'Content' },
  { path: '/admin/markets', label: 'Export markets', perm: 'markets.write', group: 'Content' },
  { path: '/admin/translations', label: 'Translations', perm: 'translations.write', group: 'Content' },
  { path: '/admin/documents', label: 'Documents', perm: 'customers.write', group: 'Content' },
  { path: '/admin/analytics', label: 'Analytics', perm: 'analytics.read', group: 'System' },
  { path: '/admin/export', label: 'Export data', perm: 'export.data', group: 'System' },
  { path: '/admin/outbox', label: 'Email outbox', perm: 'outbox.read', group: 'System' },
  { path: '/admin/users', label: 'Staff and roles', perm: 'users.manage', group: 'System' },
  { path: '/admin/settings', label: 'Settings', perm: 'settings.write', group: 'System' },
  { path: '/admin/audit', label: 'Audit log', perm: 'audit.read', group: 'System' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await readSession('staff');
  const h = await headers();
  const path = h.get('x-pathname') ?? '/admin';
  const nonce = h.get('x-nonce') ?? undefined;
  const signedIn = !!user?.session.mfaVerified;
  const items = NAV.filter((n) => !n.perm || (user && can(user.role, n.perm)));
  const groups = [...new Set(items.map((i) => i.group))];
  const isHere = (p: string) => (p === '/admin' ? path === '/admin' : path.startsWith(p));
  const current = items.find((i) => isHere(i.path))?.label ?? 'Admin';
  return (
    <html lang="en" data-type="product" data-radius="sharp" data-buttons="block">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..600&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href={`/assets/system.css?v=${KIT_VERSION}`} />
        <style>{ROOT}</style>
        <link rel="stylesheet" href="/site/site.css" />
        <link rel="stylesheet" href="/site/admin.css" />
        {/* iOS Safari shows :active (the press) only once a touchstart listener exists */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: "document.addEventListener('touchstart',function(){},{passive:true})" }} />
      </head>
      <body className="admin">
        {signedIn ? (
          <div className="admin__shell">
            <AdminDrawer current={current}>
              <a className="nav__logo" href="/admin"><span className="mark" data-mark="dots" aria-hidden="true" />Monolith admin</a>
              <nav aria-label="Admin">
                {groups.map((g) => (
                  <div key={g} className="admin__group">
                    <p className="t-label">{g}</p>
                    {items.filter((i) => i.group === g).map((i) => (
                      <a key={i.path} href={i.path} aria-current={isHere(i.path) ? 'page' : undefined}>{i.label}</a>
                    ))}
                  </div>
                ))}
              </nav>
              <div className="admin__me">
                <p className="t-small">{user.name || user.email}<br /><span className="muted">{ROLE_LABELS[user.role as StaffRole]}</span></p>
                <form action={staffLogout}><button className="btn-text" type="submit">Sign out</button></form>
                <a className="t-small link" href="/en" target="_blank" rel="noopener">Open the website</a>
              </div>
            </AdminDrawer>
            <main className="admin__main" id="top">{children}</main>
          </div>
        ) : (
          <main className="admin__auth" id="top">{children}</main>
        )}
      </body>
    </html>
  );
}
