import type { MetadataRoute } from 'next';
import { getCatalogue } from '@/lib/data';
import { getSiteSettings, settingOn } from '@/lib/site-settings';
import { siteUrl } from '@/lib/search-metadata';

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ products }, settings] = await Promise.all([getCatalogue(), getSiteSettings()]);
  const paths = ['/', '/shop', '/custom-art'];
  if (settingOn(settings.show_gallery)) paths.push('/gallery');
  if (settingOn(settings.show_about)) paths.push('/about');
  if (settingOn(settings.show_contact)) paths.push('/contact');
  if (settingOn(settings.show_style_finder)) paths.push('/style-finder');
  paths.push(...products.map(({ slug }) => `/shop/${encodeURIComponent(slug)}`));
  return paths.map(path => ({ url: new URL(path, siteUrl).href }));
}
