import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export type Product = {
  id: string; slug: string; title: string; description: string | null;
  price: number; original_price: number | null; medium: string | null; dimensions: string | null;
  available: boolean; featured: boolean; image_url: string | null;
  category_id: string | null;
};
export type Category = { id: string; slug: string; name: string };
export const priceLabel = (price: number) => Number(price) === 0 ? 'Price on request' : `₹${Number(price).toLocaleString('en-IN')}`;
export const discountPercent = ({ price, original_price }: Pick<Product, 'price' | 'original_price'>) =>
  original_price && original_price > price ? Math.round((1 - price / original_price) * 100) : 0;

export function publicDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const timeout = AbortSignal.timeout(2500);
        const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
        return fetch(input, { ...init, signal });
      },
    },
  });
}

const cachedCatalogue = unstable_cache(async () => {
  const db = publicDb();
  if (!db) throw new Error('Missing Supabase configuration');
  const [products, categories] = await Promise.all([
    db.from('products').select('id,slug,title,description,price,original_price,medium,dimensions,available,featured,image_url,category_id')
      .eq('published', true).eq('archived', false).order('created_at', { ascending: false }),
    db.from('categories').select('id,slug,name').eq('published', true).order('sort_order'),
  ]);
  if (products.error || categories.error) throw new Error(products.error?.message || categories.error?.message);
  return { products: (products.data || []) as Product[], categories: (categories.data || []) as Category[] };
}, ['art-store-catalogue', process.env.NEXT_PUBLIC_SUPABASE_URL || ''], { tags: ['catalogue'], revalidate: 300 });

export async function withPublicDataTimeout<T>(operation: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>(resolve => { timer = setTimeout(() => resolve(fallback), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getCatalogue() {
  try {
    const result = await withPublicDataTimeout(cachedCatalogue(), 2500, null);
    if (!result) return { products: [] as Product[], categories: [] as Category[], error: 'Catalogue request timed out' };
    return { ...result, error: null as string | null };
  } catch (error) {
    return { products: [] as Product[], categories: [] as Category[], error: error instanceof Error ? error.message : 'Catalogue unavailable' };
  }
}
