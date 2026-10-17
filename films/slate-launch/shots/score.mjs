// The studio's timeline up close: the playhead runs over the cues, and the waveform peaks on them.
export default {
  url: '/films/slate-launch/index.html?preview&panel=520&zoom=5&ui=1.7&t=27.4',
  ready: () => !!window.__studio?.ready,
  width: 1920, height: 800, scale: 1.25,
  async run(rec) {
    await rec.hold(0.1);
    rec.mark('start');
    await rec.hold(2.4);
    rec.mark('m1');
    await rec.hold(2.4);
    rec.mark('m2');
    await rec.hold(3);
  },
};
