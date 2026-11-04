'use client';
/* eslint-disable react-hooks/set-state-in-effect -- viewport capability is detected after browser hydration. */

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
  const [mobile, setMobile] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    setMobile(window.matchMedia('(max-width: 800px)').matches);
    const element = shell.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNearby(true); observer.disconnect(); }
    }, { rootMargin: '350px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const shouldLoad = nearby && (!mobile || activated);
  if (shouldLoad) return <HomeGalleryShowcase products={products} />;
  return <section ref={shell} className="home-gallery-poster-shell"><GalleryPoster onStart={() => setActivated(true)} /></section>;
}

function GalleryPoster({ onStart, busy = false }: { onStart?: () => void; busy?: boolean }) {
  return <div className="home-gallery-poster">
    <Image src="/artist-gallery/traditional-portrait-optimized.webp" alt="Preview of the interactive private art gallery" fill sizes="100vw" loading="eager" fetchPriority="high" />
    <div className="home-gallery-poster-shade" />
    <div className="home-gallery-poster-copy"><span>IMMERSIVE PRIVATE GALLERY</span><h2>Step inside the<br/>collection.</h2><p>{busy ? 'Preparing the gallery…' : 'Load the 3D tour only when you are ready.'}</p>{onStart&&<button type="button" onClick={onStart}><Play size={17} fill="currentColor"/> Start 3D tour</button>}</div>
  </div>;
}
