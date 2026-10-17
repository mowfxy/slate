import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/types';
import {easeOut, enter} from '../lib/motion';
import {isDark} from '../lib/theme';
import {Backdrop, GridPaper} from './Backdrop';
import {Material, groundOf} from './Materials';
import {Footnote, TitleText} from './Type';

// The Slate mark: a clapperboard reduced to two shapes. Replace per brand.
export const SlateMark: React.FC<{size: number; ink: string; accent: string; open?: number}> = ({size, ink, accent, open = 0}) => {
  const id = `stripes-${ink.replace('#', '')}-${accent.replace('#', '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="16" fill={accent} />
          <rect x="8" width="8" height="16" fill={ink} />
        </pattern>
      </defs>
      <g transform={`rotate(${-open * 18} 10 34)`}>
        <rect x="10" y="20" width="80" height="14" rx="3" fill={`url(#${id})`} />
      </g>
      <rect x="10" y="38" width="80" height="50" rx="6" fill={ink} />
    </svg>
  );
};

const Wordmark: React.FC<{brand: Required<SceneProps['brand']>; size: number; color: string}> = ({brand, size, color}) => (
  <span
    style={{
      fontFamily: brand.wordmark === 'serif' ? brand.serif : brand.sans,
      fontWeight: brand.wordmark === 'serif' ? 500 : 600,
      fontSize: size,
      letterSpacing: brand.wordmark === 'serif' ? '-0.01em' : '-0.03em',
      color,
      lineHeight: 1,
    }}
  >
    {brand.name}
  </span>
);

// Opening beat: the mark alone, settling into place.
export const LogoScene: React.FC<SceneProps> = ({scene, brand, fps, width, height}) => {
  const frame = useCurrentFrame();
  const p = enter(frame, fps, 0.1, 0.8);
  const open = interpolate(frame / fps, [0.5, 0.75, 0.9], [0, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut});
  const bg = scene.backdrop ?? 'white';
  const dark = bg === 'dark' || bg === 'space';
  return (
    <AbsoluteFill>
      <Backdrop kind={bg} paper={brand.paper} ink={brand.ink} accent={brand.accent} width={width} height={height} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.94, 1])})`}}>
        {brand.mark === 'slate' ? (
          <SlateMark size={Math.min(width, height) * 0.13} ink={dark ? '#ffffff' : brand.ink} accent={brand.accent} open={open} />
        ) : (
          <Wordmark brand={brand} size={Math.min(width, height) * 0.1} color={dark ? '#fff' : brand.ink} />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Closing beat: mark + wordmark, optional tagline and legal line. Holds, never rushes.
export const LogoEnd: React.FC<SceneProps> = ({scene, brand, fps, width, height}) => {
  const frame = useCurrentFrame();
  const p = enter(frame, fps, 0.15, 0.9);
  const tag = enter(frame, fps, 0.7, 0.8);
  const bg = scene.backdrop ?? 'paper';
  const dark = bg === 'dark' || bg === 'space' || bg === 'horizon';
  const color = dark ? '#ffffff' : brand.ink;
  const base = Math.min(width, height * 1.6);
  const square = width / height < 1.2;
  const word = base * (square ? 0.11 : 0.06);
  return (
    <AbsoluteFill>
      <Backdrop kind={bg} paper={brand.paper} ink={brand.ink} accent={brand.accent} width={width} height={height} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: word * 0.5}}>
        <div style={{display: 'flex', alignItems: 'center', gap: word * 0.3, opacity: p, filter: `blur(${(1 - p) * 10}px)`}}>
          {brand.mark === 'slate' ? <SlateMark size={word * 1.05} ink={color} accent={brand.accent} /> : null}
          <Wordmark brand={brand} size={word} color={color} />
        </div>
        {scene.tagline ? (
          <div style={{fontFamily: brand.sans, fontSize: word * (square ? 0.3 : 0.32), color: dark ? 'rgba(255,255,255,0.78)' : brand.muted, opacity: tag, letterSpacing: '0.005em'}}>
            {scene.tagline}
          </div>
        ) : null}
      </AbsoluteFill>
      {scene.footnote ? <Footnote text={scene.footnote} color={dark ? 'rgba(255,255,255,0.55)' : brand.muted} font={brand.sans} width={width} height={height} /> : null}
    </AbsoluteFill>
  );
};

// A held title on a color, texture or material. The landing after a montage.
export const TitleCard: React.FC<SceneProps> = ({scene, brand, fps, width, height}) => {
  const frame = useCurrentFrame();
  const bg = scene.background ?? 'accent';
  let ground: React.ReactNode;
  let ink = '#ffffff';
  if (typeof bg === 'object') {
    ground = <Material {...bg} width={width} height={height} t={frame / (fps * 6)} />;
    ink = isDark(groundOf(bg)) ? '#ffffff' : brand.ink;
  } else if (bg === 'accent') {
    ground = <GridPaper paper={brand.accent} ink="#ffffff" width={width} />;
  } else if (bg === 'paper' || bg === 'grid') {
    ground = <GridPaper paper={brand.paper} ink={brand.ink} width={width} />;
    ink = brand.ink;
  } else {
    ground = <Backdrop kind={bg as never} paper={brand.paper} ink={brand.ink} accent={brand.accent} width={width} height={height} />;
    ink = bg === 'white' ? brand.ink : '#ffffff';
  }
  const size = scene.size ?? Math.min(width, height) * (width / height < 1.2 ? 0.13 : 0.1);
  return (
    <AbsoluteFill>
      {ground}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: size * 0.35}}>
        <TitleText text={scene.text ?? ''} color={ink} font={scene.font === 'sans' ? brand.sans : brand.serif} size={size} fps={fps} start={0.05} />
        {scene.sub ? (
          <div style={{fontFamily: brand.sans, fontSize: size * 0.22, color: ink, opacity: 0.8 * enter(frame, fps, 0.6, 0.7)}}>{scene.sub}</div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
