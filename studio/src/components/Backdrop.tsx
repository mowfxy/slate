import React, {useId, useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {Backdrop as BackdropKind} from '../lib/types';
import {alpha, mix} from '../lib/theme';
import {seeded} from '../lib/motion';

type Props = {kind: BackdropKind; paper: string; ink: string; accent: string; width: number; height: number};

export const Backdrop: React.FC<Props> = ({kind, paper, ink, accent, width, height}) => {
  switch (kind) {
    case 'white':
      return <AbsoluteFill style={{background: '#ffffff'}} />;
    case 'space':
      return <Space width={width} height={height} />;
    case 'grid':
      return <GridPaper paper={paper} ink={ink} width={width} />;
    case 'accent':
      return <GridPaper paper={accent} ink={'#ffffff'} width={width} />;
    case 'dark':
      return <AbsoluteFill style={{background: '#0d1014'}} />;
    case 'horizon':
      return <Horizon palette={['#0d1014', '#2a4a66', '#9cc3dd', '#ff7a3d']} width={width} height={height} />;
    case 'paper':
    default:
      return (
        <AbsoluteFill style={{background: paper}}>
          <PaperTexture opacity={0.05} />
        </AbsoluteFill>
      );
  }
};

// Deep space behind floating windows (the V1 "work happens here" move).
export const Space: React.FC<{width: number; height: number}> = ({width, height}) => {
  const frame = useCurrentFrame();
  const stars = useMemo(() => {
    const r = seeded(7);
    return Array.from({length: 420}, () => ({x: r() * width, y: r() * height, s: r() ** 3 * 2.2 + 0.4, a: 0.25 + r() * 0.75, tw: r() * 6.28}));
  }, [width, height]);
  const drift = frame * 0.15;
  return (
    <AbsoluteFill style={{background: 'radial-gradient(120% 90% at 30% 20%, #1b2340 0%, #090b14 55%, #04050a 100%)'}}>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        <defs>
          <radialGradient id="neb" cx="70%" cy="70%" r="45%">
            <stop offset="0%" stopColor="#5a3d8a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill="url(#neb)" />
        {stars.map((st, i) => (
          <circle key={i} cx={(st.x + drift * st.s) % width} cy={st.y} r={st.s} fill="#fff" opacity={st.a * (0.75 + 0.25 * Math.sin(st.tw + frame / 12))} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

export const GridPaper: React.FC<{paper: string; ink: string; width: number; cell?: number}> = ({paper, ink, width, cell}) => {
  const c = cell ?? Math.round(width / 26);
  const line = alpha(ink, 0.09);
  return (
    <AbsoluteFill
      style={{
        background: paper,
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: `${c}px ${c}px`,
        backgroundPosition: 'center center',
      }}
    >
      <PaperTexture opacity={0.06} />
    </AbsoluteFill>
  );
};

// A planet-limb horizon: the V5 motif. palette = [space, deep, haze, rim].
export const Horizon: React.FC<{palette: string[]; width: number; height: number; rise?: number}> = ({palette, width, height, rise = 0}) => {
  const [space, deep, haze, rim] = palette;
  const id = useId().replace(/:/g, '');
  const R = width * 1.6;
  const horizonY = height * (0.74 - rise * 0.12);
  const cy = horizonY + R * 0.9;
  return (
    <AbsoluteFill style={{background: space}}>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        <defs>
          <radialGradient id={`limb${id}`} cx={width / 2} cy={cy} r={R} gradientUnits="userSpaceOnUse">
            <stop offset={0.9} stopColor={deep} stopOpacity={1} />
            <stop offset={0.903} stopColor={rim} stopOpacity={0.95} />
            <stop offset={0.915} stopColor={haze} stopOpacity={0.75} />
            <stop offset={0.95} stopColor={haze} stopOpacity={0.18} />
            <stop offset={1} stopColor={space} stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`body${id}`} cx={width / 2} cy={cy - R * 0.4} r={R} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor={mix(deep, '#000000', 0.2)} />
            <stop offset={1} stopColor={mix(deep, '#000000', 0.65)} />
          </radialGradient>
        </defs>
        <circle cx={width / 2} cy={cy} r={R} fill={`url(#limb${id})`} />
        <circle cx={width / 2} cy={cy} r={R * 0.9} fill={`url(#body${id})`} />
      </svg>
    </AbsoluteFill>
  );
};

// Static fractal noise; keeps flat color from looking digital.
export const PaperTexture: React.FC<{opacity: number; seed?: number}> = ({opacity, seed = 3}) => {
  const id = useId().replace(/:/g, '');
  return (
  <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, opacity, mixBlendMode: 'multiply'}}>
    <filter id={`paper${id}`}>
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={seed} />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter={`url(#paper${id})`} />
  </svg>
  );
};

// Animated film grain, re-seeded every other frame.
export const Grain: React.FC<{amount: number}> = ({amount}) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 97;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: amount, mixBlendMode: 'overlay'}}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves={2} seed={seed} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{amount: number}> = ({amount}) => (
  <AbsoluteFill style={{pointerEvents: 'none', background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${amount}) 100%)`}} />
);
