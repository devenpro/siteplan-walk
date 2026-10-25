// M1 live checks (arc 3 shell + georef): imported by check.mjs, also runnable alone: node tools/_m1-smoke.mjs <url>  (a scratch runner that calls m1Checks).
// Each scenario opens its own page. `ok(name, pass, info)` is check.mjs's recorder; `wire(page)` attaches its console-error collector.
export async function m1Checks(b, url, ok, wire, opts = {}) {
  const open = async ({ search = {}, hash = '', width = 1440, height = 900, stripGeo = false } = {}) => {
    const ctx = await b.newContext({ viewport: { width, height }, reducedMotion: 'reduce' }), pg = await ctx.newPage(); wire(pg);
    if (stripGeo) await pg.route('**/site.json', async route => { const r = await route.fetch(); const j = await r.json(); delete j.geo; await route.fulfill({ response: r, json: j }); });
    const u = new URL(url); u.searchParams.set('autostart', '800'); u.searchParams.set('q', 'low'); for (const [k, v] of Object.entries(search)) u.searchParams.set(k, v); u.hash = hash;
    await pg.goto(u.toString(), { waitUntil: 'networkidle', timeout: 120000 });
    const booted = await pg.waitForFunction(() => !!window.__walk, null, { timeout: 180000 }).then(() => true).catch(() => false); await pg.waitForTimeout(1500);
    return { ctx, pg, booted };
  };
  const shown = sel => `(() => { const e = document.querySelector('${sel}'); return !!e && getComputedStyle(e).display !== 'none' && !e.hidden; })()`;

  // 1. flags off: the shell is invisible and the legacy hashes keep their exact bytes
  let off = { failed: true };
  { const { ctx, pg, booted } = await open({ search: { mods: 'none' } });
    if (booted) off = await pg.evaluate(async ({ s1, s2 }) => { const w = window.__walk, id = w.hotspots[0].id, tid = w.site.tours[0].id, o = {};
      o.exp = document.documentElement.classList.contains('exp'); o.barHidden = document.getElementById('sections').hidden; o.flagsOff = Object.values(w.flags).every(v => v === false); o.sections = w.sections.length; o.view = w.view;
      o.toursShown = eval(s1); o.hotlistShown = eval(s2);
      w.select(id, false); o.hashSelect = location.hash === '#h=' + id; w.deselect(); o.hashDeselect = location.hash === '';
      w.startTour(tid); o.hashTour = location.hash === '#tour=' + tid; w.endTour(false); o.hashEnd = location.hash === ''; return o; }, { s1: shown('#tours'), s2: shown('#hotlist') });
    await ctx.close(); }
  ok('M1 flags off (?mods=none): no shell class, bar hidden, tours + hotlist both shown, hashes stay exactly #h=<id> / #tour=<id>',
    !off.failed && off.exp === false && off.barHidden === true && off.flagsOff && off.sections === 0 && off.view === '' && off.toursShown && off.hotlistShown && off.hashSelect && off.hashDeselect && off.hashTour && off.hashEnd, JSON.stringify(off));

  // 2. experience on: two tabs, views switch, the view survives select/Back and rides in the hash, bad views fall back
  let on = { failed: true };
  { const { ctx, pg, booted } = await open({ search: { mods: 'experience' } });
    if (booted) on = await pg.evaluate(async ({ s1, s2 }) => { const w = window.__walk, o = {}, wait = ms => new Promise(r => setTimeout(r, ms)), until = async f => { for (let i = 0; i < 30 && !f(); i++) await wait(100); }, id = w.hotspots[0].id, tid = w.site.tours[0].id, tab = v => document.querySelector(`#sections button[data-view="${v}"]`);
      o.exp = document.documentElement.classList.contains('exp'); o.tabs = [...document.querySelectorAll('#sections button')].map(x => x.dataset.view).join(','); o.startView = w.view; o.startHotlist = eval(s2); o.startTours = eval(s1); o.hash0 = location.hash;
      tab('tours').click(); await until(() => w.view === 'tours'); o.toursView = w.view === 'tours' && eval(s1) && !eval(s2); o.hashView = location.hash === '#view=tours';
      w.select(id, false); o.hashBoth = location.hash === '#view=tours&h=' + id; document.getElementById('btnBack').click(); await until(() => !document.getElementById('panelHome').hidden); o.backToTours = w.view === 'tours' && eval(s1) && !eval(s2) && location.hash === '#view=tours';
      w.startTour(tid); await until(() => location.hash.includes('tour=')); o.tourHash = location.hash === '#view=tours&tour=' + tid; w.endTour(false); await until(() => !w.tour); o.afterTour = eval(s1) || eval(s2);
      tab('masterplan').click(); await until(() => w.view === 'masterplan'); o.masterBack = w.view === 'masterplan' && eval(s2) && !eval(s1) && location.hash === ''; return o; }, { s1: shown('#tours'), s2: shown('#hotlist') });
    await ctx.close(); }
  ok('M1 experience on: bar shows Master plan + Tours, switching hides the other view, view rides in the hash, select/Back and a finished tour keep a non-empty view',
    !on.failed && on.exp && on.tabs === 'masterplan,tours' && on.startView === 'masterplan' && on.startHotlist && !on.startTours && on.hash0 === '' && on.toursView && on.hashView && on.hashBoth && on.backToTours && on.tourHash && on.afterTour && on.masterBack, JSON.stringify(on));
  let deep = { failed: true };
  { const a = await open({ search: { mods: 'experience' }, hash: '#view=tours' }), c = await open({ search: { mods: 'experience' }, hash: '#view=bogus' });
    if (a.booted && c.booted) deep = { tours: await a.pg.evaluate(() => window.__walk.view), bogus: await c.pg.evaluate(({ s }) => ({ view: window.__walk.view, hotlist: eval(s) }), { s: shown('#hotlist') }) };
    await a.ctx.close(); await c.ctx.close(); }
  ok('M1 deep links: #view=tours opens on Tours; #view=bogus falls back to a visible Master plan', deep.tours === 'tours' && deep.bogus && deep.bogus.view === 'masterplan' && deep.bogus.hotlist === true, JSON.stringify(deep));

  // 3. phone: the sheet var follows the flag (204 off, 256 with the bar) and the tabs are touch-sized
  let ph = { failed: true };
  { const a = await open({ search: { mods: 'none' }, width: 390, height: 780 }), c = await open({ search: { mods: 'experience' }, width: 390, height: 780 });
    if (a.booted && c.booted) ph = { off: await a.pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sheet-h').trim()),
      on: await c.pg.evaluate(() => ({ sheet: getComputedStyle(document.documentElement).getPropertyValue('--sheet-h').trim(), tabH: Math.min(...[...document.querySelectorAll('#sections button')].map(x => x.getBoundingClientRect().height)) })) };
    await a.ctx.close(); await c.ctx.close(); }
  ok('M1 phone sheet: --sheet-h is 204px with the flag off, 256px with the bar, tabs ≥ 44px tall', ph.off === '204px' && ph.on && ph.on.sheet === '256px' && ph.on.tabH >= 44, JSON.stringify(ph));

  // 4. georef: Belvedere places the plot near Budigere Cross; a dataset without a geo block boots with geo === null and no error
  let geo = { failed: true };
  { const a = await open({ search: { mods: 'none' } }), c = await open({ search: { mods: 'none' }, stripGeo: true });
    if (a.booted && c.booted) geo = { withGeo: await a.pg.evaluate(() => { const w = window.__walk, bd = w.site.boundary, cx = bd.reduce((s, p) => s + p[0] / bd.length, 0), cy = bd.reduce((s, p) => s + p[1] / bd.length, 0); const ll = w.latLonOf([cx, cy]);
        if (!ll) return null; const R = 6371008.8, r = x => x * Math.PI / 180, dist = (a, b, c, d) => { const dp = r(c - a), dl = r(d - b), h = Math.sin(dp / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
        const p0 = w.site.geo.points[0], back = w.latLonOf(p0.px); return { status: w.geoStatus, kmFromJunction: +(dist(ll[0], ll[1], 13.0462, 77.7504) / 1000).toFixed(3), anchorErrM: +dist(back[0], back[1], p0.lat, p0.lon).toFixed(3) }; }),
      noGeo: await c.pg.evaluate(() => ({ geo: window.__walk.geo, ll: window.__walk.latLonOf([100, 100]), status: window.__walk.geoStatus })) };
    await a.ctx.close(); await c.ctx.close(); }
  ok('M1 georef: the anchor round-trips to its pin within 1 m, the plot centre is within 600 m of Budigere Cross (it is about 210 m), status is declared; with no geo block geo, latLonOf and status are null', !geo.failed && !!geo.withGeo && geo.withGeo.anchorErrM <= 1 && geo.withGeo.kmFromJunction <= 0.6 && ['provisional', 'verified'].includes(geo.withGeo.status) && geo.noGeo.geo === null && geo.noGeo.ll === null && geo.noGeo.status === null, JSON.stringify(geo));
}
