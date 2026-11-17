// The portfolio content is in index.html. These are small navigation enhancements.
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
navigation.addEventListener("click", (event) => { if (event.target.closest("a")) closeMenu(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") { closeMenu(); menuButton.focus(); }
});
window.matchMedia("(min-width: 641px)").addEventListener("change", closeMenu);
const sections = document.querySelectorAll("main section[id]");
let currentSection = "";
function updateActiveSection() {
  let active = "";
  sections.forEach(section => { if (section.getBoundingClientRect().top <= 140) active = section.id; });
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) active = "contact";
  if (active === currentSection) return;
  currentSection = active;
  navigation.querySelectorAll("a").forEach(link => {
    if (link.hash === "#" + active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}
window.addEventListener("scroll", updateActiveSection, { passive: true });
window.addEventListener("resize", updateActiveSection);
updateActiveSection();
document.querySelector("#current-year").textContent = new Date().getFullYear();

// Visibility is a convenience. The server separately authorizes every admin request.
fetch("/api/session", { credentials: "same-origin" })
  .then(response => response.ok ? response.json() : null)
  .then(session => { if (session?.isAdmin) document.querySelector("#admin-link").hidden = false; })
  .catch(() => {});
