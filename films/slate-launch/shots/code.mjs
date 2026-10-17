// This film's own source, in an editor: the line you just read on screen is typed back in.
export default {
  url: '/engine/players/code.html?file=/films/slate-launch/film.js&size=30',
  width: 1920, height: 800, scale: 1.25,
  ready: () => !!window.code,
  async run(rec) {
    const target = await rec.do(() => code.lineTop("line('l-page'"));
    await rec.do((y) => { document.getElementById('code').scrollTop = y - 560; }, target);
    rec.mark('start');
    await rec.cursor(1560, 690);
    await rec.scroll('#code', 300, {dur: 1.2});
    const text = await rec.do(() => code.erase("line('l-page'"));
    await rec.hold(0.25);
    rec.mark('m1');
    await rec.type('.edit', text, {cps: 26});
    rec.mark('typed');
    await rec.hold(0.3);
    await rec.do(() => code.select("line('l-page'"));
    rec.mark('m2');
    await rec.hold(1.6);
  },
};
