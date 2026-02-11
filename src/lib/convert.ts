/**
 * Convert markdown note to notebook
 */

import { convertNoteToNotebook as convertNoteToNotebookRust, type Notebook } from "./fs";

/**
 * Convert a markdown note to a notebook
 * @param notePath Path to the markdown file
 * @param noteContent Current content of the note
 * @returns The created notebook
 */
export async function convertNoteToNotebook(
  notePath: string,
  noteContent: string
): Promise<Notebook> {
  return convertNoteToNotebookRust(notePath, noteContent);
}

/**
 * Check if a markdown note has code blocks that would benefit from conversion
 */
export function hasCodeBlocks(content: string): boolean {
  // Simple check for code fences
  return content.includes("```");
}

/**
 * Count code blocks in markdown content
 */
export function countCodeBlocks(content: string): number {
  // Count opening code fences
  const matches = content.match(/^```/gm);
  return matches ? Math.floor(matches.length / 2) : 0;
}
