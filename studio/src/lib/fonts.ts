import {continueRender, delayRender} from 'remotion';
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff2';
import inter500 from '@fontsource/inter/files/inter-latin-500-normal.woff2';
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff2';
import news400 from '@fontsource/newsreader/files/newsreader-latin-400-normal.woff2';
import news500 from '@fontsource/newsreader/files/newsreader-latin-500-normal.woff2';
import news400i from '@fontsource/newsreader/files/newsreader-latin-400-italic.woff2';

const faces: [string, string, string, string][] = [
  ['Inter', inter400, '400', 'normal'],
  ['Inter', inter500, '500', 'normal'],
  ['Inter', inter600, '600', 'normal'],
  ['Newsreader', news400, '400', 'normal'],
  ['Newsreader', news500, '500', 'normal'],
  ['Newsreader', news400i, '400', 'italic'],
];

let started = false;

// Block rendering until bundled fonts are ready so no frame renders in a fallback face.
export function loadFonts() {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('Loading fonts');
  Promise.all(
    faces.map(([family, url, weight, style]) => {
      const face = new FontFace(family, `url(${url}) format('woff2')`, {weight, style});
      document.fonts.add(face);
      return face.load();
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
}
