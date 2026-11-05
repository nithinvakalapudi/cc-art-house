'use client';
import { Bloom, EffectComposer, N8AO, Vignette } from '@react-three/postprocessing';

export default function GalleryEffects({ compact = false, bright = false }: { compact?: boolean; bright?: boolean }) {
  return <EffectComposer multisampling={compact ? 2 : 4} enableNormalPass={!compact}>
    {!compact && <N8AO aoRadius={.34} intensity={bright ? .28 : .65} quality="performance" />}
    <Bloom intensity={compact ? .02 : .04} luminanceThreshold={.92} luminanceSmoothing={.45} mipmapBlur />
    <Vignette eskil={false} offset={bright || compact ? .5 : .18} darkness={bright || compact ? .04 : .16} />
  </EffectComposer>;
}
