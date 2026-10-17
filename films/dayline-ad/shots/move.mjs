// Drag one thing later in the day; the rest of the morning slides up to fill the gap, one block per eighth note.
export default {
  url: '/films/dayline-ad/app/index.html?bpm=92&state=placed',
  width: 1920, height: 1080, scale: 2.5, fps: 60, // 60 fps to match the film; 2.5x so the camera can go in close and stay sharp
  ready: () => !!window.app?.ready,
  async run(rec) {
    rec.mark('start');
    await rec.cursor(1400, 900);
    await rec.hold(0.4);
    const sel = '.col[data-day="0"] .block:nth-child(2)';
    const box = await rec.page.locator(sel).boundingBox();
    await rec.rect('block', sel);
    await rec.rect('grid', '#grid');
    const p = {x: box.x + box.width * 0.35, y: box.y + box.height / 2};
    await rec.move(p, {dur: 0.8});
    await rec.page.mouse.down();
    rec.mark('grab');
    await rec.hold(0.15);
    await rec.move({x: p.x + 6, y: p.y + 4 * 56}, {dur: 2 * (60 / 92) - 0.15}); // the drop lands two beats after the grab
    await rec.page.mouse.up();
    rec.mark('drop');
    await rec.hold(0.1);
    await rec.move({x: p.x + 260, y: p.y + 4 * 56 + 120}, {dur: 0.8});
    await rec.hold(1.6);
  },
};
