import type {Brand} from './types';

export const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';
export const SERIF = 'Newsreader, Georgia, serif';

export function resolveBrand(b: Brand): Required<Brand> {
  return {
    name: b.name,
    accent: b.accent,
    accent2: b.accent2 ?? b.accent,
    ink: b.ink,
    paper: b.paper,
    muted: b.muted ?? mix(b.ink, b.paper, 0.55),
    sans: b.sans ? `${b.sans}, ${SANS}` : SANS,
    serif: b.serif ? `${b.serif}, ${SERIF}` : SERIF,
    wordmark: b.wordmark ?? 'serif',
    mark: b.mark ?? 'slate',
  };
}

function hex(c: string): [number, number, number] {
  const h = c.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Linear mix of two hex colors; t=0 gives a, t=1 gives b.
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const f = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${f(r1, r2)}${f(g1, g2)}${f(b1, b2)}`;
}

export function alpha(c: string, a: number): string {
  const [r, g, b] = hex(c);
  return `rgba(${r},${g},${b},${a})`;
}

export function isDark(c: string): boolean {
  const [r, g, b] = hex(c);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}
