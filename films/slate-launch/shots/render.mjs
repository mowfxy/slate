// A real render of this film, played back from its cast (shots/render.cast.json, made by engine/termcast.mjs).
export default {
  url: '/engine/players/terminal.html?cast=/films/slate-launch/shots/render.cast.json&speed=14&gap=0.5&size=30&theme=chalk&align=top',
  width: 1920, height: 800, scale: 1.25,
  async run(rec) {
    rec.mark('start');
    await rec.hold(0.3);
    await rec.type('#cmd', 'node engine/render.mjs films/slate-launch', {cps: 22});
    await rec.hold(0.25);
    await rec.press('Enter');
    rec.mark('m1');
    const len = await rec.do(() => window.castLength());
    await rec.hold(len * 0.5);
    rec.mark('m2');
    await rec.hold(len * 0.5 + 1.2);
  },
};
