'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useGalleryAudio(moving: boolean, arrival: number, active: boolean) {
  const [enabled, setEnabled] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const ambience = useRef<{ source: AudioBufferSourceNode; gain: GainNode } | null>(null);
  const footsteps = useRef<number | null>(null);

  const ensureContext = useCallback(() => {
    if (!context.current) context.current = new AudioContext();
    if (context.current.state === 'suspended') void context.current.resume();
    return context.current;
  }, []);
  const startAmbience = useCallback(() => {
    const ctx = ensureContext();
    if (ambience.current) return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .12;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = buffer; source.loop = true; filter.type = 'lowpass'; filter.frequency.value = 260; gain.gain.value = .035;
    source.connect(filter).connect(gain).connect(ctx.destination); source.start(); ambience.current = { source, gain };
  }, [ensureContext]);
  const footstep = useCallback(() => {
    const ctx = ensureContext(), oscillator = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(92, ctx.currentTime); oscillator.frequency.exponentialRampToValueAtTime(48, ctx.currentTime + .11);
    filter.type = 'lowpass'; filter.frequency.value = 180; gain.gain.setValueAtTime(.0001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.055, ctx.currentTime + .012); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .15);
    oscillator.connect(filter).connect(gain).connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + .16);
  }, [ensureContext]);
  const chime = useCallback(() => {
    const ctx = ensureContext();
    [392, 523.25].forEach((frequency, index) => { const oscillator = ctx.createOscillator(), gain = ctx.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.0001, ctx.currentTime + index * .05); gain.gain.exponentialRampToValueAtTime(.018, ctx.currentTime + .04 + index * .05); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .65); oscillator.connect(gain).connect(ctx.destination); oscillator.start(ctx.currentTime + index * .05); oscillator.stop(ctx.currentTime + .7); });
  }, [ensureContext]);
  const toggle = useCallback(() => {
    setEnabled(value => { const next = !value; if (next) startAmbience(); else if (ambience.current) ambience.current.gain.gain.setTargetAtTime(.0001, ensureContext().currentTime, .08); if (next && ambience.current) ambience.current.gain.gain.setTargetAtTime(.035, ensureContext().currentTime, .08); return next; });
  }, [startAmbience, ensureContext]);

  useEffect(() => {
    if (!enabled || !active || !moving) { if (footsteps.current) window.clearInterval(footsteps.current); footsteps.current = null; return; }
    footstep(); footsteps.current = window.setInterval(footstep, 520);
    return () => { if (footsteps.current) window.clearInterval(footsteps.current); footsteps.current = null; };
  }, [enabled, active, moving, footstep]);
  useEffect(() => { if (enabled && active && arrival >= 0 && !moving) chime(); }, [arrival, enabled, active, moving, chime]);
  useEffect(() => () => { if (footsteps.current) window.clearInterval(footsteps.current); ambience.current?.source.stop(); void context.current?.close(); }, []);
  return { enabled, toggle };
}
