// The week view: the day narrows into Monday and the rest of the week fills in, a sixteenth note apart.
export default {
  url: '/films/dayline-ad/app/index.html?bpm=92&state=placed',
  width: 1920, height: 1080, scale: 2.5, fps: 60, // 60 fps to match the film; 2.5x so the camera can go in close and stay sharp
  ready: () => !!window.app?.ready,
  async run(rec) {
    rec.mark('start');
    await rec.rect('week', '#weekBtn');
    await rec.rect('grid', '#grid');
    await rec.cursor(1300, 300);
    await rec.hold(0.3);
    await rec.move('#weekBtn', {dur: 0.7});
    rec.mark('click');
    await rec.click();
    await rec.hold(0.6 + 19 * (15 / 92) + 1.8);
  },
};
