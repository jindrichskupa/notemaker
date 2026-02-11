/**
 * Frontmatter parser and serializer
 */

import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { Frontmatter, ParsedNote } from "./types";

// Regex to match frontmatter block
// Must start at beginning of file with --- and end with ---
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Parse a note's content to extract frontmatter and body
 */
export function parseNote(content: string): ParsedNote {
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    return {
      frontmatter: null,
      body: content,
      raw: content,
    };
  }

  try {
    const yamlContent = match[1];
    const body = match[2];
    const frontmatter = yamlParse(yamlContent) as Frontmatter;

    return {
      frontmatter: frontmatter || {},
      body,
      raw: content,
    };
  } catch (error) {
    console.error("Failed to parse frontmatter:", error);
    return {
      frontmatter: null,
      body: content,
      raw: content,
    };
  }
}

/**
 * Serialize frontmatter and body back to a note string
 */
export function serializeNote(
  frontmatter: Frontmatter | null,
  body: string
): string {
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return body;
  }

  // Clean up undefined/null values
  const cleanFrontmatter: Frontmatter = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== undefined && value !== null && value !== "") {
      // Don't include empty arrays
      if (Array.isArray(value) && value.length === 0) continue;
      cleanFrontmatter[key] = value;
    }
  }

  if (Object.keys(cleanFrontmatter).length === 0) {
    return body;
  }

  const yamlContent = yamlStringify(cleanFrontmatter, {
    indent: 2,
    lineWidth: 0, // No line wrapping
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN",
  }).trim();

  // Ensure body starts with newline if it has content
  const normalizedBody = body.startsWith("\n") ? body : body ? `\n${body}` : "";

  return `---\n${yamlContent}\n---${normalizedBody}`;
}

/**
 * Update specific frontmatter fields while preserving others
 */
export function updateFrontmatter(
  content: string,
  updates: Partial<Frontmatter>
): string {
  const { frontmatter, body } = parseNote(content);

  const newFrontmatter: Frontmatter = {
    ...frontmatter,
    ...updates,
    modified: new Date().toISOString(),
  };

  return serializeNote(newFrontmatter, body);
}

/**
 * Create a new note with frontmatter
 */
export function createNewNote(
  title: string,
  body: string = "",
  initialFrontmatter: Partial<Frontmatter> = {}
): string {
  const now = new Date().toISOString();

  const frontmatter: Frontmatter = {
    title,
    labels: [],
    created: now,
    modified: now,
    ...initialFrontmatter,
  };

  // Start body with heading if provided title
  const noteBody = body || `\n# ${title}\n\n`;

  return serializeNote(frontmatter, noteBody);
}

/**
 * Extract just the frontmatter from content without parsing the full body
 * Useful for quick metadata access
 */
export function extractFrontmatter(content: string): Frontmatter | null {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return null;

  try {
    return yamlParse(match[1]) as Frontmatter;
  } catch {
    return null;
  }
}

/**
 * Check if content has frontmatter
 */
export function hasFrontmatter(content: string): boolean {
  return FRONTMATTER_REGEX.test(content);
}

/**
 * Get the title from frontmatter or fall back to first heading
 */
export function getNoteTitle(content: string, fileName: string): string {
  const { frontmatter, body } = parseNote(content);

  // First try frontmatter title
  if (frontmatter?.title) {
    return frontmatter.title;
  }

  // Then try first heading
  const headingMatch = body.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  // Fall back to filename without extension
  return fileName.replace(/\.md$/i, "");
}

/**
 * Format a date for display
 */
export function formatDate(dateString: string | undefined): string {
  if (!dateString) return "N/A";

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

/**
 * Format a date for relative display (e.g., "2 hours ago")
 */
export function formatRelativeDate(dateString: string | undefined): string {
  if (!dateString) return "N/A";

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;

    return formatDate(dateString);
  } catch {
    return dateString;
  }
}
