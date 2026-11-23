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

const certificateDialog = document.querySelector('#certificate-dialog');
let documentTrigger;
document.querySelector('#achievements-content').addEventListener('click', event => {
  const link = event.target.closest('a[data-certificate-preview]');
  if (!link || typeof certificateDialog.showModal !== 'function' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  documentTrigger = link;
  document.querySelector('#certificate-dialog-title').textContent = link.dataset.documentTitle;
  const image = document.querySelector('#certificate-dialog-image');
  image.src = link.dataset.certificatePreview;
  image.alt = link.dataset.documentTitle + ' — full document preview';
  document.querySelector('#certificate-download').href = link.href;
  certificateDialog.showModal();
  document.body.classList.add('document-open');
});
certificateDialog.addEventListener('close', () => {
  document.body.classList.remove('document-open');
  document.querySelector('#certificate-dialog-image').removeAttribute('src');
  documentTrigger?.focus({ preventScroll:true });
});
certificateDialog.addEventListener('click', event => {
  if (event.target !== certificateDialog) return;
  const bounds = certificateDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) certificateDialog.close();
});
