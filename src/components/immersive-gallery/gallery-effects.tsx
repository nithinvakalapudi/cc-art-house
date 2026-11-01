'use client';
import { Bloom, DepthOfField, EffectComposer, N8AO, Vignette } from '@react-three/postprocessing';

export default function GalleryEffects({ moving, compact = false, bright = false }: { moving: boolean; compact?: boolean; bright?: boolean }) {
  return <EffectComposer multisampling={compact ? 0 : 2} enableNormalPass={!compact}>
    {!compact && <N8AO aoRadius={.34} intensity={bright ? .28 : .65} quality="performance" />}
    {!compact && <DepthOfField focusDistance={.032} focalLength={.025} bokehScale={moving ? 0 : .42} />}
    <Bloom intensity={compact ? .08 : .14} luminanceThreshold={.92} luminanceSmoothing={.45} mipmapBlur />
    <Vignette eskil={false} offset={bright || compact ? .5 : .18} darkness={bright || compact ? .06 : .36} />
  </EffectComposer>;
}
