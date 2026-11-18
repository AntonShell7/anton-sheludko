// Navigation and small enhancements. All content and links work without scripts.
document.documentElement.classList.add('js');
const header = document.querySelector('#site-header');
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#site-nav');
menuButton.hidden = false;
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});
window.matchMedia('(min-width: 801px)').addEventListener('change', closeMenu);

const sections = [...document.querySelectorAll('main section[id]')];
let currentSection = '';
let scrollScheduled = false;
function updateNavigation() {
  scrollScheduled = false;
  header.classList.toggle('is-scrolled', window.scrollY > 35);
  let active = '';
  sections.forEach(section => {
    if (section.getBoundingClientRect().top <= 180) active = section.id;
  });
  if (window.scrollY + innerHeight >= document.documentElement.scrollHeight - 3) active = 'contact';
  if (active === currentSection) return;
  currentSection = active;
  navigation.querySelectorAll('a').forEach(link => {
    if (link.hash === '#' + active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
function scheduleNavigation() {
  if (scrollScheduled) return;
  scrollScheduled = true;
  requestAnimationFrame(updateNavigation);
}
window.addEventListener('scroll', scheduleNavigation, { passive:true });
window.addEventListener('resize', scheduleNavigation);
window.addEventListener('load', updateNavigation);
updateNavigation();
document.querySelector('#current-year').textContent = new Date().getFullYear();

// A slight rise on entry, without making any text invisible while waiting.
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold:0.08 });
  document.querySelectorAll('[data-reveal]').forEach(element => observer.observe(element));
}

// Exact phrases selected by Anton. No automatic rotation or invented attribution.
const quotes = [...document.querySelectorAll('.quote-list blockquote')];
const quoteList = document.querySelector('.quote-list');
const quoteControls = document.querySelector('.quote-controls');
const quotePosition = document.querySelector('.quote-position');
let quoteIndex = 0;
function selectQuote(index) {
  quoteIndex = (index + quotes.length) % quotes.length;
  quotes.forEach((quote, position) => {
    quote.hidden = position !== quoteIndex;
    quote.classList.toggle('is-changing', position === quoteIndex);
  });
  quotePosition.textContent = `${String(quoteIndex + 1).padStart(2, '0')} / ${String(quotes.length).padStart(2, '0')}`;
}
quoteControls.hidden = false;
selectQuote(0);
quoteList.setAttribute('aria-live', 'polite');
quoteList.setAttribute('aria-atomic', 'true');
document.getElementById('quote-previous').addEventListener('click', () => selectQuote(quoteIndex - 1));
document.getElementById('quote-next').addEventListener('click', () => selectQuote(quoteIndex + 1));
