/**
 * Table of Contents - Extract headings from markdown
 */

export interface TocItem {
  id: string;
  text: string;
  level: number;
  children: TocItem[];
}

export interface FlatTocItem {
  id: string;
  text: string;
  level: number;
}

// Heading regex - matches # through ######
const HEADING_REGEX = /^(#{1,6})\s+(.+)$/gm;

/**
 * Extract headings from markdown content
 */
export function extractHeadings(content: string): FlatTocItem[] {
  const headings: FlatTocItem[] = [];
  let match;

  // Reset regex state
  HEADING_REGEX.lastIndex = 0;

  while ((match = HEADING_REGEX.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();

    // Generate slug/id from text
    const id = generateSlug(text);

    headings.push({ id, text, level });
  }

  return headings;
}

/**
 * Build nested TOC tree from flat headings
 */
export function buildTocTree(headings: FlatTocItem[]): TocItem[] {
  const root: TocItem[] = [];
  const stack: { item: TocItem; level: number }[] = [];

  for (const heading of headings) {
    const item: TocItem = {
      id: heading.id,
      text: heading.text,
      level: heading.level,
      children: [],
    };

    // Pop items from stack until we find a parent
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top-level heading
      root.push(item);
    } else {
      // Child of last item in stack
      stack[stack.length - 1].item.children.push(item);
    }

    stack.push({ item, level: heading.level });
  }

  return root;
}

/**
 * Generate URL-friendly slug from text
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-")      // Replace spaces with dashes
    .replace(/-+/g, "-")       // Collapse multiple dashes
    .replace(/^-|-$/g, "");    // Trim dashes from ends
}

/**
 * Get TOC as markdown
 */
export function tocToMarkdown(items: TocItem[], indent: number = 0): string {
  let result = "";
  const prefix = "  ".repeat(indent);

  for (const item of items) {
    result += `${prefix}- [${item.text}](#${item.id})\n`;
    if (item.children.length > 0) {
      result += tocToMarkdown(item.children, indent + 1);
    }
  }

  return result;
}

/**
 * Check if content has enough headings to show TOC
 */
export function shouldShowToc(headings: FlatTocItem[], minHeadings: number = 3): boolean {
  return headings.length >= minHeadings;
}

/**
 * Get heading at a specific line number
 */
export function getHeadingAtLine(content: string, lineNumber: number): FlatTocItem | null {
  const lines = content.split("\n");
  if (lineNumber < 0 || lineNumber >= lines.length) return null;

  const line = lines[lineNumber];
  const match = line.match(/^(#{1,6})\s+(.+)$/);

  if (match) {
    return {
      id: generateSlug(match[2].trim()),
      text: match[2].trim(),
      level: match[1].length,
    };
  }

  return null;
}

/**
 * Find line number for a heading by id
 */
export function findHeadingLine(content: string, headingId: string): number {
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match && generateSlug(match[2].trim()) === headingId) {
      return i;
    }
  }

  return -1;
}
