'use client';
import { Component, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { ArrowLeft, ArrowRight, CalendarDays, Layers, Maximize2, Pause, Play, UserRound } from 'lucide-react';
import type { Product } from '@/lib/data';
import { artistGallery } from '@/lib/artist-gallery';
import GalleryScene from './gallery-scene';
import GalleryEffects from './gallery-effects';
import type { GalleryArtwork } from './immersive-gallery';

class GalleryBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function HomeGalleryShowcase({products}:{products:Product[]}){
  const closeLook = useRef<HTMLDialogElement>(null);
  const [inspection, setInspection] = useState<GalleryArtwork | null>(null);

  useEffect(() => {
    const dialog = closeLook.current;
    if (inspection && dialog && !dialog.open) dialog.showModal();
  }, [inspection]);
  const artworks=useMemo<GalleryArtwork[]>(()=>{const live=products.slice(0,8).map(p=>({id:p.id,slug:p.slug,title:p.title,artist:'CC Art House',description:p.description||'Original handmade artwork',medium:p.medium||'Hand-painted original',dimensions:p.dimensions||'Ask the studio',price:Number(p.price),available:p.available,image:p.image_url||'/artist-gallery/traditional-portrait-hd.png',purchasable:true}));const used=new Set(live.map(a=>a.image));const archive=artistGallery.filter(a=>!used.has(a.image)).map((a,i)=>({id:`home-archive-${i}`,title:a.title,artist:'CC Art House',description:a.alt,medium:a.category,dimensions:'Custom sizes available',price:0,available:true,image:a.image,purchasable:false}));return[...live,...archive].slice(0,8)},[products]);
  const[stop,setStop]=useState(0),[ready,setReady]=useState(false),[moving,setMoving]=useState(true),[paused,setPaused]=useState(false);const timer=useRef<number|null>(null);const reduced=useMemo(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,[]);const compact=useMemo(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 800px)').matches,[]);const viewingTime=compact?12000:10000,movementTime=compact?2.8:2.3;
  const clear=useCallback(()=>{if(timer.current)window.clearTimeout(timer.current);timer.current=null},[]);const arrived=useCallback((index:number)=>{setMoving(false);clear();if(!paused)timer.current=window.setTimeout(()=>{setMoving(true);setStop((index+1)%artworks.length)},viewingTime)},[artworks.length,clear,paused,viewingTime]);
  const [fallback, setFallback] = useState(false);
  useEffect(()=>{if(paused || fallback || inspection)clear();else if(!moving&&!timer.current)timer.current=window.setTimeout(()=>{setMoving(true);setStop(current=>(current+1)%artworks.length)},viewingTime);return()=>clear()},[paused,fallback,inspection,moving,viewingTime,artworks.length,clear]);
  const showFallback = useCallback(() => {
    setFallback(true);
    setMoving(false);
  }, []);
  useEffect(() => {
    if (ready || fallback) return;
    const timeout = window.setTimeout(showFallback, 8000);
    return () => window.clearTimeout(timeout);
  }, [ready, fallback, showFallback]);
  useEffect(() => {
    if (!fallback || paused || reduced || artworks.length < 2) return;
    const interval = window.setInterval(() => setStop(current => (current + 1) % artworks.length), viewingTime);
    return () => window.clearInterval(interval);
  }, [fallback, paused, reduced, artworks.length, viewingTime]);
  const active=artworks[stop],detailsHref=active?.slug?`/shop/${active.slug}`:`/gallery?art=${active?.id||''}`;
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const pauseToRead = () => {
    if (moving || performance.now() < suppressClickUntil.current) return;
    clear();
    setPaused(true);
  };
  const navigate = (direction: number) => {
    if (artworks.length < 2) return;
    clear();
    setPaused(false);
    setMoving(!fallback);
    setStop(current => (current + direction + artworks.length) % artworks.length);
  };
  return <section className="home-immersive-showcase" aria-label="Automatic immersive artwork tour">
    <div className="home-immersive-heading"><div><span className="craft-eyebrow">STEP INSIDE THE COLLECTION</span><h2>A gallery that moves<br/><em>with your curiosity.</em></h2></div><p>A brighter, slower private viewing that gives every painting time to breathe.</p></div>
    <div className="home-immersive-stage">
      {!fallback && <GalleryBoundary onFailure={showFallback}><div className="home-immersive-canvas" style={{ touchAction: 'pan-y pinch-zoom' }}
        onPointerDown={event => {
          if (event.pointerType === 'touch' && event.isPrimary) swipe.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerCancel={() => { swipe.current = null; }}
        onPointerUp={event => {
          const start = swipe.current;
          swipe.current = null;
          if (!start || event.pointerType !== 'touch') return;
          const dx = event.clientX - start.x, dy = event.clientY - start.y;
          if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          suppressClickUntil.current = performance.now() + 350;
          navigate(dx < 0 ? 1 : -1);
        }}><Canvas shadows dpr={compact ? [1, 1.75] : [1.5, 2]} performance={{min:.55}} camera={{position:[0,1.72,8],fov:compact?58:56,near:.1,far:100}} gl={{antialias:true,powerPreference:'high-performance'}}><Suspense fallback={null}><GalleryScene wallDetails artworks={artworks} targetStop={stop} paused={paused || Boolean(inspection)} reducedMotion={reduced} transitionDuration={movementTime} atmosphere="day" mobileQuality={compact} onReady={()=>setReady(true)} onMoving={setMoving} onArrive={arrived} onLabelSelect={pauseToRead} onSelect={index => {
          if (moving || index !== stop || performance.now() < suppressClickUntil.current) return;
          pauseToRead();
          setInspection(artworks[index]);
        }}/><GalleryEffects compact={compact} bright/></Suspense></Canvas></div></GalleryBoundary>}
      {!ready&&!fallback&&<div className="home-immersive-loading"><span/>Curating your private view…</div>}
      {fallback && active && <Link className="museum-art-preview" href={detailsHref}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={active.image} alt={active.title} />
      </Link>}
      {fallback && active && <aside className="museum-art-details" aria-label="Artwork information">
        <h3>{active.title}</h3>
        <dl>
          <div><UserRound aria-hidden="true" /><span><dt>Artist</dt><dd>{active.artist}</dd></span></div>
          <div><CalendarDays aria-hidden="true" /><span><dt>Year</dt><dd>Not specified</dd></span></div>
          <div><Layers aria-hidden="true" /><span><dt>Medium</dt><dd>{active.medium}</dd></span></div>
          <div><Maximize2 aria-hidden="true" /><span><dt>Size</dt><dd>{active.dimensions}</dd></span></div>
        </dl>
        <h4>About the Artwork</h4>
        <p>{active.description}</p>
        <div className="museum-art-actions">
          <Link href={detailsHref}><Maximize2 size={16} /> View in Detail</Link>
          <Link href="/about"><Play size={16} /> About the Artist</Link>
        </div>
      </aside>}
      <div className="museum-art-navigation" aria-label="Choose artwork">
        <button type="button" aria-label="Previous artwork" onClick={() => navigate(-1)}><ArrowLeft /></button>
        <button type="button" aria-label="Next artwork" onClick={() => navigate(1)}><ArrowRight /></button>
      </div>
      <button className="home-immersive-pause" aria-label={paused?'Resume gallery':'Pause gallery'} onClick={()=>setPaused(value=>!value)}>{paused?<Play fill="currentColor"/>:<Pause fill="currentColor"/>}</button>
      <Link className="home-immersive-caption" href={detailsHref} aria-label={`View details for ${active?.title||'this artwork'}`}><span>{String(stop+1).padStart(2,'0')} / {String(artworks.length).padStart(2,'0')}</span><div><small>{paused?'VIEWING PAUSED':moving?'Approaching artwork':compact?'TAP TO VIEW DETAILS':'CLICK TO VIEW DETAILS'}</small><strong>{active?.title}</strong></div><i><b key={stop} style={{animationDuration:`${viewingTime}ms`,animationPlayState:paused?'paused':'running'}}/></i></Link>
      <div className="home-immersive-enter museum-wall-actions">
        {!fallback && active && <button type="button" disabled={moving} onClick={() => {
          pauseToRead();
          setInspection(active);
        }}>Take a closer look</button>}
        {!fallback && active && <><Link href={detailsHref}>View in Detail</Link><Link href="/about">About the Artist</Link></>}
        <Link href="/gallery">Enter immersive gallery <ArrowRight size={16} /></Link>
      </div>
    </div>
    <dialog ref={closeLook} className="museum-close-look" aria-label={inspection?.title} onClose={() => setInspection(null)}>
      {inspection && <button type="button" onClick={() => closeLook.current?.close()} aria-label="Return to museum">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={inspection.image} alt={inspection.title} />
        <span>Return to museum</span>
      </button>}
    </dialog>
  </section>;
}

