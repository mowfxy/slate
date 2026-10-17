import React, {useId} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/types';
import {isDark} from '../lib/theme';
import {PaperTexture} from './Backdrop';
import {Material, groundOf, paletteOf} from './Materials';

// Fast cuts on the beat grid. One repeated shape (a glyph, a lens, a horizon)
// is what keeps a 3-frame cut readable, so pick a mask or a material that rhymes.
export const Montage: React.FC<SceneProps> = ({scene, tl, brand, fps, width, height}) => {
  const frame = useCurrentFrame();
  const id = useId().replace(/:/g, '');
  const shots = tl.shots ?? [{start: 0, startFrame: 0, item: 0}];
  let k = 0;
  for (let i = 0; i < shots.length; i++) if (shots[i].startFrame <= frame) k = i;
  const shot = shots[k];
  const next = shots[k + 1]?.startFrame ?? tl.durationFrames;
  const t = (frame - shot.startFrame) / Math.max(1, next - shot.startFrame);
  const item = {...scene.items![shot.item], seed: scene.items![shot.item].seed ?? shot.item + 1};
  const m = Math.min(width, height);
  const ground = item.image ? '#000000' : groundOf(item);
  const mat = <Material {...item} width={width} height={height} t={t} />;

  let body: React.ReactNode = mat;
  if (scene.mask === 'glyph') {
    const size = m * 1.12;
    body = (
      <AbsoluteFill style={{background: ground}}>
        {!isDark(ground) ? <PaperTexture opacity={0.08} seed={shot.item + 2} /> : null}
        <svg width={0} height={0} style={{position: 'absolute'}}>
          <defs>
            <clipPath id={`glyph${id}`} clipPathUnits="userSpaceOnUse">
              <text x={width / 2} y={height / 2 + size * 0.34} textAnchor="middle" fontFamily={brand.serif} fontWeight={500} fontSize={size}>
                {scene.glyph ?? brand.name[0]}
              </text>
            </clipPath>
          </defs>
        </svg>
        {/* a faint silhouette keeps sparse materials readable as the glyph */}
        <AbsoluteFill style={{clipPath: `url(#glyph${id})`, background: isDark(ground) ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}} />
        <AbsoluteFill style={{clipPath: `url(#glyph${id})`}}>{mat}</AbsoluteFill>
      </AbsoluteFill>
    );
  } else if (scene.mask === 'lens') {
    // An eyepiece: aperture opens as we arrive, dark machined rings around it.
    const open = interpolate(frame / fps, [0, 0.5], [0.55, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    const r = m * 0.4 * open;
    const off = (1 - open) * m * 0.5;
    const cx = width / 2 + off;
    const cy = height / 2 - off * 0.3;
    body = (
      <AbsoluteFill style={{background: '#060606'}}>
        <AbsoluteFill style={{clipPath: `circle(${r}px at ${cx}px ${cy}px)`}}>{mat}</AbsoluteFill>
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at ${cx}px ${cy}px, transparent ${r * 0.86}px, rgba(0,0,0,0.55) ${r}px, #1d1d1d ${r + 2}px, #0c0c0c ${r + m * 0.03}px, #222 ${r + m * 0.045}px, #080808 ${r + m * 0.08}px, #151515 ${r + m * 0.11}px, #050505 ${r + m * 0.2}px)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  if (scene.mask === 'horizon') {
    // V5: the curved edge of many worlds. The material is the planet; the sky stays put.
    const R = width * 1.6;
    const horizonY = height * 0.7;
    const cy = horizonY + R;
    const rim = paletteOf(item.palette, 'archive')[1] ?? brand.accent;
    body = (
      <AbsoluteFill style={{background: 'radial-gradient(120% 80% at 50% 100%, #1a2230 0%, #07090d 70%)'}}>
        <AbsoluteFill style={{clipPath: `circle(${R}px at ${width / 2}px ${cy}px)`}}>{mat}</AbsoluteFill>
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle ${R * 1.08}px at ${width / 2}px ${cy}px, transparent ${R * 0.985}px, ${rim}55 ${R}px, ${rim}22 ${R * 1.02}px, transparent ${R * 1.08}px)`,
            mixBlendMode: 'screen',
          }}
        />
        <AbsoluteFill style={{background: `radial-gradient(circle ${R}px at ${width / 2}px ${cy}px, transparent 96%, rgba(0,0,0,0.45) 100%)`}} />
      </AbsoluteFill>
    );
  }

  // Overlay words (V5): enter on shot boundaries in the second half and stay locked while the world cuts underneath.
  const overlay = scene.overlay ?? [];
  let word: string | null = null;
  if (overlay.length) {
    const firstShot = Math.floor(shots.length * 0.38);
    const span = (shots.length - firstShot) / overlay.length;
    const idx = Math.floor((k - firstShot) / span);
    if (k >= firstShot) word = overlay[Math.min(overlay.length - 1, idx)];
  }
  const textColor = isDark(ground) || item.material === 'horizon' || scene.mask === 'horizon' || scene.mask === 'lens' ? '#ffffff' : brand.ink;
  return (
    <AbsoluteFill>
      {body}
      {word ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div style={{fontFamily: brand.serif, fontSize: m * 0.1, color: textColor, transform: `translateY(${-height * 0.06}px)`, letterSpacing: '-0.01em', textShadow: textColor === '#ffffff' ? '0 0 40px rgba(0,0,0,0.35)' : 'none'}}>
            {word}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
