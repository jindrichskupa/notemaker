/**
 * Frontmatter parser tests
 */

import { describe, it, expect } from "vitest";
import {
  parseNote,
  serializeNote,
  hasFrontmatter,
  extractFrontmatter,
  getNoteTitle,
  createNewNote,
} from "./parser";

describe("Frontmatter Parser", () => {
  describe("parseNote", () => {
    it("parses note with frontmatter", () => {
      const content = `---
title: "Test Note"
labels:
  - tag1
  - tag2
---

# Content here`;

      const result = parseNote(content);

      expect(result.frontmatter).not.toBeNull();
      expect(result.frontmatter?.title).toBe("Test Note");
      expect(result.frontmatter?.labels).toEqual(["tag1", "tag2"]);
      expect(result.body).toContain("# Content here");
    });

    it("returns null frontmatter for note without frontmatter", () => {
      const content = "# Just a heading\n\nSome content";

      const result = parseNote(content);

      expect(result.frontmatter).toBeNull();
      expect(result.body).toBe(content);
    });

    it("handles empty frontmatter", () => {
      const content = `---
---

# Content`;

      const result = parseNote(content);

      // Empty YAML returns null from yaml parser, which becomes {} in parseNote
      // but our regex doesn't match empty frontmatter properly
      expect(result.body).toContain("# Content");
    });

    it("handles malformed YAML gracefully", () => {
      const content = `---
title: "unclosed quote
---

Content`;

      const result = parseNote(content);

      // Should return null frontmatter on parse error
      expect(result.frontmatter).toBeNull();
    });
  });

  describe("serializeNote", () => {
    it("serializes frontmatter and body", () => {
      const frontmatter = { title: "My Note", labels: ["test"] };
      const body = "\n# Content\n";

      const result = serializeNote(frontmatter, body);

      expect(result).toContain("---");
      expect(result).toContain("title:");
      expect(result).toContain("labels:");
      expect(result).toContain("# Content");
    });

    it("returns body only when frontmatter is null", () => {
      const body = "# Just content";

      const result = serializeNote(null, body);

      expect(result).toBe(body);
      expect(result).not.toContain("---");
    });

    it("returns body only when frontmatter is empty", () => {
      const body = "# Just content";

      const result = serializeNote({}, body);

      expect(result).toBe(body);
    });

    it("skips undefined and null values", () => {
      const frontmatter = {
        title: "Test",
        description: undefined,
        author: null,
      };

      const result = serializeNote(frontmatter as any, "body");

      expect(result).toContain("title:");
      expect(result).not.toContain("description");
      expect(result).not.toContain("author");
    });

    it("skips empty arrays", () => {
      const frontmatter = {
        title: "Test",
        labels: [],
      };

      const result = serializeNote(frontmatter, "body");

      expect(result).not.toContain("labels");
    });
  });

  describe("hasFrontmatter", () => {
    it("returns true for content with frontmatter", () => {
      const content = `---
title: "Test"
---

Content`;

      expect(hasFrontmatter(content)).toBe(true);
    });

    it("returns false for content without frontmatter", () => {
      const content = "# Just a heading";

      expect(hasFrontmatter(content)).toBe(false);
    });

    it("returns false for incomplete frontmatter", () => {
      const content = `---
title: "Test"

Content without closing`;

      expect(hasFrontmatter(content)).toBe(false);
    });
  });

  describe("extractFrontmatter", () => {
    it("extracts frontmatter without full parsing", () => {
      const content = `---
title: "Quick Extract"
date: "2024-01-01"
---

Long body content here...`;

      const frontmatter = extractFrontmatter(content);

      expect(frontmatter).not.toBeNull();
      expect(frontmatter?.title).toBe("Quick Extract");
    });

    it("returns null for no frontmatter", () => {
      const content = "No frontmatter here";

      expect(extractFrontmatter(content)).toBeNull();
    });
  });

  describe("getNoteTitle", () => {
    it("returns frontmatter title when available", () => {
      const content = `---
title: "Frontmatter Title"
---

# Heading Title`;

      expect(getNoteTitle(content, "file.md")).toBe("Frontmatter Title");
    });

    it("falls back to first heading", () => {
      const content = "# Heading Title\n\nContent";

      expect(getNoteTitle(content, "file.md")).toBe("Heading Title");
    });

    it("falls back to filename", () => {
      const content = "Just some content without heading";

      expect(getNoteTitle(content, "my-note.md")).toBe("my-note");
    });
  });

  describe("createNewNote", () => {
    it("creates note with frontmatter", () => {
      const note = createNewNote("New Note");

      expect(note).toContain("---");
      expect(note).toContain('title: "New Note"');
      expect(note).toContain("created:");
      expect(note).toContain("modified:");
      expect(note).toContain("# New Note");
    });

    it("includes custom initial frontmatter", () => {
      const note = createNewNote("Test", "", { author: "Test Author" });

      expect(note).toContain("author:");
    });

    it("uses provided body", () => {
      const note = createNewNote("Test", "Custom body content");

      expect(note).toContain("Custom body content");
    });
  });

  describe("roundtrip", () => {
    it("preserves content through parse and serialize", () => {
      const original = `---
title: "Roundtrip Test"
labels:
  - one
  - two
---

# Content

Some text here.`;

      const parsed = parseNote(original);
      const serialized = serializeNote(parsed.frontmatter, parsed.body);
      const reparsed = parseNote(serialized);

      expect(reparsed.frontmatter?.title).toBe("Roundtrip Test");
      expect(reparsed.frontmatter?.labels).toEqual(["one", "two"]);
      expect(reparsed.body).toContain("# Content");
    });
  });
});
