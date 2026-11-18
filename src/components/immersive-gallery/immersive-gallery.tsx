'use client';
import Image from 'next/image';
/* eslint-disable react-hooks/set-state-in-effect -- URL, local-storage and media-query state is synchronized after browser hydration. */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { Accessibility, ArrowLeft, ArrowRight, CalendarDays, Heart, ImageUp, Maximize2, Mic2, Moon, Pause, Play, RotateCcw, Share2, Sun, Volume2, VolumeX, X, ZoomIn } from 'lucide-react';
import { AddToCartButton } from '@/components/cart-store';
import { WishlistButton } from '@/components/wishlist';
import GalleryScene, {type WalkInput} from './gallery-scene';
import GalleryEffects from './gallery-effects';
import { useGalleryAudio } from './use-gallery-audio';

export type GalleryArtwork = { id:string;slug?:string;title:string;artist:string;description:string;medium:string;dimensions:string;price:number;available:boolean;image:string;purchasable:boolean };
const currency = (value:number) => value > 0 ? `₹${value.toLocaleString('en-IN')}` : 'Personal quote';

export default function ImmersiveGallery({artworks,autoAdvanceMs=6500,curatorDefault=false}:{artworks:GalleryArtwork[];autoAdvanceMs?:number;curatorDefault?:boolean}) {
  const [started,setStarted]=useState(false),[ready,setReady]=useState(false),[paused,setPaused]=useState(false),[moving,setMoving]=useState(false),[panelOpen,setPanelOpen]=useState(false),[finished,setFinished]=useState(false),[fullscreen,setFullscreen]=useState(false);
  const [atmosphere,setAtmosphere]=useState<'day'|'evening'>(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 800px)').matches?'day':'evening'),[inspection,setInspection]=useState(false),[roomPreview,setRoomPreview]=useState<string|null>(null),[quizOpen,setQuizOpen]=useState(false),[accessible,setAccessible]=useState(false),[reactionCount,setReactionCount]=useState(0),[curatorEnabled,setCuratorEnabled]=useState(curatorDefault);
  const [stop,setStop]=useState(-1); const [webglUnavailable,setWebglUnavailable]=useState(false); const shellRef=useRef<HTMLDivElement>(null); const advanceTimer=useRef<number|null>(null); const [manual, setManual] = useState(false);
  const walk = useRef<WalkInput>({keys:new Set(), x:0, z:0, yaw:0, pitch:0});
  const drag = useRef<{x:number;y:number}|null>(null);
  const blocked = panelOpen || inspection || Boolean(roomPreview) || quizOpen;
  const freeWalk = () => { setManual(true); setMoving(false); setPaused(false); };
  const markWebglUnavailable=useCallback(()=>setWebglUnavailable(true),[]);
  const systemReduceMotion=useMemo(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,[]); const reduceMotion=accessible||systemReduceMotion;
  const compact=useMemo(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 800px)').matches,[]);
  const audio=useGalleryAudio(moving,stop,started);
  const clearAdvance=useCallback(()=>{if(advanceTimer.current)window.clearTimeout(advanceTimer.current);advanceTimer.current=null},[]);
  const goTo=useCallback((index:number)=>{clearAdvance();setManual(false);setPanelOpen(false);setFinished(false);setStop(Math.max(-1,Math.min(artworks.length,index)));setPaused(false)},[artworks.length,clearAdvance]);
  const onArrive = useCallback((index: number) => {
    setMoving(false);
    if (index >= artworks.length) setFinished(true);
  }, [artworks.length]);
  useEffect(() => {
    if (!started || !ready || paused || manual || moving || blocked || finished || stop < 0 || stop >= artworks.length) return;
    advanceTimer.current = window.setTimeout(() => {
      setStop(stop + 1);
    }, reduceMotion ? Math.max(9000, autoAdvanceMs) : autoAdvanceMs);
    return clearAdvance;
  }, [started, ready, paused, manual, moving, blocked, finished, stop, artworks.length, reduceMotion, autoAdvanceMs, clearAdvance]);
  const active=stop>=0&&stop<artworks.length?artworks[stop]:null;
  useEffect(()=>{const requested=new URLSearchParams(window.location.search).get('art');const index=artworks.findIndex(a=>a.slug===requested||a.id===requested);if(index>=0){setStarted(true);setStop(index)}},[artworks]);
  useEffect(()=>{if(active)setReactionCount(Number(localStorage.getItem(`art-reactions-${active.id}`)||Math.max(7,18-stop)))},[active,stop]);
  useEffect(() => {
    const keys = walk.current.keys;
    const down = (event: KeyboardEvent) => {
      if (!started || finished || blocked || event.ctrlKey || event.metaKey || event.altKey ||
          (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]'))) return;
      const key = event.key.toLowerCase();
      if (!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) return;
      event.preventDefault();
      if (!manual && (key === 'arrowleft' || key === 'arrowright')) {
        goTo((stop + (key === 'arrowleft' ? -1 : 1) + artworks.length) % artworks.length);
        return;
      }
      keys.add(key); setManual(true); setMoving(false); setPaused(false);
    };
    const up = (event: KeyboardEvent) => { keys.delete(event.key.toLowerCase()); };
    const reset = () => keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset);
    };
  }, [started, finished, blocked, manual, goTo, stop, artworks.length]);
  useEffect(()=>{
    if(!('speechSynthesis' in window))return;
    window.speechSynthesis.cancel();
    if(!curatorEnabled||!active||moving||!panelOpen)return;
    const speech=new SpeechSynthesisUtterance(`${active.title}, by ${active.artist}. ${active.description}. ${active.medium}. Dimensions ${active.dimensions}.`);
    speech.rate=.9;speech.pitch=.92;
    const timer=window.setTimeout(()=>window.speechSynthesis.speak(speech),250);
    return()=>{window.clearTimeout(timer);window.speechSynthesis.cancel()};
  },[curatorEnabled,active,moving,panelOpen]);
  useEffect(()=>()=>{if('speechSynthesis'in window)window.speechSynthesis.cancel()},[]);
  const share=async()=>{if(!active)return;const url=`${location.origin}/gallery?art=${encodeURIComponent(active.slug||active.id)}`;if(navigator.share)await navigator.share({title:active.title,text:`Private viewing: ${active.title}`,url});else await navigator.clipboard.writeText(url)};
  const toggleFullscreen=async()=>{if(!document.fullscreenElement)await shellRef.current?.requestFullscreen();else await document.exitFullscreen()};
  useEffect(()=>{const update=()=>setFullscreen(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',update);return()=>document.removeEventListener('fullscreenchange',update)},[]);
  if(webglUnavailable)return <section className="immersive-gallery" aria-label="Artwork collection"><div className="gallery-canvas-wrap"><GalleryArtworkFallback artworks={artworks}/></div></section>;
  return <section className="immersive-gallery" ref={shellRef} aria-label="Immersive 3D art gallery">
    <div className="gallery-canvas-wrap">
    <div style={{position:'absolute',inset:0,touchAction:started?'none':'pan-y'}}
      onPointerDown={event => {
        if (started && !blocked && !finished) drag.current = {x:event.clientX,y:event.clientY};
      }}
      onPointerMove={event => {
        if (!drag.current || !event.buttons) return;
        const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y;
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          if (Math.hypot(dx,dy) < 5) return;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        walk.current.yaw += dx * .003;
        walk.current.pitch += dy * .003;
        drag.current = {x:event.clientX,y:event.clientY};
        freeWalk();
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}>
    <Canvas fallback={<WebGLFallbackMarker onUnsupported={markWebglUnavailable}/>} shadows dpr={compact ? [1, 1.75] : [1.5, 2]} performance={{min:.55}} camera={{position:[0,1.72,8],fov:compact?52:58,near:.1,far:100}} gl={{antialias:true,powerPreference:'high-performance'}}><Suspense fallback={null}><GalleryScene manual={manual} walkInput={walk} artworks={artworks} targetStop={started?stop:-1} focusedStop={stop} showHotspot={started&&!moving} paused={paused || blocked} reducedMotion={reduceMotion} mobileQuality={compact} atmosphere={atmosphere} onReady={()=>setReady(true)} onMoving={setMoving} onArrive={onArrive} onSelect={(index)=>{if(manual || (index===stop&&!moving)){setStop(index);setPanelOpen(true)}else goTo(index)}}/><GalleryEffects compact={compact} bright={compact}/></Suspense></Canvas></div>
    {!ready&&<div className="gallery-loading" role="status"><span/><p>Preparing the private viewing room</p><small>Lighting the gallery and framing the collection…</small></div>}
    {ready&&!started&&<div className="gallery-welcome"><p className="gallery-kicker">A PRIVATE VIEWING</p><h1>Walk into<br/><em>the collection.</em></h1><p>The gallery doors open into a cinematic journey past eight original works.</p><button onClick={()=>{setStarted(true);goTo(0)}}><Play size={18} fill="currentColor"/> Start Museum Tour</button><button className="gallery-quiz-launch" onClick={()=>setQuizOpen(true)}>Find art for my space</button><small>WASD to walk. Drag to look.</small></div>}
    {started&&<><div className="gallery-top-ui"><button className="gallery-wordmark" onClick={()=>{setStarted(false);goTo(-1)}}>CC ART WORKS <span>· PRIVATE GALLERY</span></button><div><button aria-label={audio.enabled?'Mute gallery atmosphere':'Enable gallery atmosphere'} onClick={audio.toggle}>{audio.enabled?<Volume2/>:<VolumeX/>}</button><button aria-label={fullscreen?'Exit full screen':'Enter full screen'} onClick={toggleFullscreen}><Maximize2/></button></div></div><div className="gallery-progress" aria-live="polite"><span>{finished?'Tour complete':stop>=0?`${String(Math.min(stop+1,artworks.length)).padStart(2,"0")} / ${String(artworks.length).padStart(2,"0")}`:'Entrance'}</span><i><b style={{width:`${finished?100:Math.max(0,((stop+1)/artworks.length)*100)}%`}}/></i><small>{moving?'Approaching artwork':panelOpen?'Viewing artwork':'Gallery paused'}</small></div>{active&&!panelOpen&&<div className="gallery-moving-title"><small>{moving?'APPROACHING ARTWORK':'NOW VIEWING'}</small><strong>{active.title}</strong></div>}<div className="gallery-journey" aria-label="Eight artwork journey">{artworks.map((art,index)=><button key={art.id} className={index===stop?'active':''} onClick={()=>goTo(index)} aria-current={index===stop ? "step" : undefined} aria-label={`Go to artwork ${index+1}: ${art.title}`}><span aria-hidden="true">&#9679;</span></button>)}</div><div className="gallery-controls" aria-label="Gallery controls"><button onClick={()=>goTo(stop<=0?artworks.length-1:stop-1)} aria-label="Previous artwork"><ArrowLeft/></button><button className="gallery-play" onClick={()=>manual?goTo(Math.max(0,stop)):setPaused(v=>!v)} aria-label={manual?"Resume Tour":paused?'Resume gallery walk':'Pause gallery walk'}>{(paused||manual)?<Play fill="currentColor"/>:<Pause fill="currentColor"/>}</button><button onClick={()=>goTo((stop+1)%artworks.length)} aria-label="Next artwork"><ArrowRight/></button></div></>}
    {started && !blocked && !finished && <div className="museum-walk-tools">
      {active && !moving && <button onClick={() => setPanelOpen(true)}>Artwork information</button>}
      {manual && <button onClick={() => goTo(Math.max(0,stop))}>Resume Tour</button>}
      {compact && <button className="museum-joystick" aria-label="Drag to walk" onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        freeWalk();
      }} onPointerMove={event => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const rect = event.currentTarget.getBoundingClientRect();
        walk.current.x = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / 30));
        walk.current.z = Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height / 2) / 30));
      }} onLostPointerCapture={() => { walk.current.x = walk.current.z = 0; }}>&#10021;</button>}
    </div>}
    {active&&panelOpen&&!moving&&<aside className={`gallery-art-panel ${stop%2===0?'panel-right':'panel-left'}`} aria-label={`Details for ${active.title}`}><button className="gallery-panel-close" aria-label="Close artwork details" onClick={()=>setPanelOpen(false)}><X/></button><p className="gallery-kicker">STOP {String(stop+1).padStart(2,'0')} · {stop%2===0?'LEFT WALL':'RIGHT WALL'}</p><h2>{active.title}</h2><p className="gallery-artist">By {active.artist}</p><p className="gallery-description">{active.description}</p><dl><div><dt>Medium</dt><dd>{active.medium}</dd></div><div><dt>Dimensions</dt><dd>{active.dimensions}</dd></div><div><dt>Price</dt><dd>{currency(active.price)}</dd></div><div><dt>Status</dt><dd className={active.available?'available':''}>{active.available?'Available':'Sold / collected'}</dd></div></dl><div className="gallery-panel-actions">{active.slug?<Link href={`/shop/${active.slug}`}>View artwork</Link>:<Link href="/custom-art">Request similar</Link>}{active.purchasable&&<WishlistButton id={active.id}/>} {active.purchasable&&active.slug&&active.available&&active.price>0&&<AddToCartButton className="gallery-buy" item={{id:active.id,slug:active.slug,title:active.title,price:active.price,image_url:active.image}}/>}</div></aside>}
    {finished&&<div className="gallery-finale"><div><button onClick={()=>{setStarted(false);goTo(-1)}}><RotateCcw/> Restart Tour</button><Link href="/shop">Explore all paintings <ArrowRight/></Link></div></div>}
    {started&&<div className="gallery-premium-tools"><button title="Day or evening lighting" onClick={()=>setAtmosphere(v=>v==='day'?'evening':'day')}>{atmosphere==='day'?<Sun/>:<Moon/>}</button><button title="Reduced motion accessibility mode" className={accessible?'active':''} onClick={()=>setAccessible(v=>!v)}><Accessibility/></button></div>}
    {active&&panelOpen&&!moving&&<div className="gallery-experience-actions"><button className={curatorEnabled?'active':''} aria-pressed={curatorEnabled} onClick={()=>setCuratorEnabled(value=>!value)}><Mic2/> {curatorEnabled?'Curator on':'Curator'}</button><button onClick={()=>setInspection(true)}><ZoomIn/> Inspect</button><label><ImageUp/> In my room<input type="file" accept="image/*" onChange={event=>{const file=event.target.files?.[0];if(file)setRoomPreview(URL.createObjectURL(file))}}/></label><button onClick={share}><Share2/> Share</button><button onClick={()=>{const next=reactionCount+1;setReactionCount(next);localStorage.setItem(`art-reactions-${active.id}`,String(next))}}><Heart/> {reactionCount}</button><Link href="/contact"><CalendarDays/> Private appointment</Link></div>}
    {inspection&&active&&<div className="gallery-modal" role="dialog" aria-modal="true" aria-label={`Inspect ${active.title}`}><button className="gallery-modal-close" onClick={()=>setInspection(false)}><X/></button><div className="gallery-inspect"><Image width={800} height={800} src={active.image} alt={active.title}/><div><p className="gallery-kicker">HIGH RESOLUTION VIEW</p><h2>{active.title}</h2><p>Move your pointer or pinch to examine the brushwork. The original proportions are preserved.</p><small>{active.medium} · {active.dimensions}</small></div></div></div>}
    {roomPreview&&active&&<div className="gallery-modal" role="dialog" aria-modal="true" aria-label="Preview artwork in your room"><button className="gallery-modal-close" onClick={()=>{URL.revokeObjectURL(roomPreview);setRoomPreview(null)}}><X/></button><div className="gallery-room-preview" style={{backgroundImage:`url(${roomPreview})`}}><Image width={800} height={800} src={active.image} alt={active.title}/><span>Drag-free preview · approximate scale</span></div></div>}
    {quizOpen&&<ArtMatchQuiz artworks={artworks} onClose={()=>setQuizOpen(false)} onMatch={index=>{setQuizOpen(false);setStarted(true);goTo(index)}}/>}
  </div></section>;
}

function WebGLFallbackMarker({onUnsupported}:{onUnsupported:()=>void}){
  useEffect(()=>{onUnsupported()},[onUnsupported]);
  return null;
}

function GalleryArtworkFallback({artworks}:{artworks:GalleryArtwork[]}){
  return <div className="gallery-webgl-fallback" role="region" aria-label="Browse artworks without 3D">
    <div className="gallery-webgl-fallback-inner">
      <p className="gallery-kicker">CC ART WORKS · COLLECTION</p>
      <h2>Explore the paintings</h2>
      <p className="gallery-webgl-message">This browser cannot display the 3D room, but every artwork is ready to view.</p>
      <div className="gallery-webgl-grid">{artworks.map(art=><Link key={art.id} href={art.slug?`/shop/${art.slug}`:'/custom-art'}>
        <Image width={800} height={800} src={art.image} alt={art.title}/><strong>{art.title}</strong><span>{art.slug?'View artwork':'Request something similar'} <ArrowRight size={14}/></span>
      </Link>)}</div>
    </div>
  </div>;
}

function ArtMatchQuiz({artworks,onClose,onMatch}:{artworks:GalleryArtwork[];onClose:()=>void;onMatch:(index:number)=>void}){
  const[step,setStep]=useState(0),[score,setScore]=useState(0); const questions=[['What should the room feel like?','Calm & timeless','Bold & joyful'],['Where will it live?','A quiet personal space','A social living space'],['Which detail draws you in?','Fine line and pattern','Colour and character']];
  return <div className="gallery-modal" role="dialog" aria-modal="true"><button className="gallery-modal-close" onClick={onClose}><X/></button><div className="gallery-quiz"><p className="gallery-kicker">PERSONAL ART MATCH · {step+1}/3</p><h2>{questions[step][0]}</h2><button onClick={()=>{if(step===2)onMatch(score%artworks.length);else setStep(step+1)}}>{questions[step][1]}</button><button onClick={()=>{if(step===2)onMatch((score+5)%artworks.length);else{setScore(score+2);setStep(step+1)}}}>{questions[step][2]}</button></div></div>
}
