'use client';
import { Bloom, EffectComposer, N8AO, Vignette } from '@react-three/postprocessing';

export default function GalleryEffects({ compact = false, bright = false }: { compact?: boolean; bright?: boolean }) {
  if (compact) return null;
  return <EffectComposer multisampling={4} enableNormalPass>
    <N8AO aoRadius={.34} intensity={bright ? .28 : .65} quality="performance" />
    <Bloom intensity={.04} luminanceThreshold={.92} luminanceSmoothing={.45} mipmapBlur />
    <Vignette eskil={false} offset={bright ? .5 : .18} darkness={bright ? .04 : .16} />
  </EffectComposer>;
}
