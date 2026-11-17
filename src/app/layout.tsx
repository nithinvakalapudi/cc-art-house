import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, UserRound } from "lucide-react";
import AuthLinks from "@/components/auth-links";
import RecoveryRedirect from "@/components/recovery-redirect";
import NavigationFeedback from "@/components/navigation-feedback";
import StoreMotion from "@/components/store-motion";
import SiteControls, { CookieSettingsButton } from "@/components/site-controls";
import { CartCount, CartProvider } from "@/components/cart-store";
import MobileCommerceDock from "@/components/mobile-commerce-dock";
import { getSiteSettings, settingOn } from "@/lib/site-settings";
import { siteUrl } from "@/lib/search-metadata";
import "./globals.css";
import "./editorial.css";
import "./premium.css";
import "./enhancements.css";
import "./atelier.css";
import "./mobile-premium.css";
import "./motion-premium.css";
import "./performance.css";
import "./admin.css";
import "./audit-fixes.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    metadataBase: new URL(siteUrl),
    title: settings.seo_title,
    description: settings.seo_description,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings();
  const mobileLinks=[[settings.home_label,'/'],[settings.nav_shop_label,'/shop'],...(settingOn(settings.show_gallery)?[[settings.nav_gallery_label,'/gallery']]:[]),...(settingOn(settings.show_style_finder)?[[settings.nav_style_label,'/style-finder']]:[]),[settings.nav_custom_label,'/custom-art'],...(settingOn(settings.show_about)?[[settings.nav_about_label,'/about']]:[]),...(settingOn(settings.show_contact)?[[settings.nav_contact_label,'/contact']]:[]),['Wishlist','/wishlist']];
  const customFooterLinks=[1,2,3].map((n)=>({label:settings[`footer_link_${n}_label` as keyof typeof settings],href:settings[`footer_link_${n}_url` as keyof typeof settings]})).filter((item)=>item.label&&item.href);
  return (
    <html lang="en" data-brick-appearance="light" data-scroll-behavior="smooth">
      <body>
        <CartProvider>
        <RecoveryRedirect />
        <NavigationFeedback />
        <StoreMotion />
        <a className="skip-link" href="#main-content">Skip to content</a>
        <div className="craft-topline" />
        <header className="craft-header">
          <div className="craft-header-inner">
            <div className="craft-brand-block">
              <Link className="craft-brand" href="/">{settings.site_name}<span>.</span></Link>
              <p className="craft-tagline">{settings.site_tagline}</p>
            </div>
            <div className="craft-header-right">
              <nav className="craft-nav" aria-label="Main navigation">
                <Link href="/">{settings.home_label}</Link>
                <Link href="/shop">{settings.nav_shop_label}</Link>
                {settingOn(settings.show_gallery)&&<Link href="/gallery">{settings.nav_gallery_label}</Link>}
                {settingOn(settings.show_style_finder)&&<Link href="/style-finder">{settings.nav_style_label}</Link>}
                <Link href="/custom-art">{settings.nav_custom_label}</Link>
                {settingOn(settings.show_about)&&<Link href="/about">{settings.nav_about_label}</Link>}
                {settingOn(settings.show_contact)&&<Link href="/contact">{settings.nav_contact_label}</Link>}
              </nav>
              <div className="craft-header-icons">
                <SiteControls brand={settings.site_name} links={mobileLinks} showContact={settingOn(settings.show_contact)} />
                <Link href="/account" aria-label="Your account"><UserRound size={19} /></Link>
                <CartCount />
              </div>
            </div>
          </div>
        </header>
        <div className="craft-pink-ribbon">{settings.announcement_text}</div>
        <div className="craft-contact-strip"><span>{settings.contact_strip_text}</span>{settingOn(settings.show_contact)&&<Link href="/contact">Get in touch <ArrowUpRight size={15} /></Link>}</div>
        <main id="main-content" tabIndex={-1}>{children}</main>
        <MobileCommerceDock />
        <footer className="footer craft-footer">
          <div className="footer-grid">
            <div><Link className="craft-footer-brand" href="/">{settings.site_name}<span>.</span></Link><p>{settings.site_tagline}</p></div>
            <div><h3>{settings.footer_explore_title}</h3><Link href="/shop">{settings.nav_shop_label}</Link>{settingOn(settings.show_gallery)&&<Link href="/gallery">{settings.nav_gallery_label}</Link>}<Link href="/custom-art">{settings.nav_custom_label}</Link>{settingOn(settings.show_about)&&<Link href="/about">{settings.nav_about_label}</Link>}</div>
            <div><h3>{settings.footer_help_title}</h3>{settingOn(settings.show_contact)&&<Link href="/contact">{settings.nav_contact_label}</Link>}<Link href="/cart">Your cart</Link>{customFooterLinks.map((item,index)=><Link key={`${item.href}-${index}`} href={item.href}>{item.label}</Link>)}</div>
            <div><h3>{settings.footer_account_title}</h3><Link href="/wishlist">Your wishlist</Link><Link href="/compare">Compare artworks</Link><AuthLinks /><Link href="/account/orders">Orders</Link><Link href="/account/custom-orders">Custom requests</Link><Link href="/account/collection">My collection</Link><Link href="/account/preferences">Update preferences</Link></div>
          </div>
          <div className="footer-bottom">© {new Date().getFullYear()} {settings.site_name}. {settings.footer_copyright_line} <span>Site updated 1 November 2026</span></div>
          <CookieSettingsButton />
        </footer>
        </CartProvider>
      </body>
    </html>
  );
}
