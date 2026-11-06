/* Hoshi: small site-only behaviours (ES module, no dependencies, no network).
   1. Compact hours list in the footer ([data-hours-compact]) built from window.SITE.hours.
   2. Booking "sitting" (omakase or nigiri sitting): the radios in the booking form, and the
      "Book" buttons on the counter cards, select the sitting, show it next to the form and write it
      into the notes field (replacing any earlier choice). The counter seats in the evening only, so
      the time list core builds is narrowed to evening slots; omakase (about 2 h) must start at
      least 2 hours before the evening close. If the first offered day has no evening seat, the date
      moves to the next day that has one.
   3. Gentle reveal on scroll, only when the visitor allows motion. Content is visible without JS. */
const S = window.SITE || {};
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const LOCALE = S.locale || 'en-US';
const $ = (s, r = document) => r.querySelector(s);
const toMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')); return m ? +m[1] * 60 + +m[2] : NaN; };
const dayRanges = (i) => (Array.isArray(S.hours) ? S.hours : []).filter((h) => String(h.day || '').slice(0, 3).toLowerCase() === DAYS[i] && !h.closed && h.open && h.close);

/* ---------- 1. compact hours ---------- */
function compactHours() {
  const boxes = document.querySelectorAll('[data-hours-compact]');
  if (!boxes.length) return;
  const dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
  const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
  const t = (hhmm) => { const m = toMin(hhmm); return timeFmt.format(new Date(2024, 0, 1, Math.floor(m / 60), m % 60)); };
  const dayName = (i) => dayFmt.format(new Date(2024, 0, 1 + i)); // 2024-01-01 is a Monday
  const per = DAYS.map((d, i) => { const r = dayRanges(i); return r.length ? r.map((h) => `${t(h.open)} – ${t(h.close)}`).join(', ') : 'Closed'; });
  const groups = [];
  per.forEach((txt, i) => { const g = groups[groups.length - 1]; if (g && g.txt === txt) g.end = i; else groups.push({ start: i, end: i, txt }); });
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = groups.map((g) => `<div><dt>${esc(dayName(g.start))}${g.end > g.start ? `–${esc(dayName(g.end))}` : ''}</dt><dd>${esc(g.txt)}</dd></div>`).join('');
  boxes.forEach((b) => { b.innerHTML = html; });
}

/* ---------- 2. sitting + evening times ---------- */
const SITTINGS = {
  omakase: { label: 'Omakase', length: 'about 2 hours', minutes: 120 },
  nigiri: { label: 'Nigiri sitting', length: 'about 1 hour', minutes: 60 }
};
const EVENING_FROM = 16 * 60; // counter seatings start with the evening opening

function sittingSetup() {
  const form = $('[data-reserve]');
  if (!form) return;
  const date = $('#r-date', form), time = $('#r-time', form), notes = $('#r-notes', form);
  const selected = $('[data-sitting-selected]', form);
  const current = () => { const r = form.querySelector('input[name="r-sitting"]:checked'); return (r && SITTINGS[r.value]) ? r.value : 'omakase'; };
  const PREFIX = /^Sitting: [^.]*\.\s*/;

  function writeNotes() {
    if (!notes) return;
    const rest = notes.value.replace(PREFIX, '');
    const head = `Sitting: ${SITTINGS[current()].label}.`;
    notes.value = rest ? `${head} ${rest}` : head;
  }
  function showSelected() {
    const s = SITTINGS[current()];
    if (selected) selected.textContent = `Selected: ${s.label}, ${s.length}`;
  }

  // evening window for a date: [startMin, latestStartMin] or null
  function eveningWindow(d) {
    const wd = (d.getDay() + 6) % 7;
    const r = dayRanges(wd).find((h) => toMin(h.open) >= EVENING_FROM);
    if (!r) return null;
    const o = toMin(r.open); let c = toMin(r.close); if (c <= o) c += 1440;
    return [o, c - SITTINGS[current()].minutes];
  }
  const parse = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let initial = true, advances = 0, busy = false, wanted = '';
  const note = $('[data-time-note]', form);
  const NO_SEATS = 'No counter seats on this day';
  const NO_SEATS_ERR = 'No counter seats on the chosen day (the counter seats in the evening). Choose another date.';
  const say = (msg) => { if (note) note.textContent = msg; };
  const label = (v) => { const o = Array.from(time.options).find((x) => x.value === v); return o ? o.text : v; };

  function filterTimes() {
    if (busy || !time || !date) return;
    const d = parse(date.value);
    const opts = Array.from(time.options).filter((o) => o.value);
    if (!d) return;
    if (!opts.length && time.options.length && !initial) {
      // core found no slots at all (closed day): use the counter wording
      const only = time.options[0];
      if (time.options.length === 1 && only.text !== NO_SEATS) { only.text = NO_SEATS; time.dataset.errRequired = NO_SEATS_ERR; }
      return;
    }
    const win = eveningWindow(d);
    const ok = (o) => { const t = toMin(o.value); return win && t >= win[0] && t <= win[1]; };
    const bad = opts.filter((o) => !ok(o));
    const left = opts.length - bad.length;
    if (!bad.length && left) { initial = false; keepWanted(); return; }
    busy = true;
    bad.forEach((o) => o.remove());
    if (!left) {
      if (initial && advances < 14) {
        const next = new Date(d); next.setDate(d.getDate() + 1);
        if (!date.max || ymd(next) <= date.max) {
          advances += 1; busy = false;
          date.value = ymd(next);
          date.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
      }
      initial = false;
      Array.from(time.options).forEach((o) => o.remove());
      time.add(new Option(NO_SEATS, ''));
      time.dataset.errRequired = NO_SEATS_ERR;
      if (wanted) { say('No counter seats for this sitting on this day. Choose another date.'); wanted = ''; }
    } else {
      initial = false;
      if (!time.value && time.options.length) time.selectedIndex = 0;
      keepWanted();
    }
    busy = false;
  }
  // after a sitting change: keep the guest's time if it still works, else move to the nearest start and say so
  function keepWanted() {
    if (!wanted) return;
    const vals = Array.from(time.options).map((o) => o.value).filter(Boolean);
    const w = wanted; wanted = '';
    if (!vals.length) return;
    if (vals.includes(w)) { time.value = w; return; }
    const wm = toMin(w);
    let best = vals[0];
    for (const v of vals) if (Math.abs(toMin(v) - wm) < Math.abs(toMin(best) - wm)) best = v;
    time.value = best;
    const latest = toMin(best) < wm;
    say(`Time changed to ${label(best)}, the ${latest ? 'latest' : 'earliest'} ${SITTINGS[current()].label.toLowerCase()} start on this day.`);
  }
  if (time) new MutationObserver(filterTimes).observe(time, { childList: true });

  function refill() { // let core rebuild the list for the new sitting, then the observer narrows it
    if (time && time.value) wanted = time.value;
    say('');
    if (date) date.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (time) time.addEventListener('change', () => say(''));
  if (date) date.addEventListener('input', () => say(''));
  form.addEventListener('change', (e) => {
    if (e.target && e.target.name === 'r-sitting') { showSelected(); writeNotes(); refill(); }
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-book-set]');
    if (!a) return;
    const r = form.querySelector(`input[name="r-sitting"][value="${a.dataset.bookSet}"]`);
    if (r) { r.checked = true; showSelected(); writeNotes(); refill(); }
  });
  // before core handles the submit: make sure the notes carry the chosen sitting
  document.addEventListener('submit', (e) => { if (e.target === form) writeNotes(); }, true);
  // after core: show the sitting on the confirmation
  document.addEventListener('submit', (e) => {
    if (e.target !== form) return;
    const conf = $('[data-sitting-conf]');
    if (conf) { const s = SITTINGS[current()]; conf.textContent = form.hidden ? `Sitting: ${s.label}, ${s.length}.` : ''; }
  });
  form.addEventListener('reset', () => setTimeout(() => { showSelected(); initial = true; advances = 0; filterTimes(); }, 0));
  showSelected();
  filterTimes();
}

/* ---------- 3. reveal ---------- */
function reveal() {
  const mq = matchMedia('(prefers-reduced-motion: no-preference)');
  if (!mq.matches || !('IntersectionObserver' in window)) return;
  const els = Array.from(document.querySelectorAll('.reveal'));
  if (!els.length) return;
  const vh = innerHeight;
  const below = els.filter((el) => el.getBoundingClientRect().top > vh * 0.9);
  if (!below.length) return;
  below.forEach((el) => el.classList.add('is-pending'));
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      en.target.classList.add('is-in');
      en.target.classList.remove('is-pending');
      io.unobserve(en.target);
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
  below.forEach((el) => io.observe(el));
  if (mq.addEventListener) mq.addEventListener('change', () => { if (!mq.matches) below.forEach((el) => el.classList.remove('is-pending')); });
}

compactHours();
sittingSetup();
reveal();
