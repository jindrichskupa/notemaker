/**
 * Export Dialog - Export notes to various formats
 */

import { createSignal, Show } from "solid-js";
import {
  exportToHtml,
  exportToPdf,
  downloadHtml,
  printToPdf,
  getExportFilename,
  ExportFormat,
} from "../lib/export";

export interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  notePath: string;
  noteTitle?: string;
}

export function ExportDialog(props: ExportDialogProps) {
  const [format, setFormat] = createSignal<ExportFormat>("html");
  const [includeStyles, setIncludeStyles] = createSignal(true);
  const [isExporting, setIsExporting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const options = {
        format: format(),
        includeStyles: includeStyles(),
        title: props.noteTitle,
      };

      if (format() === "html") {
        const html = await exportToHtml(props.content, options);
        const filename = getExportFilename(props.notePath, "html");
        downloadHtml(html, filename);
      } else {
        const html = await exportToPdf(props.content, options);
        printToPdf(html);
      }

      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    } else if (e.key === "Enter" && !isExporting()) {
      handleExport();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && props.onClose()}
        onKeyDown={handleKeyDown}
      >
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
          {/* Header */}
          <div class="flex items-center justify-between border-b border-gray-700" style={{ padding: "16px 24px" }}>
            <h2 class="text-lg font-medium text-gray-100">Export Note</h2>
            <button
              onClick={props.onClose}
              class="p-1 text-gray-400 hover:text-gray-200 rounded transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: "24px", display: "flex", "flex-direction": "column", gap: "16px" }}>
            {/* Note info */}
            <div class="text-sm text-gray-400">
              Exporting: <span class="text-gray-200">{props.noteTitle || props.notePath}</span>
            </div>

            {/* Format selection */}
            <div>
              <label class="block text-sm text-gray-300" style={{ "margin-bottom": "8px" }}>Format</label>
              <div class="flex" style={{ gap: "12px" }}>
                <button
                  onClick={() => setFormat("html")}
                  class={`flex-1 rounded-lg border transition-colors ${
                    format() === "html"
                      ? "bg-blue-600/20 border-blue-500 text-blue-300"
                      : "bg-gray-700/50 border-gray-600 text-gray-300 hover:border-gray-500"
                  }`}
                  style={{ padding: "12px 16px" }}
                >
                  <div class="flex flex-col items-center gap-1">
                    <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M5.854 4.854a.5.5 0 1 0-.708-.708l-3.5 3.5a.5.5 0 0 0 0 .708l3.5 3.5a.5.5 0 0 0 .708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 0 1 .708-.708l3.5 3.5a.5.5 0 0 1 0 .708l-3.5 3.5a.5.5 0 0 1-.708-.708L13.293 8l-3.147-3.146z" />
                    </svg>
                    <span class="text-sm font-medium">HTML</span>
                  </div>
                </button>
                <button
                  onClick={() => setFormat("pdf")}
                  class={`flex-1 rounded-lg border transition-colors ${
                    format() === "pdf"
                      ? "bg-blue-600/20 border-blue-500 text-blue-300"
                      : "bg-gray-700/50 border-gray-600 text-gray-300 hover:border-gray-500"
                  }`}
                  style={{ padding: "12px 16px" }}
                >
                  <div class="flex flex-col items-center gap-1">
                    <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H4zm0 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" />
                      <path d="M4.603 12.087a.81.81 0 0 1-.438-.42c-.195-.388-.13-.776.08-1.102.198-.307.526-.568.897-.787a7.68 7.68 0 0 1 1.482-.645 19.701 19.701 0 0 0 1.062-2.227 7.269 7.269 0 0 1-.43-1.295c-.086-.4-.119-.796-.046-1.136.075-.354.274-.672.65-.823.192-.077.4-.12.602-.077a.7.7 0 0 1 .477.365c.088.164.12.356.127.538.007.187-.012.395-.047.614-.084.51-.27 1.134-.52 1.794a10.954 10.954 0 0 0 .98 1.686 5.753 5.753 0 0 1 1.334.05c.364.065.734.195.96.465.12.144.193.32.2.518.007.192-.047.382-.138.563a1.04 1.04 0 0 1-.354.416.856.856 0 0 1-.51.138c-.331-.014-.654-.196-.933-.417a5.716 5.716 0 0 1-.911-.95 11.642 11.642 0 0 0-1.997.406 11.311 11.311 0 0 1-1.021 1.51c-.29.35-.608.655-.926.787a.793.793 0 0 1-.58.029z" />
                    </svg>
                    <span class="text-sm font-medium">PDF</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Options */}
            <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
              <label class="flex items-center cursor-pointer" style={{ gap: "12px" }}>
                <input
                  type="checkbox"
                  checked={includeStyles()}
                  onChange={(e) => setIncludeStyles(e.currentTarget.checked)}
                  class="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500"
                />
                <span class="text-sm text-gray-300">Include styles</span>
              </label>
            </div>

            {/* Format info */}
            <div class="p-3 bg-gray-700/50 rounded-lg text-xs text-gray-400">
              <Show when={format() === "html"}>
                HTML file will be downloaded directly to your computer.
              </Show>
              <Show when={format() === "pdf"}>
                A print dialog will open. Choose "Save as PDF" to create a PDF file.
              </Show>
            </div>

            {/* Error */}
            <Show when={error()}>
              <div class="p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300">
                {error()}
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div class="flex justify-end border-t border-gray-700" style={{ gap: "12px", padding: "20px 24px" }}>
            <button
              onClick={props.onClose}
              class="text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
              style={{ padding: "12px 24px" }}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting()}
              class="text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg transition-colors"
              style={{ padding: "12px 24px" }}
            >
              {isExporting() ? "Exporting..." : `Export as ${format().toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

export default ExportDialog;
