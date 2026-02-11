import { LanguageDescription, LanguageSupport, StreamLanguage } from "@codemirror/language";

/**
 * Wrap StreamLanguage in LanguageSupport for compatibility with LanguageDescription
 */
function wrapStreamLanguage(lang: StreamLanguage<unknown>): LanguageSupport {
  return new LanguageSupport(lang);
}

/**
 * Language descriptions for code blocks in markdown
 * Uses dynamic imports for lazy loading
 */
export const languages = [
  LanguageDescription.of({
    name: "javascript",
    alias: ["js", "jsx", "ts", "tsx", "typescript"],
    load: async () => {
      const { javascript } = await import("@codemirror/lang-javascript");
      return javascript({ jsx: true, typescript: true });
    },
  }),
  LanguageDescription.of({
    name: "python",
    alias: ["py", "python3"],
    load: async () => {
      const { python } = await import("@codemirror/lang-python");
      return python();
    },
  }),
  LanguageDescription.of({
    name: "json",
    alias: ["jsonc"],
    load: async () => {
      const { json } = await import("@codemirror/lang-json");
      return json();
    },
  }),
  LanguageDescription.of({
    name: "yaml",
    alias: ["yml"],
    load: async () => {
      const { yaml } = await import("@codemirror/lang-yaml");
      return yaml();
    },
  }),
  LanguageDescription.of({
    name: "sql",
    alias: ["mysql", "postgresql", "postgres", "sqlite"],
    load: async () => {
      const { sql } = await import("@codemirror/lang-sql");
      return sql();
    },
  }),
  LanguageDescription.of({
    name: "rust",
    alias: ["rs"],
    load: async () => {
      const { rust } = await import("@codemirror/lang-rust");
      return rust();
    },
  }),
  LanguageDescription.of({
    name: "go",
    alias: ["golang"],
    load: async () => {
      const { go } = await import("@codemirror/lang-go");
      return go();
    },
  }),
  LanguageDescription.of({
    name: "shell",
    alias: ["bash", "sh", "zsh", "fish"],
    load: async () => {
      const { shell } = await import("@codemirror/legacy-modes/mode/shell");
      return wrapStreamLanguage(StreamLanguage.define(shell));
    },
  }),
  LanguageDescription.of({
    name: "dockerfile",
    alias: ["docker"],
    load: async () => {
      const { dockerFile } = await import(
        "@codemirror/legacy-modes/mode/dockerfile"
      );
      return wrapStreamLanguage(StreamLanguage.define(dockerFile));
    },
  }),
  LanguageDescription.of({
    name: "css",
    alias: ["scss", "less"],
    load: async () => {
      const { css } = await import("@codemirror/legacy-modes/mode/css");
      return wrapStreamLanguage(StreamLanguage.define(css));
    },
  }),
  LanguageDescription.of({
    name: "html",
    alias: ["htm", "xml", "svg"],
    load: async () => {
      const { html } = await import("@codemirror/lang-html");
      return html();
    },
  }),
  LanguageDescription.of({
    name: "markdown",
    alias: ["md", "mdx"],
    load: async () => {
      const { markdown } = await import("@codemirror/lang-markdown");
      return markdown();
    },
  }),
  LanguageDescription.of({
    name: "toml",
    load: async () => {
      const { toml } = await import("@codemirror/legacy-modes/mode/toml");
      return wrapStreamLanguage(StreamLanguage.define(toml));
    },
  }),
  LanguageDescription.of({
    name: "nginx",
    alias: ["conf"],
    load: async () => {
      const { nginx } = await import("@codemirror/legacy-modes/mode/nginx");
      return wrapStreamLanguage(StreamLanguage.define(nginx));
    },
  }),
  LanguageDescription.of({
    name: "ruby",
    alias: ["rb"],
    load: async () => {
      const { ruby } = await import("@codemirror/legacy-modes/mode/ruby");
      return wrapStreamLanguage(StreamLanguage.define(ruby));
    },
  }),
  LanguageDescription.of({
    name: "hcl",
    alias: ["terraform", "tf"],
    load: async () => {
      // HCL uses ruby mode as approximation (similar block structure)
      const { ruby } = await import("@codemirror/legacy-modes/mode/ruby");
      return wrapStreamLanguage(StreamLanguage.define(ruby));
    },
  }),
];

/**
 * Get language by name or alias
 */
export function getLanguageByName(name: string): LanguageDescription | undefined {
  const lowercaseName = name.toLowerCase();
  return languages.find(
    (lang) =>
      lang.name === lowercaseName ||
      lang.alias.some((alias) => alias === lowercaseName)
  );
}
