/**
 * Daily Notes System
 */

import { getTemplate, processTemplate } from "../templates";

export interface DailyNoteConfig {
  folder: string;           // Folder for daily notes (e.g., "daily" or "journal")
  format: string;          // Date format for filename (e.g., "YYYY-MM-DD")
  templateId: string;      // Template to use for new daily notes
}

const DEFAULT_CONFIG: DailyNoteConfig = {
  folder: "daily",
  format: "YYYY-MM-DD",
  templateId: "daily",
};

/**
 * Format date according to format string
 * Supports: YYYY, MM, DD, HH, mm, ss
 */
export function formatDate(date: Date, format: string): string {
  const tokens: Record<string, string> = {
    YYYY: date.getFullYear().toString(),
    MM: (date.getMonth() + 1).toString().padStart(2, "0"),
    DD: date.getDate().toString().padStart(2, "0"),
    HH: date.getHours().toString().padStart(2, "0"),
    mm: date.getMinutes().toString().padStart(2, "0"),
    ss: date.getSeconds().toString().padStart(2, "0"),
  };

  let result = format;
  for (const [token, value] of Object.entries(tokens)) {
    result = result.replace(new RegExp(token, "g"), value);
  }

  return result;
}

/**
 * Get daily note filename for a date
 */
export function getDailyNoteFilename(date: Date, config: DailyNoteConfig = DEFAULT_CONFIG): string {
  const formatted = formatDate(date, config.format);
  return `${formatted}.md`;
}

/**
 * Get daily note path for a date
 */
export function getDailyNotePath(
  vaultPath: string,
  date: Date,
  config: DailyNoteConfig = DEFAULT_CONFIG
): string {
  const filename = getDailyNoteFilename(date, config);
  return `${vaultPath}/${config.folder}/${filename}`;
}

/**
 * Get today's daily note path
 */
export function getTodayNotePath(
  vaultPath: string,
  config: DailyNoteConfig = DEFAULT_CONFIG
): string {
  return getDailyNotePath(vaultPath, new Date(), config);
}

/**
 * Create daily note content
 */
export function createDailyNoteContent(date: Date): string {
  const template = getTemplate("daily");
  if (!template) {
    // Fallback if template not found
    const dateStr = formatDate(date, "YYYY-MM-DD");
    return `# ${dateStr}\n\n## Tasks\n- [ ] \n\n## Notes\n\n`;
  }

  const dateStr = formatDate(date, "YYYY-MM-DD");
  return processTemplate(template, {
    date: dateStr,
    title: dateStr,
  });
}

/**
 * Parse date from daily note filename
 */
export function parseDailyNoteDate(
  filename: string,
  _format: string = "YYYY-MM-DD"
): Date | null {
  // Simple parsing for common format
  const match = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  return null;
}

/**
 * Get list of daily notes in a date range
 */
export function getDailyNotesInRange(
  startDate: Date,
  endDate: Date,
  config: DailyNoteConfig = DEFAULT_CONFIG
): { date: Date; filename: string }[] {
  const notes: { date: Date; filename: string }[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    notes.push({
      date: new Date(current),
      filename: getDailyNoteFilename(current, config),
    });
    current.setDate(current.getDate() + 1);
  }

  return notes;
}

/**
 * Navigate to previous/next daily note
 */
export function getAdjacentDailyNote(
  currentDate: Date,
  direction: "prev" | "next",
  config: DailyNoteConfig = DEFAULT_CONFIG
): { date: Date; path: string; filename: string } {
  const newDate = new Date(currentDate);
  newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));

  return {
    date: newDate,
    path: getDailyNotePath("", newDate, config),
    filename: getDailyNoteFilename(newDate, config),
  };
}

export { DEFAULT_CONFIG };
