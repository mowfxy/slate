import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import type {CameraKey, CursorKey, SceneProps} from '../lib/types';
import {easeCamera, easeOut, enter} from '../lib/motion';
import {alpha} from '../lib/theme';
import {Backdrop} from './Backdrop';
import {Material} from './Materials';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export type Cam = {x: number; y: number; zoom: number};

// Camera keyframes are in content-normalized coords: (0.5, 0.5, 1) frames the whole thing.
export function cameraAt(keys: CameraKey[] | undefined, t: number): Cam {
  const ks = (keys && keys.length ? keys : [{t: 0}]).map((k) => ({t: k.t, x: k.x ?? 0.5, y: k.y ?? 0.5, zoom: k.zoom ?? 1}));
  if (t <= ks[0].t) return ks[0];
  for (let i = 1; i < ks.length; i++) {
    const a = ks[i - 1];
    const b = ks[i];
    if (t <= b.t) {
      const e = easeCamera((t - a.t) / Math.max(1e-6, b.t - a.t));
      return {
        x: a.x + (b.x - a.x) * e,
        y: a.y + (b.y - a.y) * e,
        zoom: Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * e),
      };
    }
  }
  return ks[ks.length - 1];
}

// Positions content of size cw×ch so the camera's focus sits at frame center.
export const CameraRig: React.FC<{cam: Cam; cw: number; ch: number; width: number; height: number; children: React.ReactNode}> = ({cam, cw, ch, width, height, children}) => {
  const tx = -(cam.x - 0.5) * cw * cam.zoom;
  const ty = -(cam.y - 0.5) * ch * cam.zoom;
  return (
    <div
      style={{
        position: 'absolute',
        left: (width - cw) / 2,
        top: (height - ch) / 2,
        width: cw,
        height: ch,
        transform: `translate(${tx}px, ${ty}px) scale(${cam.zoom})`,
        transformOrigin: '50% 50%',
      }}
    >
      {children}
    </div>
  );
};

// Screen-space position of a content point under the camera.
export function project(px: number, py: number, cam: Cam, cw: number, ch: number, width: number, height: number) {
  return {x: width / 2 + (px - cam.x) * cw * cam.zoom, y: height / 2 + (py - cam.y) * ch * cam.zoom};
}

export function cursorAt(keys: CursorKey[], t: number) {
  if (!keys.length) return null;
  const first = keys[0];
  const visible = interpolate(t, [first.t - 0.9, first.t - 0.6], [0, 1], clamp);
  let x = first.x;
  let y = first.y;
  let press = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const prev = keys[i - 1];
    if (prev) {
      // travel during the last 0.7s before arriving, with a slight human arc
      const dur = Math.min(0.7, k.t - prev.t);
      const e = easeCamera(interpolate(t, [k.t - dur, k.t], [0, 1], clamp));
      const dx = k.x - prev.x;
      const dy = k.y - prev.y;
      const arc = Math.sin(Math.PI * e) * 0.12;
      if (t >= k.t - dur) {
        x = prev.x + dx * e - dy * arc;
        y = prev.y + dy * e + dx * arc;
      }
    } else if (t < k.t) {
      // first key: drift in from slightly below-right
      const e = easeOut(interpolate(t, [k.t - 0.9, k.t], [0, 1], clamp));
      x = k.x + 0.06 * (1 - e);
      y = k.y + 0.1 * (1 - e);
    }
    if (k.click) press = Math.max(press, interpolate(t, [k.t - 0.05, k.t, k.t + 0.12], [0, 1, 0], clamp));
  }
  const last = [...keys].reverse().find((k) => k.click && t >= k.t);
  const ripple = last ? (t - last.t) / 0.45 : 1;
  return {x, y, visible, press, ripple, rippleAt: last};
}

export const Cursor: React.FC<{x: number; y: number; size: number; press: number; visible: number}> = ({x, y, size, press, visible}) => (
  <svg
    width={size}
    height={size * 1.5}
    viewBox="0 0 20 30"
    style={{position: 'absolute', left: x - size * 0.12, top: y - size * 0.06, opacity: visible, transform: `scale(${1 - press * 0.16})`, transformOrigin: '10% 5%', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))'}}
  >
    <path d="M2 1 L2 23 L7.5 17.8 L11.2 26.5 L14.6 25 L11 16.6 L18.4 16.6 Z" fill="#111" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
);

const Ripple: React.FC<{x: number; y: number; p: number; size: number}> = ({x, y, p, size}) =>
  p >= 0 && p < 1 ? (
    <div
      style={{
        position: 'absolute',
        left: x - size * p,
        top: y - size * p,
        width: size * 2 * p,
        height: size * 2 * p,
        borderRadius: '50%',
        border: `2px solid rgba(0,0,0,${0.35 * (1 - p)})`,
      }}
    />
  ) : null;

const WindowChrome: React.FC<{w: number; h: number; title?: string; u: number; children: React.ReactNode}> = ({w, h, title, u, children}) => {
  const bar = 40 * u;
  return (
    <div style={{width: w, height: h, borderRadius: 14 * u, overflow: 'hidden', background: '#fff', boxShadow: `0 ${30 * u}px ${90 * u}px rgba(0,0,0,0.28), 0 0 0 ${Math.max(1, u)}px rgba(0,0,0,0.08)`}}>
      <div style={{height: bar, display: 'flex', alignItems: 'center', gap: 8 * u, padding: `0 ${16 * u}px`, background: '#f6f6f5', borderBottom: `${Math.max(1, u)}px solid #e8e8e6`}}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <div key={c} style={{width: 12 * u, height: 12 * u, borderRadius: '50%', background: c}} />
        ))}
        <div style={{flex: 1, textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: 14 * u, fontWeight: 500, color: '#444', marginRight: 52 * u}}>{title}</div>
      </div>
      <div style={{width: w, height: h - bar, overflow: 'hidden'}}>{children}</div>
    </div>
  );
};

// A screenshot or screen capture in a window, with a camera that pushes in on what matters.
export const UIShot: React.FC<SceneProps & {imageSize?: [number, number]}> = ({scene, brand, fps, width, height, imageSize}) => {
  const frame = useCurrentFrame();
  const t = frame / fps;
  const u = Math.min(width, height * 1.78) / 1920;
  const [iw, ih] = imageSize ?? [1600, 1000];
  const framed = scene.frame !== 'none';
  const bar = framed ? 40 * u : 0;
  const maxW = width * 0.8;
  const maxH = height * 0.8 - bar;
  const s = Math.min(maxW / iw, maxH / ih);
  const cw = iw * s;
  const ch = ih * s + bar;
  const cam = cameraAt(scene.camera, t);
  const enterP = enter(frame, fps, 0, 0.6);
  const cur = cursorAt(scene.cursor ?? [], t);
  // cursor keys are in image coords; convert to content coords (window adds a title bar)
  const toContent = (x: number, y: number) => ({x, y: (bar + y * ih * s) / ch});
  const dark = scene.backdrop === 'space' || scene.backdrop === 'dark';
  const img = <Img src={staticFile(scene.image!)} style={{width: cw, height: ih * s, display: 'block'}} />;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Backdrop kind={scene.backdrop ?? 'paper'} paper={brand.paper} ink={brand.ink} accent={brand.accent} width={width} height={height} />
      <AbsoluteFill style={{opacity: enterP, transform: `translateY(${(1 - enterP) * 30 * u}px)`}}>
        <CameraRig cam={cam} cw={cw} ch={ch} width={width} height={height}>
          {framed ? (
            <WindowChrome w={cw} h={ch} title={scene.windowTitle} u={u}>
              {img}
            </WindowChrome>
          ) : (
            <div style={{borderRadius: 12 * u, overflow: 'hidden', boxShadow: dark ? '0 30px 90px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.12)'}}>{img}</div>
          )}
        </CameraRig>
        {cur
          ? (() => {
              const c = toContent(cur.x, cur.y);
              const p = project(c.x, c.y, cam, cw, ch, width, height);
              const r = cur.rippleAt ? toContent(cur.rippleAt.x, cur.rippleAt.y) : null;
              const rp = r ? project(r.x, r.y, cam, cw, ch, width, height) : null;
              return (
                <>
                  {rp ? <Ripple x={rp.x} y={rp.y} p={cur.ripple} size={36 * u} /> : null}
                  <Cursor x={p.x} y={p.y} size={30 * u} press={cur.press} visible={cur.visible} />
                </>
              );
            })()
          : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Icon: React.FC<{d: string; size: number; color: string; stroke?: number}> = ({d, size, color, stroke = 2}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

// The prompt box every AI launch needs: typed prompt, chips, a decisive send.
export const PromptBox: React.FC<SceneProps> = ({scene, tl, brand, fps, width, height}) => {
  const frame = useCurrentFrame();
  const t = frame / fps;
  const u = Math.min(width, height * 1.78) / 1920;
  const W = 1000 * u;
  const H = 212 * u;
  const lead = scene.typeDelay ?? 0.5;
  const cps = scene.cps ?? 16;
  const prompt = scene.prompt ?? '';
  const n = Math.max(0, Math.floor((t - lead) * cps + 1e-6));
  const typed = prompt.slice(0, n);
  const typedAt = tl.typedAt ?? 0;
  const sendAt = tl.sendAt ?? 1e9;
  const zoomFrom = scene.zoomFrom ?? 1.55;
  const keys: CameraKey[] = scene.camera ?? [
    {t: 0, x: 0.3, y: 0.33, zoom: zoomFrom},
    {t: Math.max(0.6, typedAt * 0.55), x: 0.38, y: 0.4, zoom: (zoomFrom + 1) / 2},
    {t: Math.max(1.2, typedAt + 0.1), x: 0.5, y: 0.5, zoom: 1},
  ];
  const cam = cameraAt(keys, t);
  const box = {cw: W, ch: H};
  const sendPos = {x: 0.948, y: 0.755};
  const cursorKeys: CursorKey[] = scene.send === false ? [] : [{t: sendAt - 0.75, x: 0.82, y: 1.25}, {t: sendAt, x: sendPos.x, y: sendPos.y, click: true}];
  const cur = cursorAt(cursorKeys, t);
  const press = interpolate(t, [sendAt - 0.02, sendAt + 0.06, sendAt + 0.22], [1, 0.86, 1], clamp);
  const sent = t >= sendAt;
  const caretOn = !sent && (t < typedAt + 0.1 || Math.floor(t * 2.4) % 2 === 0);
  const chipStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8 * u,
    height: 36 * u,
    padding: `0 ${14 * u}px`,
    borderRadius: 18 * u,
    border: `${Math.max(1, u)}px solid #e4e4e2`,
    fontSize: 17 * u,
    color: '#3b3b3b',
    background: '#fff',
  };
  return (
    <AbsoluteFill>
      <Backdrop kind={scene.backdrop ?? 'white'} paper={brand.paper} ink={brand.ink} accent={brand.accent} width={width} height={height} />
      <CameraRig cam={cam} cw={box.cw} ch={box.ch} width={width} height={height}>
        <div
          style={{
            width: W,
            height: H,
            boxSizing: 'border-box',
            borderRadius: 28 * u,
            background: '#fff',
            border: `${Math.max(1, u)}px solid #e6e6e4`,
            boxShadow: `0 ${18 * u}px ${60 * u}px rgba(0,0,0,0.07)`,
            padding: 28 * u,
            fontFamily: brand.sans,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{height: 84 * u, fontSize: 28 * u, lineHeight: `${42 * u}px`, color: brand.ink, overflow: 'hidden', letterSpacing: '-0.01em'}}>
            {typed.length === 0 ? <span style={{color: '#a3a3a0'}}>{scene.placeholder ?? 'Describe the video you want'}</span> : typed}
            <span style={{display: 'inline-block', width: 2.5 * u, height: 32 * u, background: brand.accent, marginLeft: 2 * u, verticalAlign: '-0.15em', opacity: caretOn ? 1 : 0}} />
          </div>
          <div style={{flex: 1}} />
          <div style={{height: 48 * u, display: 'flex', alignItems: 'center', gap: 10 * u}}>
            <div style={{...chipStyle, width: 36 * u, padding: 0, justifyContent: 'center'}}>
              <Icon d="M12 5v14M5 12h14" size={18 * u} color="#555" />
            </div>
            {(scene.chips ?? []).map((c) => (
              <div key={c} style={chipStyle}>
                {c}
              </div>
            ))}
            <div style={{flex: 1}} />
            {scene.model ? <div style={{fontSize: 17 * u, color: '#8a8a87'}}>{scene.model}</div> : null}
            <Icon d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" size={22 * u} color="#777" />
            <div
              style={{
                width: 48 * u,
                height: 48 * u,
                borderRadius: '50%',
                background: typed.length ? brand.ink : '#d5d5d2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${press})`,
              }}
            >
              {sent ? (
                <div style={{width: 14 * u, height: 14 * u, borderRadius: 3 * u, background: '#fff'}} />
              ) : (
                <Icon d="M12 19V5M5 12l7-7 7 7" size={24 * u} color="#fff" stroke={2.4} />
              )}
            </div>
          </div>
        </div>
      </CameraRig>
      {cur
        ? (() => {
            const p = project(cur.x, cur.y, cam, box.cw, box.ch, width, height);
            return <Cursor x={p.x} y={p.y} size={30 * u} press={cur.press} visible={cur.visible} />;
          })()
        : null}
    </AbsoluteFill>
  );
};

// A drifting wall of outputs (V2's "look what people built" collage).
export const CardGrid: React.FC<SceneProps> = ({scene, tl, brand, fps, width, height}) => {
  const frame = useCurrentFrame();
  const t = frame / fps;
  const items = scene.items ?? [];
  const rows = 3;
  const cardH = height * 0.3;
  const cardW = cardH * 1.6;
  const gap = cardH * 0.12;
  const cols = Math.ceil(width / (cardW + gap)) + 3;
  const total = tl.end - tl.start;
  const pan = interpolate(t, [0, total], [0, -(cardW + gap) * 1.2], clamp);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Backdrop kind={scene.backdrop ?? 'white'} paper={brand.paper} ink={brand.ink} accent={brand.accent} width={width} height={height} />
      <AbsoluteFill style={{transform: `rotate(-6deg) scale(1.12) translateX(${pan}px)`, transformOrigin: '50% 50%'}}>
        {Array.from({length: rows}, (_, r) =>
          Array.from({length: cols}, (_, c) => {
            const i = r * cols + c;
            const item = items[(i * 5 + r * 3) % items.length];
            const delay = ((c + r * 0.6) * 0.045) % 0.6;
            const p = enter(frame, fps, delay, 0.55);
            const x = c * (cardW + gap) - cardW * 0.8 + (r % 2) * (cardW / 2);
            const y = (height - rows * cardH - (rows - 1) * gap) / 2 + r * (cardH + gap);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: cardW,
                  height: cardH,
                  borderRadius: cardH * 0.06,
                  overflow: 'hidden',
                  opacity: p,
                  transform: `translateY(${(1 - p) * cardH * 0.25}px) scale(${0.92 + 0.08 * p})`,
                  boxShadow: `0 ${cardH * 0.05}px ${cardH * 0.15}px ${alpha('#000000', 0.16)}`,
                }}
              >
                <Material {...item} width={cardW} height={cardH} t={t / total} />
              </div>
            );
          }),
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
