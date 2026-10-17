import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import type {SceneProps} from '../lib/types';
import {enter} from '../lib/motion';
import {alpha} from '../lib/theme';
import {Backdrop} from './Backdrop';

type Seg = {text: string; kind: 'plain' | 'accent' | 'square' | 'round'; trail?: string};

// "*word*" = accent color. In bracketTitle, "[word]" and "(word)" become animated brackets.
export function parseMarkup(text: string, brackets = false): Seg[] {
  const re = brackets ? /(\*[^*]+\*|\[[^\]]+\]|\([^)]+\))/g : /(\*[^*]+\*)/g;
  const segs: Seg[] = text
    .split(re)
    .filter((s) => s.length)
    .map((s) => {
      if (s.startsWith('*')) return {text: s.slice(1, -1), kind: 'accent'};
      if (brackets && s.startsWith('[')) return {text: s.slice(1, -1), kind: 'square'};
      if (brackets && s.startsWith('(')) return {text: s.slice(1, -1), kind: 'round'};
      return {text: s, kind: 'plain'};
    });
  // Punctuation right after a bracket stays glued to it, so ". Every" never starts a line.
  for (let i = 0; i < segs.length - 1; i++) {
    const m = /^[.,!?;:]+/.exec(segs[i + 1].text);
    if ((segs[i].kind === 'square' || segs[i].kind === 'round') && segs[i + 1].kind === 'plain' && m) {
      segs[i].trail = m[0];
      segs[i + 1].text = segs[i + 1].text.slice(m[0].length);
    }
  }
  return segs.filter((s) => s.text.length || s.kind !== 'plain');
}

export function titleSize(width: number, height: number) {
  const square = width / height < 1.2;
  return Math.round(Math.min(width, height * 1.6) * (square ? 0.055 : 0.032));
}

const Caret: React.FC<{color: string; visible: number; size: number}> = ({color, visible, size}) => (
  <span
    style={{
      display: 'inline-block',
      width: Math.max(2, size * 0.055),
      height: size * 0.95,
      background: color,
      marginLeft: size * 0.06,
      verticalAlign: '-0.12em',
      opacity: visible,
    }}
  />
);

// Characters revealed so far, given typing speed. Brackets count as one char each.
function useTyped(scene: SceneProps['scene'], fps: number, defaultCps: number) {
  const frame = useCurrentFrame();
  const cps = scene.cps ?? defaultCps;
  const t = frame / fps - (scene.typeDelay ?? 0.3);
  return Math.max(0, Math.floor(t * cps + 1e-6));
}

export const TypeTitle: React.FC<SceneProps & {cps: number}> = ({scene, tl, brand, fps, width, height, cps}) => {
  const frame = useCurrentFrame();
  const n = useTyped(scene, fps, cps);
  const size = scene.size ?? titleSize(width, height);
  const segs = parseMarkup(scene.text ?? '');
  const typedAt = tl.typedAt ?? 0;
  const tSec = frame / fps;
  const caretOn = tSec < typedAt + 0.15 ? 1 : Math.floor((tSec - typedAt) * 2.4) % 2 === 0 ? 1 : 0;
  const caretFade = interpolate(tSec, [typedAt + 0.9, typedAt + 1.1], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  let left = n;
  const font = scene.font === 'serif' ? brand.serif : brand.sans;
  const ink = scene.backdrop === 'space' || scene.backdrop === 'dark' ? '#ffffff' : brand.ink;
  return (
    <AbsoluteFill>
      <Backdrop kind={scene.backdrop ?? 'white'} paper={brand.paper} ink={brand.ink} accent={brand.accent} width={width} height={height} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            fontFamily: font,
            fontWeight: scene.font === 'serif' ? 400 : 600,
            fontSize: size,
            letterSpacing: scene.font === 'serif' ? '-0.01em' : '-0.025em',
            lineHeight: 1.12,
            color: ink,
            textAlign: 'center',
            maxWidth: width * 0.62,
            textWrap: 'balance',
          }}
        >
          {segs.map((s, i) => {
            const shown = s.text.slice(0, Math.max(0, left));
            left -= s.text.length;
            return (
              <span key={i} style={{color: s.kind === 'accent' ? brand.accent : undefined}}>
                {shown}
              </span>
            );
          })}
          <Caret color={brand.accent} visible={caretOn * caretFade} size={size} />
          {scene.sub ? (
            <div style={{fontSize: size * 0.42, fontWeight: 400, color: brand.muted, marginTop: size * 0.5, letterSpacing: 0, opacity: enter(frame, fps, typedAt + 0.1, 0.5)}}>{scene.sub}</div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// V2's move: brackets pop in as a pair, the word types inside them and pushes them apart.
export const BracketTitle: React.FC<SceneProps & {cps: number}> = ({scene, brand, fps, width, height, cps}) => {
  const frame = useCurrentFrame();
  const n = useTyped(scene, fps, cps);
  const size = scene.size ?? titleSize(width, height);
  const segs = parseMarkup(scene.text ?? '', true);
  let cursor = 0;
  return (
    <AbsoluteFill>
      <Backdrop kind={scene.backdrop ?? 'white'} paper={brand.paper} ink={brand.ink} accent={brand.accent} width={width} height={height} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            fontFamily: brand.sans,
            fontWeight: 600,
            fontSize: size,
            letterSpacing: '-0.025em',
            lineHeight: 1.18,
            color: brand.ink,
            textAlign: 'center',
            maxWidth: width * 0.66,
            textWrap: 'balance',
          }}
        >
          {segs.map((s, i) => {
            const start = cursor;
            // bracketed tokens consume their brackets as typed chars too
            const len = s.kind === 'square' || s.kind === 'round' ? s.text.length + 2 + (s.trail?.length ?? 0) : s.text.length;
            cursor += len;
            if (n <= start) return null;
            if (s.kind === 'plain' || s.kind === 'accent') {
              return (
                <span key={i} style={{color: s.kind === 'accent' ? brand.accent : undefined}}>
                  {s.text.slice(0, n - start)}
                </span>
              );
            }
            const color = s.kind === 'square' ? brand.accent : brand.accent2;
            const [o, c] = s.kind === 'square' ? ['[', ']'] : ['(', ')'];
            const popT = frame / fps - (start / (scene.cps ?? cps) + (scene.typeDelay ?? 0.3));
            const pop = interpolate(popT, [0, 0.08, 0.2], [0.6, 1.12, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
            const inner = s.text.slice(0, Math.max(0, n - start - 1));
            return (
              <span key={i} style={{color, display: 'inline-block', whiteSpace: 'nowrap'}}>
                <span style={{display: 'inline-block', transform: `scale(${pop})`, fontWeight: 400}}>{o}</span>
                {inner}
                <span style={{display: 'inline-block', transform: `scale(${pop})`, fontWeight: 400}}>{c}</span>
                {s.trail ? <span style={{color: brand.ink}}>{s.trail.slice(0, Math.max(0, n - start - s.text.length - 2))}</span> : null}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
      {scene.footnote ? <Footnote text={scene.footnote} color={brand.muted} font={brand.sans} width={width} height={height} /> : null}
    </AbsoluteFill>
  );
};

export const Footnote: React.FC<{text: string; color: string; font: string; width: number; height: number}> = ({text, color, font, width, height}) => (
  <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * 0.08}}>
    <div style={{fontFamily: font, fontSize: Math.min(width, height * 1.6) * 0.0115, color, letterSpacing: '0.01em'}}>{text}</div>
  </AbsoluteFill>
);

// Serif title card with a soft focus-pull entrance (V3/V4/V5 title moments).
export const TitleText: React.FC<{
  text: string;
  color: string;
  font: string;
  size: number;
  start?: number;
  fps: number;
  accent?: string;
}> = ({text, color, font, size, start = 0, fps, accent}) => {
  const frame = useCurrentFrame();
  const p = enter(frame, fps, start, 0.9);
  const segs = parseMarkup(text);
  return (
    <div
      style={{
        fontFamily: font,
        fontSize: size,
        fontWeight: 400,
        color,
        letterSpacing: `${interpolate(p, [0, 1], [0.02, -0.015])}em`,
        opacity: p,
        filter: `blur(${(1 - p) * 14}px)`,
        transform: `scale(${interpolate(p, [0, 1], [1.04, 1])})`,
        textAlign: 'center',
        lineHeight: 1.05,
        textShadow: `0 0 ${size * 0.6}px ${alpha('#000000', 0.12)}`,
      }}
    >
      {segs.map((s, i) => (
        <span key={i} style={{color: s.kind === 'accent' && accent ? accent : undefined}}>
          {s.text}
        </span>
      ))}
    </div>
  );
};
