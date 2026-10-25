// M5a live checks (Homes view behind the `plans` flag): imported by check.mjs after m1Checks; runnable alone through a scratch runner like tools/_m1-smoke.mjs.
// Each scenario opens its own page and never throws: a missing element becomes {error} and fails its check instead of killing the run.
export async function m5aChecks(b, url, ok, wire) {
  const IDS = ['1c', '2l', '3g', '3p', '3s'], SBA = { '1c': 715, '2l': 1149, '3g': 1443, '3p': 1767, '3s': 2013 }, LABEL = "Indicative layout from published plans · areas are the developer's published figures", FORBID = /₹|price|lakh|crore/i;
  const open = async ({ search = {}, hash = '', width = 1440, height = 900, autostart = true, pre = null, quiet = false } = {}) => {
    const ctx = await b.newContext({ viewport: { width, height }, reducedMotion: 'reduce' }), pg = await ctx.newPage(); pg.__fatal = []; pg.on('pageerror', e => pg.__fatal.push(e.message));
    if (!quiet) wire(pg);   // quiet pages (intentional 404s) only record uncaught exceptions
    if (pre) await pre(pg);
    const u = new URL(url); if (autostart) u.searchParams.set('autostart', '800'); u.searchParams.set('q', 'low'); for (const [k, v] of Object.entries(search)) u.searchParams.set(k, v); u.hash = hash;
    await pg.goto(u.toString(), { waitUntil: 'networkidle', timeout: 120000 });
    const booted = await pg.waitForFunction(() => !!window.__walk, null, { timeout: 180000 }).then(() => true).catch(() => false); await pg.waitForTimeout(1500);
    return { ctx, pg, booted };
  };
  const run = async (fn) => { try { return await fn(); } catch (e) { return { error: String(e.message || e).split('\n')[0] }; } };
  // dispatched clicks, as in m1-checks: Playwright's actionability waits stall on a ~1 fps software renderer; the hit-test is covered separately by the phone check
  const tap = (pg, sel) => pg.evaluate(q => { const e = document.querySelector(q); if (!e) throw new Error('no element ' + q); e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }, sel);
  const tabs = pg => pg.evaluate(() => [...document.querySelectorAll('#sections button')].map(x => x.dataset.view).join(','));
  const vis = (pg, sel, t = 8000) => pg.waitForSelector(sel, { state: 'visible', timeout: t });

  // 1. flags: plans off => no tab, no units.json request, #plan= ignored
  const off = await run(async () => {
    const reqs = []; const a = await open({ search: { mods: 'experience' }, pre: async pg => pg.on('request', r => reqs.push(r.url())) });
    const b2 = await open({ search: { mods: 'none' }, hash: '#plan=2l', autostart: false });
    const r = { tabs: await tabs(a.pg), unitsRequested: reqs.some(u => /units\.json/.test(u)), hashIgnored: await b2.pg.evaluate(() => location.hash), tabsNone: await tabs(b2.pg), plansApi: await a.pg.evaluate(() => window.__walk.plans), fatal: [...a.pg.__fatal, ...b2.pg.__fatal] };
    await a.ctx.close(); await b2.ctx.close(); return r; });
  ok('M5a flags off: no Homes tab, no units.json request, __walk.plans null, #plan=2l left alone with ?mods=none', !off.error && off.tabs === 'masterplan,tours' && !off.unitsRequested && off.plansApi === null && off.hashIgnored === '#plan=2l' && off.tabsNone === '' && off.fatal.length === 0, JSON.stringify(off));

  // 2. Homes list
  const list = await run(async () => {
    const a = await open({ search: { mods: 'experience,plans' } }); const r = { tabs: await tabs(a.pg) };
    await tap(a.pg, '#sections button[data-view="homes"]'); await vis(a.pg, '#homes .unitcard');
    r.cards = await a.pg.evaluate(() => [...document.querySelectorAll('#homes .unitcard')].map(c => ({ id: c.dataset.id, text: c.textContent.replace(/\s+/g, ' ').trim(), svg: !!c.querySelector('svg') })));
    r.homesText = await a.pg.evaluate(() => document.getElementById('homes').textContent); r.toursHidden = await a.pg.evaluate(() => { const t = document.getElementById('tours'); return !t.closest('[hidden]') && t.checkVisibility(); });
    await a.ctx.close(); return r; });
  ok('M5a Homes list: tabs masterplan,homes,tours; 5 cards in order 1c,2l,3g,3p,3s, each with a plan drawing, its type and published SBA; no price words', !list.error && list.tabs === 'masterplan,homes,tours' && list.cards.map(c => c.id).join() === IDS.join() && list.cards.every(c => c.svg && new RegExp('1?,?' + String(SBA[c.id]).replace(/(\d)(\d{3})$/, '$1,?$2')).test(c.text) && /BHK/.test(c.text)) && !FORBID.test(list.homesText) && list.toursHidden === false, JSON.stringify(list).slice(0, 700));

  // 3. plan detail: rooms, label, areas, hash, room tap, Back
  const det = await run(async () => {
    const a = await open({ search: { mods: 'experience,plans' } }); await tap(a.pg, '#sections button[data-view="homes"]'); await vis(a.pg, '#homes .unitcard[data-id="2l"]'); await tap(a.pg, '#homes .unitcard[data-id="2l"]'); await vis(a.pg, '#planSvg svg');
    const r = await a.pg.evaluate(() => ({ rooms: document.querySelectorAll('#planSvg svg rect.room').length, panelText: document.getElementById('panelPlan').textContent, hash: location.hash, homesHidden: document.getElementById('homes').closest('[hidden]') !== null || !document.getElementById('homes').checkVisibility(), openId: window.__walk.plans && window.__walk.plans.openId }));
    await tap(a.pg, '#planSvg svg rect.room[data-i="0"]'); const roomTap = await a.pg.evaluate(() => ({ on: document.querySelectorAll('#planSvg svg rect.room.on').length, onI: document.querySelector('#planSvg svg rect.room.on')?.dataset.i, readout: document.getElementById('planRoom').textContent }));
    await tap(a.pg, '#planBack'); await vis(a.pg, '#homes .unitcard'); const back = await a.pg.evaluate(() => ({ hash: location.hash, planHidden: document.getElementById('panelPlan').hidden, openId: window.__walk.plans.openId }));
    await a.ctx.close(); return { ...r, tap: roomTap, back }; });
  ok('M5a plan detail: 2L opens 8 rooms, the verbatim label, SBA 1,149 / carpet 709 / balcony 33, hash #view=homes&plan=2l; tapping a room highlights it and names it with its size; Back returns to the list (#view=homes)',
    !det.error && det.rooms === 8 && det.panelText.includes(LABEL) && /1,?149/.test(det.panelText) && /709/.test(det.panelText) && /\b33\b/.test(det.panelText) && !FORBID.test(det.panelText) && det.hash === '#view=homes&plan=2l' && det.homesHidden && det.openId === '2l'
      && det.tap.on === 1 && det.tap.onI === '0' && /Master bedroom/.test(det.tap.readout) && /3\.35/.test(det.tap.readout) && det.back.hash === '#view=homes' && det.back.planHidden === true && det.back.openId === null, JSON.stringify(det).slice(0, 800));

  // 4. deep links survive boot (before Explore); an unknown id lands on the Homes list
  const deep = await run(async () => {
    const a = await open({ search: { mods: 'experience,plans' }, hash: '#plan=3p', autostart: false }); await vis(a.pg, '#planSvg svg');
    const r = { rooms: await a.pg.evaluate(() => document.querySelectorAll('#planSvg svg rect.room').length), hash: await a.pg.evaluate(() => location.hash), introUp: await a.pg.evaluate(() => !document.getElementById('intro').classList.contains('hide')), openId: await a.pg.evaluate(() => window.__walk.plans.openId) };
    const c = await open({ search: { mods: 'experience,plans' }, hash: '#plan=nope', autostart: false }); await vis(c.pg, '#homes .unitcard');
    r.nope = { hash: await c.pg.evaluate(() => location.hash), view: await c.pg.evaluate(() => window.__walk.view), planHidden: await c.pg.evaluate(() => document.getElementById('panelPlan').hidden), fatal: c.pg.__fatal };
    await a.ctx.close(); await c.ctx.close(); return r; });
  ok('M5a deep links: #plan=3p opens the 12-room plan and the URL still reads #plan=3p before Explore; #plan=nope shows the Homes list, no error, hash untouched', !deep.error && deep.rooms === 12 && deep.hash === '#plan=3p' && deep.introUp && deep.openId === '3p' && deep.nope.hash === '#plan=nope' && deep.nope.view === 'homes' && deep.nope.planHidden && deep.nope.fatal.length === 0, JSON.stringify(deep));

  // 5. compare: same pixels-per-metre; self-compare and close behave
  const cmp = await run(async () => {
    const a = await open({ search: { mods: 'experience,plans' }, hash: '#plan=2l', autostart: false }); await vis(a.pg, '#planSvg svg');
    const chips = await a.pg.evaluate(() => [...document.querySelectorAll('.compare-chip')].map(c => c.dataset.id)); await tap(a.pg, '.compare-chip[data-id="3g"]'); await a.pg.waitForFunction(() => document.querySelectorAll('#planSvg svg').length === 2, null, { timeout: 8000 });
    const ppm = await a.pg.evaluate(() => [...document.querySelectorAll('#planSvg svg')].map(s => { const vb = s.viewBox.baseVal, w = s.getBoundingClientRect().width; return { ppm: w / vb.width * 10, w }; }));
    const self = await a.pg.evaluate(() => { const p = window.__walk.plans; let threw = false; try { p.compare('2l'); } catch { threw = true; } return { threw, svgs: document.querySelectorAll('#planSvg svg').length, compareId: p.compareId }; });
    await tap(a.pg, '#planBack'); const closed = await a.pg.evaluate(() => ({ openId: window.__walk.plans.openId, compareId: window.__walk.plans.compareId }));
    await a.ctx.close(); return { chips, ppm, self, closed }; });
  ok('M5a compare: chips offer the other 4 types; 2L vs 3G render at equal pixels-per-metre (1 %); comparing a type with itself does not throw or add a plan; closing clears compare', !cmp.error && cmp.chips.sort().join() === ['1c', '3g', '3p', '3s'].join() && cmp.ppm.length === 2 && Math.abs(cmp.ppm[0].ppm / cmp.ppm[1].ppm - 1) < 0.01 && !cmp.self.threw && cmp.self.svgs === 2 && cmp.closed.openId === null && cmp.closed.compareId === null, JSON.stringify(cmp));

  // 6. phone: the tallest plan (3P) never scrolls the page sideways and is tappable
  const phone = await run(async () => {
    const r = {}; for (const [w, h] of [[390, 780], [320, 640]]) {
      const a = await open({ search: { mods: 'experience,plans' }, hash: '#plan=3p', autostart: false, width: w, height: h }); await vis(a.pg, '#planSvg svg');
      r[w] = await a.pg.evaluate(() => { const s = document.querySelector('#planSvg svg'), rect = s.querySelector('rect.room'), b = rect.getBoundingClientRect(), hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return { overflowX: document.documentElement.scrollWidth - window.innerWidth, svgW: Math.round(s.getBoundingClientRect().width), collapsed: document.getElementById('panel').classList.contains('collapsed'), tappable: !!hit && (hit === rect || rect.contains(hit) || hit.closest('#planSvg') !== null) }; });
      await a.ctx.close(); }
    return r; });
  ok('M5a phone (390 and 320 px): the 3P plan opens with the sheet expanded, no sideways page scroll, a drawing at least 240 px wide, and rooms are tappable', !phone.error && [390, 320].every(w => phone[w] && phone[w].overflowX <= 0 && phone[w].svgW >= 240 && phone[w].collapsed === false && phone[w].tappable), JSON.stringify(phone));

  // 7. bad data: a 404 and a junk document both leave a working shell without a Homes tab (quiet pages: the 404 itself is an expected console line)
  const bad = await run(async () => {
    const r = {}; for (const [name, fulfill] of [['404', { status: 404, body: 'nope' }], ['junk', { status: 200, contentType: 'application/json', body: '{}' }]]) {
      const a = await open({ search: { mods: 'experience,plans' }, quiet: true, pre: async pg => pg.route('**/units.json', route => route.fulfill(fulfill)) });
      await tap(a.pg, '#sections button[data-view="tours"]'); r[name] = { tabs: await tabs(a.pg), view: await a.pg.evaluate(() => window.__walk.view), plans: await a.pg.evaluate(() => window.__walk.plans), fatal: a.pg.__fatal }; await a.ctx.close(); }
    return r; });
  ok('M5a bad data: units.json 404 or junk => no Homes tab, __walk.plans null, no uncaught error, the Tours tab still works', !bad.error && ['404', 'junk'].every(k => bad[k] && bad[k].tabs === 'masterplan,tours' && bad[k].view === 'tours' && bad[k].plans === null && bad[k].fatal.length === 0), JSON.stringify(bad));
}
