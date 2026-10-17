import React, {useId, useMemo} from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {seeded} from '../lib/motion';
import {Horizon, PaperTexture} from './Backdrop';

// Curated palettes. Index 0 is always the ground, the rest are inks.
export const PALETTES: Record<string, string[]> = {
  archive: ['#efe6d2', '#c8452f', '#2f5d50', '#e0b54a', '#22303a'],
  botanical: ['#f1ead8', '#4f7a3a', '#b4385a', '#e8c26b', '#1f2a24'],
  ocean: ['#0f2d3d', '#3e8ea7', '#a8dadc', '#f1faee', '#e76f51'],
  ember: ['#1a0f0a', '#d9481c', '#f4a259', '#ffe8c2', '#5c1a0b'],
  blueprint: ['#1f4e8c', '#ffffff', '#9cc3ff', '#16386a', '#ffd166'],
  violet: ['#1c1433', '#7b5cff', '#c3b5ff', '#f0ecff', '#ff6fb5'],
  coral: ['#f3ece2', '#e35d4a', '#1d1d1b', '#f2c14e', '#5b8e7d'],
  teal: ['#2f5b5b', '#f0a33a', '#e8dcc0', '#a7c7b7', '#d9643a'],
  ink: ['#f4f1ea', '#1b1b1b', '#6b6b6b', '#c8452f', '#d9d4c7'],
  dawn: ['#0d1014', '#2a4a66', '#9cc3dd', '#ff7a3d'],
  dusk: ['#120c18', '#4a2f5c', '#c79bd6', '#ff9e5e'],
  ice: ['#081018', '#1d3b52', '#d6ecf7', '#ffffff'],
  forest: ['#0b120d', '#1f3b2b', '#a6d4a0', '#f2d06b'],
  rose: ['#14080c', '#5c2235', '#f2a6b8', '#ffd9c2'],
};

export const MATERIALS = [
  'dots',
  'halftone',
  'stripes',
  'rings',
  'constellation',
  'cutout',
  'topo',
  'blueprint',
  'mosaic',
  'cells',
  'petals',
  'waves',
  'gradient',
  'type',
  'horizon',
] as const;

export type MaterialProps = {
  material?: string;
  image?: string;
  palette?: string[] | string;
  seed?: number;
  width: number;
  height: number;
  t: number; // 0..1 progress through the shot, for gentle motion
};

export function paletteOf(p: MaterialProps['palette'], fallback = 'archive'): string[] {
  if (Array.isArray(p)) return p;
  return PALETTES[p ?? fallback] ?? PALETTES[fallback];
}

export const Material: React.FC<MaterialProps> = (props) => {
  const {image, width, height} = props;
  if (image) {
    return (
      <AbsoluteFill>
        <Img src={staticFile(image)} style={{width, height, objectFit: 'cover'}} />
      </AbsoluteFill>
    );
  }
  const P = paletteOf(props.palette, defaultPalette(props.material));
  const seed = props.seed ?? 1;
  return (
    <AbsoluteFill style={{background: P[0], overflow: 'hidden'}}>
      <Pattern {...props} P={P} seed={seed} />
    </AbsoluteFill>
  );
};

function defaultPalette(m?: string) {
  return (
    {
      constellation: 'teal',
      blueprint: 'blueprint',
      cells: 'botanical',
      horizon: 'dawn',
      gradient: 'violet',
      waves: 'ocean',
      rings: 'ember',
    } as Record<string, string>
  )[m ?? ''] ?? 'archive';
}

// The ground color a material sits on. Used around glyph masks.
export function groundOf(item: {material?: string; palette?: string[] | string}) {
  return paletteOf(item.palette, defaultPalette(item.material))[0];
}

const Pattern: React.FC<MaterialProps & {P: string[]; seed: number}> = ({material, width: w, height: h, P, seed, t}) => {
  const id = useId().replace(/:/g, '');
  const content = useMemo(() => {
    const rand = seeded(seed * 7919 + 13);
    const m = Math.min(w, h);
    switch (material) {
      case 'dots': {
        const cell = m / 22;
        const out: React.ReactNode[] = [];
        for (let y = cell / 2; y < h; y += cell)
          for (let x = cell / 2; x < w; x += cell) out.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={cell * 0.42} fill={P[1]} />);
        return (
          <>
            <GridLines w={w} h={h} cell={cell / 2} color={P[4] ?? P[2]} />
            {out}
          </>
        );
      }
      case 'halftone': {
        const cell = m / 40;
        const out: React.ReactNode[] = [];
        const cx = w * (0.3 + rand() * 0.4);
        const cy = h * (0.3 + rand() * 0.4);
        for (let y = 0; y < h + cell; y += cell)
          for (let x = 0; x < w + cell; x += cell) {
            const d = Math.hypot(x - cx, y - cy) / m;
            const rr = cell * 0.5 * Math.max(0.05, 1 - d * 1.1);
            out.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={rr} fill={P[1]} />);
          }
        return out;
      }
      case 'stripes': {
        const n = 18;
        const step = (Math.hypot(w, h) * 1.2) / n;
        return (
          <g transform={`rotate(${-30 + rand() * 60} ${w / 2} ${h / 2})`}>
            {Array.from({length: n}, (_, i) => (
              <rect key={i} x={-w * 0.6 + i * step} y={-h} width={step * 0.5} height={h * 3} fill={P[1 + (i % 2) * 2] ?? P[1]} />
            ))}
          </g>
        );
      }
      case 'rings': {
        const cx = w * (0.35 + rand() * 0.3);
        const cy = h * (0.35 + rand() * 0.3);
        const n = 16;
        const maxR = Math.hypot(w, h);
        return Array.from({length: n}, (_, i) => (
          <circle key={i} cx={cx} cy={cy} r={maxR * (1 - i / n)} fill={P[1 + (i % (P.length - 1))]} />
        ));
      }
      case 'constellation': {
        const pts = Array.from({length: 46}, () => ({x: rand() * w, y: rand() * h, r: 2 + rand() ** 2 * 9}));
        const lines: React.ReactNode[] = [];
        pts.forEach((p, i) => {
          let best = -1;
          let bd = Infinity;
          pts.forEach((q, j) => {
            const d = Math.hypot(p.x - q.x, p.y - q.y);
            if (j !== i && d < bd) {
              bd = d;
              best = j;
            }
          });
          if (best >= 0) lines.push(<line key={`l${i}`} x1={p.x} y1={p.y} x2={pts[best].x} y2={pts[best].y} stroke={P[2]} strokeWidth={m / 700} opacity={0.8} />);
        });
        const dust = Array.from({length: 300}, (_, i) => <circle key={`d${i}`} cx={rand() * w} cy={rand() * h} r={rand() * 1.6} fill={P[2]} opacity={0.5} />);
        return (
          <>
            {dust}
            {lines}
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={p.r * (m / 1080)} fill={i % 3 ? P[1] : P[4]} />
            ))}
          </>
        );
      }
      case 'cutout': {
        return Array.from({length: 26}, (_, i) => {
          const s = m * (0.08 + rand() * 0.16);
          const x = rand() * w;
          const y = rand() * h;
          return (
            <g key={i} transform={`rotate(${rand() * 40 - 20} ${x} ${y})`}>
              <rect x={x - s / 2 + 4} y={y - s / 2 + 6} width={s} height={s * (0.7 + rand() * 0.6)} fill="#000" opacity={0.12} />
              <rect x={x - s / 2} y={y - s / 2} width={s} height={s * (0.7 + rand() * 0.6)} fill={P[1 + (i % (P.length - 1))]} />
            </g>
          );
        });
      }
      case 'topo': {
        const cx = w * (0.3 + rand() * 0.4);
        const cy = h * (0.3 + rand() * 0.4);
        const ph = rand() * 6.28;
        return Array.from({length: 28}, (_, i) => {
          const base = (i + 1) * (m / 26);
          const d = Array.from({length: 73}, (_, k) => {
            const a = (k / 72) * Math.PI * 2;
            const rr = base * (1 + 0.18 * Math.sin(3 * a + ph + i * 0.2) + 0.08 * Math.sin(7 * a - ph));
            return `${k ? 'L' : 'M'}${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
          }).join(' ');
          return <path key={i} d={d + 'Z'} fill="none" stroke={i % 5 === 0 ? P[1] : P[2]} strokeWidth={i % 5 === 0 ? m / 400 : m / 900} />;
        });
      }
      case 'blueprint': {
        const cell = m / 12;
        const out: React.ReactNode[] = [<GridLines key="g" w={w} h={h} cell={cell} color={P[2]} opacity={0.35} />];
        const cx = w * 0.5;
        const cy = h * (0.9 + rand() * 0.4);
        for (let i = 1; i < 8; i++) out.push(<circle key={`c${i}`} cx={cx} cy={cy} r={i * m * 0.16} fill="none" stroke={P[1]} strokeWidth={m / 500} opacity={0.85} />);
        for (let i = 0; i < 14; i++) {
          const a = Math.PI + (i / 13) * Math.PI;
          out.push(<line key={`r${i}`} x1={cx} y1={cy} x2={cx + Math.cos(a) * m * 2} y2={cy + Math.sin(a) * m * 2} stroke={P[1]} strokeWidth={m / 900} opacity={0.6} />);
        }
        return out;
      }
      case 'mosaic': {
        const cell = m / 9;
        const out: React.ReactNode[] = [];
        for (let y = 0; y < h; y += cell)
          for (let x = 0; x < w; x += cell)
            out.push(<rect key={`${x}-${y}`} x={x + 3} y={y + 3} width={cell - 6} height={cell - 6} rx={cell * 0.08} fill={P[1 + Math.floor(rand() * (P.length - 1))]} />);
        return out;
      }
      case 'cells': {
        const out: React.ReactNode[] = [];
        const placed: {x: number; y: number; r: number}[] = [];
        for (let k = 0; k < 900 && placed.length < 140; k++) {
          const c = {x: rand() * w, y: rand() * h, r: m * (0.025 + rand() * 0.05)};
          if (placed.every((p) => Math.hypot(p.x - c.x, p.y - c.y) > p.r + c.r + 2)) placed.push(c);
        }
        placed.forEach((c, i) => {
          out.push(<circle key={`a${i}`} cx={c.x} cy={c.y} r={c.r} fill={P[1]} opacity={0.85} />);
          out.push(<circle key={`b${i}`} cx={c.x} cy={c.y} r={c.r} fill="none" stroke={P[4]} strokeWidth={m / 600} opacity={0.6} />);
          out.push(<circle key={`n${i}`} cx={c.x + c.r * 0.2} cy={c.y - c.r * 0.1} r={c.r * 0.28} fill={P[3]} />);
        });
        return out;
      }
      case 'petals': {
        const out: React.ReactNode[] = [];
        for (let k = 0; k < 7; k++) {
          const cx = rand() * w;
          const cy = rand() * h;
          const s = m * (0.06 + rand() * 0.1);
          const col = P[1 + (k % (P.length - 1))];
          for (let i = 0; i < 8; i++)
            out.push(<ellipse key={`${k}-${i}`} cx={cx} cy={cy - s} rx={s * 0.42} ry={s} fill={col} opacity={0.9} transform={`rotate(${i * 45} ${cx} ${cy})`} />);
          out.push(<circle key={`c${k}`} cx={cx} cy={cy} r={s * 0.35} fill={P[3] ?? P[1]} />);
        }
        return out;
      }
      case 'waves': {
        return Array.from({length: 34}, (_, i) => {
          const y0 = (i / 33) * h;
          const amp = m * (0.01 + 0.03 * Math.sin(i * 0.4));
          const d = Array.from({length: 61}, (_, k) => `${k ? 'L' : 'M'}${(k / 60) * w},${y0 + Math.sin(k / 6 + i * 0.5) * amp}`).join(' ');
          return <path key={i} d={d} fill="none" stroke={P[1 + (i % (P.length - 1))]} strokeWidth={m / 260} />;
        });
      }
      case 'gradient': {
        const blobs = Array.from({length: 5}, (_, i) => ({x: rand() * w, y: rand() * h, r: m * (0.4 + rand() * 0.5), c: P[1 + (i % (P.length - 1))]}));
        return (
          <>
            <defs>
              {blobs.map((b, i) => (
                <radialGradient key={i} id={`${id}g${i}`}>
                  <stop offset="0%" stopColor={b.c} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={b.c} stopOpacity={0} />
                </radialGradient>
              ))}
            </defs>
            {blobs.map((b, i) => (
              <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={`url(#${id}g${i})`} />
            ))}
          </>
        );
      }
      case 'type': {
        const words = ['Aa', 'Rg', 'Qu', '&', 'fi', 'Sy', 'ee', 'Mo', 'ak', '?'];
        const size = m / 6;
        const out: React.ReactNode[] = [];
        let k = 0;
        for (let y = size; y < h + size; y += size * 0.95)
          for (let x = -size * 0.2; x < w; x += size * 1.7)
            out.push(
              <text key={k} x={x} y={y} fontFamily="Newsreader, Georgia, serif" fontSize={size} fill={P[1 + (k++ % 2)]} opacity={0.92}>
                {words[Math.floor(rand() * words.length)]}
              </text>,
            );
        return out;
      }
      default:
        return null;
    }
  }, [material, w, h, P, seed, id]);

  if (material === 'horizon') return <Horizon palette={P} width={w} height={h} rise={t} />;

  // gentle life: every material breathes a little through the shot
  const scale = 1 + t * 0.05;
  return (
    <AbsoluteFill style={{transform: `scale(${scale})`}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        {content}
      </svg>
      {P[0] && isLight(P[0]) ? <PaperTexture opacity={0.07} seed={seed} /> : null}
    </AbsoluteFill>
  );
};

const GridLines: React.FC<{w: number; h: number; cell: number; color: string; opacity?: number}> = ({w, h, cell, color, opacity = 0.25}) => {
  const lines: React.ReactNode[] = [];
  for (let x = 0; x < w; x += cell) lines.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={h} stroke={color} strokeWidth={1} opacity={opacity} />);
  for (let y = 0; y < h; y += cell) lines.push(<line key={`y${y}`} x1={0} y1={y} x2={w} y2={y} stroke={color} strokeWidth={1} opacity={opacity} />);
  return <>{lines}</>;
};

function isLight(c: string) {
  const n = parseInt(c.replace('#', ''), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) > 140;
}
