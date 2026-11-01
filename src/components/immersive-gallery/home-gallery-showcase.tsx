'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Canvas } from '@react-three/fiber';
import { ArrowRight, Pause, Play } from 'lucide-react';
import type { Product } from '@/lib/data';
import { artistGallery } from '@/lib/artist-gallery';
import GalleryScene from './gallery-scene';
import GalleryEffects from './gallery-effects';
import type { GalleryArtwork } from './immersive-gallery';

export default function HomeGalleryShowcase({products}:{products:Product[]}){
  const router=useRouter();
  const artworks=useMemo<GalleryArtwork[]>(()=>{const live=products.slice(0,8).map(p=>({id:p.id,slug:p.slug,title:p.title,artist:'CC Art House',description:p.description||'Original handmade artwork',medium:p.medium||'Hand-painted original',dimensions:p.dimensions||'Ask the studio',price:Number(p.price),available:p.available,image:p.image_url||'/artist-gallery/traditional-portrait-hd.png',purchasable:true}));const used=new Set(live.map(a=>a.image));const archive=artistGallery.filter(a=>!used.has(a.image)).map((a,i)=>({id:`home-archive-${i}`,title:a.title,artist:'CC Art House',description:a.alt,medium:a.category,dimensions:'Custom sizes available',price:0,available:true,image:a.image,purchasable:false}));return[...live,...archive].slice(0,8)},[products]);
  const[stop,setStop]=useState(0),[ready,setReady]=useState(false),[moving,setMoving]=useState(true),[paused,setPaused]=useState(false);const timer=useRef<number|null>(null);const reduced=useMemo(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,[]);const compact=useMemo(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 800px)').matches,[]);const viewingTime=compact?6000:5000,movementTime=compact?2.8:2.3;
  const clear=useCallback(()=>{if(timer.current)window.clearTimeout(timer.current);timer.current=null},[]);const arrived=useCallback((index:number)=>{setMoving(false);clear();if(!paused)timer.current=window.setTimeout(()=>{setMoving(true);setStop((index+1)%artworks.length)},viewingTime)},[artworks.length,clear,paused,viewingTime]);
  useEffect(()=>{if(paused)clear();else if(!moving&&!timer.current)timer.current=window.setTimeout(()=>{setMoving(true);setStop(current=>(current+1)%artworks.length)},viewingTime);return()=>clear()},[paused,moving,viewingTime,artworks.length,clear]);
  const active=artworks[stop],detailsHref=active?.slug?`/shop/${active.slug}`:`/gallery?art=${active?.id||''}`;
  return <section className="home-immersive-showcase" aria-label="Automatic immersive artwork tour">
    <div className="home-immersive-heading"><div><span className="craft-eyebrow">STEP INSIDE THE COLLECTION</span><h2>A gallery that moves<br/><em>with your curiosity.</em></h2></div><p>A brighter, slower private viewing that gives every painting time to breathe.</p></div>
    <div className="home-immersive-stage">
      <div className="home-immersive-canvas"><Canvas shadows dpr={[.75,1.4]} performance={{min:.55}} camera={{position:[0,1.72,8],fov:compact?50:56,near:.1,far:100}} gl={{antialias:!compact,powerPreference:'high-performance'}}><Suspense fallback={null}><GalleryScene artworks={artworks} targetStop={stop} paused={paused} reducedMotion={reduced} transitionDuration={movementTime} atmosphere="day" mobileQuality={compact} onReady={()=>setReady(true)} onMoving={setMoving} onArrive={arrived} onSelect={(index)=>{const art=artworks[index];router.push(art.slug?`/shop/${art.slug}`:`/gallery?art=${art.id}`)}}/><GalleryEffects moving={moving} compact={compact} bright/></Suspense></Canvas></div>
      {!ready&&<div className="home-immersive-loading"><span/>Curating your private view…</div>}
      <button className="home-immersive-pause" aria-label={paused?'Resume gallery':'Pause gallery'} onClick={()=>setPaused(value=>!value)}>{paused?<Play fill="currentColor"/>:<Pause fill="currentColor"/>}</button>
      <Link className="home-immersive-caption" href={detailsHref} aria-label={`View details for ${active?.title||'this artwork'}`}><span>{String(stop+1).padStart(2,'0')} / 08</span><div><small>{paused?'VIEWING PAUSED':moving?'Approaching artwork':compact?'TAP TO VIEW DETAILS':'CLICK TO VIEW DETAILS'}</small><strong>{active?.title}</strong></div><i><b key={stop} style={{animationDuration:`${viewingTime}ms`,animationPlayState:paused?'paused':'running'}}/></i></Link>
      <Link className="home-immersive-enter" href="/gallery">Enter immersive gallery <ArrowRight/></Link>
    </div>
  </section>;
}
