'use client';
/* eslint-disable react-hooks/set-state-in-effect -- URL, local-storage and media-query state is synchronized after browser hydration. */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { Accessibility, ArrowLeft, ArrowRight, CalendarDays, GitCompareArrows, Heart, ImageUp, Maximize2, Mic2, Moon, Pause, Play, RotateCcw, Share2, Sun, Volume2, VolumeX, X, ZoomIn } from 'lucide-react';
import { AddToCartButton } from '@/components/cart-store';
import { WishlistButton } from '@/components/wishlist';
import GalleryScene from './gallery-scene';
import GalleryEffects from './gallery-effects';
import { useGalleryAudio } from './use-gallery-audio';

export type GalleryArtwork = { id:string;slug?:string;title:string;artist:string;description:string;medium:string;dimensions:string;price:number;available:boolean;image:string;purchasable:boolean };
const currency = (value:number) => value > 0 ? `₹${value.toLocaleString('en-IN')}` : 'Personal quote';

export default function ImmersiveGallery({artworks,autoAdvanceMs=6500,curatorDefault=false}:{artworks:GalleryArtwork[];autoAdvanceMs?:number;curatorDefault?:boolean}) {
  const [started,setStarted]=useState(false),[ready,setReady]=useState(false),[paused,setPaused]=useState(false),[moving,setMoving]=useState(false),[panelOpen,setPanelOpen]=useState(false),[finished,setFinished]=useState(false),[fullscreen,setFullscreen]=useState(false);
  const [atmosphere,setAtmosphere]=useState<'day'|'evening'>(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 800px)').matches?'day':'evening'),[inspection,setInspection]=useState(false),[roomPreview,setRoomPreview]=useState<string|null>(null),[quizOpen,setQuizOpen]=useState(false),[accessible,setAccessible]=useState(false),[reactionCount,setReactionCount]=useState(0),[curatorEnabled,setCuratorEnabled]=useState(curatorDefault);
  const [stop,setStop]=useState(-1); const [webglUnavailable,setWebglUnavailable]=useState(false); const shellRef=useRef<HTMLDivElement>(null); const advanceTimer=useRef<number|null>(null); const touchStart=useRef<number|null>(null);
  const markWebglUnavailable=useCallback(()=>setWebglUnavailable(true),[]);
  const systemReduceMotion=useMemo(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,[]); const reduceMotion=accessible||systemReduceMotion;
  const compact=useMemo(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 800px)').matches,[]);
  const audio=useGalleryAudio(moving,stop,started);
  const clearAdvance=useCallback(()=>{if(advanceTimer.current)window.clearTimeout(advanceTimer.current);advanceTimer.current=null},[]);
  const goTo=useCallback((index:number)=>{clearAdvance();setPanelOpen(false);setFinished(false);setStop(Math.max(-1,Math.min(artworks.length,index)));setPaused(false)},[artworks.length,clearAdvance]);
  const onArrive=useCallback((index:number)=>{setMoving(false);if(index>=artworks.length){setFinished(true);setPanelOpen(false);return}if(index>=0){setPanelOpen(true);clearAdvance();advanceTimer.current=window.setTimeout(()=>{setPanelOpen(false);setStop(index+1)},reduceMotion?Math.max(9000,autoAdvanceMs):autoAdvanceMs)}},[artworks.length,clearAdvance,reduceMotion,autoAdvanceMs]);
  useEffect(()=>()=>clearAdvance(),[clearAdvance]); useEffect(()=>{if(paused)clearAdvance()},[paused,clearAdvance]);
  useEffect(()=>{if(stop>=0&&stop<artworks.length)localStorage.setItem('art-house-gallery-stop',String(stop))},[stop,artworks.length]);
  useEffect(()=>{if(!paused&&panelOpen&&stop>=0&&stop<artworks.length&&!moving&&!advanceTimer.current){advanceTimer.current=window.setTimeout(()=>{setPanelOpen(false);setStop(stop+1)},reduceMotion?Math.max(9000,autoAdvanceMs):autoAdvanceMs)}},[paused,panelOpen,stop,artworks.length,moving,reduceMotion,autoAdvanceMs]);
  const active=stop>=0&&stop<artworks.length?artworks[stop]:null;
  useEffect(()=>{const requested=new URLSearchParams(window.location.search).get('art');const index=artworks.findIndex(a=>a.slug===requested||a.id===requested);if(index>=0){setStarted(true);setStop(index)}},[artworks]);
  useEffect(()=>{if(active)setReactionCount(Number(localStorage.getItem(`art-reactions-${active.id}`)||Math.max(7,18-stop)))},[active,stop]);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(!started||inspection||quizOpen)return;if(event.key==='ArrowRight')goTo(stop+1);if(event.key==='ArrowLeft')goTo(stop-1);if(event.key===' ')setPaused(v=>!v);if(event.key==='Escape')setPanelOpen(false)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[started,inspection,quizOpen,goTo,stop]);
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
  return <section className="immersive-gallery" ref={shellRef} aria-label="Immersive 3D art gallery" onTouchStart={event=>{touchStart.current=event.touches[0]?.clientX??null}} onTouchEnd={event=>{if(touchStart.current===null)return;const delta=event.changedTouches[0].clientX-touchStart.current;if(Math.abs(delta)>55)goTo(stop+(delta<0?1:-1));touchStart.current=null}}><div className="gallery-canvas-wrap">
    <Canvas fallback={<WebGLFallbackMarker onUnsupported={markWebglUnavailable}/>} shadows dpr={compact?[1,1.3]:[.9,1.65]} performance={{min:.55}} camera={{position:[0,1.72,8],fov:compact?52:58,near:.1,far:100}} gl={{antialias:true,powerPreference:'high-performance'}}><Suspense fallback={null}><GalleryScene artworks={artworks} targetStop={started?stop:-1} focusedStop={stop} showHotspot={started&&!moving} paused={paused} reducedMotion={reduceMotion} mobileQuality={compact} atmosphere={atmosphere} onReady={()=>setReady(true)} onMoving={setMoving} onArrive={onArrive} onSelect={(index)=>{if(index===stop&&!moving)setPanelOpen(true);else goTo(index)}}/><GalleryEffects moving={moving} compact={compact} bright={compact}/></Suspense></Canvas>
    {!ready&&<div className="gallery-loading" role="status"><span/><p>Preparing the private viewing room</p><small>Lighting the gallery and framing the collection…</small></div>}
    {ready&&!started&&<div className="gallery-welcome"><p className="gallery-kicker">A PRIVATE VIEWING</p><h1>Walk into<br/><em>the collection.</em></h1><p>The gallery doors open into a cinematic journey past eight original works.</p><button onClick={()=>{const saved=Number(localStorage.getItem('art-house-gallery-stop'));setStarted(true);setStop(Number.isInteger(saved)&&saved>=0&&saved<artworks.length?saved:0)}}><Play size={18} fill="currentColor"/> Enter the private gallery</button><button className="gallery-quiz-launch" onClick={()=>setQuizOpen(true)}>Find art for my space</button><small>Your place is remembered. Sound stays off until enabled.</small></div>}
    {started&&<><div className="gallery-top-ui"><button className="gallery-wordmark" onClick={()=>{setStarted(false);setStop(-1);setPanelOpen(false)}}>THE ART HOUSE <span>· PRIVATE GALLERY</span></button><div><button aria-label={audio.enabled?'Mute gallery atmosphere':'Enable gallery atmosphere'} onClick={audio.toggle}>{audio.enabled?<Volume2/>:<VolumeX/>}</button><button aria-label={fullscreen?'Exit full screen':'Enter full screen'} onClick={toggleFullscreen}><Maximize2/></button></div></div><div className="gallery-progress" aria-live="polite"><span>{finished?'Tour complete':stop>=0?`Artwork ${Math.min(stop+1,artworks.length)} of ${artworks.length}`:'Entrance'}</span><i><b style={{width:`${finished?100:Math.max(0,((stop+1)/artworks.length)*100)}%`}}/></i><small>{moving?'Walking to the next work…':panelOpen?'Viewing artwork':'Gallery paused'}</small></div>{moving&&active&&<div className="gallery-moving-title"><small>UP NEXT</small><strong>{active.title}</strong></div>}<div className="gallery-journey" aria-label="Eight artwork journey">{artworks.map((art,index)=><button key={art.id} className={index===stop?'active':''} onClick={()=>goTo(index)} aria-label={`Go to artwork ${index+1}: ${art.title}`}><img src={art.image} alt=""/><span>{index+1}</span></button>)}</div><div className="gallery-controls" aria-label="Gallery controls"><button onClick={()=>goTo(stop-1)} disabled={stop<=0||moving} aria-label="Previous artwork"><ArrowLeft/></button><button className="gallery-play" onClick={()=>setPaused(v=>!v)} aria-label={paused?'Resume gallery walk':'Pause gallery walk'}>{paused?<Play fill="currentColor"/>:<Pause fill="currentColor"/>}</button><button onClick={()=>goTo(stop+1)} disabled={moving||finished} aria-label="Next artwork"><ArrowRight/></button></div></>}
    {active&&panelOpen&&!moving&&<aside className={`gallery-art-panel ${stop%2===0?'panel-right':'panel-left'}`} aria-label={`Details for ${active.title}`}><button className="gallery-panel-close" aria-label="Close artwork details and continue" onClick={()=>{setPanelOpen(false);goTo(stop+1)}}><X/></button><p className="gallery-kicker">STOP {String(stop+1).padStart(2,'0')} · {stop%2===0?'LEFT WALL':'RIGHT WALL'}</p><h2>{active.title}</h2><p className="gallery-artist">By {active.artist}</p><p className="gallery-description">{active.description}</p><dl><div><dt>Medium</dt><dd>{active.medium}</dd></div><div><dt>Dimensions</dt><dd>{active.dimensions}</dd></div><div><dt>Price</dt><dd>{currency(active.price)}</dd></div><div><dt>Status</dt><dd className={active.available?'available':''}>{active.available?'Available':'Sold / collected'}</dd></div></dl><div className="gallery-panel-actions">{active.slug?<Link href={`/shop/${active.slug}`}>View artwork</Link>:<Link href="/custom-art">Request similar</Link>}{active.purchasable&&<WishlistButton id={active.id}/>} {active.purchasable&&<CompareAction id={active.id}/>} {active.purchasable&&active.slug&&active.available&&active.price>0&&<AddToCartButton className="gallery-buy" item={{id:active.id,slug:active.slug,title:active.title,price:active.price,image_url:active.image}}/>}</div></aside>}
    {finished&&<div className="gallery-finale"><p className="gallery-kicker">THE WALK IS COMPLETE</p><h2>Eight works.<br/><em>Eight stories.</em></h2><p>Continue into the full collection or take the gallery walk again.</p><div><button onClick={()=>goTo(0)}><RotateCcw/> Walk again</button><Link href="/shop">Explore all paintings <ArrowRight/></Link></div></div>}
    {started&&<div className="gallery-premium-tools"><button title="Day or evening lighting" onClick={()=>setAtmosphere(v=>v==='day'?'evening':'day')}>{atmosphere==='day'?<Sun/>:<Moon/>}</button><button title="Reduced motion accessibility mode" className={accessible?'active':''} onClick={()=>setAccessible(v=>!v)}><Accessibility/></button></div>}
    {active&&panelOpen&&!moving&&<div className="gallery-experience-actions"><button className={curatorEnabled?'active':''} aria-pressed={curatorEnabled} onClick={()=>setCuratorEnabled(value=>!value)}><Mic2/> {curatorEnabled?'Curator on':'Curator'}</button><button onClick={()=>setInspection(true)}><ZoomIn/> Inspect</button><label><ImageUp/> In my room<input type="file" accept="image/*" onChange={event=>{const file=event.target.files?.[0];if(file)setRoomPreview(URL.createObjectURL(file))}}/></label><button onClick={share}><Share2/> Share</button><button onClick={()=>{const next=reactionCount+1;setReactionCount(next);localStorage.setItem(`art-reactions-${active.id}`,String(next))}}><Heart/> {reactionCount}</button><Link href="/contact"><CalendarDays/> Private appointment</Link></div>}
    {inspection&&active&&<div className="gallery-modal" role="dialog" aria-modal="true" aria-label={`Inspect ${active.title}`}><button className="gallery-modal-close" onClick={()=>setInspection(false)}><X/></button><div className="gallery-inspect"><img src={active.image} alt={active.title}/><div><p className="gallery-kicker">HIGH RESOLUTION VIEW</p><h2>{active.title}</h2><p>Move your pointer or pinch to examine the brushwork. The original proportions are preserved.</p><small>{active.medium} · {active.dimensions}</small></div></div></div>}
    {roomPreview&&active&&<div className="gallery-modal" role="dialog" aria-modal="true" aria-label="Preview artwork in your room"><button className="gallery-modal-close" onClick={()=>{URL.revokeObjectURL(roomPreview);setRoomPreview(null)}}><X/></button><div className="gallery-room-preview" style={{backgroundImage:`url(${roomPreview})`}}><img src={active.image} alt={active.title}/><span>Drag-free preview · approximate scale</span></div></div>}
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
      <p className="gallery-kicker">THE ART HOUSE · COLLECTION</p>
      <h2>Explore the paintings</h2>
      <p className="gallery-webgl-message">This browser cannot display the 3D room, but every artwork is ready to view.</p>
      <div className="gallery-webgl-grid">{artworks.map(art=><Link key={art.id} href={art.slug?`/shop/${art.slug}`:'/custom-art'}>
        <img src={art.image} alt={art.title}/><strong>{art.title}</strong><span>{art.slug?'View artwork':'Request something similar'} <ArrowRight size={14}/></span>
      </Link>)}</div>
    </div>
  </div>;
}

function CompareAction({id}:{id:string}){
  const[added,setAdded]=useState(false);
  return <button type="button" className="gallery-compare" onClick={()=>{const current=JSON.parse(localStorage.getItem('art-compare')||'[]') as string[];localStorage.setItem('art-compare',JSON.stringify([...new Set([...current,id])].slice(-3)));setAdded(true)}}><GitCompareArrows size={16}/>{added?'Added':'Compare'}</button>;
}

function ArtMatchQuiz({artworks,onClose,onMatch}:{artworks:GalleryArtwork[];onClose:()=>void;onMatch:(index:number)=>void}){
  const[step,setStep]=useState(0),[score,setScore]=useState(0); const questions=[['What should the room feel like?','Calm & timeless','Bold & joyful'],['Where will it live?','A quiet personal space','A social living space'],['Which detail draws you in?','Fine line and pattern','Colour and character']];
  return <div className="gallery-modal" role="dialog" aria-modal="true"><button className="gallery-modal-close" onClick={onClose}><X/></button><div className="gallery-quiz"><p className="gallery-kicker">PERSONAL ART MATCH · {step+1}/3</p><h2>{questions[step][0]}</h2><button onClick={()=>{if(step===2)onMatch(score%artworks.length);else setStep(step+1)}}>{questions[step][1]}</button><button onClick={()=>{if(step===2)onMatch((score+5)%artworks.length);else{setScore(score+2);setStep(step+1)}}}>{questions[step][2]}</button></div></div>
}
