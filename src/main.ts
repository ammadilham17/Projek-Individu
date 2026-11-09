import "./style.css";
import type { Note, NoteFilter, SortOrder } from "./types/note";
import { saveToStorage } from "./utils/storage";
import {
  STORAGE_KEY,
  validateNoteInput,
  parseTags,
  createNote,
  updateNote,
  deleteNote,
  togglePin,
  filterNotes,
  getAllTags,
  getStats,
  fetchNotes,
} from "./services/noteService";

// ---------- Helper DOM ----------

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemen #${id} tidak ditemukan di index.html`);
  return el as T;
}

const loadingEl = getEl<HTMLDivElement>("loading");
const errorEl = getEl<HTMLDivElement>("error");
const formEl = getEl<HTMLFormElement>("note-form");
const titleEl = getEl<HTMLInputElement>("title");
const contentEl = getEl<HTMLTextAreaElement>("content");
const tagsEl = getEl<HTMLInputElement>("tags");
const formErrorEl = getEl<HTMLParagraphElement>("form-error");
const submitBtn = getEl<HTMLButtonElement>("submit-btn");
const cancelBtn = getEl<HTMLButtonElement>("cancel-btn");
const searchEl = getEl<HTMLInputElement>("search");
const tagFilterEl = getEl<HTMLSelectElement>("tag-filter");
const sortEl = getEl<HTMLSelectElement>("sort");
const statsEl = getEl<HTMLDivElement>("stats");
const listEl = getEl<HTMLDivElement>("notes-list");
const emptyEl = getEl<HTMLParagraphElement>("empty");

// ---------- State ----------

let notes: Note[] = [];
let editingId: string | null = null;
const filter: NoteFilter = { keyword: "", tag: null, sort: "newest" };

// Type guard: memastikan string dari <select> memang SortOrder yang valid
function isSortOrder(value: string): value is SortOrder {
  return value === "newest" || value === "oldest" || value === "title";
}

// ---------- Loading & error ----------

function showLoading(show: boolean): void {
  loadingEl.hidden = !show;
}

function showError(message: string): void {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError(): void {
  errorEl.hidden = true;
}

// ---------- Simpan ----------

function persist(): void {
  try {
    saveToStorage(STORAGE_KEY, notes);
  } catch {
    showError("Gagal menyimpan ke localStorage. Penyimpanan mungkin penuh.");
  }
}

// ---------- Render ----------

function renderStats(): void {
  const s = getStats(notes);
  statsEl.replaceChildren();
  const items: [string, number][] = [
    ["Total catatan", s.total],
    ["Dipin", s.pinned],
    ["Tag unik", s.uniqueTags],
  ];
  for (const [label, value] of items) {
    const box = document.createElement("div");
    box.className = "stat";
    const num = document.createElement("strong");
    num.textContent = String(value);
    const text = document.createElement("span");
    text.textContent = label;
    box.append(num, text);
    statsEl.append(box);
  }
}

function renderTagOptions(): void {
  const tags = getAllTags(notes);
  // kalau tag yang sedang dipilih sudah tidak ada, reset filter
  if (filter.tag !== null && !tags.includes(filter.tag)) filter.tag = null;

  tagFilterEl.replaceChildren(new Option("Semua tag", ""));
  for (const t of tags) tagFilterEl.append(new Option(t, t));
  tagFilterEl.value = filter.tag ?? "";
}

function makeButton(label: string, className: string, onClick: () => void) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function renderCard(note: Note): HTMLElement {
  const card = document.createElement("article");
  card.className = note.pinned ? "note pinned" : "note";

  const title = document.createElement("h3");
  title.textContent = (note.pinned ? "📌 " : "") + note.title;

  const content = document.createElement("p");
  content.className = "note-content";
  content.textContent = note.content;

  const tagList = document.createElement("div");
  tagList.className = "tag-list";
  for (const t of note.tags ?? []) {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = t;
    tagList.append(chip);
  }

  const date = document.createElement("small");
  date.textContent =
    "Diperbarui " + new Date(note.updatedAt).toLocaleString("id-ID");

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.append(
    makeButton(note.pinned ? "Lepas pin" : "Pin", "btn-small", () => {
      notes = togglePin(notes, note.id);
      persist();
      render();
    }),
    makeButton("Edit", "btn-small", () => startEdit(note)),
    makeButton("Hapus", "btn-small btn-danger", () => {
      if (!confirm(`Hapus catatan "${note.title}"?`)) return;
      notes = deleteNote(notes, note.id);
      if (editingId === note.id) resetForm();
      persist();
      render();
    }),
  );

  card.append(title, content, tagList, date, actions);
  return card;
}

function renderList(): void {
  const visible = filterNotes(notes, filter);
  listEl.replaceChildren(...visible.map(renderCard));

  if (notes.length === 0) {
    emptyEl.textContent = "Belum ada catatan. Tulis catatan pertamamu di atas.";
    emptyEl.hidden = false;
  } else if (visible.length === 0) {
    emptyEl.textContent =
      "Tidak ada catatan yang cocok dengan pencarian atau filter.";
    emptyEl.hidden = false;
  } else {
    emptyEl.hidden = true;
  }
}

function render(): void {
  renderStats();
  renderTagOptions();
  renderList();
}

// ---------- Form: tambah & edit ----------

function resetForm(): void {
  editingId = null;
  formEl.reset();
  formErrorEl.textContent = "";
  submitBtn.textContent = "Simpan catatan";
  cancelBtn.hidden = true;
}

function startEdit(note: Note): void {
  editingId = note.id;
  titleEl.value = note.title;
  contentEl.value = note.content;
  tagsEl.value = (note.tags ?? []).join(", ");
  formErrorEl.textContent = "";
  submitBtn.textContent = "Perbarui catatan";
  cancelBtn.hidden = false;
  titleEl.focus();
  formEl.scrollIntoView({ behavior: "smooth" });
}

formEl.addEventListener("submit", (e) => {
  e.preventDefault();

  const input = {
    title: titleEl.value,
    content: contentEl.value,
    tags: parseTags(tagsEl.value),
  };

  const problem = validateNoteInput(input);
  if (problem !== null) {
    formErrorEl.textContent = problem;
    return;
  }

  if (editingId !== null) {
    notes = updateNote(notes, editingId, {
      title: input.title.trim(),
      content: input.content.trim(),
      tags: input.tags,
    });
  } else {
    notes = createNote(notes, input);
  }

  persist();
  resetForm();
  render();
});

cancelBtn.addEventListener("click", resetForm);

// ---------- Search, filter, sort ----------

searchEl.addEventListener("input", () => {
  filter.keyword = searchEl.value;
  renderList();
});

tagFilterEl.addEventListener("change", () => {
  filter.tag = tagFilterEl.value === "" ? null : tagFilterEl.value;
  renderList();
});

sortEl.addEventListener("change", () => {
  if (isSortOrder(sortEl.value)) {
    filter.sort = sortEl.value;
    renderList();
  }
});

// ---------- Mulai aplikasi ----------

async function init(): Promise<void> {
  showLoading(true);
  clearError();
  try {
    notes = await fetchNotes();
  } catch (e) {
    showError(e instanceof Error ? e.message : "Terjadi kesalahan.");
  } finally {
    showLoading(false);
    render();
  }
}

void init();
