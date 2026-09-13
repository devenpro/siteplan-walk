// Postcard gallery (C1): a scroll-snap strip of media entries per hotspot with dots, hover arrows, ←/→ and an IntersectionObserver-driven active index.
// renderMedia() is the one place a manifest entry becomes DOM; the strip and (C4) fullscreen both use it.
import { labelOf, sortByRank, isVideoKind } from './media-kinds.js';

export function renderMedia(entry, hotspot, base) {
  const alt = hotspot.name + ' — ' + labelOf(entry);
  if (entry.kind === 'embed') {   // official-channel facade: poster + play glyph; the iframe lands in C3
    const wrap = document.createElement('div'); wrap.className = 'media poster embed';
    const im = document.createElement('img'); im.loading = 'lazy'; im.decoding = 'async'; im.src = base + 'postcards/' + entry.poster; im.alt = alt; wrap.appendChild(im);
    const play = document.createElement('span'); play.className = 'play'; play.setAttribute('aria-hidden', 'true'); wrap.appendChild(play); return wrap;
  }
  if (entry.kind === 'video' || entry.kind === 'ai-video') {   // muted, inline, no preload; src only while the slide is active (one decoder at a time)
    const wrap = document.createElement('div'); wrap.className = 'media video ' + entry.kind;
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'none'; v.poster = base + 'postcards/' + entry.poster; v.dataset.src = base + 'postcards/' + entry.file;
    v.loop = entry.loop !== false; if (entry.kind === 'video') v.controls = true; v.setAttribute('aria-label', alt); wrap.appendChild(v);
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'playbtn'; btn.hidden = true; btn.setAttribute('aria-label', 'Play'); btn.addEventListener('click', () => v.play().then(() => { btn.hidden = true; }).catch(() => {})); wrap.appendChild(btn);
    return wrap;
  }
  const im = document.createElement('img'); im.className = 'media'; im.loading = 'lazy'; im.decoding = 'async'; im.src = base + 'postcards/' + entry.file; im.alt = alt; return im;
}

export function createGallery({ strip, dots, prev, next, badge, credit, base, canAutoplay = () => true }) {
  let entries = [], index = 0, hotspot = null, io = null, pending = null, pendingUntil = 0;   // pending: the slide go() asked for — authoritative until its scroll lands (or 1.2 s pass)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // ---- video lifecycle (C2): src only on the active slide (one decoder), autoplay behind the gate, poster + play button on refusal, pause when hidden ----
  const gate = () => document.visibilityState === 'visible' && !reduced.matches && !(navigator.connection && navigator.connection.saveData) && canAutoplay();
  const videoOf = i => strip.children[i] && strip.children[i].querySelector('video');
  const deactivate = v => { if (!v) return; v.pause(); if (v.getAttribute('src')) { v.removeAttribute('src'); v.load(); } const b = v.parentElement.querySelector('.playbtn'); if (b) b.hidden = true; };
  const activate = v => { if (!v) return; if (!v.getAttribute('src')) v.src = v.dataset.src; const b = v.parentElement.querySelector('.playbtn');
    if (gate()) v.play().then(() => { b.hidden = true; }).catch(() => { b.hidden = false; }); else b.hidden = false; };
  document.addEventListener('visibilitychange', () => { const v = videoOf(index); if (!v) return; if (document.hidden) v.pause(); else if (gate() && v.getAttribute('src')) v.play().catch(() => {}); });
  function setActive(i) {
    index = i; const e = entries[i];
    [...strip.children].forEach((s, k) => s.classList.toggle('active', k === i));
    [...dots.children].forEach((d, k) => d.setAttribute('aria-current', k === i ? 'true' : 'false'));
    badge.textContent = labelOf(e); badge.className = 'badge ' + (e ? e.kind : ''); credit.textContent = e ? (e.credit || '') : '';
    prev.disabled = i <= 0; next.disabled = i >= entries.length - 1;
    [...strip.children].forEach((s, k) => { if (k !== i) deactivate(s.querySelector('video')); }); activate(videoOf(i));
  }
  function show(h) {
    hotspot = h; entries = sortByRank(h.images || []); if (io) io.disconnect();
    strip.replaceChildren(...entries.map((e, i) => { const s = document.createElement('div'); s.className = 'slide'; s.dataset.i = i; s.appendChild(renderMedia(e, h, base)); return s; }));
    dots.replaceChildren(...entries.map((e, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'dot'; b.setAttribute('aria-label', `${labelOf(e)} (${i + 1} of ${entries.length})`); b.addEventListener('click', () => go(i)); return b; }));
    strip.classList.toggle('wide', entries.some(e => e.kind === 'embed' || (e.width && e.height && e.width / e.height > 1.6)));   // 16:9 only when an entry really is (embeds are; Kling loops keep the postcard's 3:2)
    strip.parentElement.classList.toggle('single', entries.length <= 1); strip.parentElement.hidden = entries.length === 0;
    strip.scrollLeft = 0; setActive(0);
    pending = null;
    io = new IntersectionObserver(items => { let best = null; for (const it of items) if (it.isIntersecting && (!best || it.intersectionRatio > best.intersectionRatio)) best = it; if (!best) return;
      const i = +best.target.dataset.i; if (pending !== null) { if (i === pending) pending = null; else if (performance.now() < pendingUntil) return; else pending = null; }   // a stale notification must not undo go()
      setActive(i); }, { root: strip, threshold: [0.6] });
    for (const s of strip.children) io.observe(s);
  }
  function go(i) { if (!entries.length) return; const k = Math.max(0, Math.min(entries.length - 1, i)); pending = k; pendingUntil = performance.now() + 1200; strip.scrollTo({ left: k * strip.clientWidth, behavior: reduced.matches ? 'auto' : 'smooth' }); setActive(k); }
  function clear() { [...strip.children].forEach(s => deactivate(s.querySelector('video'))); if (io) io.disconnect(); strip.replaceChildren(); dots.replaceChildren(); entries = []; hotspot = null; }
  prev.addEventListener('click', () => go(index - 1)); next.addEventListener('click', () => go(index + 1));
  return { show, go, clear, get index() { return index; }, get count() { return entries.length; }, get entries() { return entries; }, get hotspot() { return hotspot; },
    get playing() { const v = videoOf(index); return !!v && !!v.getAttribute('src') && !v.paused && !v.ended; } };
}
