// Small enhancements only: the story and all links work without JavaScript.
document.documentElement.classList.add("js");
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#site-nav");
menuButton.hidden = false;
function closeMenu() {
  menuButton.setAttribute("aria-expanded", "false");
  navigation.classList.remove("is-open");
}
menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  navigation.classList.toggle("is-open", open);
});
navigation.addEventListener("click", event => {
  if (event.target.closest("a")) closeMenu();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
    closeMenu();
    menuButton.focus();
  }
});
document.addEventListener("click", event => {
  if (!event.target.closest(".site-header")) closeMenu();
});
window.matchMedia("(min-width: 641px)").addEventListener("change", closeMenu);

// Update once per animation frame, not once per scroll event.
const sections = [...document.querySelectorAll("main section[id]")];
const progress = document.querySelector(".reading-progress");
let scrollScheduled = false;
let currentSection = "";
function updateReadingPosition() {
  scrollScheduled = false;
  const distance = document.documentElement.scrollHeight - window.innerHeight;
  progress.value = distance > 0 ? Math.min(100, Math.max(0, window.scrollY / distance * 100)) : 0;
  let active = "";
  sections.forEach(section => {
    if (section.getBoundingClientRect().top <= 170) active = section.id;
  });
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3) active = "contact";
  if (active === currentSection) return;
  currentSection = active;
  navigation.querySelectorAll("a").forEach(link => {
    if (link.hash === "#" + active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}
function scheduleReadingPosition() {
  if (scrollScheduled) return;
  scrollScheduled = true;
  requestAnimationFrame(updateReadingPosition);
}
window.addEventListener("scroll", scheduleReadingPosition, { passive: true });
window.addEventListener("resize", scheduleReadingPosition);
window.addEventListener("load", updateReadingPosition);
updateReadingPosition();
document.querySelector("#current-year").textContent = new Date().getFullYear();

// Reveal each chapter once. Nothing is hidden while waiting for this enhancement.
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08 });
  document.querySelectorAll("[data-reveal]").forEach(element => observer.observe(element));
}

// Accessible tabs illustrate the learning approach; they do not imitate the real app.
const tabList = document.querySelector(".demo-steps");
const tabs = [...tabList.querySelectorAll('[role="tab"]')];
tabList.hidden = false;
function selectLearningStep(index, moveFocus = false) {
  tabs.forEach((tab, position) => {
    const selected = position === index;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(tab.getAttribute("aria-controls"));
    panel.hidden = !selected;
    panel.classList.toggle("is-changing", selected);
  });
  if (moveFocus) tabs[index].focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectLearningStep(index));
  tab.addEventListener("keydown", event => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectLearningStep(next, true);
  });
});
const recallButton = document.querySelector(".recall-button");
const recallAnswer = document.getElementById("recall-answer");
recallButton.addEventListener("click", () => {
  const expanded = recallButton.getAttribute("aria-expanded") !== "true";
  recallButton.setAttribute("aria-expanded", String(expanded));
  recallButton.textContent = expanded ? "Hide meaning ↑" : "Reveal meaning ↗";
  recallAnswer.hidden = !expanded;
});

// Anton's selected phrases. Reader-controlled, with no automatic rotation.
const quotes = [...document.querySelectorAll(".quote-list blockquote")];
const quoteControls = document.querySelector(".quote-controls");
const quotePosition = document.querySelector(".quote-position");
const quoteList = document.querySelector(".quote-list");
let quoteIndex = 0;
function selectQuote(index) {
  quoteIndex = (index + quotes.length) % quotes.length;
  quotes.forEach((quote, position) => {
    quote.hidden = position !== quoteIndex;
    quote.classList.toggle("is-changing", position === quoteIndex);
  });
  quotePosition.textContent = `${String(quoteIndex + 1).padStart(2, "0")} / ${String(quotes.length).padStart(2, "0")}`;
}
quoteControls.hidden = false;
selectQuote(0);
quoteList.setAttribute("aria-live", "polite");
quoteList.setAttribute("aria-atomic", "true");
document.getElementById("quote-previous").addEventListener("click", () => selectQuote(quoteIndex - 1));
document.getElementById("quote-next").addEventListener("click", () => selectQuote(quoteIndex + 1));
