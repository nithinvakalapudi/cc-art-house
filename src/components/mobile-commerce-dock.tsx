'use client';

import Link from 'next/link';
import { Palette, ShoppingBag, UserRound } from 'lucide-react';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/shop', label: 'Shop art', Icon: ShoppingBag },
  { href: '/custom-art', label: 'Create custom', Icon: Palette, featured: true },
  { href: '/account', label: 'Account', Icon: UserRound },
];

export default function MobileCommerceDock() {
  const pathname = usePathname();
  return <nav className="mobile-commerce-dock" aria-label="Quick shopping navigation">
    {items.map(({ href, label, Icon, featured }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      const className = [active && 'mobile-dock-active', featured && active && 'mobile-dock-featured'].filter(Boolean).join(' ') || undefined;
      return <Link key={href} className={className} href={href} aria-current={active ? 'page' : undefined}><Icon size={19}/><span>{label}</span></Link>;
    })}
  </nav>;
}
