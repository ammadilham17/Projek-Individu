export interface Note {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NoteInput = Pick<Note, "title" | "content" | "tags">;
export type NoteUpdate = Partial<NoteInput & Pick<Note, "pinned">>;

export type SortOrder = "newest" | "oldest" | "title";

export interface NoteFilter {
  keyword: string;
  tag: string | null;
  sort: SortOrder;
}

export interface NoteStats {
  total: number;
  pinned: number;
  uniqueTags: number;
}
