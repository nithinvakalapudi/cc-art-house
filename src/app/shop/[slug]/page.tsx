import Image from 'next/image';
import { WishlistButton } from '@/components/wishlist';
import ArtworkPreview from '@/components/artwork-preview';
import ProductReviews from '@/components/product-reviews';
import PremiumArtworkActions from '@/components/premium-artwork-actions';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import ArtworkGallery, { type ArtworkImage } from '@/components/artwork-gallery';
import { discountPercent, priceLabel, publicDb } from '@/lib/data';
import { artistGallery } from '@/lib/artist-gallery';
import { AddToCartButton } from '@/components/cart-store';
import { cache } from 'react';
import { searchSiteName } from '@/lib/search-metadata';

const getPainting = cache(async (slug: string) => {
  const db = publicDb();
  if (!db) return null;
  const { data, error } = await db.from('products').select('*').eq('slug', slug).eq('published', true).eq('archived', false).maybeSingle();
  if (error) throw new Error('Artwork lookup failed');
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let painting;
  try { painting = await getPainting(slug); } catch { return {}; }
  if (!painting) return {};
  return {
    title: `${painting.title} | ${searchSiteName}`,
    description: painting.description || `View ${painting.title}, an original artwork from CC Art Works.`,
    alternates: { canonical: `/shop/${encodeURIComponent(slug)}` },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = publicDb();
  if (!db) return <div className="content artwork-load-error" role="alert"><h1>Artwork details are unavailable</h1><p>The store connection is not configured right now. Please try again later or return to the collection.</p><div><Link className="button outline" href="/shop">Back to paintings</Link></div></div>;
  let painting;
  try { painting = await getPainting(slug); } catch {
    return <div className="content artwork-load-error" role="alert"><h1>We couldn’t open this artwork</h1><p>The painting details are temporarily unavailable. Try again, or return to the collection.</p><div><Link className="button primary" href={`/shop/${encodeURIComponent(slug)}`}>Try again</Link><Link className="button outline" href="/shop">Back to paintings</Link></div></div>;
  }
  if (!painting) notFound();
  const discount = discountPercent(painting);
  const { data: gallery } = await db.from('product_images').select('id,url,alt_text,sort_order').eq('product_id', painting.id).order('sort_order');
  const images: ArtworkImage[] = [
    ...(painting.image_url ? [{ url: painting.image_url, alt: painting.title, label: 'Artwork' }] : []),
    ...(gallery || []).map((image, index) => ({ url: image.url, alt: image.alt_text || `${painting.title}, view ${index + 2}`, label: image.alt_text || `View ${index + 2}` })),
  ];
  const artistSource = artistGallery.find(item => item.image === painting.image_url || (item.image === '/artist-gallery/traditional-portrait.jpg' && painting.image_url === '/artist-gallery/traditional-portrait-hd.png'));
  return <>
    <div className="artwork-breadcrumb"><Link href="/shop">Paintings</Link><span aria-hidden="true">/</span><span>{painting.title}</span></div>
    <div className="artwork-detail">
      <ArtworkGallery images={images} title={painting.title} />
      <div className="artwork-detail-copy">
        <span className="craft-eyebrow">ORIGINAL ARTWORK</span><h1>{painting.title}</h1><div className="artwork-price-row">{discount>0&&<s aria-label={`Original price ${priceLabel(painting.original_price)}`}>{priceLabel(painting.original_price)}</s>}<p className="artwork-price">{priceLabel(painting.price)}</p>{discount>0&&<span>{discount}% OFF</span>}</div>
        <p className={`artwork-availability ${painting.available ? '' : 'sold'}`}>{Number(painting.price) === 0 ? 'Please ask the studio to confirm availability' : painting.available ? 'Available' : 'Sold'}</p>
        {painting.description && <div className="artwork-story"><h2>The story behind the piece</h2><p>{painting.description}</p>{painting.inspiration&&<p><strong>Artist’s inspiration:</strong> {painting.inspiration}</p>}</div>}
        <dl className="artwork-facts">
          {painting.medium&&<div><dt>Medium and materials</dt><dd>{painting.medium}</dd></div>}{painting.dimensions&&<div><dt>Dimensions</dt><dd>{painting.dimensions}</dd></div>}{painting.creation_hours&&<div><dt>Time to create</dt><dd>{painting.creation_hours} hours</dd></div>}
          <div><dt>Authenticity</dt><dd>{painting.authenticity_code} · Original {painting.edition_total?`${painting.edition_number||1} of ${painting.edition_total}`:'1 of 1'}</dd></div>
          {painting.care_instructions&&<div><dt>Care guide</dt><dd>{painting.care_instructions}</dd></div>}{painting.palette?.length>0&&<div><dt>Colour palette</dt><dd>{painting.palette.join(', ')}</dd></div>}{painting.room_tags?.length>0&&<div><dt>Suggested rooms</dt><dd>{painting.room_tags.join(', ')}</dd></div>}
        </dl>
        {artistSource&&<p className="artwork-source"><a href={artistSource.source} target="_blank" rel="noopener noreferrer">See the original artist post ↗</a></p>}
        {painting.artist_video_url&&<a className="button outline artist-video-link" href={painting.artist_video_url} target="_blank" rel="noopener noreferrer">Watch the artist’s studio message ↗</a>}
        {Number(painting.price)>0&&painting.available?<div className="artwork-buy-bar"><div className="artwork-buy-summary"><strong>{priceLabel(painting.price)}</strong><small>Available</small></div><AddToCartButton item={{id:painting.id,slug:painting.slug,title:painting.title,price:Number(painting.price),image_url:painting.image_url}}/></div>:<p className="artwork-order-note">{Number(painting.price)===0?'This painting is available by custom quote. ':'This painting has been sold. '}<Link href="/custom-art">Request a similar artwork <ArrowRight size={15}/></Link></p>}
        <WishlistButton id={painting.id}/><PremiumArtworkActions productId={painting.id}/><p className="artwork-order-note">Shipping and payment are confirmed by the studio before dispatch.</p>
      </div>
    </div>
    <div className="content"><ArtworkPreview image={painting.image_url} title={painting.title} dimensions={painting.dimensions}/>{painting.reference_image_url&&painting.completed_image_url&&<section className="before-after panel"><p className="craft-eyebrow">FROM MEMORY TO ART</p><h2>Reference and finished painting</h2><div><figure><Image width={800} height={800} src={painting.reference_image_url} alt="Customer reference supplied with permission"/><figcaption>Reference</figcaption></figure><figure><Image width={800} height={800} src={painting.completed_image_url} alt={`Completed ${painting.title}`}/><figcaption>Finished artwork</figcaption></figure></div></section>}</div>
    <ProductReviews productId={painting.id}/><div className="artwork-detail-bottom"><h2>Looking for something personal?</h2><p>Tell us what you imagine and we’ll help plan a custom piece.</p><Link href="/custom-art">Explore custom artwork <ArrowRight size={17}/></Link></div>
  </>;
}
