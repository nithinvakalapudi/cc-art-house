'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';

const walls=[['Warm ivory','#eee8db'],['Sage','#bbc7b2'],['Terracotta','#b97b63'],['Midnight','#263e47']];

export default function ArtworkPreview({image,title,dimensions}:{image:string|null;title:string;dimensions:string|null}){
 const [wall,setWall]=useState(walls[0][1]);const [width,setWidth]=useState(60);const [height,setHeight]=useState(80);
 return <section className="art-preview panel"><p className="craft-eyebrow">PREVIEW IT ON A SAMPLE WALL</p><h2>See how it could look in your space.</h2><p className="muted">Choose a wall colour and adjust the artwork size to explore a simple room preview.</p><div className="room-scene" style={{background:wall}}>{image?<Image width={800} height={800} src={image} alt={`${title} displayed on a sample wall`} style={{width:`${width/240*100}%`,maxHeight:`${height/180*100}%`}}/>:<span>No artwork image available</span>}<div className="room-sofa" aria-hidden="true"><span/><span/></div></div><div className="wall-swatches" role="group" aria-label="Wall colour">{walls.map(([name,colour])=><button key={colour} aria-pressed={wall===colour} onClick={()=>setWall(colour)}><span style={{background:colour}}/>{name}</button>)}</div><details className="size-guide"><summary>Adjust artwork size</summary><p>Listed dimensions: <strong>{dimensions||'Ask the studio to confirm'}</strong>.</p><label className="field">Preview width: {width} cm<input type="range" min="20" max="120" step="5" value={width} onChange={e=>setWidth(Number(e.target.value))}/></label><label className="field">Preview height: {height} cm<input type="range" min="20" max="120" step="5" value={height} onChange={e=>setHeight(Number(e.target.value))}/></label></details><p className="muted">This preview is illustrative. Check the listed dimensions before ordering.</p></section>;
}
