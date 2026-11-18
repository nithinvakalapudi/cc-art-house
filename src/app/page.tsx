import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Heart, PackageCheck, Palette, Sparkles } from 'lucide-react';
import { getActivePromotions, getCatalogue } from '@/lib/data';
import ProductCard from '@/components/product-card';
import CopyButton from '@/components/copy-button';
import { artistGallery } from '@/lib/artist-gallery';
import LazyHomeGallery from '@/components/immersive-gallery/lazy-home-gallery';
import { getSiteSettings } from '@/lib/site-settings';
import { searchSiteName, siteUrl } from '@/lib/search-metadata';

export async function generateMetadata() {
  const settings = await getSiteSettings();
  return {
    title: `${searchSiteName} | Handmade Paintings & Custom Artwork`,
    description: settings.seo_description,
    alternates: { canonical: '/' },
    openGraph: { type: 'website', siteName: searchSiteName, url: '/' },
  } as const;
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: searchSiteName,
  alternateName: 'CC ArtHouse',
  url: `${siteUrl}/`,
};

export const dynamic = 'force-dynamic';

function homepageProducts<T extends { title: string }>(products: T[]) {
  const ordered = [...products];
  const selectedIndex = ordered.findIndex(product => product.title === 'Srinivasa Kalyanam');

  if (selectedIndex >= 0) {
    const [selected] = ordered.splice(selectedIndex, 1);
    ordered.splice(Math.min(3, ordered.length), 0, selected);
  }

  return ordered.slice(0, 8);
}

export default async function Home() {
  const [{ products, categories, error },settings,promotions] = await Promise.all([getCatalogue(),getSiteSettings(),getActivePromotions()]);
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
    <section className="craft-hero">
      <div className="craft-hero-copy">
        <span className="craft-eyebrow">{settings.hero_eyebrow}</span>
        <h1>{settings.hero_title}<br /><em>{settings.hero_accent}</em></h1>
        <p>{settings.hero_description}</p>
        <div className="craft-actions"><Link className="craft-button" href="/shop">Shop paintings <ArrowRight size={18}/></Link><Link className="craft-text-link" href="/custom-art">Create something custom <ArrowRight size={17}/></Link></div>
        <span className="craft-hero-note"><Sparkles size={15}/> Thoughtfully made, one piece at a time</span>
      </div>
      <div className="craft-hero-image"><Image src={settings.hero_image_url} alt="Featured handmade artwork" fill priority sizes="(max-width: 800px) 100vw, 48vw" quality={85} /></div>
    </section>

    {promotions.length > 0 && <section className="home-promotion-banner" aria-label="Current studio offers"><div className="home-promotion-inner"><span className="craft-eyebrow">A LITTLE SOMETHING FROM THE STUDIO</span>{promotions.map(promotion=><article className="home-promotion-card" key={promotion.code}><div><h2>{promotion.title}</h2><p><strong>{promotion.discount_type==='percentage'?`${Number(promotion.discount_value)}% off`:`₹${Number(promotion.discount_value).toLocaleString('en-IN')} off`}</strong> your order when you enter <b>{promotion.code}</b> at checkout.</p>{promotion.ends_at&&<small>Offer ends {new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeZone:'Asia/Kolkata'}).format(new Date(promotion.ends_at))}</small>}</div><div className="home-promotion-actions"><CopyButton value={promotion.code} label="Copy code"/><Link href="/shop">Shop paintings <ArrowRight size={16}/></Link></div></article>)}</div></section>}

    <section className="craft-featured">
      <div className="craft-section-inner">
        <div className="craft-centered-heading"><span className="craft-eyebrow">FROM OUR STUDIO</span><h2>{settings.featured_title}</h2><p>{settings.featured_description}</p></div>
        {error && <p className="craft-catalogue-note" role="status">The catalogue is taking a moment to load. You can still explore custom artwork.</p>}
        {products.length ? <div className="craft-product-grid">{homepageProducts(products).map(product => <ProductCard key={product.id} product={product}/>)}</div> : <div className="craft-empty-art"><span aria-hidden="true">✳</span><div><h3>New art is on its way</h3><p>Original paintings will appear here when they are published.</p><Link href="/custom-art">Request a custom painting <ArrowRight size={17}/></Link></div></div>}
        <div className="craft-section-action"><Link className="craft-outline-button" href="/shop">Explore all paintings <ArrowRight size={17}/></Link></div>
      </div>
    </section>

    <LazyHomeGallery products={products} />

    <section className="home-artist-gallery"><div className="craft-section-inner"><div className="craft-section-heading"><div><h2>From the artist’s gallery</h2></div><Link href="/gallery">Explore the gallery <ArrowRight size={17}/></Link></div><p className="home-gallery-intro">Paintings, mandalas and keepsakes from @artworksof_cctwinzz.</p><div className="home-gallery-grid">{artistGallery.slice(0,4).map(artwork => <Link href="/gallery" key={artwork.image} className="home-gallery-card"><Image width={800} height={800} src={artwork.image} alt={artwork.alt} loading="lazy"/><span>{artwork.title}</span></Link>)}</div></div></section>

    <section className="craft-categories"><div className="craft-section-inner"><div className="craft-section-heading"><div><h2>Browse by category</h2></div><Link href="/shop">View all categories <ArrowRight size={17}/></Link></div><div className="craft-category-grid">{categories.length ? categories.map((category, index) => <Link key={category.id} href={`/shop?category=${encodeURIComponent(category.slug)}`} className={`craft-category craft-category-${index % 4}`}><span className="craft-category-num">0{index + 1} / THE COLLECTION</span><span className="craft-category-mark" aria-hidden="true">{['✺','◒','✦','❀'][index % 4]}</span><strong>{category.name}<ArrowRight size={20}/></strong></Link>) : <p>Categories will appear when the studio publishes them.</p>}</div></div></section>

    <section className="craft-custom"><div className="craft-custom-art" aria-hidden="true"><span>✿</span><span>✻</span><span>✳</span></div><div className="craft-custom-copy"><h2>Commission a painting</h2><p>Share a photo, a memory or an idea. Tell us the size and colours you have in mind.</p><Link className="craft-button" href="/custom-art">Request a painting <ArrowRight size={18}/></Link></div></section>

    <section className="craft-promise"><div className="craft-section-inner"><h2>Buying from the studio</h2><div className="craft-promise-grid"><div><Palette size={26}/><h3>Original paintings</h3><p>Each painting carries its own character and the touch of its maker.</p></div><div><Heart size={26}/><h3>Custom requests</h3><p>Choose a piece you love, or tell us the story you want to see in art.</p></div><div><PackageCheck size={26}/><h3>Packing your artwork</h3><p>Every order is prepared thoughtfully for its journey to you.</p></div></div></div></section>

    <section className="craft-story"><div className="craft-section-inner craft-story-inner"><div><span className="craft-eyebrow">CC ART WORKS STORY</span><h2>Made slowly.<br /><em>Made to mean more.</em></h2></div><div><p>We believe the best art feels personal. Every canvas carries the marks of a real hand and the care of someone who loves the process.</p><Link href="/about">Get to know us <ArrowRight size={17}/></Link></div></div></section>
    <section className="home-faq"><div className="home-faq-inner"><h2>Frequently asked questions</h2><details><summary>Can I request a painting made just for me?</summary><p>Yes. Share your idea, preferred size, style, colours and references through our <Link href="/custom-art">custom artwork form</Link>. We’ll review it with you before production.</p></details><details><summary>How is my artwork delivered?</summary><p>We arrange delivery to the address you provide at checkout. The delivery charge and estimated arrival are shown when available.</p></details><details><summary>How do I see recent artwork?</summary><p>Explore the <Link href="/gallery">artist gallery</Link> or follow <a href="https://www.instagram.com/artworksof_cctwinzz/" target="_blank" rel="noopener noreferrer">@artworksof_cctwinzz</a> for studio updates.</p></details></div></section>
    <section className="craft-last-cta"><h2>Have a question for the studio?</h2><Link className="craft-outline-button" href="/contact">Get in touch <ArrowRight size={17}/></Link></section>
  </>;
}
