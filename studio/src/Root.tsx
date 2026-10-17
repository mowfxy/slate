import React from 'react';
import {CalculateMetadataFunction, Composition, staticFile} from 'remotion';
import {Film, FilmProps} from './Film';
import {buildTimeline} from './lib/timeline.mjs';
import launch from '../../examples/slate-launch/spec.json';
import type {Spec} from './lib/types';

function measure(src: string) {
  return new Promise<[number, number]>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
    img.onerror = () => reject(new Error(`Could not load image ${src}`));
    img.src = staticFile(src);
  });
}

// Size the composition from the spec, and measure screenshots so the camera math is exact.
const calculateMetadata: CalculateMetadataFunction<FilmProps> = async ({props}) => {
  const tl = buildTimeline(props.spec);
  const images = props.spec.scenes.filter((s) => s.type === 'uiShot' && s.image).map((s) => s.image as string);
  const imageSizes: Record<string, [number, number]> = {...(props.imageSizes ?? {})};
  for (const src of images) if (!imageSizes[src]) imageSizes[src] = await measure(src);
  return {
    durationInFrames: tl.totalFrames,
    fps: tl.fps,
    width: tl.width,
    height: tl.height,
    props: {...props, imageSizes},
  };
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Film"
    component={Film}
    durationInFrames={300}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{spec: launch as unknown as Spec, audio: null}}
    calculateMetadata={calculateMetadata}
  />
);
