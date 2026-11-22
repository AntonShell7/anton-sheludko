const form = document.querySelector("#achievement-form");
const list = document.querySelector("#achievement-list");
const formStatus = document.querySelector("#form-status");
const pageStatus = document.querySelector("#page-status");
const saveButton = document.querySelector("#save-button");
const deleteDialog = document.querySelector("#delete-dialog");
let achievements = [];
let pendingDelete = null;

function field(name) { return form.elements.namedItem(name); }
function status(element, message, error = false) { element.textContent = message; element.classList.toggle("error", error); }
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options, headers: { ...(options.method ? { "X-Portfolio-Request": "1" } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}
function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function resetEditor() {
  form.reset(); field("id").value = ""; field("updatedAt").value = "";
  document.querySelector("#editor-title").textContent = "Add an achievement";
  document.querySelector("#cancel-edit").hidden = true;
  document.querySelector("#existing-file").hidden = true;
  document.querySelector("#existing-preview").hidden = true;
  document.querySelector("#selected-file").textContent = "";
  document.querySelector("#selected-preview").textContent = "";
  field("file").setCustomValidity("");
  field("preview").setCustomValidity("");
  status(formStatus, "");
}
function edit(record) {
  resetEditor();
  for (const name of ["id", "updatedAt", "title", "year", "category", "organizer", "description", "proofUrl"]) field(name).value = record[name] ?? "";
  field("published").checked = record.published;
  document.querySelector("#editor-title").textContent = "Edit achievement";
  document.querySelector("#cancel-edit").hidden = false;
  if (record.file) {
    const link = document.querySelector("#existing-file-link");
    link.href = record.file.url; link.textContent = record.file.name + " ↗";
    document.querySelector("#existing-file").hidden = false;
  }
  if (record.preview) {
    const link = document.querySelector("#existing-preview-link");
    link.href = record.preview.url; link.textContent = record.preview.name;
    document.querySelector("#existing-preview").hidden = false;
  }
  field("title").focus();
}
function renderCollection() {
  list.replaceChildren();
  document.querySelector("#achievement-count").textContent = String(achievements.length);
  if (!achievements.length) { list.append(element("p", "collection-empty", "Your collection is empty. Add your first achievement when you’re ready.")); return; }
  for (const record of achievements) {
    const article = element("article", "achievement-item");
    const meta = element("div", "item-meta");
    meta.append(element("span", "", record.year + " · " + record.category), element("span", "item-status" + (record.published ? "" : " draft"), record.published ? "Published" : "Draft"));
    article.append(meta, element("h3", "", record.title));
    if (record.organizer) article.append(element("p", "item-description", record.organizer));
    if (record.description) article.append(element("p", "item-description", record.description));
    if (record.file) { const link = element("a", "item-attachment", record.file.name + " ↗"); link.href = record.file.url; link.target = "_blank"; link.rel = "noopener noreferrer"; article.append(link); }
    const actions = element("div", "item-actions");
    const editButton = element("button", "text-button", "Edit"); editButton.type = "button"; editButton.setAttribute("aria-label", "Edit " + record.title); editButton.addEventListener("click", () => edit(record));
    const deleteButton = element("button", "text-button delete-button", "Delete"); deleteButton.type = "button"; deleteButton.setAttribute("aria-label", "Delete " + record.title); deleteButton.addEventListener("click", () => {
      pendingDelete = record;
      document.querySelector("#delete-description").textContent = record.title;
      document.querySelector("#delete-status").textContent = "";
      deleteDialog.showModal();
    });
    actions.append(editButton, deleteButton); article.append(actions); list.append(article);
  }
}
async function load() { const data = await api("/api/admin/achievements"); achievements = data.achievements; renderCollection(); }
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const id = field("id").value;
  saveButton.disabled = true;
  status(formStatus, "Saving…"); status(pageStatus, "");
  try {
    const { achievement } = await api("/api/admin/achievements" + (id ? "/" + id : ""), { method: id ? "PUT" : "POST", body: new FormData(form) });
    resetEditor();
    achievements = achievements.filter(record => record.id !== achievement.id).concat(achievement).sort((a, b) => b.year - a.year || b.createdAt.localeCompare(a.createdAt));
    renderCollection();
    status(pageStatus, achievement.published ? "Achievement published on your portfolio." : "Draft saved. It is only visible to you.");
  } catch (error) { status(formStatus, error.message, true); }
  finally { saveButton.disabled = false; }
});
document.querySelector("#cancel-edit").addEventListener("click", resetEditor);
for (const [name, limit] of [["file", 10], ["preview", 2]]) {
  field(name).addEventListener("change", () => {
    const file = field(name).files[0];
    const tooLarge = file?.size > limit * 1024 * 1024;
    field(name).setCustomValidity(tooLarge ? `Choose a file smaller than ${limit} MB.` : "");
    document.querySelector("#selected-" + name).textContent = file ? file.name + " · " + (file.size / 1024 / 1024).toFixed(2) + " MB" : "";
    if (tooLarge) field(name).reportValidity();
  });
}
document.querySelector("#confirm-delete").addEventListener("click", async () => {
  if (!pendingDelete) return;
  const button = document.querySelector("#confirm-delete"); button.disabled = true;
  try {
    await api("/api/admin/achievements/" + pendingDelete.id, { method: "DELETE" });
    if (field("id").value === pendingDelete.id) resetEditor();
    achievements = achievements.filter(record => record.id !== pendingDelete.id);
    renderCollection(); deleteDialog.close(); pendingDelete = null; status(pageStatus, "Achievement deleted.");
  } catch (error) { document.querySelector("#delete-status").textContent = error.message; }
  finally { button.disabled = false; }
});
Promise.all([load(), api("/api/session").then(session => { document.querySelector("#local-notice").hidden = !session.localPreview; })])
  .catch(error => { status(pageStatus, error.message, true); list.replaceChildren(element("p", "collection-empty", "Achievements could not be loaded. Reload this page to try again.")); });
