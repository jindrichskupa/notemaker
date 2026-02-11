/**
 * Note Templates System
 */

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  content: string;
  frontmatter?: Record<string, unknown>;
}

// Built-in templates
export const BUILT_IN_TEMPLATES: NoteTemplate[] = [
  {
    id: "blank",
    name: "Blank Note",
    description: "Empty note with no content",
    content: "",
  },
  {
    id: "daily",
    name: "Daily Note",
    description: "Template for daily journaling",
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
 * Get template by ID
 */
export function getTemplate(id: string): NoteTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get all templates
 */
export function getAllTemplates(): NoteTemplate[] {
  return BUILT_IN_TEMPLATES;
}

/**
 * Create note from template
 */
export function createFromTemplate(
  template: NoteTemplate,
  title: string
): { content: string; frontmatter: Record<string, unknown> } {
  const content = processTemplate(template, { title });

  const frontmatter: Record<string, unknown> = {
    title,
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    ...template.frontmatter,
  };

  return { content, frontmatter };
}
