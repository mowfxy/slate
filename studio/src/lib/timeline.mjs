// Timeline: turns a Slate spec into absolute scene timings, cut points and
// sound events. Plain ESM so the Remotion bundle, the Node render script and
// the Python score generator (via build/timeline.json) all share one truth.

export const SCENE_TYPES = [
  'logo',
  'typeTitle',
  'bracketTitle',
  'promptBox',
  'uiShot',
  'montage',
  'cardGrid',
  'titleCard',
  'logoEnd',
];

// Default music energy per scene type (0..1). Drives the score's arrangement.
const ENERGY = {
  logo: 0.15,
  typeTitle: 0.35,
  bracketTitle: 0.5,
  promptBox: 0.45,
  uiShot: 0.55,
  montage: 0.9,
  cardGrid: 0.8,
  titleCard: 0.45,
  logoEnd: 0.12,
};

export const DEFAULTS = {
  fps: 30,
  width: 1920,
  height: 1080,
  bpm: 100,
  cps: 16, // typing speed, characters per second
  typeDelay: 0.3,
};

// Shot lengths a montage may use, in beats. Cuts always land on these.
const BEAT_STEPS = [8, 4, 2, 1, 0.5, 0.25];

export function stripMarkup(text) {
  return String(text).replace(/[*]/g, '');
}

export function wordCount(text) {
  return stripMarkup(text)
    .replace(/[[\]()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function sceneSeconds(scene, bpm, i) {
  if (typeof scene.beats === 'number') return (scene.beats * 60) / bpm;
  if (typeof scene.seconds === 'number') return scene.seconds;
  throw new Error(`scene ${i} (${scene.type}) needs "beats" or "seconds"`);
}

function quantizeStep(beats) {
  let best = BEAT_STEPS[0];
  for (const s of BEAT_STEPS) {
    if (Math.abs(Math.log2(s / beats)) < Math.abs(Math.log2(best / beats))) best = s;
  }
  return best;
}

/**
 * Shot lengths (in beats) for a montage of `totalBeats`.
 * pacing: "accelerate" | "steady" | "decelerate"; from/to are shot lengths in beats.
 */
export function montageShots(totalBeats, pacing = 'accelerate', from = 1, to = 0.25) {
  if (pacing === 'steady') to = from;
  if (pacing === 'decelerate') [from, to] = [to, from];
  const shots = [];
  let t = 0;
  while (t < totalBeats - 1e-6) {
    const p = Math.min(1, t / totalBeats);
    // geometric interpolation reads as a smooth acceleration to the ear
    const len = quantizeStep(from * Math.pow(to / from, p));
    const remaining = totalBeats - t;
    const step = Math.min(len, remaining);
    shots.push(step);
    t += step;
  }
  return shots;
}

function typingTicks(text, start, cps, delay) {
  const ticks = [];
  const plain = stripMarkup(text);
  for (let c = 0; c < plain.length; c++) {
    if (plain[c] === ' ') continue;
    ticks.push({ t: start + delay + c / cps, type: 'key' });
  }
  return { ticks, end: start + delay + plain.length / cps };
}

export function validateSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== 'object') return ['spec must be an object'];
  if (!Array.isArray(spec.scenes) || spec.scenes.length === 0) errors.push('spec.scenes must be a non-empty array');
  (spec.scenes || []).forEach((s, i) => {
    if (!SCENE_TYPES.includes(s.type)) errors.push(`scene ${i}: unknown type "${s.type}"`);
    if (typeof s.beats !== 'number' && typeof s.seconds !== 'number') errors.push(`scene ${i}: needs "beats" or "seconds"`);
    if (['typeTitle', 'bracketTitle', 'titleCard'].includes(s.type) && !s.text) errors.push(`scene ${i}: needs "text"`);
    if (s.type === 'promptBox' && !s.prompt) errors.push(`scene ${i}: needs "prompt"`);
    if (s.type === 'uiShot' && !s.image) errors.push(`scene ${i}: needs "image"`);
    if (s.type === 'montage' && (!Array.isArray(s.items) || s.items.length === 0)) errors.push(`scene ${i}: needs "items"`);
    if (s.type === 'cardGrid' && (!Array.isArray(s.items) || s.items.length === 0)) errors.push(`scene ${i}: needs "items"`);
  });
  return errors;
}

export function buildTimeline(spec) {
  const errors = validateSpec(spec);
  if (errors.length) throw new Error('Invalid spec:\n  ' + errors.join('\n  '));
  const meta = { ...DEFAULTS, ...(spec.meta || {}) };
  const { fps, bpm } = meta;
  const beat = 60 / bpm;
  const scenes = [];
  const events = [];
  let t = 0;

  spec.scenes.forEach((scene, index) => {
    const seconds = sceneSeconds(scene, bpm, index);
    const start = t;
    const end = t + seconds;
    const entry = {
      index,
      type: scene.type,
      start,
      end,
      startFrame: Math.round(start * fps),
      durationFrames: Math.max(1, Math.round(end * fps) - Math.round(start * fps)),
      energy: typeof scene.energy === 'number' ? scene.energy : ENERGY[scene.type],
    };
    const cps = scene.cps || meta.cps;
    const delay = scene.typeDelay ?? meta.typeDelay;

    switch (scene.type) {
      case 'typeTitle': {
        const { ticks, end: typed } = typingTicks(scene.text, start, cps, delay);
        events.push(...ticks);
        entry.typedAt = typed - start;
        break;
      }
      case 'bracketTitle': {
        const { ticks, end: typed } = typingTicks(scene.text, start, cps, delay);
        events.push(...ticks);
        const plain = stripMarkup(scene.text);
        for (let c = 0; c < plain.length; c++) {
          if ('[('.includes(plain[c])) events.push({ t: start + delay + c / cps, type: 'pop' });
        }
        entry.typedAt = typed - start;
        break;
      }
      case 'promptBox': {
        const lead = scene.typeDelay ?? 0.5;
        const { ticks, end: typed } = typingTicks(scene.prompt, start, cps, lead);
        events.push(...ticks);
        const sendAt = typed + (scene.sendPause ?? 0.45);
        if (scene.send !== false && sendAt < end) events.push({ t: sendAt, type: 'click' });
        entry.typedAt = typed - start;
        entry.sendAt = sendAt - start;
        break;
      }
      case 'uiShot': {
        const cam = scene.camera || [];
        for (let k = 1; k < cam.length; k++) {
          const dz = Math.abs(Math.log((cam[k].zoom || 1) / (cam[k - 1].zoom || 1)));
          const dist = Math.hypot((cam[k].x ?? 0.5) - (cam[k - 1].x ?? 0.5), (cam[k].y ?? 0.5) - (cam[k - 1].y ?? 0.5));
          if (dz > 0.25 || dist > 0.15) events.push({ t: start + cam[k - 1].t, type: 'whoosh', len: cam[k].t - cam[k - 1].t });
        }
        for (const c of scene.cursor || []) if (c.click) events.push({ t: start + c.t, type: 'click' });
        break;
      }
      case 'montage': {
        const totalBeats = seconds / beat;
        const shots = montageShots(totalBeats, scene.pacing, scene.from ?? 1, scene.to ?? 0.25);
        const cuts = [];
        let b = 0;
        shots.forEach((len) => {
          cuts.push(start + b * beat);
          b += len;
        });
        entry.shots = shots.map((len, k) => ({
          start: cuts[k] - start,
          startFrame: Math.round(cuts[k] * fps) - entry.startFrame,
          item: k % scene.items.length,
        }));
        cuts.slice(1).forEach((c) => events.push({ t: c, type: 'cut' }));
        break;
      }
      case 'cardGrid':
        events.push({ t: start, type: 'whoosh', len: Math.min(1.2, seconds) });
        break;
      case 'titleCard':
        if (scene.hit !== false) events.push({ t: start, type: 'hit' });
        break;
      case 'logoEnd':
        events.push({ t: start, type: 'resolve' });
        break;
      default:
        break;
    }
    // Every hard scene change is a cut, unless the scene asks to dissolve in.
    if (index > 0 && (scene.transition ?? 'cut') === 'cut') events.push({ t: start, type: 'cut', scene: true });
    scenes.push(entry);
    t = end;
  });

  const duration = t;
  events.sort((a, b) => a.t - b.t);
  return {
    title: spec.meta?.title || 'Untitled',
    archetype: spec.meta?.archetype || 'demo',
    fps,
    width: meta.width,
    height: meta.height,
    bpm,
    key: spec.audio?.key || (meta.archetype === 'teaser' ? 'A' : 'D'),
    musicStyle: spec.audio?.style || (meta.archetype === 'teaser' ? 'pulse' : 'glass'),
    duration,
    totalFrames: Math.round(duration * fps),
    scenes,
    events,
    reading: spec.scenes.map((s, i) => {
      const text = s.text || s.overlay?.join(' ') || '';
      return { scene: i, words: text ? wordCount(text) : 0, seconds: scenes[i].end - scenes[i].start };
    }),
  };
}
