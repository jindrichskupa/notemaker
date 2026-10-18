import { describe, it, expect } from "vitest";
import { renderMarkdownSync } from "./renderer";
import { searchEngine } from "../search/engine";

describe("XSS hardening", () => {
  it("strips scripts and event handlers from note HTML", () => {
    const html = renderMarkdownSync(
      '<img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">x</a>\n\n<kbd>K</kbd>'
    );
    expect(html).not.toMatch(/onerror|<script|javascript:/);
    expect(html).toContain("<kbd>K</kbd>");
  });

  it("keeps checkboxes clickable and code highlighted", () => {
    const html = renderMarkdownSync("- [ ] todo\n\n```js\nconst a = 1;\n```");
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain("disabled");
    expect(html).toContain("hljs");
  });

  it("escapes search snippets around <mark>", () => {
    const engine = searchEngine as any;
    const snippet = engine.generateSnippet('<img src=x onerror="alert(1)"> needle', {
      include: ["needle"],
      exclude: [],
      phrases: [],
    });
    expect(snippet).not.toContain("<img");
    expect(snippet).toContain("<mark>needle</mark>");
  });
});
