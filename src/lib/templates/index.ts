/**
 * Note & Notebook Templates System
 *
 * Supports:
 * - Built-in templates (notes and notebooks)
 * - Custom vault templates from .notemaker/templates/
 */

import { invoke } from "@tauri-apps/api/core";
import { parseNote } from "../frontmatter/parser";

export type TemplateType = "note" | "notebook";

export interface NotebookBlockDef {
  type: "markdown" | "code";
  language?: string;
  content: string;
}

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  category?: string;
  icon?: string;
  content: string;
  frontmatter?: Record<string, unknown>;
  isCustom?: boolean;
  filePath?: string;  // For custom templates
  templateType?: TemplateType;  // 'note' (default) or 'notebook'
  blocks?: NotebookBlockDef[];  // For notebook templates
}

export interface TemplateMetadata {
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  type?: TemplateType;
}

// Built-in templates
export const BUILT_IN_TEMPLATES: NoteTemplate[] = [
  {
    id: "blank",
    name: "Blank Note",
    description: "Empty note with no content",
    category: "Basic",
    content: "",
  },
  {
    id: "daily",
    name: "Daily Note",
    description: "Template for daily journaling",
    category: "Personal",
    content: `# {{date}}

## Tasks
- [ ]

## Notes


## Highlights

`,
    frontmatter: {
      labels: ["daily"],
    },
  },
  {
    id: "meeting",
    name: "Meeting Notes",
    description: "Template for meeting notes",
    category: "Work",
    content: `# Meeting: {{title}}

**Date:** {{date}}
**Attendees:**

## Agenda
1.

## Discussion


## Action Items
- [ ]

## Next Steps

`,
    frontmatter: {
      labels: ["meeting"],
    },
  },
  {
    id: "project",
    name: "Project",
    description: "Template for project documentation",
    category: "Work",
    content: `# {{title}}

## Overview


## Goals
-

## Tasks
- [ ]

## Resources
-

## Notes

`,
    frontmatter: {
      labels: ["project"],
      kanban: "todo",
    },
  },
  {
    id: "bug",
    name: "Bug Report",
    description: "Template for bug tracking",
    category: "Development",
    content: `# Bug: {{title}}

## Description


## Steps to Reproduce
1.

## Expected Behavior


## Actual Behavior


## Environment
- OS:
- Version:

## Screenshots


## Possible Solution

`,
    frontmatter: {
      labels: ["bug"],
      kanban: "todo",
    },
  },
  {
    id: "feature",
    name: "Feature Request",
    description: "Template for feature requests",
    category: "Development",
    content: `# Feature: {{title}}

## Problem
What problem does this solve?

## Solution
Describe the proposed solution.

## Alternatives
What alternatives have been considered?

## Implementation
How should this be implemented?

## Tasks
- [ ]

`,
    frontmatter: {
      labels: ["feature"],
      kanban: "todo",
    },
  },
  {
    id: "howto",
    name: "How-To Guide",
    description: "Template for tutorials and guides",
    category: "Documentation",
    content: `# How to {{title}}

## Prerequisites
-

## Steps

### Step 1:


### Step 2:


### Step 3:


## Troubleshooting


## Related
-

`,
    frontmatter: {
      labels: ["docs", "howto"],
    },
  },
  {
    id: "checklist",
    name: "Checklist",
    description: "Simple checklist template",
    category: "Basic",
    content: `# {{title}}

## Checklist

- [ ] Item 1
- [ ] Item 2
- [ ] Item 3
- [ ] Item 4
- [ ] Item 5

## Notes

`,
    frontmatter: {
      labels: ["checklist"],
    },
  },
  {
    id: "retrospective",
    name: "Retrospective",
    description: "Sprint/project retrospective template",
    category: "Work",
    content: `# Retrospective: {{title}}

**Date:** {{date}}
**Sprint/Period:**

## What Went Well
-

## What Could Be Improved
-

## Action Items
- [ ]

## Key Metrics
| Metric | Value |
|--------|-------|
| Completed | |
| Remaining | |

## Team Feedback

`,
    frontmatter: {
      labels: ["retro", "team"],
    },
  },
  {
    id: "decision",
    name: "Decision Log",
    description: "Document important decisions",
    category: "Documentation",
    content: `# Decision: {{title}}

**Date:** {{date}}
**Status:** Proposed | Accepted | Deprecated
**Deciders:**

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or more difficult to do because of this change?

## Alternatives Considered
1.
2.

## Related
-

`,
    frontmatter: {
      labels: ["decision", "adr"],
    },
  },
  {
    id: "post-mortem",
    name: "Post Mortem",
    description: "Incident post-mortem analysis",
    category: "Operations",
    content: `# Post Mortem: {{title}}

**Date:** {{date}}
**Incident Date:**
**Severity:** SEV1 | SEV2 | SEV3
**Duration:**
**Author:**

## Summary
Brief description of the incident.

## Impact
- **Users affected:**
- **Services affected:**
- **Revenue impact:**

## Timeline
| Time | Event |
|------|-------|
| HH:MM | Incident started |
| HH:MM | Alert triggered |
| HH:MM | Investigation began |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Incident resolved |

## Root Cause
What was the underlying cause of the incident?

## Detection
How was the incident detected? Could we have detected it sooner?

## Resolution
What steps were taken to resolve the incident?

## Lessons Learned

### What went well
-

### What went poorly
-

### Where we got lucky
-

## Action Items
- [ ] Immediate fix
- [ ] Preventive measures
- [ ] Monitoring improvements
- [ ] Documentation updates

## Related Incidents
-

`,
    frontmatter: {
      labels: ["post-mortem", "incident"],
    },
  },
  {
    id: "runbook",
    name: "Runbook",
    description: "Operational runbook for incidents",
    category: "Operations",
    content: `# Runbook: {{title}}

## Overview
Brief description of what this runbook covers.

## When to Use
- Scenario 1
- Scenario 2

## Prerequisites
- Access to:
- Tools needed:

## Procedure

### Step 1: Assess
\`\`\`bash
# Commands to check status
\`\`\`

### Step 2: Mitigate
\`\`\`bash
# Commands to fix
\`\`\`

### Step 3: Verify
\`\`\`bash
# Commands to verify fix
\`\`\`

## Rollback
If things go wrong:

\`\`\`bash
# Rollback commands
\`\`\`

## Escalation
- L1:
- L2:
- L3:

## Related
-

`,
    frontmatter: {
      labels: ["runbook", "ops"],
    },
  },
];

// Built-in notebook templates
export const BUILT_IN_NOTEBOOK_TEMPLATES: NoteTemplate[] = [
  {
    id: "notebook:python-tutorial",
    name: "Python Tutorial",
    description: "Interactive Python tutorial with code examples",
    category: "Development",
    icon: "🐍",
    content: "",
    templateType: "notebook",
    blocks: [
      {
        type: "markdown",
        language: undefined,
        content: `# Python Tutorial

Welcome to this interactive Python tutorial!

## Getting Started

Run each code block to see the output.`,
      },
      {
        type: "code",
        language: "python",
        content: `# Hello World
print("Hello, Python!")`,
      },
      {
        type: "markdown",
        language: undefined,
        content: `## Variables

Python variables are dynamically typed.`,
      },
      {
        type: "code",
        language: "python",
        content: `# Variables
name = "Python"
version = 3.12
is_awesome = True

print(f"{name} {version} is awesome: {is_awesome}")`,
      },
    ],
  },
  {
    id: "notebook:shell-script",
    name: "Shell Script",
    description: "Interactive shell script with examples",
    category: "Development",
    icon: "💻",
    content: "",
    templateType: "notebook",
    blocks: [
      {
        type: "markdown",
        language: undefined,
        content: `# Shell Script Notebook

Interactive shell scripting with live execution.`,
      },
      {
        type: "code",
        language: "shell",
        content: `# System info
echo "User: $USER"
echo "Shell: $SHELL"
echo "Date: $(date)"`,
      },
      {
        type: "markdown",
        language: undefined,
        content: `## File Operations`,
      },
      {
        type: "code",
        language: "shell",
        content: `# List files
ls -la`,
      },
    ],
  },
  {
    id: "notebook:data-analysis",
    name: "Data Analysis",
    description: "Python data analysis template",
    category: "Development",
    icon: "📊",
    content: "",
    templateType: "notebook",
    blocks: [
      {
        type: "markdown",
        language: undefined,
        content: `# Data Analysis

## Overview
Describe your analysis goals here.`,
      },
      {
        type: "code",
        language: "python",
        content: `# Import libraries
import json
from datetime import datetime

# Sample data
data = {
    "name": "Analysis",
    "date": datetime.now().isoformat(),
    "values": [1, 2, 3, 4, 5]
}

print(json.dumps(data, indent=2))`,
      },
      {
        type: "markdown",
        language: undefined,
        content: `## Data Processing`,
      },
      {
        type: "code",
        language: "python",
        content: `# Process data
values = [1, 2, 3, 4, 5]
total = sum(values)
average = total / len(values)

print(f"Total: {total}")
print(f"Average: {average}")`,
      },
      {
        type: "markdown",
        language: undefined,
        content: `## Results

Document your findings here.`,
      },
    ],
  },
  {
    id: "notebook:sql-queries",
    name: "SQL Queries",
    description: "SQL query collection template",
    category: "Development",
    icon: "🗄️",
    content: "",
    templateType: "notebook",
    blocks: [
      {
        type: "markdown",
        language: undefined,
        content: `# SQL Query Collection

Document and organize your SQL queries.`,
      },
      {
        type: "code",
        language: "sql",
        content: `-- Example query
SELECT
    id,
    name,
    created_at
FROM users
WHERE active = true
ORDER BY created_at DESC
LIMIT 10;`,
      },
      {
        type: "markdown",
        language: undefined,
        content: `## Notes

Add explanations for complex queries.`,
      },
    ],
  },
  {
    id: "notebook:api-testing",
    name: "API Testing",
    description: "Test API endpoints with shell commands",
    category: "Operations",
    icon: "🔌",
    content: "",
    templateType: "notebook",
    blocks: [
      {
        type: "markdown",
        language: undefined,
        content: `# API Testing

Test your API endpoints interactively.

## Configuration`,
      },
      {
        type: "code",
        language: "shell",
        content: `# Set base URL
BASE_URL="https://api.example.com"
echo "Testing: $BASE_URL"`,
      },
      {
        type: "markdown",
        language: undefined,
        content: `## GET Request`,
      },
      {
        type: "code",
        language: "shell",
        content: `# GET request example
curl -s "$BASE_URL/health" | head -20`,
      },
      {
        type: "markdown",
        language: undefined,
        content: `## POST Request`,
      },
      {
        type: "code",
        language: "shell",
        content: `# POST request example
curl -s -X POST "$BASE_URL/api/data" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "value"}' | head -20`,
      },
    ],
  },
  {
    id: "notebook:blank",
    name: "Blank Notebook",
    description: "Empty notebook with one markdown block",
    category: "Basic",
    icon: "📓",
    content: "",
    templateType: "notebook",
    blocks: [
      {
        type: "markdown",
        language: undefined,
        content: `# {{title}}

Start writing here...`,
      },
    ],
  },
];

/**
 * Process template variables
 */
export function processTemplate(
  template: NoteTemplate,
  variables: Record<string, string> = {}
): string {
  const now = new Date();

  // Default variables
  const defaults: Record<string, string> = {
    date: now.toISOString().split("T")[0],
    datetime: now.toISOString(),
    time: now.toTimeString().split(" ")[0],
    year: now.getFullYear().toString(),
    month: (now.getMonth() + 1).toString().padStart(2, "0"),
    day: now.getDate().toString().padStart(2, "0"),
    title: "Untitled",
  };

  const allVars = { ...defaults, ...variables };

  // Replace {{variable}} patterns
  let content = template.content;
  for (const [key, value] of Object.entries(allVars)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return content;
}

/**
 * Process notebook template blocks with variables
 */
export function processNotebookTemplate(
  template: NoteTemplate,
  variables: Record<string, string> = {}
): NotebookBlockDef[] {
  if (!template.blocks) return [];

  const now = new Date();
  const defaults: Record<string, string> = {
    date: now.toISOString().split("T")[0],
    datetime: now.toISOString(),
    time: now.toTimeString().split(" ")[0],
    year: now.getFullYear().toString(),
    month: (now.getMonth() + 1).toString().padStart(2, "0"),
    day: now.getDate().toString().padStart(2, "0"),
    title: "Untitled",
  };

  const allVars = { ...defaults, ...variables };

  return template.blocks.map((block) => {
    let content = block.content;
    for (const [key, value] of Object.entries(allVars)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    return { ...block, content };
  });
}

/**
 * Get template by ID
 */
export function getTemplate(id: string): NoteTemplate | undefined {
  return [...BUILT_IN_TEMPLATES, ...BUILT_IN_NOTEBOOK_TEMPLATES].find((t) => t.id === id);
}

/**
 * Get all built-in templates (notes only)
 */
export function getAllTemplates(): NoteTemplate[] {
  return BUILT_IN_TEMPLATES;
}

/**
 * Get all built-in notebook templates
 */
export function getAllNotebookTemplates(): NoteTemplate[] {
  return BUILT_IN_NOTEBOOK_TEMPLATES;
}

/**
 * Load custom templates from vault's .notemaker/templates/ folder
 */
export async function loadVaultTemplates(vaultPath: string): Promise<NoteTemplate[]> {
  const templatesDir = `${vaultPath}/.notemaker/templates`;

  try {
    // Check if templates directory exists
    const exists = await invoke<boolean>("path_exists", { path: templatesDir });
    if (!exists) {
      return [];
    }

    // List template files
    const entries = await invoke<Array<{ name: string; path: string; is_directory: boolean }>>(
      "list_directory",
      { path: templatesDir }
    );

    const templates: NoteTemplate[] = [];

    for (const entry of entries) {
      if (entry.is_directory || !entry.name.endsWith(".md")) {
        continue;
      }

      try {
        const content = await invoke<string>("read_file", { path: entry.path });
        const { frontmatter, body } = parseNote(content);

        // Extract template metadata from frontmatter
        const templateMeta = frontmatter?.template as TemplateMetadata | undefined;
        const fileName = entry.name.replace(/\.md$/, "");

        templates.push({
          id: `custom:${fileName}`,
          name: templateMeta?.name || fileName,
          description: templateMeta?.description || "Custom template",
          category: templateMeta?.category || "Custom",
          icon: templateMeta?.icon,
          content: body,
          frontmatter: { ...frontmatter, template: undefined }, // Remove template meta from output
          isCustom: true,
          filePath: entry.path,
        });
      } catch (err) {
        console.error(`Failed to load template ${entry.name}:`, err);
      }
    }

    return templates;
  } catch (err) {
    console.error("Failed to load vault templates:", err);
    return [];
  }
}

/**
 * Get all templates (built-in notes + notebooks + vault custom)
 */
export async function getAllTemplatesAsync(vaultPath: string | null): Promise<NoteTemplate[]> {
  const builtInNotes = BUILT_IN_TEMPLATES.map(t => ({ ...t, isCustom: false, templateType: "note" as TemplateType }));
  const builtInNotebooks = BUILT_IN_NOTEBOOK_TEMPLATES.map(t => ({ ...t, isCustom: false }));

  if (!vaultPath) {
    return [...builtInNotes, ...builtInNotebooks];
  }

  const vaultTemplates = await loadVaultTemplates(vaultPath);

  // Vault templates can override built-in by using same ID
  const templateMap = new Map<string, NoteTemplate>();

  for (const t of builtInNotes) {
    templateMap.set(t.id, t);
  }

  for (const t of builtInNotebooks) {
    templateMap.set(t.id, t);
  }

  for (const t of vaultTemplates) {
    templateMap.set(t.id, t);
  }

  return Array.from(templateMap.values());
}

/**
 * Filter templates by type
 */
export function filterTemplatesByType(templates: NoteTemplate[], type: TemplateType): NoteTemplate[] {
  return templates.filter(t => (t.templateType || "note") === type);
}

/**
 * Check if template is a notebook template
 */
export function isNotebookTemplate(template: NoteTemplate): boolean {
  return template.templateType === "notebook";
}

/**
 * Save a note as a template
 */
export async function saveAsTemplate(
  vaultPath: string,
  templateName: string,
  content: string,
  metadata: TemplateMetadata
): Promise<string> {
  const templatesDir = `${vaultPath}/.notemaker/templates`;

  // Ensure templates directory exists
  await invoke("create_directory", { path: templatesDir }).catch(() => {
    // Directory might already exist
  });

  // Create template content with metadata in frontmatter
  const templateContent = `---
template:
  name: "${metadata.name}"
  description: "${metadata.description || ""}"
  category: "${metadata.category || "Custom"}"
${metadata.icon ? `  icon: "${metadata.icon}"` : ""}
---

${content}`;

  // Generate filename from template name
  const fileName = templateName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const filePath = `${templatesDir}/${fileName}.md`;

  await invoke("write_file", { path: filePath, content: templateContent });

  return filePath;
}

/**
 * Delete a custom template
 */
export async function deleteTemplate(templatePath: string): Promise<void> {
  await invoke("delete_note", { path: templatePath });
}

/**
 * Create note from template
 */
export function createFromTemplate(
  template: NoteTemplate,
  title: string
): { content: string; frontmatter: Record<string, unknown> } {
  const content = processTemplate(template, { title });

  // Filter out template metadata from frontmatter
  const { template: _, ...restFrontmatter } = (template.frontmatter || {}) as Record<string, unknown>;

  const frontmatter: Record<string, unknown> = {
    title,
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    ...restFrontmatter,
  };

  return { content, frontmatter };
}

/**
 * Get unique categories from templates
 */
export function getTemplateCategories(templates: NoteTemplate[]): string[] {
  const categories = new Set<string>();
  for (const t of templates) {
    if (t.category) {
      categories.add(t.category);
    }
  }
  return Array.from(categories).sort();
}
