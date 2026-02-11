/**
 * Tags System - Management and filtering of note tags
 */

import { createSignal } from "solid-js";

export interface TagInfo {
  name: string;
  count: number;
  color?: string;
}

// Predefined tag colors
const TAG_COLORS: Record<string, string> = {
  important: "bg-red-500",
  todo: "bg-yellow-500",
  done: "bg-green-500",
  idea: "bg-purple-500",
  question: "bg-blue-500",
  bug: "bg-orange-500",
  feature: "bg-cyan-500",
  docs: "bg-indigo-500",
};

/**
 * Get color for a tag
 */
export function getTagColor(tag: string): string {
  const lower = tag.toLowerCase();
  return TAG_COLORS[lower] || "bg-gray-500";
}

/**
 * Tags store - manages all tags across notes
 */
class TagsStore {
  private tags = new Map<string, Set<string>>(); // tag -> set of file paths
  private listeners = new Set<() => void>();

  /**
   * Index tags from a note
   */
  indexNote(path: string, tags: string[]): void {
    // Remove old tags for this path
    this.removeNote(path);

    // Add new tags
    for (const tag of tags) {
      const normalizedTag = this.normalizeTag(tag);
      if (!this.tags.has(normalizedTag)) {
        this.tags.set(normalizedTag, new Set());
      }
      this.tags.get(normalizedTag)!.add(path);
    }

    this.notifyListeners();
  }

  /**
   * Remove a note from the index
   */
  removeNote(path: string): void {
    for (const [tag, paths] of this.tags) {
      paths.delete(path);
      if (paths.size === 0) {
        this.tags.delete(tag);
      }
    }
  }

  /**
   * Get all tags with counts
   */
  getAllTags(): TagInfo[] {
    const result: TagInfo[] = [];
    for (const [name, paths] of this.tags) {
      result.push({
        name,
        count: paths.size,
        color: getTagColor(name),
      });
    }
    return result.sort((a, b) => b.count - a.count);
  }

  /**
   * Get notes with a specific tag
   */
  getNotesWithTag(tag: string): string[] {
    const normalizedTag = this.normalizeTag(tag);
    const paths = this.tags.get(normalizedTag);
    return paths ? Array.from(paths) : [];
  }

  /**
   * Search tags by prefix
   */
  searchTags(query: string): TagInfo[] {
    const normalizedQuery = this.normalizeTag(query);
    return this.getAllTags().filter((t) =>
      t.name.includes(normalizedQuery)
    );
  }

  /**
   * Get popular tags (top N by count)
   */
  getPopularTags(limit: number = 10): TagInfo[] {
    return this.getAllTags().slice(0, limit);
  }

  /**
   * Normalize tag for comparison
   */
  private normalizeTag(tag: string): string {
    return tag.toLowerCase().trim();
  }

  /**
   * Subscribe to changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Clear all tags
   */
  clear(): void {
    this.tags.clear();
    this.notifyListeners();
  }
}

// Singleton instance
export const tagsStore = new TagsStore();

/**
 * Reactive hook for tags
 */
export function useTags() {
  const [tags, setTags] = createSignal<TagInfo[]>(tagsStore.getAllTags());

  // Subscribe to changes
  tagsStore.subscribe(() => {
    setTags(tagsStore.getAllTags());
  });

  return {
    tags,
    searchTags: (query: string) => tagsStore.searchTags(query),
    getNotesWithTag: (tag: string) => tagsStore.getNotesWithTag(tag),
    getPopularTags: (limit?: number) => tagsStore.getPopularTags(limit),
  };
}

/**
 * Parse tags from various formats
 * Supports: #hashtag, [[tag]], yaml arrays
 */
export function extractTagsFromContent(content: string): string[] {
  const tags = new Set<string>();

  // Match #hashtags (not in code blocks)
  const hashtagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_-]*)/g;
  let match;
  while ((match = hashtagRegex.exec(content)) !== null) {
    tags.add(match[1]);
  }

  return Array.from(tags);
}

/**
 * Format tag for display
 */
export function formatTag(tag: string): string {
  return `#${tag}`;
}
