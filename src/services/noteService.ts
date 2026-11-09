import type {
  Note,
  NoteInput,
  NoteUpdate,
  NoteFilter,
  NoteStats,
} from "../types/note";
import { loadFromStorage } from "../utils/storage";

export const STORAGE_KEY = "notes";

// ---------- Validasi & helper ----------

export function validateNoteInput(input: NoteInput): string | null {
  const title = input.title.trim();
  if (title === "") return "Judul tidak boleh kosong.";
  if (title.length > 60) return "Judul maksimal 60 karakter.";
  if (input.content.trim() === "") return "Isi catatan tidak boleh kosong.";
  return null;
}

// "tugas, Sekolah , tugas" -> ["tugas", "sekolah"]
export function parseTags(raw: string): string[] {
  const cleaned = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t !== "");
  return [...new Set(cleaned)];
}

// ---------- CRUD (semua immutable: return array baru) ----------

export function createNote(notes: Note[], input: NoteInput): Note[] {
  const now = new Date().toISOString();
  const note: Note = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    content: input.content.trim(),
    tags: input.tags ?? [],
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
  return [note, ...notes];
}

export function updateNote(
  notes: Note[],
  id: string,
  changes: NoteUpdate,
): Note[] {
  return notes.map((n) =>
    n.id === id ? { ...n, ...changes, updatedAt: new Date().toISOString() } : n,
  );
}

export function deleteNote(notes: Note[], id: string): Note[] {
  return notes.filter((n) => n.id !== id);
}

export function togglePin(notes: Note[], id: string): Note[] {
  return notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n));
}

// ---------- Fitur khas: cari, filter tag, sort ----------

export function filterNotes(notes: Note[], f: NoteFilter): Note[] {
  const kw = f.keyword.trim().toLowerCase();

  const result = notes.filter((n) => {
    const matchText =
      kw === "" ||
      n.title.toLowerCase().includes(kw) ||
      n.content.toLowerCase().includes(kw);
    const matchTag = f.tag === null || (n.tags ?? []).includes(f.tag);
    return matchText && matchTag;
  });

  return result.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (f.sort === "title") return a.title.localeCompare(b.title);
    const diff =
      new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    return f.sort === "newest" ? -diff : diff;
  });
}

export function getAllTags(notes: Note[]): string[] {
  const all = notes.flatMap((n) => n.tags ?? []);
  return [...new Set(all)].sort();
}

export function getStats(notes: Note[]): NoteStats {
  return {
    total: notes.length,
    pinned: notes.filter((n) => n.pinned).length,
    uniqueTags: getAllTags(notes).length,
  };
}

// ---------- Async simulasi ----------

function sampleNotes(): Note[] {
  const now = Date.now();
  const make = (
    title: string,
    content: string,
    tags: string[],
    pinned: boolean,
    hoursAgo: number,
  ): Note => {
    const iso = new Date(now - hoursAgo * 3600_000).toISOString();
    return {
      id: crypto.randomUUID(),
      title,
      content,
      tags,
      pinned,
      createdAt: iso,
      updatedAt: iso,
    };
  };
  return [
    make(
      "Jadwal ujian",
      "Matematika Senin, Bahasa Inggris Rabu.",
      ["sekolah"],
      true,
      2,
    ),
    make(
      "Ide proyek TypeScript",
      "Buat aplikasi catatan dengan tag dan pencarian.",
      ["coding", "proyek"],
      false,
      5,
    ),
    make(
      "Belanja",
      "Beli buku tulis, pulpen, dan penggaris.",
      ["pribadi"],
      false,
      24,
    ),
    make(
      "Materi interface",
      "Interface mendefinisikan bentuk object.",
      ["coding", "sekolah"],
      false,
      48,
    ),
    make(
      "Catatan tanpa tag",
      "Contoh catatan yang tidak punya tag sama sekali.",
      [],
      false,
      72,
    ),
  ];
}

export function fetchNotes(): Promise<Note[]> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const saved = loadFromStorage<Note[] | null>(STORAGE_KEY, null);
        // null = belum pernah disimpan -> pakai data contoh
        resolve(saved ?? sampleNotes());
      } catch {
        reject(new Error("Gagal memuat catatan."));
      }
    }, 800);
  });
}
