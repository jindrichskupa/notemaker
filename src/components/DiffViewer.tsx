import { For, Show } from "solid-js";
import type { DiffFile } from "../lib/git/api";

interface DiffViewerProps {
  files: DiffFile[];
}

export function DiffViewer(props: DiffViewerProps) {
  return (
    <div class="diff-viewer">
      <For each={props.files}>
        {(file) => (
          <div class="diff-file border border-gray-700 rounded-lg mb-4 overflow-hidden">
            <div class="diff-file-header bg-gray-800 px-4 py-2 flex items-center gap-2">
              <span class={`text-xs px-1.5 py-0.5 rounded ${
                file.status === "added" ? "bg-green-900 text-green-300" :
                file.status === "deleted" ? "bg-red-900 text-red-300" :
                "bg-blue-900 text-blue-300"
              }`}>
                {file.status === "added" ? "A" : file.status === "deleted" ? "D" : "M"}
              </span>
              <span class="text-sm font-mono text-gray-300">{file.path}</span>
            </div>
            <div class="diff-content bg-gray-900 overflow-x-auto">
              <For each={file.hunks}>
                {(hunk) => (
                  <div class="diff-hunk">
                    <div class="diff-hunk-header bg-gray-800/50 px-4 py-1 text-xs text-gray-500 font-mono">
                      {hunk.header}
                    </div>
                    <table class="w-full text-xs font-mono">
                      <tbody>
                        <For each={hunk.lines}>
                          {(line) => (
                            <tr class={
                              line.line_type === "add" ? "bg-green-900/20" :
                              line.line_type === "delete" ? "bg-red-900/20" :
                              ""
                            }>
                              <td class="w-12 text-right pr-2 text-gray-600 select-none border-r border-gray-800">
                                {line.old_line_no || ""}
                              </td>
                              <td class="w-12 text-right pr-2 text-gray-600 select-none border-r border-gray-800">
                                {line.new_line_no || ""}
                              </td>
                              <td class="w-4 text-center select-none">
                                <span class={
                                  line.line_type === "add" ? "text-green-400" :
                                  line.line_type === "delete" ? "text-red-400" :
                                  "text-gray-600"
                                }>
                                  {line.line_type === "add" ? "+" : line.line_type === "delete" ? "-" : " "}
                                </span>
                              </td>
                              <td class="pl-2 whitespace-pre text-gray-300">{line.content}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

export default DiffViewer;
