// The studio playing this film, with its timeline and score; the pointer scrubs back to a clap.
export default {
  url: '/films/slate-launch/index.html?preview&ui=1.3&t=2.9',
  ready: () => !!window.__studio?.ready,
  width: 1920, height: 800, scale: 1.25,
  async run(rec) {
    await rec.hold(0.1);
    rec.mark('start');
    await rec.cursor(1300, 560);
    await rec.hold(2.2);
    rec.mark('m1');
    await rec.hold(1.4);
    await rec.move({x: 560, y: 735}, {dur: 0.7});
    await rec.click();
    rec.mark('m2');
    await rec.move({x: 640, y: 735}, {dur: 1.2});
    await rec.hold(0.6);
  },
};
