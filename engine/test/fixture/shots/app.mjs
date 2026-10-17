export default {
  url: '/engine/test/fixture/app.html', width: 320, height: 180, fps: 10,
  async run(rec) { await rec.cursor(10, 10); await rec.type('#q', 'hi'); await rec.click('#go', {dur: 0.3}); rec.mark('clicked'); await rec.hold(1.2); },
};
