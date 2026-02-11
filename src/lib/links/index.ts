/**
 * Note Linking System - Wiki-style [[links]] support
 */

export interface NoteLink {
  text: string;       // Display text
  target: string;     // Target note path or name
  alias?: string;     // Optional alias (from [[target|alias]])
  position: {
    start: number;
    end: number;
  };
}

export interface ResolvedLink extends NoteLink {
  resolvedPath: string | null;  // Full path if found, null if not
  exists: boolean;
}

// Wiki link pattern: [[target]] or [[target|alias]]
const WIKI_LINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Extract all wiki-style links from content
 */
export function extractLinks(content: string): NoteLink[] {
  const links: NoteLink[] = [];
  let match;

  while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
    const target = match[1].trim();
    const alias = match[2]?.trim();

    links.push({
      text: alias || target,
      target,
      alias,
      position: {
        start: match.index,
        end: match.index + match[0].length,
      },
    });
  }

  return links;
}

/**
 * Resolve links against available notes
 * @param links - Links to resolve
 * @param availableNotes - Map of note names/paths to full paths
 */
export function resolveLinks(
  links: NoteLink[],
  availableNotes: Map<string, string>
): ResolvedLink[] {
  return links.map((link) => {
    // Try exact match first
    let resolvedPath = availableNotes.get(link.target);

    // Try with .md extension
    if (!resolvedPath) {
      resolvedPath = availableNotes.get(`${link.target}.md`);
    }

    // Try case-insensitive match
    if (!resolvedPath) {
      const lowerTarget = link.target.toLowerCase();
      for (const [name, path] of availableNotes) {
        if (name.toLowerCase() === lowerTarget ||
            name.toLowerCase() === `${lowerTarget}.md`) {
          resolvedPath = path;
          break;
        }
      }
    }

    return {
      ...link,
      resolvedPath: resolvedPath || null,
      exists: !!resolvedPath,
    };
  });
}

/**
 * Create a wiki link string
 */
export function createLink(target: string, alias?: string): string {
  if (alias) {
    return `[[${target}|${alias}]]`;
  }
  return `[[${target}]]`;
}

/**
 * Convert wiki links in content to markdown links
 */
export function convertToMarkdownLinks(
  content: string,
  resolvedLinks: ResolvedLink[]
): string {
  let result = content;

  // Process in reverse order to maintain positions
  const sortedLinks = [...resolvedLinks].sort(
    (a, b) => b.position.start - a.position.start
  );

  for (const link of sortedLinks) {
    const before = result.slice(0, link.position.start);
    const after = result.slice(link.position.end);

    if (link.exists && link.resolvedPath) {
      // Convert to markdown link for existing notes
      const displayText = link.alias || link.target;
      result = `${before}[${displayText}](${link.resolvedPath})${after}`;
    } else {
      // Keep as styled text for non-existing notes (will be styled differently)
      const displayText = link.alias || link.target;
      result = `${before}<span class="wikilink wikilink-missing">${displayText}</span>${after}`;
    }
  }

  return result;
}

/**
 * Check if text contains wiki links
 */
export function hasWikiLinks(content: string): boolean {
  return WIKI_LINK_REGEX.test(content);
}

/**
 * Get all unique targets from links
 */
export function getUniqueTargets(links: NoteLink[]): string[] {
  return [...new Set(links.map((l) => l.target))];
}

/**
 * Link store - manages all links across notes
 */
class LinksStore {
  // Map from source path to its outgoing links
  private outgoingLinks = new Map<string, NoteLink[]>();
  // Map from target to source paths (backlinks)
  private backlinks = new Map<string, Set<string>>();
  private listeners = new Set<() => void>();

  /**
   * Index links from a note
   */
  indexNote(sourcePath: string, content: string): void {
    // Remove old links
    this.removeNote(sourcePath);

    // Extract new links
    const links = extractLinks(content);
    this.outgoingLinks.set(sourcePath, links);

    // Update backlinks
    for (const link of links) {
      const target = this.normalizeTarget(link.target);
      if (!this.backlinks.has(target)) {
        this.backlinks.set(target, new Set());
      }
      this.backlinks.get(target)!.add(sourcePath);
    }

    this.notifyListeners();
  }

  /**
   * Remove a note from the index
   */
  removeNote(sourcePath: string): void {
    const oldLinks = this.outgoingLinks.get(sourcePath) || [];

    // Remove from backlinks
    for (const link of oldLinks) {
      const target = this.normalizeTarget(link.target);
      this.backlinks.get(target)?.delete(sourcePath);
      if (this.backlinks.get(target)?.size === 0) {
        this.backlinks.delete(target);
      }
    }

    this.outgoingLinks.delete(sourcePath);
  }

  /**
   * Get outgoing links from a note
   */
  getOutgoingLinks(sourcePath: string): NoteLink[] {
    return this.outgoingLinks.get(sourcePath) || [];
  }

  /**
   * Get backlinks to a note (notes that link to this note)
   */
  getBacklinks(targetPath: string): string[] {
    const normalizedTarget = this.normalizeTarget(targetPath);

    // Also check without extension
    const withoutExt = normalizedTarget.replace(/\.md$/, "");

    const result = new Set<string>();

    for (const path of this.backlinks.get(normalizedTarget) || []) {
      result.add(path);
    }
    for (const path of this.backlinks.get(withoutExt) || []) {
      result.add(path);
    }

    // Also match by note name only
    const noteName = targetPath.split("/").pop()?.replace(".md", "") || "";
    for (const path of this.backlinks.get(noteName.toLowerCase()) || []) {
      result.add(path);
    }

    return Array.from(result);
  }

  /**
   * Get all links in the vault
   */
  getAllLinks(): { source: string; links: NoteLink[] }[] {
    return Array.from(this.outgoingLinks.entries()).map(([source, links]) => ({
      source,
      links,
    }));
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

  private normalizeTarget(target: string): string {
    return target.toLowerCase().trim();
  }

  /**
   * Clear all links
   */
  clear(): void {
    this.outgoingLinks.clear();
    this.backlinks.clear();
    this.notifyListeners();
  }
}

// Singleton instance
export const linksStore = new LinksStore();
