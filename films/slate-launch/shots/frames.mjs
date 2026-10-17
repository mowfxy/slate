// The film's frames arriving one by one, as the renderer captures them.
export default {
  url: '/films/slate-launch/shots/frames.html',
  width: 1920, height: 800, scale: 1.25,
  async run(rec) {
    await rec.do(() => window.start(14));
    rec.mark('start');
    await rec.hold(1.6);
    rec.mark('m1');
    await rec.hold(1.6);
    rec.mark('m2');
    await rec.hold(1.6);
    rec.mark('m3');
    await rec.hold(1.4);
  },
};
