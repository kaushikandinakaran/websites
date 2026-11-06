/* Le Petit Marais: small page helpers. Module scope (no globals).
   1. Hours table: keep each time range on one line ("12:00 PM – 2:30 PM"); lines may break only between ranges.
   2. Gentle photo settle on scroll (scale only, an image is never hidden); off when reduced motion is preferred. */
const hoursBox = document.querySelector('[data-hours]');
if (hoursBox) {
  const tidy = () => {
    for (const td of hoursBox.querySelectorAll('td')) {
      const t = td.textContent;
      const fixed = t.split(', ').map((r) => r.replace(/ /g, ' ')).join(', ');
      if (fixed !== t) td.textContent = fixed;
    }
  };
  tidy();
  new MutationObserver(tidy).observe(hoursBox, { childList: true, subtree: true, characterData: true });
}

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
if (!reduce.matches && 'IntersectionObserver' in window) {
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  const fold = innerHeight;
  for (const el of els) if (el.getBoundingClientRect().top > fold) io.observe(el); else el.classList.add('is-in');
  document.documentElement.classList.add('motion');
}
