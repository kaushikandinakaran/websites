// The Kailash Room: slow reveal of a few editorial blocks. Optional polish; the page works without it.
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
if (!mq.matches && 'IntersectionObserver' in window) {
  const els = [...document.querySelectorAll('.spice__media img, .room__media img, .pairing img')];
  const below = els.filter(el => el.getBoundingClientRect().top > window.innerHeight);
  if (below.length) {
    below.forEach(el => el.setAttribute('data-reveal', ''));
    document.documentElement.classList.add('kr-motion');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    below.forEach(el => io.observe(el));
  }
}
