/**
 * Frontmatter types for note metadata
 */

export interface Frontmatter {
  title?: string;
  labels?: string[];
  created?: string; // ISO datetime
  modified?: string; // ISO datetime
  kanban?: string;
  category?: string;
  pinned?: boolean;
  archived?: boolean;
  [key: string]: unknown; // Custom fields
}

export interface ParsedNote {
  frontmatter: Frontmatter | null;
  body: string;
  raw: string;
}

export const KANBAN_STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in-progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
] as const;

export type KanbanStatus = (typeof KANBAN_STATUSES)[number]["value"];
