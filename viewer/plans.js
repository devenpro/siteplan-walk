// The Homes view (arc 3, M5a): a card per unit type and a plan detail pane with room tap and a same-scale compare. DOM only; the SVG comes from plan-svg.js, the data from units.js.
// The host (app.js) owns panel visibility and the URL: it is told through onOpen(id | null, { silent }) and a `silent` open/close means "the caller handles the DOM and the hash".
import { planSvg, planViewBox, escapeXml as esc } from './plan-svg.js';
import { unitById } from './units.js';
export const PLAN_LABEL = "Indicative layout from published plans · areas are the developer's published figures";
const nf = n => Number(n).toLocaleString('en-IN');
export function createPlans({ units, listEl, detailEl, onOpen = () => {}, lift = false, onLift = () => {} }) {
  const q = sel => detailEl.querySelector(sel), head = q('#planHead'), stage = q('#planSvg'), room = q('#planRoom'), facts = q('#planFacts'), chips = q('#planCompare .chips'), label = q('#planLabel');
  let openId = null, compareId = null, active = null, mode = '2d', liftOn = !!lift, liftBtn = null;   // active = { id, i }: the tapped room; mode: '2d' | '3d' (M5b, only with the `lift` option)
  const beds = u => `${u.beds} bed · ${u.baths} bath`;
  listEl.innerHTML = `<p class="homes-note">${esc(PLAN_LABEL)}</p><div class="homes-grid">` + units.map(u =>
    `<button class="unitcard" type="button" data-id="${esc(u.id)}"><span class="uc-plan">${planSvg(u, { mini: true })}</span><span class="uc-t"><b>${esc(u.type)}</b> ${esc(u.plan)}</span><span class="uc-m">${nf(u.sba)} sq ft · ${beds(u)}</span></button>`).join('') + '</div>';
  label.textContent = PLAN_LABEL;
  if (liftOn) {   // M5b: the 3D button exists only when the host turned the lift on
    liftBtn = document.createElement('button'); liftBtn.id = 'planLift'; liftBtn.className = 'plan-lift'; liftBtn.type = 'button'; liftBtn.textContent = 'View in 3D'; liftBtn.setAttribute('aria-pressed', 'false');
    stage.insertAdjacentElement('afterend', liftBtn); liftBtn.addEventListener('click', () => setMode(mode === '3d' ? '2d' : '3d'));
  }
  function leave3d() { if (mode !== '3d') return; mode = '2d'; if (liftBtn) { liftBtn.textContent = 'View in 3D'; liftBtn.setAttribute('aria-pressed', 'false'); } onLift(null); }   // also for a silent close: silent means no DOM or hash work, not "stay lifted"
  function setMode(m) {
    if (!liftOn || !openId) return;
    if (m === '2d') return leave3d();
    if (m === '3d' && mode !== '3d') { mode = '3d'; liftBtn.textContent = 'Back to 2D plan'; liftBtn.setAttribute('aria-pressed', 'true'); onLift(unitById(units, openId)); }
  }
  function disableLift(note) { leave3d(); liftOn = false; if (liftBtn) { liftBtn.remove(); liftBtn = null; } room.textContent = note; }
  function render() {
    const u = unitById(units, openId); if (!u) return;
    const cmp = unitById(units, compareId), list = cmp ? [u, cmp] : [u];
    head.innerHTML = `<div class="plan-title"><b>${esc(u.type)}</b> · ${esc(u.plan)}</div><div class="plan-sub">${esc(u.label)} · ${esc(u.tower)} · ${esc(u.unitsRange)} · floors ${esc(u.floors)}</div>`;
    const stageW = stage.clientWidth || (detailEl.clientWidth ? detailEl.clientWidth - 28 : 330), vbs = list.map(x => planViewBox(x, {}));
    const k = Math.min(cmp ? 3 : 4, stageW / Math.max(...vbs.map(v => v.w)));   // one k for every figure => equal pixels per metre; stacked, because the desktop panel is only 360 px wide
    stage.innerHTML = list.map((x, j) => `<figure class="pfig" data-id="${esc(x.id)}">` + planSvg(x, { active: active && active.id === x.id ? active.i : -1 }).replace('<svg ', `<svg style="width:${(vbs[j].w * k).toFixed(1)}px" `)
      + (cmp ? `<figcaption><b>${esc(x.type)} · ${esc(x.plan)}</b> ${nf(x.sba)} sq ft super built-up · ${nf(x.carpet)} carpet · ${nf(x.balcony)} balcony</figcaption>` : '') + '</figure>').join('');
    const a = active && unitById(units, active.id), r = a && a.rooms[active.i];
    room.innerHTML = r ? `<b>${esc(r.name)}</b> · ${r.w.toFixed(2)} × ${r.h.toFixed(2)} m · ${(r.w * r.h).toFixed(1)} m²${cmp ? ' · ' + esc(a.plan) : ''}` : 'Tap a room for its name and size.';
    facts.innerHTML = [['Super built-up', nf(u.sba) + ' sq ft'], ['Carpet', nf(u.carpet) + ' sq ft'], ['Balcony', nf(u.balcony) + ' sq ft'], ['Rooms', beds(u)]].map(([l, v]) => `<div><b>${esc(v)}</b><span>${l}</span></div>`).join('');
    chips.innerHTML = units.filter(x => x.id !== u.id).map(x => `<button class="compare-chip" type="button" data-id="${esc(x.id)}" aria-pressed="${x.id === compareId}">${esc(x.type)} · ${esc(x.plan.replace(/^Type /, ''))}</button>`).join('');
  }
  function open(id, opts = {}) {
    const u = unitById(units, id); if (!u) return false;
    leave3d();
    onOpen(u.id, opts);   // first: the host may end a tour / clear a hotspot (which closes any plan), so state is set only after it has settled
    openId = u.id; compareId = null; active = null; render(); return true;
  }
  function close(opts = {}) {
    if (!openId) return; leave3d(); openId = compareId = null; active = null;
    if (!opts.silent) onOpen(null, opts);
  }
  function compare(id) {
    if (!openId) return;
    leave3d();   // compare is a 2D feature
    if (id === openId || !unitById(units, id)) return;   // comparing a type with itself or an unknown one is a no-op
    compareId = id === compareId ? null : id; active = null; render();
  }
  listEl.addEventListener('click', e => { const c = e.target.closest('.unitcard'); if (c) open(c.dataset.id); });
  q('#planBack').addEventListener('click', () => close());
  chips.addEventListener('click', e => { const c = e.target.closest('.compare-chip'); if (c) compare(c.dataset.id); });
  stage.addEventListener('click', e => {
    const rect = e.target.closest && e.target.closest('rect.room'), fig = rect && rect.closest('.pfig'); if (!rect || !fig) return;
    active = { id: fig.dataset.id, i: +rect.dataset.i }; render();
  });
  addEventListener('resize', () => { if (openId) render(); });
  return { open, close, compare, render, setMode, disableLift, get mode() { return mode; }, get openId() { return openId; }, get compareId() { return compareId; } };
}
