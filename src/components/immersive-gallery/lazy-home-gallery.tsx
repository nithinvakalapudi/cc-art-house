'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import type { Product } from '@/lib/data';



const HomeGalleryShowcase = dynamic(() => import('./home-gallery-showcase'), {
  ssr: false,
  loading: () => <GalleryPoster busy />,
});

export default function LazyHomeGallery({ products }: { products: Product[] }) {
  const shell = useRef<HTMLElement>(null);
  const [nearby, setNearby] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    const element = shell.current;
    if (!element) return;
    // Warm the module after the initial page load, then mount the scene near the viewport.
    const preload = () => { void import('./home-gallery-showcase').catch(() => {}); };
    const schedulePreload = () => {
      if ('requestIdleCallback' in window) return window.requestIdleCallback(preload, { timeout: 1500 });
      preload();
      return undefined;
    };
    let idle: number | undefined;
    const onLoad = () => { idle = schedulePreload(); };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNearby(true); observer.disconnect(); }
    }, { rootMargin: '1000px 0px' });
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.removeEventListener('load', onLoad);
      if (idle !== undefined) window.cancelIdleCallback(idle);
    };
  }, []);

  const shouldLoad = nearby || activated;
  if (shouldLoad) return <HomeGalleryShowcase products={products} />;
  return <section ref={shell} className="home-gallery-poster-shell"><GalleryPoster onStart={() => setActivated(true)} /></section>;
}

function GalleryPoster({ onStart, busy = false }: { onStart?: () => void; busy?: boolean }) {
  return <div className="home-gallery-poster">
    <Image src="/artist-gallery/traditional-portrait-optimized.webp" alt="Preview of the interactive private art gallery" fill sizes="100vw" loading="lazy" />
    <div className="home-gallery-poster-shade" />
    <div className="home-gallery-poster-copy"><span>IMMERSIVE PRIVATE GALLERY</span><h2>Step inside the<br/>collection.</h2><p>{busy ? 'Preparing the gallery…' : 'Explore the collection in 3D.'}</p>{onStart&&<button type="button" onClick={onStart}><Play size={17} fill="currentColor"/> Start 3D tour</button>}</div>
  </div>;
}
