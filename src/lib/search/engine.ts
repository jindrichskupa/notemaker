/**
 * Simple in-memory search engine
 * For production, this would be backed by SQLite FTS5 in Rust
 */

import { SearchQuery, SearchResult } from "./types";
import { TreeNode } from "../store/vault";
import { parseNote, getNoteTitle } from "../frontmatter";
import * as fs from "../fs";

interface IndexedNote {
  path: string;
  title: string;
  content: string;
  labels: string[];
  category?: string;
  modified?: number;
}

class SearchEngine {
  private index: Map<string, IndexedNote> = new Map();

  /**
   * Index a single note
   */
  async indexNote(path: string): Promise<void> {
    try {
      const noteContent = await fs.readNote(path);
      const { frontmatter, body } = parseNote(noteContent.content);
      const fileName = fs.getFileName(path);

      const indexed: IndexedNote = {
        path,
        title: getNoteTitle(noteContent.content, fileName),
        content: body.toLowerCase(),
        labels: frontmatter?.labels || [],
        category: frontmatter?.category,
        modified: noteContent.modified,
      };

      this.index.set(path, indexed);
    } catch (err) {
      console.error(`Failed to index note ${path}:`, err);
    }
  }

  /**
   * Remove a note from the index
   */
  removeNote(path: string): void {
    this.index.delete(path);
  }

  /**
   * Index all notes and notebooks from tree
   */
  async indexAll(nodes: TreeNode[]): Promise<void> {
    const notePaths: string[] = [];
    const notebookPaths: string[] = [];

    const collectPaths = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === "file") {
          notePaths.push(node.path);
        } else if (node.type === "folder") {
          // Notebook = folder ending with .md
          if (node.name.endsWith(".md")) {
            notebookPaths.push(node.path);
          } else if (node.children) {
            collectPaths(node.children);
          }
        }
      }
    };

    collectPaths(nodes);

    // Index regular notes
    for (const path of notePaths) {
      await this.indexNote(path);
    }

    // Index notebooks (combines all block content)
    for (const path of notebookPaths) {
      await this.indexNotebook(path);
    }
  }

  /**
   * Index a notebook (combines content from all blocks)
   */
  async indexNotebook(path: string): Promise<void> {
    try {
      const notebook = await fs.readNotebook(path);

      // Combine all block content
      const combinedContent = notebook.blocks
        .map(block => block.content)
        .join("\n\n");

      const indexed: IndexedNote = {
        path,
        title: notebook.name,
        content: combinedContent.toLowerCase(),
        labels: [],
        category: undefined,
        modified: undefined,
      };

      this.index.set(path, indexed);
    } catch (err) {
      console.error(`Failed to index notebook ${path}:`, err);
    }
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.index.clear();
  }

  /**
   * Search the index
   */
  search(query: SearchQuery): SearchResult[] {
    if (!query.text.trim()) {
      return [];
    }

    const searchTerms = this.parseSearchTerms(query.text.toLowerCase());
    const results: SearchResult[] = [];

    for (const note of this.index.values()) {
      // Apply filters
      if (query.category && note.category !== query.category) {
        continue;
      }

      if (query.labels && query.labels.length > 0) {
        const hasAllLabels = query.labels.every((label) =>
          note.labels.some((l) => l.toLowerCase() === label.toLowerCase())
        );
        if (!hasAllLabels) continue;
      }

      // Calculate score
      const score = this.calculateScore(note, searchTerms);

      if (score > 0) {
        results.push({
          path: note.path,
          title: note.title,
          snippet: this.generateSnippet(note.content, searchTerms),
          score,
          labels: note.labels,
          modified: note.modified
            ? new Date(note.modified * 1000).toISOString()
            : undefined,
        });
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score).slice(0, 50);
  }

  /**
   * Parse search terms, handling operators
   */
  private parseSearchTerms(query: string): {
    include: string[];
    exclude: string[];
    phrases: string[];
  } {
    const include: string[] = [];
    const exclude: string[] = [];
    const phrases: string[] = [];

    // Extract phrases in quotes
    const phraseRegex = /"([^"]+)"/g;
    let match;
    while ((match = phraseRegex.exec(query)) !== null) {
      phrases.push(match[1].toLowerCase());
    }

    // Remove phrases from query
    const withoutPhrases = query.replace(phraseRegex, "");

    // Split remaining terms
    const terms = withoutPhrases.split(/\s+/).filter((t) => t);

    for (const term of terms) {
      if (term.startsWith("-") && term.length > 1) {
        exclude.push(term.slice(1));
      } else if (term !== "or" && term !== "and") {
        include.push(term);
      }
    }

    return { include, exclude, phrases };
  }

  /**
   * Calculate relevance score for a note
   */
  private calculateScore(
    note: IndexedNote,
    terms: { include: string[]; exclude: string[]; phrases: string[] }
  ): number {
    let score = 0;
    const titleLower = note.title.toLowerCase();
    const contentLower = note.content;

    // Check exclusions first
    for (const term of terms.exclude) {
      if (titleLower.includes(term) || contentLower.includes(term)) {
        return 0;
      }
    }

    // Check phrases
    for (const phrase of terms.phrases) {
      if (!contentLower.includes(phrase) && !titleLower.includes(phrase)) {
        return 0;
      }
      score += 10;
    }

    // Score include terms
    for (const term of terms.include) {
      // Title match is worth more
      if (titleLower.includes(term)) {
        score += 20;
        // Exact title match is worth even more
        if (titleLower === term) {
          score += 30;
        }
      }

      // Content match
      if (contentLower.includes(term)) {
        score += 5;
        // Count occurrences (max 5)
        const regex = new RegExp(this.escapeRegex(term), "gi");
        const matches = contentLower.match(regex);
        if (matches) {
          score += Math.min(matches.length, 5);
        }
      }

      // Label match
      if (note.labels.some((l) => l.toLowerCase().includes(term))) {
        score += 15;
      }
    }

    // Require at least one include term to match
    if (terms.include.length > 0 && score < 5) {
      return 0;
    }

    return score;
  }

  /**
   * Generate a snippet with highlighted matches
   */
  private generateSnippet(
    content: string,
    terms: { include: string[]; exclude: string[]; phrases: string[] }
  ): string {
    const allTerms = [...terms.include, ...terms.phrases];
    if (allTerms.length === 0) return content.slice(0, 150) + "...";

    // Find first occurrence of any term
    let firstIndex = content.length;
    let matchedTerm = allTerms[0];

    for (const term of allTerms) {
      const index = content.toLowerCase().indexOf(term);
      if (index !== -1 && index < firstIndex) {
        firstIndex = index;
        matchedTerm = term;
      }
    }

    // Extract snippet around the match
    const start = Math.max(0, firstIndex - 50);
    const end = Math.min(content.length, firstIndex + matchedTerm.length + 100);
    let snippet = content.slice(start, end);

    // Add ellipsis
    if (start > 0) snippet = "..." + snippet;
    if (end < content.length) snippet = snippet + "...";

    // Highlight matches
    for (const term of allTerms) {
      const regex = new RegExp(`(${this.escapeRegex(term)})`, "gi");
      snippet = snippet.replace(regex, "<mark>$1</mark>");
    }

    return snippet;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Get all unique labels from indexed notes
   */
  getAllLabels(): string[] {
    const labels = new Set<string>();
    for (const note of this.index.values()) {
      for (const label of note.labels) {
        labels.add(label);
      }
    }
    return Array.from(labels).sort();
  }

  /**
   * Get all unique categories from indexed notes
   */
  getAllCategories(): string[] {
    const categories = new Set<string>();
    for (const note of this.index.values()) {
      if (note.category) {
        categories.add(note.category);
      }
    }
    return Array.from(categories).sort();
  }
}

// Singleton instance
export const searchEngine = new SearchEngine();
