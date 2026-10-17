// The critic's real report on this film, played back from its cast (shots/critic.cast.json).
export default {
  url: '/engine/players/terminal.html?cast=/films/slate-launch/shots/critic.cast.json&speed=3&gap=0.25&size=26&theme=chalk&align=top',
  width: 1920, height: 800, scale: 1.25,
  async run(rec) {
    rec.mark('start');
    await rec.hold(0.2);
    await rec.type('#cmd', 'python3 tools/critic.py out/slate-launch.mp4', {cps: 24});
    await rec.press('Enter');
    rec.mark('m1');
    const len = await rec.do(() => window.castLength());
    await rec.hold(len + 3);
  },
};
