/** A spreadsheet row as read, with its line in the sheet. */
export type SheetRow = { cells: Record<string, unknown>; sheetRow: number };

function readFile(file: File, asText: boolean) {
  return new Promise<string | ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string | ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    if (asText) reader.readAsText(file, "utf-8");
    else reader.readAsArrayBuffer(file);
  });
}

/**
 * Reads the first sheet of a CSV or Excel file in the browser. Rows with
 * nothing in them are left out. The library loads with the first file, so
 * pages that may never import don't carry it.
 */
export async function readSpreadsheet(
  file: File,
): Promise<{ headers: string[]; rows: SheetRow[] }> {
  const { read, utils } = await import("xlsx");
  // A CSV is read as UTF-8 text, so Hindi names and headers arrive as
  // written; read as bytes they turned into "à¤à¤¾…". Excel files are read as
  // bytes, which SheetJS decodes itself.
  const isText =
    /\.(csv|tsv|txt)$/i.test(file.name) || file.type.startsWith("text/");
  const data = await readFile(file, isText);
  // raw: keep CSV cells as typed, so "05/06/2010" isn't reread as a US
  // month-first date before the server parses it as DD/MM/YYYY (D5). Excel
  // date cells still arrive as serial numbers, which the server converts.
  const workbook = isText
    ? read(data as string, { type: "string", raw: true })
    : read(data, { type: "array", raw: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });

  // Every row has every column (defval), so the first row's keys are the
  // headers, duplicates made unique by SheetJS ("Name_1").
  const headers = Object.keys(rawData[0] ?? {});
  const rows = rawData
    .map((cells, index) => ({
      cells,
      // SheetJS keeps each row's 0-based line; the header is line 1.
      sheetRow:
        typeof (cells as { __rowNum__?: unknown }).__rowNum__ === "number"
          ? (cells as { __rowNum__: number }).__rowNum__ + 1
          : index + 2,
    }))
    .filter(({ cells }) =>
      Object.values(cells).some((v) => String(v ?? "").trim() !== ""),
    );
  return { headers, rows };
}
