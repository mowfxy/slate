// The real app: nine to-dos in the tray, one click, and each lands in the day on an eighth note.
export default {
  url: '/films/dayline-ad/app/index.html?bpm=92',
  width: 1920, height: 1080, scale: 1.5,
  ready: () => !!window.app?.ready,
  async run(rec) {
    rec.mark('start');
    await rec.cursor(1180, 760);
    await rec.hold(0.5);
    await rec.move('#go', {dur: 0.9});
    await rec.hold(0.15);
    rec.mark('click');
    await rec.click();
    await rec.hold(9 * (30 / 92) + 1.6);
  },
};
