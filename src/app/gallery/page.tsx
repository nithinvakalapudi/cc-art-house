import { getCatalogue } from '@/lib/data';
import { artistGallery } from '@/lib/artist-gallery';
import ImmersiveGallery, { type GalleryArtwork } from '@/components/immersive-gallery/immersive-gallery';
import { getSiteSettings } from '@/lib/site-settings';

export const metadata = { title: 'Immersive gallery | CC Art Works', description: 'Walk through a cinematic 3D gallery and discover eight handmade artworks.' };
export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  const [{ products },settings] = await Promise.all([getCatalogue(),getSiteSettings()]);
  const catalogueArt: GalleryArtwork[] = products.slice(0, 8).map(product => ({
    id: product.id, slug: product.slug, title: product.title, artist: 'CC Art Works',
    description: product.description || 'An original handmade artwork created with care in our Bengaluru studio.',
    medium: product.medium || 'Hand-painted original', dimensions: product.dimensions || 'Ask the studio',
    price: Number(product.price), available: product.available,
    image: product.image_url || '/artist-gallery/traditional-portrait-hd.png', purchasable: true,
  }));
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const productTitles = new Set(catalogueArt.map(art => normalize(art.title)));
  const productImages = new Set(catalogueArt.map(art => art.image));
  const archiveSeenTitles = new Set<string>();
  const archiveSeenImages = new Set<string>();
  const uniqueArchive = artistGallery.filter(art => {
    const title = normalize(art.title);
    if (productTitles.has(title) || productImages.has(art.image) || archiveSeenTitles.has(title) || archiveSeenImages.has(art.image)) return false;
    archiveSeenTitles.add(title);
    archiveSeenImages.add(art.image);
    return true;
  });
  const archiveArt: GalleryArtwork[] = uniqueArchive.map((art, index) => ({
    id: `archive-${index}`, title: art.title, artist: 'CC Art Works',
    description: `A ${art.category.toLowerCase()} piece from the artist’s archive. Request a personal interpretation made for your space.`,
    medium: art.category, dimensions: 'Custom sizes available', price: 0, available: true,
    image: art.image, purchasable: false,
  }));
  const autoSeconds=Math.min(30,Math.max(2,Number(settings.gallery_auto_seconds)||6.5));
  return <ImmersiveGallery artworks={[...catalogueArt, ...archiveArt].slice(0, 8)} autoAdvanceMs={autoSeconds*1000} curatorDefault={settings.gallery_curator_default==='true'} />;
}
