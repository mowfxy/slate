// The Slate spec: what Claude writes, what the studio renders.
// See docs/spec.md at the repo root for the full reference.

export type Brand = {
  name: string;
  accent: string; // the one accent color
  accent2?: string; // second accent, only for bracketTitle "( )"
  ink: string; // primary text
  paper: string; // canvas
  muted?: string;
  sans?: string;
  serif?: string;
  wordmark?: 'sans' | 'serif';
  mark?: 'slate' | 'none';
};

export type Look = {
  grain?: number; // 0..1 film grain amount
  vignette?: number;
};

export type CameraKey = {t: number; x?: number; y?: number; zoom?: number};
export type CursorKey = {t: number; x: number; y: number; click?: boolean};

export type MaterialItem = {
  material?: string;
  image?: string;
  palette?: string[];
  seed?: number;
};

export type Backdrop = 'paper' | 'white' | 'space' | 'grid' | 'accent' | 'horizon' | 'dark';

export type Scene = {
  type: string;
  beats?: number;
  seconds?: number;
  transition?: 'cut' | 'fade' | 'blur';
  energy?: number;
  text?: string;
  sub?: string;
  prompt?: string;
  placeholder?: string;
  chips?: string[];
  model?: string;
  image?: string;
  frame?: 'window' | 'none';
  windowTitle?: string;
  backdrop?: Backdrop;
  camera?: CameraKey[];
  cursor?: CursorKey[];
  items?: MaterialItem[];
  mask?: 'none' | 'lens' | 'glyph' | 'horizon';
  glyph?: string;
  overlay?: string[];
  pacing?: 'accelerate' | 'steady' | 'decelerate';
  background?: string | MaterialItem;
  font?: 'sans' | 'serif';
  size?: number;
  tagline?: string;
  footnote?: string;
  zoomFrom?: number;
  cps?: number;
  typeDelay?: number;
  sendPause?: number;
  send?: boolean;
  hit?: boolean;
  from?: number;
  to?: number;
};

export type Spec = {
  meta: {
    title: string;
    archetype?: 'demo' | 'teaser' | 'ad' | 'feature';
    fps?: number;
    width?: number;
    height?: number;
    bpm?: number;
    cps?: number;
  };
  brand: Brand;
  look?: Look;
  audio?: {key?: string; style?: string; music?: string};
  scenes: Scene[];
};

export type TimelineScene = {
  index: number;
  type: string;
  start: number;
  end: number;
  startFrame: number;
  durationFrames: number;
  energy: number;
  typedAt?: number;
  sendAt?: number;
  shots?: {start: number; startFrame: number; item: number}[];
};

export type Timeline = {
  fps: number;
  width: number;
  height: number;
  bpm: number;
  duration: number;
  totalFrames: number;
  scenes: TimelineScene[];
};

export type SceneProps = {
  scene: Scene;
  tl: TimelineScene;
  brand: Required<Brand>;
  fps: number;
  width: number;
  height: number;
};
