'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, ArrowUp, Check, Cookie, Menu, Moon, Search, ShoppingBag, Sun, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const consentKey = 'art-house-cookie-choice';
const themeKey = 'art-house-theme';
const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

export default function SiteControls({brand='CC Art Works',links=[['Home','/'],['Shop paintings','/shop'],['Artist gallery','/gallery'],['Custom artwork','/custom-art'],['Our story','/about'],['Contact','/contact'],['Wishlist','/wishlist']],showContact=true}:{brand?:string;links?:string[][];showContact?:boolean}) {
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [consent, setConsent] = useState<string | null>('loading');
  const [menu, setMenu] = useState(false);
  const menuDialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  function captureUtm() {
    const params = new URLSearchParams(window.location.search);
    for (const key of utmKeys) {
      const value = params.get(key);
      if (value) sessionStorage.setItem(key, value.slice(0, 200));
    }
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem(themeKey) === 'dark' ? 'dark' : 'light';
    // Hydrate browser-only preferences after the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;
    const choice = localStorage.getItem(consentKey);
    setConsent(choice);
    if (choice === 'accepted') captureUtm();
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, window.scrollY / max * 100) : 0);
      setScrolled(window.scrollY > 500);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const openSettings = () => setConsent(null);
    window.addEventListener('open-cookie-settings', openSettings);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('open-cookie-settings', openSettings); };
  }, []);

  useEffect(() => {
    if (!search) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSearch(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [search]);

  function chooseConsent(value: 'accepted' | 'essential') {
    localStorage.setItem(consentKey, value);
    setConsent(value);
    if (value === 'accepted') captureUtm();
    else for (const key of utmKeys) sessionStorage.removeItem(key);
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem(themeKey, next);
  }

  return <>
    <div className="scroll-progress" style={{ width: `${progress}%` }} aria-hidden="true" />
    <div className="site-control-buttons">
      <button type="button" className="icon-control" onClick={() => setSearch(true)} aria-label="Search the site"><Search size={19} /></button>
      <button type="button" className="icon-control" onClick={toggleTheme} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>{theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</button>
      <button type="button" className="icon-control mobile-menu-button" onClick={() => {
        menuDialog.current?.showModal();
        setMenu(true);
      }} aria-label="Open menu" aria-expanded={menu} aria-controls="mobile-navigation"><Menu size={22} /></button>
    </div>
    <dialog id="mobile-navigation" ref={menuDialog} className="mobile-nav-dialog" aria-label="Mobile navigation"
      onClose={() => setMenu(false)} onClick={event => {
        if (event.target === event.currentTarget) menuDialog.current?.close();
      }}>
      <div className="mobile-nav-sheet">
        <div className="mobile-nav-heading">
          <strong>{brand}.</strong>
          <button type="button" onClick={() => menuDialog.current?.close()} aria-label="Close menu"><X /></button>
        </div>
        <div className="mobile-nav-shortcuts">
          <Link href="/cart" onClick={() => menuDialog.current?.close()}><ShoppingBag size={18} /> Cart</Link>
          <Link href="/account" onClick={() => menuDialog.current?.close()}><UserRound size={18} /> Account</Link>
        </div>
        <nav className="mobile-nav-links" aria-label="Browse the store">
          {links.map(([label, href]) => (
            <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}
              onClick={() => menuDialog.current?.close()}>
              <span>{label}</span><ArrowRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>
    </dialog>
    {search && <div className="site-overlay search-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSearch(false); }}><div className="search-panel" role="dialog" aria-modal="true" aria-label="Search paintings"><div className="overlay-heading"><h2>Find your next favourite piece</h2><button type="button" onClick={() => setSearch(false)} aria-label="Close search"><X /></button></div><form onSubmit={event => { event.preventDefault(); setSearch(false); router.push(`/shop?q=${encodeURIComponent(query.trim())}`); }}><label htmlFor="global-search">Search paintings</label><div className="search-input-row"><input id="global-search" autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Try portrait, flowers, landscape…" required /><button type="submit">Search <Search size={18}/></button></div></form><p>Looking for something personal? <Link href="/custom-art" onClick={() => setSearch(false)}>Request custom artwork</Link>.</p></div></div>}
    {consent === null && <div className="cookie-banner" role="dialog" aria-label="Cookie preferences"><Cookie size={25} aria-hidden="true"/><div><strong>Your privacy matters</strong><p>We use essential storage for your preferences. With your permission, we also remember campaign links that brought you here.</p></div><div className="cookie-actions"><button type="button" onClick={() => chooseConsent('essential')}>Essential only</button><button type="button" onClick={() => chooseConsent('accepted')}><Check size={16}/> Accept optional</button></div></div>}
    <div className="floating-tools" hidden={pathname.startsWith('/cart') || pathname.startsWith('/account') || pathname.startsWith('/admin')}>{showContact&&<Link className="floating-contact" href="/contact">Ask the studio <span aria-hidden="true">↗</span></Link>}{scrolled && <button type="button" className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top"><ArrowUp size={20}/></button>}</div>
  </>;
}

export function CookieSettingsButton() {
  return <button type="button" className="cookie-settings" onClick={() => window.dispatchEvent(new Event('open-cookie-settings'))}>Cookie settings</button>;
}

