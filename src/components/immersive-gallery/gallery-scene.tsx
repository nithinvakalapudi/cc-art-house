'use client';
/* eslint-disable react-hooks/immutability, react-hooks/purity -- Three.js scenes intentionally mutate renderer, camera and textures frame-by-frame. */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { AdaptiveDpr, ContactShadows, Environment, Html, MeshReflectorMaterial, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { GalleryArtwork } from './immersive-gallery';

type Props = {
  artworks: GalleryArtwork[];
  targetStop: number;
  paused: boolean;
  reducedMotion: boolean;
  mobileQuality?: boolean;
  transitionDuration?: number;
  focusedStop?: number;
  showHotspot?: boolean;
  onReady: () => void;
  onMoving: (moving: boolean) => void;
  onArrive: (index: number) => void;
  onSelect: (index: number) => void;
  atmosphere?: 'day' | 'evening';
};
type Pose = { position: THREE.Vector3; quaternion: THREE.Quaternion };
type Transition = { from: Pose; to: Pose; aisle: THREE.Quaternion; path: THREE.CatmullRomCurve3; elapsed: number; duration: number; target: number; active: boolean };
const Z_STOPS = [4, 0, -4, -8, -12, -16, -20, -24];

function lookPose(position: THREE.Vector3, target: THREE.Vector3): Pose {
  const matrix = new THREE.Matrix4().lookAt(position, target, new THREE.Vector3(0, 1, 0));
  return { position, quaternion: new THREE.Quaternion().setFromRotationMatrix(matrix) };
}
function poseFor(index: number, mobileQuality = false): Pose {
  if (index < 0) return lookPose(new THREE.Vector3(0, 1.72, 8), new THREE.Vector3(0, 1.65, -8));
  if (index >= 8) return lookPose(new THREE.Vector3(0, 2.35, -29), new THREE.Vector3(0, 1.65, -11));
  const left = index % 2 === 0, z = Z_STOPS[index];
  const aisleOffset = mobileQuality ? 1.72 : 1.12;
  return lookPose(new THREE.Vector3(left ? -aisleOffset : aisleOffset, 1.72, z + .22), new THREE.Vector3(left ? -4.73 : 4.73, 1.72, z));
}
function transitionFor(from: Pose, to: Pose, target: number, duration: number): Transition {
  const dz = to.position.z - from.position.z;
  const direction = Math.sign(dz || -1);
  const path = new THREE.CatmullRomCurve3([
    from.position.clone(),
    new THREE.Vector3(0, 1.72, from.position.z + dz * .28),
    new THREE.Vector3(0, 1.72, from.position.z + dz * .72),
    to.position.clone(),
  ], false, 'centripetal', .45);
  const aisle = lookPose(new THREE.Vector3(0, 1.72, 0), new THREE.Vector3(0, 1.68, direction < 0 ? -8 : 8)).quaternion;
  return { from, to, aisle, path, elapsed: 0, duration, target, active: true };
}

export default function GalleryScene({ artworks, targetStop, paused, reducedMotion, mobileQuality = false, transitionDuration = 3.8, focusedStop = -1, showHotspot = false, atmosphere = 'evening', onReady, onMoving, onArrive, onSelect }: Props) {
  const { camera, gl } = useThree();
  const regress = useThree(state => state.performance.regress);
  const startPose = poseFor(-1, mobileQuality);
  const transition = useRef<Transition>(transitionFor(startPose, startPose, -1, 1));
  const lastTarget = useRef(-1), bobTime = useRef(0);

  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = atmosphere === 'day' ? 1.34 : 1.04;
    onReady();
  }, [gl, onReady, atmosphere]);
  useEffect(() => {
    if (targetStop === lastTarget.current) return;
    lastTarget.current = targetStop;
    const from = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
    const duration = reducedMotion ? .05 : targetStop >= artworks.length ? 4.5 : transitionDuration;
    transition.current = transitionFor(from, poseFor(targetStop, mobileQuality), targetStop, duration);
    regress();
    onMoving(true);
  }, [targetStop, camera, reducedMotion, mobileQuality, artworks.length, onMoving, transitionDuration, regress]);

  useFrame((_, delta) => {
    if (paused || !transition.current.active) return;
    const move = transition.current;
    move.elapsed = Math.min(move.duration, move.elapsed + delta);
    const raw = move.elapsed / move.duration;
    const eased = raw < .5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
    camera.position.copy(move.path.getPoint(eased));
    if (raw < .58) camera.quaternion.slerpQuaternions(move.from.quaternion, move.aisle, raw / .58);
    else camera.quaternion.slerpQuaternions(move.aisle, move.to.quaternion, (raw - .58) / .42);
    if (!reducedMotion && raw < .9) {
      bobTime.current += delta * 8;
      camera.position.y += Math.sin(bobTime.current) * .006 * Math.sin(Math.PI * raw);
      camera.rotation.z += Math.sin(bobTime.current * .5) * .0012;
    }
    gl.toneMappingExposure = atmosphere === 'day' ? THREE.MathUtils.lerp(1.16, 1.36, Math.pow(raw, 2)) : THREE.MathUtils.lerp(.92, 1.08, Math.pow(raw, 2));
    if (raw >= 1) {
      move.active = false;
      camera.position.copy(move.to.position);
      camera.quaternion.copy(move.to.quaternion);
      gl.toneMappingExposure = atmosphere === 'day' ? 1.36 : 1.08;
      onArrive(move.target);
    }
  });

  return <>
    <AdaptiveDpr />
    <color attach="background" args={[atmosphere === 'day' ? '#44413c' : '#171716']} />
    <fog attach="fog" args={[atmosphere === 'day' ? '#44413c' : '#171716', 24, 50]} />
    <ambientLight intensity={atmosphere === 'day' ? .52 : .2} color={atmosphere === 'day' ? '#fff4df' : '#ead9be'} />
    <directionalLight castShadow position={[0, 8, 7]} intensity={atmosphere === 'day' ? 2.1 : 1.15} color="#ffe4bd" shadow-mapSize={[1024, 1024]} />
    <Environment preset="apartment" environmentIntensity={.13} />
    <MuseumShell />
    {!reducedMotion && !mobileQuality && <DustMotes />}
    {artworks.map((art, index) => <ArtworkFrame key={art.id} art={art} index={index} showHotspot={showHotspot && focusedStop === index} onSelect={() => onSelect(index)} />)}
    {!mobileQuality && <ContactShadows position={[0, .025, -10]} opacity={.36} scale={42} blur={2.6} far={15} />}
  </>;
}

function DustMotes() {
  const points = useMemo(() => {
    const values = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) { values[i*3]=(Math.random()-.5)*8; values[i*3+1]=.6+Math.random()*4.2; values[i*3+2]=7-Math.random()*34; }
    return values;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame((_, delta) => { if(ref.current) ref.current.rotation.y += delta * .004; });
  return <points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[points,3]} /></bufferGeometry><pointsMaterial color="#f4d7a5" size={.018} transparent opacity={.26} depthWrite={false}/></points>;
}

function MuseumShell() {
  return <group>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10]}><planeGeometry args={[10, 40]} /><MeshReflectorMaterial color="#302b27" roughness={.43} metalness={.16} mirror={.28} resolution={512} blur={[500, 130]} mixBlur={.9} mixStrength={1.05} /></mesh>
    <mesh receiveShadow position={[-5.1, 2.7, -10]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[40, 5.4]} /><meshStandardMaterial color="#d9d0c1" roughness={.9} /></mesh>
    <mesh receiveShadow position={[5.1, 2.7, -10]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[40, 5.4]} /><meshStandardMaterial color="#d9d0c1" roughness={.9} /></mesh>
    <mesh position={[0, 5.4, -10]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[10, 40]} /><meshStandardMaterial color="#2d2927" roughness={.94} /></mesh>
    <Skirting x={-4.98} /><Skirting x={4.98} />
    {Z_STOPS.map((z, index) => <WallBay key={`bay-${z}`} z={z} left={index % 2 === 0} />)}
    {[6, 2, -2, -6, -10, -14, -18, -22, -26].map(z => <CeilingRecess key={z} z={z} />)}
    <Rug z={2} /><Rug z={-8} /><Rug z={-18} />
    <Bench x={2.95} z={-5.8} rotation={-Math.PI / 2} /><Bench x={-2.95} z={-17.8} rotation={Math.PI / 2} />
    {Z_STOPS.map((z, index) => <spotLight key={`light-${z}`} position={[index % 2 === 0 ? -3.5 : 3.5, 4.7, z + .3]} target-position={[index % 2 === 0 ? -5 : 5, 1.7, z]} angle={.38} penumbra={.82} intensity={5.8} distance={8} color="#ffdaa0" castShadow={index < 2} />)}
    <Doorway />
  </group>;
}
function Skirting({ x }: { x: number }) { return <mesh position={[x, .16, -10]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[40, .32, .14]} /><meshStandardMaterial color="#5b3b27" roughness={.58} /></mesh>; }
function WallBay({ z, left }: { z: number; left: boolean }) { return <group position={[left ? -5.01 : 5.01, 1.77, z]} rotation={[0, left ? Math.PI / 2 : -Math.PI / 2, 0]}><mesh position={[0, 0, -.035]}><boxGeometry args={[3.22, 3.55, .08]} /><meshStandardMaterial color={left ? '#6d4930' : '#53443a'} roughness={.72} /></mesh><mesh position={[0, 0, .012]}><boxGeometry args={[2.92, 3.28, .045]} /><meshStandardMaterial color="#c8bdab" roughness={.92} /></mesh></group>; }
function CeilingRecess({ z }: { z: number }) { return <group position={[0, 5.3, z]}><mesh><boxGeometry args={[7.1, .16, 2.65]} /><meshStandardMaterial color="#3c3530" roughness={.82} /></mesh><mesh position={[0, -.095, 0]}><boxGeometry args={[5.9, .035, 1.78]} /><meshStandardMaterial color="#1f1d1b" emissive="#5b4930" emissiveIntensity={.12} /></mesh><pointLight position={[0, -.18, 0]} intensity={.42} distance={6} color="#f3cf96" /></group>; }
function Rug({ z }: { z: number }) { return <mesh position={[0, .046, z - 3.4]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[3.15, 7.2]} /><meshStandardMaterial color="#6f2f2c" roughness={.95} /></mesh>; }
function Bench({ x, z, rotation }: { x: number; z: number; rotation: number }) { return <group position={[x, .47, z]} rotation={[0, rotation, 0]}><mesh castShadow><boxGeometry args={[2.25, .18, .72]} /><meshStandardMaterial color="#795438" roughness={.56} /></mesh><mesh position={[-.86, -.37, 0]}><boxGeometry args={[.12, .7, .56]} /><meshStandardMaterial color="#272321" metalness={.5} /></mesh><mesh position={[.86, -.37, 0]}><boxGeometry args={[.12, .7, .56]} /><meshStandardMaterial color="#272321" metalness={.5} /></mesh></group>; }
function Doorway() { return <group position={[0, 2.45, -29.2]}><mesh position={[-2.35, 0, 0]}><boxGeometry args={[.48, 4.9, .45]} /><meshStandardMaterial color="#8b6a42" metalness={.28} /></mesh><mesh position={[2.35, 0, 0]}><boxGeometry args={[.48, 4.9, .45]} /><meshStandardMaterial color="#8b6a42" metalness={.28} /></mesh><mesh position={[0, 2.22, 0]}><boxGeometry args={[5.15, .48, .45]} /><meshStandardMaterial color="#8b6a42" metalness={.28} /></mesh><Text position={[0, 1.5, .25]} color="#d8b779" fontSize={.28} letterSpacing={.16} anchorX="center">THE ART HOUSE</Text></group>; }

const frameStyles = [
  { frame: '#6a3f21', trim: '#c19a55', metal: .22 }, { frame: '#24211f', trim: '#aeb1ae', metal: .55 },
  { frame: '#7b5839', trim: '#d2b276', metal: .18 }, { frame: '#40342d', trim: '#b6864e', metal: .4 },
];
function ArtworkFrame({ art, index, showHotspot, onSelect }: { art: GalleryArtwork; index: number; showHotspot: boolean; onSelect: () => void }) {
  const { gl } = useThree();
  const texture = useLoader(THREE.TextureLoader, art.image);
  const source = texture.image as { width?: number; height?: number } | undefined;
  const aspect = source?.width && source?.height ? source.width / source.height : .82;
  const maxW = 2.32, maxH = 2.68;
  const artW = aspect >= maxW / maxH ? maxW : maxH * aspect;
  const artH = aspect >= maxW / maxH ? maxW / aspect : maxH;
  const frameW = artW + .34, frameH = artH + .34;
  const left = index % 2 === 0, x = left ? -4.86 : 4.86, z = Z_STOPS[index];
  const rotation: [number, number, number] = [0, left ? Math.PI / 2 : -Math.PI / 2, 0];
  const style = frameStyles[index % frameStyles.length];
  useEffect(() => { texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy()); texture.needsUpdate = true; }, [texture, gl]);
  return <group position={[x, 1.78, z]} rotation={rotation} onClick={event => { event.stopPropagation(); onSelect(); }}>
    <mesh castShadow position={[0, 0, -.095]}><boxGeometry args={[frameW + .18, frameH + .18, .2]} /><meshStandardMaterial color={style.frame} roughness={.38} metalness={style.metal} /></mesh>
    <mesh castShadow position={[0, 0, .015]}><boxGeometry args={[frameW, frameH, .085]} /><meshStandardMaterial color={style.trim} roughness={.26} metalness={.58} emissive={style.trim} emissiveIntensity={.035} /></mesh>
    <mesh position={[0, 0, .07]}><boxGeometry args={[artW + .08, artH + .08, .085]} /><meshStandardMaterial color="#e8dfcf" roughness={.88} /></mesh>
    <mesh position={[0, 0, .125]}><planeGeometry args={[artW, artH]} /><meshStandardMaterial map={texture} roughness={.66} /></mesh>
    <mesh position={[0, 0, .139]} renderOrder={3}><planeGeometry args={[artW, artH]} /><meshPhysicalMaterial color="#ffffff" transparent opacity={.055} roughness={.08} metalness={.05} depthWrite={false} /></mesh>
    <MuseumPlaque art={art} x={frameW / 2 + .48} y={-frameH / 2 + .18} />
    {showHotspot && <Html position={[0, -frameH / 2 - .32, .2]} center transform distanceFactor={4}><button className="gallery-frame-hotspot" onClick={event => { event.stopPropagation(); onSelect(); }}>View details</button></Html>}
  </group>;
}
function MuseumPlaque({ art, x, y }: { art: GalleryArtwork; x: number; y: number }) { return <group position={[x, y, .075]}><mesh><boxGeometry args={[.62, .36, .045]} /><meshStandardMaterial color="#9b7744" metalness={.72} roughness={.25} emissive="#5c4223" emissiveIntensity={.08} /></mesh><Text position={[0, .055, .03]} color="#fff3d8" fontSize={.055} maxWidth={.52} textAlign="center" anchorX="center">{art.title.toUpperCase()}</Text><Text position={[0, -.07, .03]} color="#e9d8b8" fontSize={.04} maxWidth={.5} textAlign="center" anchorX="center">{art.available ? 'AVAILABLE' : 'COLLECTED'}</Text></group>; }
