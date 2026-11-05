'use client';
import { Component, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router=useRouter();
  const artworks=useMemo<GalleryArtwork[]>(()=>{const live=products.slice(0,8).map(p=>({id:p.id,slug:p.slug,title:p.title,artist:'CC Art House',description:p.description||'Original handmade artwork',medium:p.medium||'Hand-painted original',dimensions:p.dimensions||'Ask the studio',price:Number(p.price),available:p.available,image:p.image_url||'/artist-gallery/traditional-portrait-hd.png',purchasable:true}));const used=new Set(live.map(a=>a.image));const archive=artistGallery.filter(a=>!used.has(a.image)).map((a,i)=>({id:`home-archive-${i}`,title:a.title,artist:'CC Art House',description:a.alt,medium:a.category,dimensions:'Custom sizes available',price:0,available:true,image:a.image,purchasable:false}));return[...live,...archive].slice(0,8)},[products]);
  const[stop,setStop]=useState(0),[ready,setReady]=useState(false),[moving,setMoving]=useState(true),[paused,setPaused]=useState(false);const timer=useRef<number|null>(null);const reduced=useMemo(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,[]);const compact=useMemo(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 800px)').matches,[]);const viewingTime=compact?6000:5000,movementTime=compact?2.8:2.3;
  const [wallTurning, setWallTurning] = useState(false);
  const clear=useCallback(()=>{if(timer.current)window.clearTimeout(timer.current);timer.current=null},[]);const arrived=useCallback((index:number)=>{setWallTurning(false);setMoving(false);clear();if(!paused)timer.current=window.setTimeout(()=>{setMoving(true);setStop((index+1)%artworks.length)},viewingTime)},[artworks.length,clear,paused,viewingTime]);
  const [focusWallText, setFocusWallText] = useState(false);
  const [fallback, setFallback] = useState(false);
  useEffect(()=>{if(paused || fallback)clear();else if(!moving&&!timer.current)timer.current=window.setTimeout(()=>{setMoving(true);setStop(current=>(current+1)%artworks.length)},viewingTime);return()=>clear()},[paused,fallback,moving,viewingTime,artworks.length,clear]);
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
  const navigate = (direction: number) => {
    if (artworks.length < 2) return;
    clear();
    setFocusWallText(false);
    setPaused(false);
    setMoving(!fallback);
    setStop(current => (current + direction + artworks.length) % artworks.length);
  };
  return <section className="home-immersive-showcase" aria-label="Automatic immersive artwork tour">
    <div className="home-immersive-heading"><div><span className="craft-eyebrow">STEP INSIDE THE COLLECTION</span><h2>A gallery that moves<br/><em>with your curiosity.</em></h2></div><p>A brighter, slower private viewing that gives every painting time to breathe.</p></div>
    <div className="home-immersive-stage">
      {!fallback && <GalleryBoundary onFailure={showFallback}><div className="home-immersive-canvas"><Canvas shadows dpr={compact ? [1, 1.75] : [1.5, 2]} performance={{min:.55}} camera={{position:[0,1.72,8],fov:compact?50:56,near:.1,far:100}} gl={{antialias:!compact,powerPreference:'high-performance'}}><Suspense fallback={null}><GalleryScene wallDetails focusWallText={focusWallText} artworks={artworks} targetStop={stop} paused={paused && !wallTurning} reducedMotion={reduced} transitionDuration={movementTime} atmosphere="day" mobileQuality={compact} onReady={()=>setReady(true)} onMoving={setMoving} onArrive={arrived} onSelect={(index)=>{const art=artworks[index];router.push(art.slug?`/shop/${art.slug}`:`/gallery?art=${art.id}`)}}/><GalleryEffects compact={compact} bright/></Suspense></Canvas></div></GalleryBoundary>}
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
        {compact && !fallback && active && <button type="button" onClick={() => {
          clear();
          setWallTurning(true);
          setPaused(true);
          setMoving(true);
          setFocusWallText(value => !value);
        }}>{focusWallText ? 'Back to painting' : 'Read about this artwork'}</button>}
        {!fallback && active && <><Link href={detailsHref}>View in Detail</Link><Link href="/about">About the Artist</Link></>}
        <Link href="/gallery">Enter immersive gallery <ArrowRight size={16} /></Link>
      </div>
    </div>
  </section>;
}

