'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BadgePercent,
  Boxes,
  ClipboardList,
  ContactRound,
  FileCheck2,
  Image,
  LayoutDashboard,
  Mail,
  ScrollText,
  Settings2,
  ShieldCheck,
  Truck,
  WandSparkles,
} from 'lucide-react';

const primaryItems = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { href: '/admin/products', label: 'Paintings', icon: Image },
  { href: '/admin/custom-orders', label: 'Custom requests', icon: WandSparkles },
  { href: '/admin/messages', label: 'Messages', icon: Mail },
];

const storeItems = [
  { href: '/admin/analytics', label: 'Sales overview', icon: BarChart3 },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { href: '/admin/promotions', label: 'Promotions', icon: BadgePercent },
  { href: '/admin/customers', label: 'Users & customers', icon: ContactRound },
  { href: '/admin/activity', label: 'Activity log', icon: ScrollText },
  { href: '/admin/catalogue-checks', label: 'Catalogue checks', icon: FileCheck2 },
  { href: '/admin/settings', label: 'Store settings', icon: Settings2 },
  { href: '/admin/pricing', label: 'Custom art pricing', icon: BarChart3 },
  { href: '/admin/delivery', label: 'Delivery pricing', icon: Truck },
];

export default function AdminNavigation({ role }: { role: 'owner' | 'admin' | 'viewer' }) {
  const pathname = usePathname();
  const items = [...primaryItems, ...storeItems, ...(role === 'owner' ? [{ href: '/admin/team', label: 'Admin team', icon: ShieldCheck }] : [])];

  const link = (item: (typeof items)[number], compact = false) => {
    const active = item.href === '/admin' ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`admin-nav-link${active ? ' is-active' : ''}${compact ? ' is-compact' : ''}`}
        aria-current={active ? 'page' : undefined}
        title={compact ? item.label : undefined}
      >
        <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      <nav className="admin-desktop-nav" aria-label="Admin sections">
        <span className="admin-nav-heading">WORKSPACE</span>
        {primaryItems.map((item) => link(item))}
        <span className="admin-nav-heading admin-nav-heading-spaced">STORE TOOLS</span>
        {storeItems.map((item) => link(item))}
        {role === 'owner' && <span className="admin-nav-heading admin-nav-heading-spaced">ACCESS</span>}
        {role === 'owner' && link(items[items.length - 1])}
      </nav>
      <nav className="admin-mobile-nav" aria-label="Admin sections">
        {items.map((item) => link(item, true))}
      </nav>
    </>
  );
}
