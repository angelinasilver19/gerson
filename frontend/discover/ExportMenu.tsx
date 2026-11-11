import { useState } from "react";
import { buildExport, defaultFormat, exportFormats, saveFile, type ExportFormat } from "./exportResult";
import type { RunOutput } from "./runTool";

export function ExportMenu({ output }: { output: RunOutput }) {
  const [format, setFormat] = useState<ExportFormat>(defaultFormat(output));

  return (
    <form
      className="export-actions"
      onSubmit={(event) => {
        event.preventDefault();
        const file = buildExport(output, format);
        saveFile(file.filename, file.blob);
      }}
    >
      <label>
        <span className="sr-only">Export format{output.label ? ` for ${output.label}` : ""}</span>
        <select
          value={format}
          aria-label={`Export format for ${output.label}`}
          onChange={(event) => setFormat(event.target.value as ExportFormat)}
        >
          {exportFormats.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn secondary">
        Export
      </button>
    </form>
  );
}
