import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowUpRight, LockKeyhole, Store } from 'lucide-react';
import { adminAccess } from '@/lib/supabase-server';
import AdminNavigation from '@/components/admin-navigation';
import AdminLogoutButton from '@/components/admin-logout-button';
import AdminThemeToggle from '@/components/admin-theme-toggle';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await adminAccess();
  if (!role) redirect('/account/admin');

  const accessLabel = role === 'viewer' ? 'Read access' : role === 'owner' ? 'Owner access' : 'Write access';
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Link className="admin-sidebar-brand" href="/admin" aria-label="CC Art Works admin overview">
          <span className="admin-brand-mark">CC</span>
          <span><strong>CC Art Works</strong><small>STUDIO ADMIN</small></span>
        </Link>
        <AdminNavigation role={role} />
        <div className="admin-sidebar-bottom">
          <span className="admin-access-pill"><LockKeyhole size={13} />{accessLabel}</span>
          <Link href="/" className="admin-store-link"><Store size={16} />View storefront<ArrowUpRight size={14} /></Link>
        </div>
      </aside>
      <section className="admin-workspace">
        <header className="admin-topbar">
          <div><span className="admin-topbar-kicker">CC ART WORKS / STUDIO</span><span className="admin-topbar-title">Management dashboard</span></div>
          <div className="admin-topbar-right"><AdminThemeToggle /><span className={`admin-role-tag ${role}`}>{role === 'owner' ? 'OWNER' : role === 'admin' ? 'EDITOR' : 'VIEWER'}</span><Link className="admin-topbar-store" href="/">Visit shop<ArrowUpRight size={14}/></Link><AdminLogoutButton /></div>
        </header>
        <main className="admin-main">{children}</main>
      </section>
    </div>
  );
}



