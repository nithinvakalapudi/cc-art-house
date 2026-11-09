'use client';

import Link from 'next/link';
import { ShoppingCart, ShoppingBag, UserRound } from 'lucide-react';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/shop', label: 'Shop art', Icon: ShoppingBag },
  { href: '/cart', label: 'Cart', Icon: ShoppingCart },
  { href: '/account', label: 'Account', Icon: UserRound },
];

export default function MobileCommerceDock() {
  const pathname = usePathname();
  return <nav className="mobile-commerce-dock" aria-label="Quick shopping navigation">
    {items.map(({ href, label, Icon }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      const className = active ? 'mobile-dock-active' : undefined;
      return <Link key={href} className={className} href={href} aria-current={active ? 'page' : undefined}><Icon size={19}/><span>{label}</span></Link>;
    })}
  </nav>;
}
