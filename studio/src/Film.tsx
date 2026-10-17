import React, {useMemo} from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Scene, SceneProps, Spec, Timeline} from './lib/types';
import {buildTimeline} from './lib/timeline.mjs';
import {resolveBrand} from './lib/theme';
import {loadFonts} from './lib/fonts';
import {Grain, Vignette} from './components/Backdrop';
import {BracketTitle, TypeTitle} from './components/Type';
import {LogoEnd, LogoScene, TitleCard} from './components/Brand';
import {CardGrid, PromptBox, UIShot} from './components/UI';
import {Montage} from './components/Montage';

loadFonts();

export type FilmProps = {
  spec: Spec;
  audio?: string | null;
  imageSizes?: Record<string, [number, number]>;
};

const SceneSwitch: React.FC<SceneProps & {cps: number; imageSizes: FilmProps['imageSizes']}> = (props) => {
  const {scene} = props;
  switch (scene.type) {
    case 'logo':
      return <LogoScene {...props} />;
    case 'typeTitle':
      return <TypeTitle {...props} />;
    case 'bracketTitle':
      return <BracketTitle {...props} />;
    case 'promptBox':
      return <PromptBox {...props} />;
    case 'uiShot':
      return <UIShot {...props} imageSize={props.imageSizes?.[scene.image ?? '']} />;
    case 'montage':
      return <Montage {...props} />;
    case 'cardGrid':
      return <CardGrid {...props} />;
    case 'titleCard':
      return <TitleCard {...props} />;
    case 'logoEnd':
      return <LogoEnd {...props} />;
    default:
      return null;
  }
};

// Soft entrances for scenes that ask for them; hard cuts are the default.
const Entrance: React.FC<{scene: Scene; children: React.ReactNode}> = ({scene, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!scene.transition || scene.transition === 'cut') return <>{children}</>;
  const p = interpolate(frame / fps, [0, 0.4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{opacity: p, filter: scene.transition === 'blur' ? `blur(${(1 - p) * 18}px)` : undefined}}>{children}</AbsoluteFill>;
};

export const Film: React.FC<FilmProps> = ({spec, audio, imageSizes}) => {
  const tl = useMemo(() => buildTimeline(spec) as Timeline, [spec]);
  const brand = resolveBrand(spec.brand);
  const cps = spec.meta.cps ?? 16;
  return (
    <AbsoluteFill style={{background: brand.paper}}>
      {tl.scenes.map((s) => (
        <Sequence key={s.index} from={s.startFrame} durationInFrames={s.durationFrames} name={`${s.index} ${s.type}`}>
          <Entrance scene={spec.scenes[s.index]}>
            <SceneSwitch scene={spec.scenes[s.index]} tl={s} brand={brand} fps={tl.fps} width={tl.width} height={tl.height} cps={cps} imageSizes={imageSizes} />
          </Entrance>
        </Sequence>
      ))}
      {spec.look?.vignette ? <Vignette amount={spec.look.vignette} /> : null}
      {spec.look?.grain ? <Grain amount={spec.look.grain} /> : null}
      {audio ? <Audio src={staticFile(audio)} /> : null}
    </AbsoluteFill>
  );
};
