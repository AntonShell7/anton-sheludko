/* Small progressive enhancements. All portfolio content lives in index.html. */
document.documentElement.classList.add("js");

const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#site-nav");
menuButton.hidden = false;

function closeMenu() {
  menuButton.setAttribute("aria-expanded", "false");
  navigation.classList.remove("is-open");
}

menuButton.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  navigation.classList.toggle("is-open", !isOpen);
});

navigation.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
    closeMenu();
    menuButton.focus();
  }
});

window.matchMedia("(min-width: 641px)").addEventListener("change", closeMenu);

/* Missing destinations stay readable, but never become broken links.
   Edit data-href or data-email in the HTML to activate each link. */
document.querySelectorAll(".optional-link").forEach((link) => {
  const email = link.dataset.email?.trim();
  const destination = link.dataset.href?.trim();
  let href = "";

  if (email && !/[\[\]\s]/.test(email) && /^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    href = "mailto:" + email;
  } else if (destination && !/[\[\]]/.test(destination)) {
    try {
      const url = new URL(destination, document.baseURI);
      const isWebLink = /^https?:\/\//i.test(destination) && /^https?:$/.test(url.protocol);
      const isLocalPdf = link.hasAttribute("data-resume") && /^(\.\/)?[^:/]+\.pdf$/i.test(destination) && /^(https?|file):$/.test(url.protocol);
      const isAllowedResume = !link.hasAttribute("data-resume") || /\.pdf$/i.test(url.pathname);
      if ((isWebLink || isLocalPdf) && isAllowedResume) href = url.href;
    } catch {
      // Leave malformed URLs inactive until they are corrected in the HTML.
    }
  }

  if (href) {
    link.href = href;
    link.hidden = false;
    const label = link.querySelector(".link-state");
    if (label) {
      label.textContent = link.hasAttribute("data-resume") ? "PDF ↗" : "↗";
      label.setAttribute("aria-hidden", "true");
    }
    if (/^https?:/.test(href) || link.hasAttribute("data-resume")) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", link.textContent.replace("↗", "").trim() + " (opens in a new tab)");
    }
  } else if (link.hasAttribute("data-resume") || link.hasAttribute("data-hide-when-unset")) {
    link.hidden = true;
  }
});

/* Keep the navigation accurate at the top and bottom of the page too. */
const sections = document.querySelectorAll("main section[id]");
const navigationLinks = navigation.querySelectorAll("a");
let currentSection = "";

function updateActiveSection() {
  let activeSection = "";
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top <= 140) activeSection = section.id;
  });
  const atPageBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  if (atPageBottom) activeSection = "contact";
  if (activeSection === currentSection) return;
  currentSection = activeSection;
  navigationLinks.forEach((link) => {
    if (link.hash === "#" + activeSection) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}
window.addEventListener("scroll", updateActiveSection, { passive: true });
window.addEventListener("resize", updateActiveSection);
updateActiveSection();

document.querySelector("#current-year").textContent = new Date().getFullYear();
