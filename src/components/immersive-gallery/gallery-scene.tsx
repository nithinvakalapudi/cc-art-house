'use client';
/* eslint-disable react-hooks/immutability, react-hooks/purity -- Three.js scenes intentionally mutate renderer, camera and textures frame-by-frame. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import type { GalleryArtwork } from './immersive-gallery';

export type WalkInput = { keys: Set<string>; x: number; z: number; yaw: number; pitch: number };

type Props = {
  manual?: boolean;
  walkInput?: WalkInput;
  artworks: GalleryArtwork[];
  targetStop: number;
  wallDetails?: boolean;
  focusWallText?: boolean;
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
const Z_STOPS = [4, 4, -4, -4, -12, -12, -20, -20];

function lookPose(position: THREE.Vector3, target: THREE.Vector3): Pose {
  const matrix = new THREE.Matrix4().lookAt(position, target, new THREE.Vector3(0, 1, 0));
  return { position, quaternion: new THREE.Quaternion().setFromRotationMatrix(matrix) };
}
function poseFor(index: number, mobileQuality = false, wallDetails = false, focusWallText = false): Pose {
  if (index < 0) return lookPose(new THREE.Vector3(0, 1.72, 9), new THREE.Vector3(0, 3.25, -8));
  if (index >= 8) return lookPose(new THREE.Vector3(0, 1.72, mobileQuality ? -18.5 : -21.5), new THREE.Vector3(0, 2.55, -28.8));
  const left = index % 2 === 0, z = Z_STOPS[index];
  if (wallDetails) {
    const direction = left ? 1 : -1;
    const offset = mobileQuality ? (focusWallText ? 2.8 : 0) : 1.4;
    const distance = mobileQuality ? 0 : -.95;
    return lookPose(new THREE.Vector3(left ? distance : -distance, 1.77, z + direction * offset), new THREE.Vector3(left ? -4.73 : 4.73, 1.77, z + direction * offset));
  }
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

export default function GalleryScene({ manual = false, walkInput, artworks, targetStop, wallDetails = false, focusWallText = false, paused, reducedMotion, mobileQuality = false, transitionDuration = 3.8, focusedStop = -1, showHotspot = false, atmosphere = 'evening', onReady, onMoving, onArrive, onSelect }: Props) {
  const { camera, gl } = useThree();
  const regress = useThree(state => state.performance.regress);
  const startPose = poseFor(-1, mobileQuality);
  const transition = useRef<Transition>(transitionFor(startPose, startPose, -1, 1));
  const lastTarget = useRef(-2);
  const lastWallFocus = useRef(false);
  const velocity = useRef(new THREE.Vector2());
  const look = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));

  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = atmosphere === 'day' ? 1.34 : 1.04;
    onReady();
  }, [gl, onReady, atmosphere]);
  useEffect(() => {
    if (manual) {
      lastTarget.current = -2;
      return;
    }
    if (targetStop === lastTarget.current && focusWallText === lastWallFocus.current) return;
    lastWallFocus.current = focusWallText;
    lastTarget.current = targetStop;
    const from = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
    const duration = reducedMotion ? .05 : targetStop >= artworks.length ? 4.5 : transitionDuration;
    transition.current = transitionFor(from, poseFor(targetStop, mobileQuality, wallDetails, focusWallText), targetStop, duration);
    regress();
    onMoving(true);
  }, [manual, targetStop, wallDetails, focusWallText, camera, reducedMotion, mobileQuality, artworks.length, onMoving, transitionDuration, regress]);

  useFrame((_, delta) => {
    if (manual && walkInput) {
      if (paused) {
        velocity.current.set(0, 0);
        return;
      }
      const step = Math.min(delta, .05);
      const { keys, x, z, yaw, pitch } = walkInput;
      look.current.setFromQuaternion(camera.quaternion);
      look.current.y -= yaw;
      look.current.x = THREE.MathUtils.clamp(look.current.x - pitch, -.85, .85);
      look.current.z = 0;
      camera.quaternion.setFromEuler(look.current);
      walkInput.yaw = walkInput.pitch = 0;
      const side = x + Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
      const forward = z + Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
      const speed = 2 / Math.max(1, Math.hypot(side, forward));
      const angle = look.current.y;
      const blend = 1 - Math.exp(-9 * step);
      velocity.current.x = THREE.MathUtils.lerp(velocity.current.x, (side * Math.cos(angle) + forward * Math.sin(angle)) * speed, blend);
      velocity.current.y = THREE.MathUtils.lerp(velocity.current.y, (forward * Math.cos(angle) - side * Math.sin(angle)) * speed, blend);
      camera.position.x = THREE.MathUtils.clamp(camera.position.x + velocity.current.x * step, -2.35, 2.35);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + velocity.current.y * step, -27.4, 9);
      camera.position.y = 1.72;
      return;
    }
    if (paused || !transition.current.active) return;
    const move = transition.current;
    move.elapsed = Math.min(move.duration, move.elapsed + Math.min(delta, .05));
    const raw = move.elapsed / move.duration;
    // Follow distance along the curve so uneven control point spacing cannot change walking speed.
    const eased = THREE.MathUtils.smootherstep(raw, 0, 1);
    camera.position.copy(move.path.getPointAt(eased));
    if (raw < .58) {
      const turn = THREE.MathUtils.smootherstep(raw, 0, .58);
      camera.quaternion.slerpQuaternions(move.from.quaternion, move.aisle, turn);
    } else {
      const turn = THREE.MathUtils.smootherstep(raw, .58, 1);
      camera.quaternion.slerpQuaternions(move.aisle, move.to.quaternion, turn);
    }
    if (raw >= 1) {
      move.active = false;
      camera.position.copy(move.to.position);
      camera.quaternion.copy(move.to.quaternion);
      onArrive(move.target);
    }
  });

  return <>
    <color attach="background" args={[atmosphere === 'day' ? '#44413c' : '#171716']} />
    <fog attach="fog" args={[atmosphere === 'day' ? '#44413c' : '#171716', 38, 65]} />
    <hemisphereLight args={["#c1d3ec", "#554135", .34]} />
    <ambientLight intensity={atmosphere === 'day' ? .30 : .14} color={atmosphere === 'day' ? '#fff4df' : '#ead9be'} />
    <directionalLight castShadow position={[0, 8, 7]} intensity={atmosphere === 'day' ? 1.65 : .95} color="#ffe4bd" shadow-mapSize={[1024, 1024]} />
    <MuseumShell mobileQuality={mobileQuality} />
    {!reducedMotion && !mobileQuality && <DustMotes />}
    {wallDetails && artworks[targetStop] && <ArtworkWallText art={artworks[targetStop]} index={targetStop} />}
    {artworks.map((art, index) => <ArtworkFrame key={art.id} art={art} index={index} highlighted={targetStop === index} showHotspot={showHotspot && focusedStop === index} onSelect={() => onSelect(index)} />)}
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

function useMarble(light = false) {
  const [texture, setTexture] = useState<THREE.CanvasTexture>();
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 384;
    const context = canvas.getContext('2d');
    if (!context) return;
    const pixels = context.createImageData(384, 384);
    for (let y = 0; y < 384; y++) {
      for (let x = 0; x < 384; x++) {
        const u = x / 384 * Math.PI * 2;
        const v = y / 384 * Math.PI * 2;
        const warp = Math.sin(v + Math.sin(u * 2)) + .35 * Math.sin(u * 7 - v * 4);
        const grain = .13 * Math.sin(19 * u + 11 * v) + .06 * Math.sin(43 * v - 17 * u);
        const seam = Math.abs(Math.sin(u * 2 + v + warp + grain));
        const vein = Math.pow(1 - seam, 35) * (.4 + .6 * Math.sin(u - 2 * v) ** 2);
        const cloud = Math.sin(u + v * 2 + warp) * 10;
        const shade = light ? 209 + cloud - vein * 62 : 38 + cloud + vein * 87;
        const index = (y * 384 + x) * 4;
        pixels.data.set([shade + 4, shade + 1, shade, 255], index);
      }
    }
    context.putImageData(pixels, 0, 0);
    const marble = new THREE.CanvasTexture(canvas);
    marble.colorSpace = THREE.SRGBColorSpace;
    marble.wrapS = marble.wrapT = THREE.RepeatWrapping;
    marble.repeat.set(2, light ? 1 : 8);
    setTexture(marble);
    return () => marble.dispose();
  }, [light]);
  return texture;
}

function MuseumShell({ mobileQuality }: { mobileQuality: boolean }) {
  const marble = useMarble();
  return <group>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10]}><planeGeometry args={[10, 40]} /><MeshReflectorMaterial key={marble?.uuid ?? "untextured"} map={marble} color="#ffffff" roughness={.36} metalness={.04} mirror={.26} resolution={mobileQuality ? 128 : 512} blur={[500, 130]} mixBlur={.9} mixStrength={.85} /></mesh>
    <mesh receiveShadow position={[-5.1, 2.7, -10]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[40, 5.4]} /><meshStandardMaterial color="#171e2b" roughness={.9} /></mesh>
    <mesh receiveShadow position={[5.1, 2.7, -10]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[40, 5.4]} /><meshStandardMaterial color="#171e2b" roughness={.9} /></mesh>
    {[{ z: -15.3, length: 29.4 }, { z: 7.3, length: 5.4 }].map(({ z, length }) => (
      <mesh key={z} position={[0, 5.4, z]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10.2, length]} />
        <meshStandardMaterial color="#16181d" roughness={.94} />
      </mesh>
    ))}
    <mesh position={[0, 5.4, 2]} rotation={[Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[skylightSurround]} />
      <meshStandardMaterial color="#16181d" roughness={.94} />
    </mesh>
    {Array.from({ length: 13 }, (_, index) => (
      <mesh key={index} position={[0, .004, 8 - index * 3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, .014]} />
        <meshStandardMaterial color="#211f24" roughness={.66} />
      </mesh>
    ))}
    <Skirting x={-4.98} /><Skirting x={4.98} />
    {Z_STOPS.map((z, index) => <WallBay key={index} z={z} left={index % 2 === 0} />)}
    {[6, -2, -6, -10, -14, -18, -22, -26].map(z => <CeilingRecess key={z} z={z} />)}
    <Rug />
    <Skylight />
    {[6, -2, -10, -18, -26].map(z => (
      <group key={z} position={[0, 3.7, z]} scale={[1, .33, 1]}>
        <mesh>
          <torusGeometry args={[4.88, .17, 8, 48, Math.PI]} />
          <meshStandardMaterial color="#171e2b" roughness={.55} />
        </mesh>
        {[-.15, .15].map(offset => (
          <mesh key={offset} position={[0, 0, offset]}>
            <torusGeometry args={[4.84, .036, 6, 48, Math.PI]} />
            <meshStandardMaterial color="#c89241" metalness={.62} roughness={.36} emissive="#a76426" emissiveIntensity={.25} />
          </mesh>
        ))}
      </group>
    ))}
    {[-3.65, 3.65].map(x => (
      <mesh key={x} position={[x, 5.16, -10]}>
        <boxGeometry args={[.035, .035, 38]} />
        <meshBasicMaterial color="#ffd28b" toneMapped={false} />
      </mesh>
    ))}
    <Bench x={2.95} z={-25.5} rotation={-Math.PI / 2} /><Bench x={-2.95} z={-25.5} rotation={Math.PI / 2} />
    {Z_STOPS.map((z, index) => <spotLight key={index} position={[index % 2 === 0 ? -3.5 : 3.5, 4.7, z + .3]} target-position={[index % 2 === 0 ? -5 : 5, 1.7, z]} angle={.38} penumbra={.82} intensity={5.8} distance={8} color="#ffdaa0" castShadow={index < 2} />)}
    {[-4.1, 0, 4.1].map(x => (
      <group key={x} position={[x, 5.17, 8.1]}>
        <mesh>
          <cylinderGeometry args={[.15, .15, .045, 24]} />
          <meshStandardMaterial color="#b58748" metalness={.66} roughness={.32} />
        </mesh>
        <mesh position={[0, -.028, 0]}>
          <cylinderGeometry args={[.108, .108, .022, 24]} />
          <meshBasicMaterial color="#ffe1b2" toneMapped={false} />
        </mesh>
      </group>
    ))}
    <EntranceWall />
    <Doorway />
    {[-1, 1].map(side => (
      <group key={side}>
        <MarbleColumn x={side * 2.82} />
        <Planter x={side * 4.05} z={-26.3} scale={side < 0 ? 1.35 : 1.24} />
        <Planter x={side * 4.27} z={7.4} />
      </group>
    ))}
  </group>;
}
function Skirting({ x }: { x: number }) { return <mesh position={[x, .16, -10]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[40, .32, .14]} /><meshStandardMaterial color="#ad782d" roughness={.58} /></mesh>; }
function GiltBorder({ width, height, depth = .035 }: { width: number; height: number; depth?: number }) {
  return <group>
    {[-1, 1].map(side => (
      <group key={side}>
        <mesh position={[0, side * height / 2, 0]}>
          <boxGeometry args={[width + depth, depth, depth]} />
          <meshStandardMaterial color="#d4a256" metalness={.66} roughness={.31} emissive="#a96828" emissiveIntensity={.18} />
        </mesh>
        <mesh position={[side * width / 2, 0, 0]}>
          <boxGeometry args={[depth, height, depth]} />
          <meshStandardMaterial color="#d4a256" metalness={.66} roughness={.31} emissive="#a96828" emissiveIntensity={.18} />
        </mesh>
      </group>
    ))}
  </group>;
}

function WallBay({ z, left }: { z: number; left: boolean }) { return <group position={[left ? -5.01 : 5.01, 1.77, z]} rotation={[0, left ? Math.PI / 2 : -Math.PI / 2, 0]}><mesh position={[0, 0, -.035]}><boxGeometry args={[3.22, 3.55, .08]} /><meshStandardMaterial color={"#9b7338"} roughness={.72} /></mesh><mesh position={[0, 0, .012]}><boxGeometry args={[2.92, 3.28, .045]} /><meshStandardMaterial color="#202735" roughness={.92} /></mesh>
    <group position={[0,.36,.045]}><GiltBorder width={3.65} height={4.08} /><GiltBorder width={3.51} height={3.94} depth={.018} /></group>
    <group position={[0,-1.32,.045]}><GiltBorder width={3.3} height={.61} depth={.022} /></group>
  </group>; }
function CeilingRecess({ z }: { z: number }) { return <group position={[0, 5.3, z]}><mesh><boxGeometry args={[7.1, .16, 2.65]} /><meshStandardMaterial color="#3c3530" roughness={.82} /></mesh><mesh position={[0, -.095, 0]}><boxGeometry args={[5.9, .035, 1.78]} /><meshStandardMaterial color="#1f1d1b" emissive="#5b4930" emissiveIntensity={.12} /></mesh><group position={[0,-.13,0]} rotation={[Math.PI / 2,0,0]}>
      <GiltBorder width={7.05} height={2.61} />
      <GiltBorder width={5.94} height={1.82} depth={.021} />
    </group><pointLight position={[0, -.18, 0]} intensity={.42} distance={6} color="#f3cf96" /></group>; }
function useEntranceTexture(kind: 'sky' | 'carpet') {
  const [texture, setTexture] = useState<THREE.CanvasTexture>();
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = kind === 'sky' ? 512 : 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    const pixels = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const offset = (y * size + x) * 4;
        if (kind === 'sky') {
          const u = x / size * 2 * Math.PI;
          const v = y / size * 2 * Math.PI;
          const field = Math.sin(u * 3 + Math.sin(v * 2)) + .65 * Math.sin(v * 5 + u * 2)
            + .32 * Math.sin(u * 13 - v * 8) + .15 * Math.sin(u * 31 + v * 19);
          const cloud = THREE.MathUtils.smoothstep(field, .56, 1.55);
          pixels.data.set([60 + 183 * cloud, 141 + 108 * cloud, 218 + 37 * cloud, 255], offset);
        } else {
          const fiber = ((x * 137 + y * 149 + x * y * 17) % 31) / 31;
          const weave = (x + y) % 2;
          pixels.data.set([99 + 36 * fiber + 12 * weave, 12 + 8 * fiber, 29 + 10 * fiber, 255], offset);
        }
      }
    }
    ctx.putImageData(pixels, 0, 0);
    const surface = new THREE.CanvasTexture(canvas);
    surface.colorSpace = THREE.SRGBColorSpace;
    if (kind === 'carpet') {
      surface.wrapS = surface.wrapT = THREE.RepeatWrapping;
      surface.repeat.set(5, 58);
    }
    setTexture(surface);
    return () => surface.dispose();
  }, [kind]);
  return texture;
}

function Rug() {
  const weave = useEntranceTexture('carpet');
  return <group position={[0, .046, -10]} rotation={[-Math.PI / 2, 0, 0]}>
    <mesh><planeGeometry args={[3.2, 38]} /><meshStandardMaterial key={weave?.uuid} map={weave} color={weave ? "#ffffff" : "#760d24"} roughness={.98} /></mesh>
    {[-1.49, -1.4, 1.4, 1.49].map(x => (
      <mesh key={x} position={[x, 0, .003]}>
        <planeGeometry args={[.025, 38]} />
        <meshStandardMaterial color="#d7a654" roughness={.72} />
      </mesh>
    ))}
  </group>;
}

const skylightSurround = new THREE.Shape()
  .moveTo(-5.1, -2.6).lineTo(5.1, -2.6).lineTo(5.1, 2.6).lineTo(-5.1, 2.6).closePath();
const skylightOpening = new THREE.Path();
skylightOpening.absellipse(0, 0, 3.15, 2.15, 0, Math.PI * 2, true, 0);
skylightSurround.holes.push(skylightOpening);

function Skylight() {
  const sky = useEntranceTexture('sky');
  const ribs = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const angle = index * Math.PI / 6;
    const points = Array.from({ length: 13 }, (_, step) => {
      const arc = step * Math.PI / 24;
      return new THREE.Vector3(3.15 * Math.sin(arc) * Math.cos(angle), .96 * Math.cos(arc), 2.15 * Math.sin(arc) * Math.sin(angle));
    });
    return new THREE.CatmullRomCurve3(points);
  }), []);
  return <group position={[0, 5.4, 2]}>
    <mesh scale={[3.15, .96, 2.15]}>
      <sphereGeometry args={[1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshBasicMaterial key={sky?.uuid} map={sky} color={sky ? "#ffffff" : "#5298cd"} side={THREE.BackSide} toneMapped={false} />
    </mesh>
    {ribs.map((rib, index) => (
      <mesh key={index}>
        <tubeGeometry args={[rib, 16, .028, 6, false]} />
        <meshStandardMaterial color="#b98742" metalness={.65} roughness={.36} />
      </mesh>
    ))}
    {[1, .94, .67, .27].map(radius => (
      <mesh key={radius} position={[0, radius > .9 ? -.025 : .94 * Math.sqrt(1 - radius ** 2), 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[3.15, 2.15, 1]}>
        <torusGeometry args={[radius, radius === 1 ? .036 : .012, 8, 64]} />
        <meshStandardMaterial color="#d3a250" metalness={.55} roughness={.3} emissive="#855421" emissiveIntensity={.24} />
      </mesh>
    ))}
    <mesh position={[0, -.036, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[3.15, 2.15, 1]}>
      <torusGeometry args={[.975, .014, 8, 96]} />
      <meshBasicMaterial color="#ffca85" toneMapped={false} />
    </mesh>
    <mesh position={[0, .91, 0]}>
      <cylinderGeometry args={[.23, .32, .09, 24]} />
      <meshStandardMaterial color="#c1934d" metalness={.55} roughness={.3} />
    </mesh>
    <pointLight position={[0, -.8, 0]} color="#99caff" intensity={13} distance={12} />
  </group>;
}
function Bench({ x, z, rotation }: { x: number; z: number; rotation: number }) { return <group position={[x, .47, z]} rotation={[0, rotation, 0]}><mesh castShadow><boxGeometry args={[2.25, .18, .72]} /><meshStandardMaterial color="#e2d3b9" roughness={.56} /></mesh><mesh position={[-.86, -.37, 0]}><boxGeometry args={[.12, .7, .56]} /><meshStandardMaterial color="#9f702f" metalness={.5} /></mesh><mesh position={[.86, -.37, 0]}><boxGeometry args={[.12, .7, .56]} /><meshStandardMaterial color="#9f702f" metalness={.5} /></mesh></group>; }
function MarbleColumn({ x }: { x: number }) {
  const marble = useMarble(true);
  return <group position={[x, 0, -28.15]}>
    <mesh position={[0, 2.62, 0]}>
      <cylinderGeometry args={[.17, .23, 4.85, 18]} />
      <meshStandardMaterial key={marble?.uuid ?? "untextured"} map={marble} color="#ede5df" roughness={.28} />
    </mesh>
    {Array.from({ length: 12 }, (_, index) => {
      const angle = index * Math.PI / 6;
      return <mesh key={index} position={[Math.cos(angle) * .174, 2.62, Math.sin(angle) * .174]}>
        <cylinderGeometry args={[.013, .025, 4.55, 6]} />
        <meshStandardMaterial color="#dad2c7" roughness={.36} />
      </mesh>;
    })}
    {Array.from({ length: 12 }, (_, index) => {
      const angle = index * Math.PI / 6;
      return <group key={index} position={[0, 4.87, 0]} rotation={[0, angle, 0]}>
        <mesh position={[0, -.12, .215]} rotation={[-.36, 0, 0]} scale={[.048, .18, .045]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#bd8a43" metalness={.63} roughness={.34} />
        </mesh>
        <mesh position={[0, .035, .263]}>
          <torusGeometry args={[.041, .013, 6, 14]} />
          <meshStandardMaterial color="#d2a356" metalness={.62} roughness={.3} />
        </mesh>
      </group>;
    })}
    <mesh position={[0, 5.24, 0]}>
      <boxGeometry args={[.72, .105, .72]} />
      <meshStandardMaterial color="#b48746" metalness={.64} roughness={.35} />
    </mesh>
    {[.18, .32, 5.03, 5.15].map(y => (
      <mesh key={y} position={[0, y, 0]}>
        <cylinderGeometry args={[.31, .34, .18, 20]} />
        <meshStandardMaterial color="#b58a46" metalness={.55} roughness={.32} />
      </mesh>
    ))}
  </group>;
}

const figBranches = [
  { angle: .2, height: 1.51, spread: .28 },
  { angle: 2.4, height: 1.36, spread: .39 },
  { angle: 4.7, height: 1.2, spread: .43 },
  { angle: 1.5, height: 1.06, spread: .37 },
  { angle: 3.6, height: 1.27, spread: .36 },
  { angle: 5.8, height: 1.42, spread: .33 },
];

function FigLeaf({ length, variant }: { length: number; variant: number }) {
  const geometry = useMemo(() => {
    const leaf = new THREE.PlaneGeometry(1, 1, 24, 48);
    const positions = leaf.attributes.position;
    const colors = [];
    const green = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const t = (positions.getY(i) + .5);
      const side = positions.getX(i) * 2;
      const taper = Math.pow(Math.max(.001, Math.sin(Math.PI * t)), .65);
      const waist = .80 + .13 * Math.cos((t - .69) * Math.PI * 3);
      const ripple = 1 + .026 * Math.sin(t * 26 + variant + side * 2);
      positions.setXYZ(i, side * taper * waist * ripple * .32 + .035 * Math.sin(t * 4 + variant) * t,
        t, .48 * t - .58 * t * t + .095 * side * side * taper + .007 * Math.sin(t * 26) * side ** 4);
      const sideDistance = Math.abs(side);
      const secondary = Math.pow(Math.max(0, Math.cos((t - .19 * sideDistance ** .72) * 67)), 20);
      const midrib = Math.exp(-sideDistance * 38);
      const mottling = .01 * Math.sin(t * 28 + side * 8 + variant) + .006 * Math.sin(t * 49 - side * 17);
      green.setHSL(.249 + variant * .009 - midrib * .045, .56, .15 + .085 * t + .052 * secondary + .14 * midrib + mottling);
      colors.push(green.r, green.g, green.b);
    }
    leaf.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    leaf.computeVertexNormals();
    return leaf;
  }, [variant]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return <group>
    <mesh position={[0, .043, 0]}>
      <cylinderGeometry args={[.005, .008, .086, 6]} />
      <meshStandardMaterial color="#677b38" roughness={.73} />
    </mesh>
    <mesh position={[0, .083, 0]} geometry={geometry} scale={length} castShadow receiveShadow>
      <meshPhysicalMaterial vertexColors side={THREE.DoubleSide} roughness={.54} clearcoat={.12} clearcoatRoughness={.64} />
    </mesh>
  </group>;
}

function Planter({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  const marble = useMarble();
  return <group position={[x, 0, z]} scale={scale} rotation={[0, x * .32 + z * .19, 0]}>
    <mesh position={[0, .29, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[.29, .27, .56, 32]} />
      <meshStandardMaterial key={marble?.uuid} map={marble} color={marble ? '#d2a36e' : '#25211e'} roughness={.43} />
    </mesh>
    {[.035, .558].map(y => (
      <mesh key={y} position={[0, y, 0]}>
        <cylinderGeometry args={[.296, .296, .048, 32, 1, true]} />
        <meshStandardMaterial color="#bf904d" metalness={.68} roughness={.35} side={THREE.DoubleSide} />
      </mesh>
    ))}
    <mesh position={[0, .575, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[.285, 28]} />
      <meshStandardMaterial color="#30251d" roughness={1} />
    </mesh>
    {Array.from({ length: 9 }, (_, index) => (
      <mesh key={index} position={[Math.cos(index * 2.4) * .21, .58, Math.sin(index * 2.4) * .21]} scale={[.038, .02, .03]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={index % 2 ? '#514b43' : '#756c5f'} roughness={.92} />
      </mesh>
    ))}
    <mesh position={[0, 1, 0]} rotation={[0, 0, -.07]}>
      <cylinderGeometry args={[.024, .046, .9, 10]} />
      <meshStandardMaterial color="#60452e" roughness={.94} />
    </mesh>
    {figBranches.map(({ angle, height, spread }, branch) => (
      <group key={angle} rotation={[0, angle + .14 * Math.sin(branch + x + z), 0]}>
        <mesh position={[spread / 2, height - .18, 0]} rotation={[0, 0, -Math.atan2(spread, .36)]}>
          <cylinderGeometry args={[.009, .023, Math.hypot(spread, .36), 8]} />
          <meshStandardMaterial color="#645034" roughness={.9} />
        </mesh>
        {[0, 1, 2].map(leaf => (
          <group key={leaf} position={[spread * (leaf / 2), height - .36 + leaf * .18, 0]}
            rotation={[.33 + leaf * .32, leaf * .72 - .38, -.87 + leaf * .28]}>
            <FigLeaf length={.42 + .055 * ((branch + leaf * 2) % 4) + .035 * Math.sin(x + z + branch * 2 + leaf)} variant={(branch + leaf) % 4} />
          </group>
        ))}
      </group>
    ))}
  </group>;
}

function EntranceWall() {
  return <group position={[0, 0, 9.96]} rotation={[0, Math.PI, 0]}>
    <mesh position={[0, 2.7, -.08]} receiveShadow>
      <boxGeometry args={[10.2, 5.4, .16]} />
      <meshStandardMaterial color="#171e2b" roughness={.85} />
    </mesh>
    <mesh position={[0, 1.55, .06]}>
      <boxGeometry args={[3.1, 3.1, .12]} />
      <meshStandardMaterial color="#302024" roughness={.64} />
    </mesh>
    {[1.55, 1.66, 1.79].map((radius, index) => (
      <group key={radius} position={[0, 3.08, .22 + index * .04]}>
        <mesh scale={[1, .74, 1]}>
          <torusGeometry args={[radius, index === 1 ? .06 : .035, 10, 64, Math.PI]} />
          <meshStandardMaterial color="#c39754" metalness={.64} roughness={.37} emissive="#a95e24" emissiveIntensity={.19} />
        </mesh>
        {[-1, 1].map(side => (
          <mesh key={side} position={[side * radius, -1.51, 0]}>
            <boxGeometry args={[index === 1 ? .12 : .065, 3.04, .13]} />
            <meshStandardMaterial color="#a6773b" metalness={.58} roughness={.4} />
          </mesh>
        ))}
      </group>
    ))}
    {[-1, 1].map(side => (
      <group key={side} position={[side * .77, 0, .17]}>
        <group position={[0, 2.12, 0]}><GiltBorder width={1.16} height={1.52} depth={.025} /></group>
        <group position={[0, .68, 0]}><GiltBorder width={1.16} height={.92} depth={.025} /></group>
        <mesh position={[-side * .55, 1.38, .09]}>
          <sphereGeometry args={[.058, 16, 12]} />
          <meshStandardMaterial color="#d8ae68" metalness={.68} roughness={.29} />
        </mesh>
      </group>
    ))}
    <group position={[0, 1.56, .31]}>
      <GiltBorder width={3.22} height={3.13} depth={.055} />
      <GiltBorder width={3.04} height={2.97} depth={.024} />
    </group>
    <mesh position={[0, 3.15, .29]}>
      <boxGeometry args={[3.48, .16, .32]} />
      <meshStandardMaterial color="#866038" metalness={.55} roughness={.32} />
    </mesh>
    <pointLight position={[0, 3.92, .72]} color="#ffd6a2" intensity={4.2} distance={4.3} />
    {[-1, 1].map(side => (
      <group key={side} position={[side * 3.28, 2.65, .08]}>
        <GiltBorder width={2.28} height={4.38} />
        <GiltBorder width={2.15} height={4.23} depth={.018} />
        <mesh position={[0, .26, .17]}>
          <cylinderGeometry args={[.105, .105, .48, 20]} />
          <meshBasicMaterial color="#ffce8a" toneMapped={false} />
        </mesh>
        {[.005, .515].map(y => (
          <mesh key={y} position={[0, y, .17]}>
            <cylinderGeometry args={[.132, .132, .06, 24]} />
            <meshStandardMaterial color="#ba8747" metalness={.7} roughness={.3} />
          </mesh>
        ))}
        {Array.from({ length: 10 }, (_, index) => {
          const angle = index * Math.PI / 5;
          return <mesh key={index} position={[Math.cos(angle) * .109, .26, .17 + Math.sin(angle) * .109]}>
            <cylinderGeometry args={[.008, .008, .48, 6]} />
            <meshStandardMaterial color="#d9ad66" metalness={.6} roughness={.32} />
          </mesh>;
        })}
        <pointLight position={[0, .26, .46]} color="#ffbe76" intensity={2.1} distance={3.8} />
      </group>
    ))}
    <mesh position={[0, .16, .12]}>
      <boxGeometry args={[10.2, .3, .2]} />
      <meshStandardMaterial color="#956429" metalness={.5} roughness={.42} />
    </mesh>
  </group>;
}

function Doorway() {
  return <group position={[0, 0, -28.8]}>
    <mesh position={[0, 2.7, -.25]}>
      <boxGeometry args={[10.2, 5.4, .3]} />
      <meshStandardMaterial color="#15181e" roughness={.85} />
    </mesh>
    {[1.97, 2.09, 2.24].map((radius, index) => (
      <group key={radius}>
        <mesh position={[0, 2.72, 0]}>
          <torusGeometry args={[radius, .045, 8, 48, Math.PI]} />
          <meshStandardMaterial color="#c89241" emissive="#ffaa40" emissiveIntensity={index === 1 ? 1.7 : .25} metalness={.6} roughness={.36} />
        </mesh>
        {[-radius, radius].map(x => (
          <mesh key={x} position={[x, 1.36, 0]}>
            <boxGeometry args={[.09, 2.72, .1]} />
            <meshStandardMaterial color="#c89241" emissive="#ffaa40" emissiveIntensity={index === 1 ? 1.7 : .25} />
          </mesh>
        ))}
      </group>
    ))}
    {[-1, 1].map(side => (
      <group key={side} position={[side * 3.92, 2.62, -.065]}>
        <GiltBorder width={1.15} height={4.12} />
        <GiltBorder width={1.06} height={4.02} depth={.018} />
        <pointLight position={[0, -1.96, .42]} color="#ffbd70" intensity={5} distance={3.5} />
      </group>
    ))}
    <MuseumFinale />
    <pointLight position={[0, 2.4, 1.65]} color="#ffcf91" intensity={11} distance={5} />
    <pointLight position={[-.85, 1.5, .45]} color="#ffd895" intensity={3} distance={2.7} />
  </group>;
}

function MuseumFinale() {
  const [image, setImage] = useState<{ color: THREE.Texture; relief: THREE.CanvasTexture }>();
  useEffect(() => {
    let active = true;
    let relief: THREE.CanvasTexture | undefined;
    const texture = new THREE.TextureLoader().load('/museum-finale.png', loaded => {
      if (!active) return;
      loaded.colorSpace = THREE.SRGBColorSpace;
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(loaded.image, 0, 0, 384, 256);
      const pixels = context.getImageData(0, 0, 384, 256);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const x = (i / 4) % 384;
        const y = Math.floor(i / 1536);
        const insideLogo = x > 66 && x < 318 && y > 27 && y < 175;
        const luminance = .6 * pixels.data[i] + .3 * pixels.data[i + 1] + .1 * pixels.data[i + 2];
        const height = insideLogo ? Math.max(0, (luminance - 82) * 1.45) : 0;
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = height;
      }
      context.putImageData(pixels, 0, 0);
      relief = new THREE.CanvasTexture(canvas);
      setImage({ color: loaded, relief });
    });
    return () => { active = false; texture.dispose(); relief?.dispose(); };
  }, []);

  return <group position={[0, 2.02, .24]} scale={1.14}>
    <mesh castShadow receiveShadow>
      <boxGeometry args={[3.18, 2.17, .24]} />
      <meshStandardMaterial color="#181822" metalness={.22} roughness={.42} />
    </mesh>
    <group position={[0, 0, .145]}>
      <GiltBorder width={3.12} height={2.11} depth={.055} />
      <GiltBorder width={3.04} height={2.03} depth={.02} />
    </group>
    <pointLight position={[0, 1.25, .65]} color="#ffd194" intensity={3.4} distance={3.4} />
    <pointLight position={[0, -1.16, .41]} color="#ffac52" intensity={1.6} distance={2.8} />
    {image && <mesh position={[0, 0, .16]}>
      <planeGeometry args={[3, 2, 180, 120]} />
      <meshStandardMaterial map={image.color} displacementMap={image.relief} displacementScale={.045}
        bumpMap={image.relief} bumpScale={.032} roughness={.58}
        emissiveMap={image.color} emissive="#ffffff" emissiveIntensity={.34} />
    </mesh>}
  </group>;
}

const frameStyles = [
  { frame: '#6a3f21', trim: '#c19a55', metal: .22 }, { frame: '#24211f', trim: '#c69a4d', metal: .55 },
  { frame: '#7b5839', trim: '#d2b276', metal: .18 }, { frame: '#40342d', trim: '#b6864e', metal: .4 },
];
function ArtworkFrame({ art, index, highlighted, showHotspot, onSelect }: { art: GalleryArtwork; index: number; highlighted: boolean; showHotspot: boolean; onSelect: () => void }) {
  const { gl } = useThree();
  const [loaded, setLoaded] = useState<{ url: string; texture: THREE.Texture }>();
  const texture = loaded && loaded.url === art.image ? loaded.texture : null;

  useEffect(() => {
    let active = true;
    const loader = new THREE.TextureLoader();
    const pending = loader.load(art.image, image => {
      if (!active) {
        image.dispose();
        return;
      }
      image.colorSpace = THREE.SRGBColorSpace;
      image.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
      setLoaded({ url: art.image, texture: image });
    }, undefined, () => {});
    return () => {
      active = false;
      pending.dispose();
    };
  }, [art.image, gl]);
  const source = texture?.image as { width?: number; height?: number } | undefined;
  const aspect = source?.width && source?.height ? source.width / source.height : .82;
  const maxW = 2.32, maxH = 2.68;
  const artW = aspect >= maxW / maxH ? maxW : maxH * aspect;
  const artH = aspect >= maxW / maxH ? maxW / aspect : maxH;
  const frameW = artW + .34, frameH = artH + .34;
  const left = index % 2 === 0, x = left ? -4.86 : 4.86, z = Z_STOPS[index];
  const rotation: [number, number, number] = [0, left ? Math.PI / 2 : -Math.PI / 2, 0];
  const style = frameStyles[index % frameStyles.length];
  return <group position={[x, 1.78, z]} rotation={rotation} onClick={event => { event.stopPropagation(); onSelect(); }}>
    <mesh castShadow position={[0, 0, -.095]}><boxGeometry args={[frameW + .18, frameH + .18, .2]} /><meshStandardMaterial color={style.frame} roughness={.38} metalness={style.metal} /></mesh>
    <mesh castShadow position={[0, 0, .015]}><boxGeometry args={[frameW, frameH, .085]} /><meshStandardMaterial color={style.trim} roughness={.26} metalness={.58} emissive={style.trim} emissiveIntensity={highlighted ? .23 : .065} /></mesh>
    <mesh position={[0, 0, .07]}><boxGeometry args={[artW + .08, artH + .08, .085]} /><meshStandardMaterial color="#e8dfcf" roughness={.88} /></mesh>
    <group position={[0,0,.115]}>
      <GiltBorder width={frameW + .055} height={frameH + .055} depth={.052} />
      <GiltBorder width={artW + .095} height={artH + .095} depth={.028} />
    </group>
    {texture && (
      <mesh position={[0, 0, .125]}>
        <planeGeometry args={[artW, artH]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    )}
    <mesh position={[0, 0, .139]} renderOrder={3}><planeGeometry args={[artW, artH]} /><meshPhysicalMaterial color="#ffffff" transparent opacity={.055} roughness={.08} metalness={.05} depthWrite={false} /></mesh>
    <mesh position={[0, frameH / 2 + .27, .24]}>
      <boxGeometry args={[Math.min(artW, 1.45), .045, .09]} />
      <meshBasicMaterial color="#ffcf85" toneMapped={false} />
    </mesh>
    <pointLight position={[0, frameH / 2 + .32, .92]} color="#ffc47c" intensity={1.2} distance={3.4} decay={2} />
    <group position={[0, 0, .105]}>
      <GiltBorder width={artW + .045} height={artH + .045} depth={.032} />
    </group>
    <MuseumPlaque art={art} number={index + 1} x={0} y={-frameH / 2 - .24} />
    {showHotspot && <Html position={[0, -frameH / 2 - .32, .2]} center transform distanceFactor={4}><button className="gallery-frame-hotspot" onClick={event => { event.stopPropagation(); onSelect(); }}>View details</button></Html>}
  </group>;
}
function MuseumPlaque({ art, number, x, y }: {
  art: GalleryArtwork; number: number; x: number; y: number;
}) {
  const [label, setLabel] = useState<THREE.CanvasTexture>();
  const available = art.available;

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 144;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#fff3d8';
    context.textAlign = 'center';
    context.font = '48px Georgia, serif';
    context.fillText(String(number).padStart(2, '0'), 128, 68);
    context.font = '22px sans-serif';
    context.fillText(available ? 'AVAILABLE' : 'COLLECTED', 128, 108);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    setLabel(texture);
    return () => texture.dispose();
  }, [available, number]);

  return <group position={[x, y, .075]}>
    <mesh>
      <boxGeometry args={[.62, .36, .045]} />
      <meshStandardMaterial color="#9b7744" metalness={.72} roughness={.25} emissive="#5c4223" emissiveIntensity={.08} />
    </mesh>
    {label && <mesh position={[0, 0, .025]}>
      <planeGeometry args={[.58, .326]} />
      <meshBasicMaterial map={label} transparent depthWrite={false} toneMapped={false} />
    </mesh>}
  </group>;
}

function ArtworkWallText({ art, index }: { art: GalleryArtwork; index: number }) {
  const [label, setLabel] = useState<{ id: string; texture: THREE.CanvasTexture }>();
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 960;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const paragraph = (value: string, y: number, lineHeight: number, maxLines: number) => {
      const lines: string[] = [];
      let line = '';
      for (const word of value.split(/\s+/)) {
        const next = line ? line + ' ' + word : word;
        if (line && ctx.measureText(next).width > 850) { lines.push(line); line = word; }
        else line = next;
      }
      if (line) lines.push(line);
      lines.slice(0, maxLines).forEach((row, i) => {
        ctx.fillText(i === maxLines - 1 && lines.length > maxLines ? row + '…' : row, 54, y + i * lineHeight, 850);
      });
    };
    ctx.fillStyle = '#f5d294';
    ctx.font = '74px Georgia';
    paragraph(art.title, 100, 78, 2);
    ctx.fillRect(54, 208, 126, 4);
    ctx.font = '34px Georgia';
    paragraph('Artist  ·  ' + art.artist, 276, 38, 1);
    paragraph('Medium  ·  ' + art.medium, 329, 38, 1);
    paragraph('Size  ·  ' + art.dimensions, 382, 38, 1);
    ctx.fillRect(54, 422, 850, 2);
    ctx.font = 'italic 43px Georgia';
    ctx.fillText('About the Artwork', 54, 490);
    ctx.fillStyle = '#eee8dc';
    ctx.font = '42px sans-serif';
    paragraph(art.description, 553, 49, 8);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    setLabel({ id: art.id, texture });
    return () => texture.dispose();
  }, [art]);

  const left = index % 2 === 0;
  if (label?.id !== art.id) return null;
  return <mesh position={[left ? -4.79 : 4.79, 1.96, Z_STOPS[index] + (left ? 2.8 : -2.8)]}
    rotation={[0, left ? Math.PI / 2 : -Math.PI / 2, 0]}>
    <planeGeometry args={[2.65, 2.8]} />
    <meshBasicMaterial map={label.texture} transparent depthWrite={false} toneMapped={false} />
  </mesh>;
}
