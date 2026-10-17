import {Easing, interpolate} from 'remotion';

// Decisive in-out: fast through the middle, soft landing. Used for camera moves.
export const easeCamera = Easing.bezier(0.65, 0, 0.25, 1);
// Soft arrival for things entering the frame.
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

// 0→1 over [start, start+dur] seconds with easeOut.
export function enter(frame: number, fps: number, start = 0, dur = 0.5) {
  return interpolate(frame / fps, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOut,
  });
}
