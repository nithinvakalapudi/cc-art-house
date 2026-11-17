'use client';
import Image from 'next/image';

import { useState } from 'react';

export type ArtworkImage = { url: string; alt: string; label: string };

export default function ArtworkGallery({ images, title }: { images: ArtworkImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const selected = images[active];
  if (!selected) return <div className="artwork-gallery-empty" role="img" aria-label={`No image available for ${title}`}>✺</div>;
  return <div className="artwork-gallery">
    <div className="artwork-gallery-main"><Image width={640} height={640} src={selected.url} alt={selected.alt} /></div>
    {images.length > 1 && <div className="artwork-thumbnails" aria-label="Artwork views">{images.map((image, index) => <button type="button" key={`${image.url}-${index}`} className={index === active ? 'active' : ''} onClick={() => setActive(index)} aria-label={`Show ${image.label}`} aria-pressed={index === active}><Image width={640} height={640} src={image.url} alt="" /><span>{image.label}</span></button>)}</div>}
  </div>;
}
