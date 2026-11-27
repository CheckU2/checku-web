import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const worksheetPath = "xl/worksheets/sheet1.xml";
const maxSessionsPerSheet = 24;
const marks: Record<string, [string, number]> = {
  Presente: ["A", 7],
  Retardo: ["R", 7],
  Justificada: ["J", 8],
  Falta: ["F", 6],
  "En revisión": ["P", 9],
  Invalidada: ["I", 9],
};

function columnName(index: number): string {
  const letter = String.fromCharCode(65 + index % 26);
  return index < 26 ? letter : columnName(Math.floor(index / 26) - 1) + letter;
}

export async function compactAttendanceWorkbook(blob: Blob) {
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const read = (path: string) => parser.parseFromString(strFromU8(files[path]), "application/xml");
  const write = (path: string, document: Document) => { files[path] = strToU8(serializer.serializeToString(document)); };
  const source = read(worksheetPath);
  const workbook = read("xl/workbook.xml");
  const relationships = read("xl/_rels/workbook.xml.rels");
  const contentTypes = read("[Content_Types].xml");
  const styles = read("xl/styles.xml");
  const rows = Array.from(source.getElementsByTagName("row"));
  const headerIndex = rows.findIndex(row => row.firstElementChild?.textContent === "Alumno");
  if (headerIndex < 0) throw new Error("El Excel recibido no contiene el encabezado de asistencia.");

  const header = Array.from(rows[headerIndex].children);
  const summaries = rows.slice(headerIndex + 1).map(row => Array.from(row.children));
  const sheets: { month: string; start: number; end: number }[] = [];
  for (let index = 7; index < header.length; index++) {
    const month = header[index].textContent?.slice(0, 7) || "Sesiones";
    const last = sheets.at(-1);
    if (last?.month === month && last.end - last.start < maxSessionsPerSheet) last.end++;
    else sheets.push({ month, start: index, end: index + 1 });
  }

  const root = source.documentElement;
  function append(parent: Element, name: string, attributes: Record<string, string> = {}) {
    const child = parent.ownerDocument.createElementNS(parent.namespaceURI, name);
    for (const [key, value] of Object.entries(attributes)) child.setAttribute(key, value);
    parent.append(child);
    return child;
  }
  function column(parent: Element, min: number, max: number, width: number) {
    append(parent, "col", { min: String(min), max: String(max), width: String(width), customWidth: "1" });
  }
  function inline(row: Element, col: string, value: string, style: number) {
    const cell = append(row, "c", { r: col + row.getAttribute("r"), t: "inlineStr", s: String(style) });
    append(append(cell, "is"), "t").textContent = value;
  }

  const newFill = append(styles.getElementsByTagName("fills")[0], "fill");
  const pattern = append(newFill, "patternFill", { patternType: "solid" });
  append(pattern, "fgColor", { rgb: "FFFFE59A" });
  append(pattern, "bgColor", { indexed: "64" });
  newFill.parentElement?.setAttribute("count", "6");
  const formats = styles.getElementsByTagName("cellXfs")[0];
  for (const [fill, rotation] of [[3, 0], [4, 0], [5, 0], [0, 0], [2, 90]]) {
    const format = append(formats, "xf", { numFmtId: "0", fontId: String(rotation ? 1 : 0), fillId: String(fill), borderId: "0", xfId: "0", applyAlignment: "1", applyFill: "1" });
    append(format, "alignment", { horizontal: "center", vertical: "center", textRotation: String(rotation), wrapText: "1" });
  }
  formats.setAttribute("count", String(formats.childElementCount));
  write("xl/styles.xml", styles);

  for (const row of rows.slice(headerIndex)) {
    for (const cell of Array.from(row.children).slice(7)) cell.remove();
  }
  source.getElementsByTagName("cols")[0].lastElementChild?.remove();
  const sheetList = workbook.getElementsByTagName("sheets")[0];
  const bookViews = append(workbook.documentElement, "bookViews");
  append(bookViews, "workbookView", { activeTab: "0" });
  workbook.documentElement.insertBefore(bookViews, sheetList);
  const summarySheet = sheetList.firstElementChild!;
  summarySheet.setAttribute("name", "Resumen");
  write(worksheetPath, source);

  const monthParts = new Map<string, number>();
  sheets.forEach(({ month, start, end }, index) => {
    // Each sheet repeats the legend and freezes the student column and session headers.
    const document = parser.parseFromString(`<worksheet xmlns="${root.namespaceURI}"/>`, "application/xml");
    const sheet = document.documentElement;
    const view = append(append(sheet, "sheetViews"), "sheetView", { workbookViewId: "0", showGridLines: "0" });
    append(view, "pane", { xSplit: "1", ySplit: "4", topLeftCell: "B5", activePane: "bottomRight", state: "frozen" });
    const cols = append(sheet, "cols");
    column(cols, 1, 1, 32);
    column(cols, 2, Math.max(6, end - start + 1), 5);
    const data = append(sheet, "sheetData");
    inline(append(data, "row", { r: "1" }), "A", "Claves de asistencia", 1);
    const legend2 = append(data, "row", { r: "2" });
    inline(legend2, "A", "A = Asistió  ·  R = Retardo", 7);
    inline(legend2, "B", "F = Faltó", 6);
    const legend3 = append(data, "row", { r: "3" });
    inline(legend3, "A", "P = En revisión  ·  I = Invalidada", 9);
    inline(legend3, "B", "J = Justificada", 8);
    const labels = append(data, "row", { r: "4", ht: "130", customHeight: "1" });
    inline(labels, "A", "Alumno", 1);
    header.slice(start, end).forEach((cell, position) => inline(labels, columnName(position + 1), cell.textContent ?? "", 10));
    summaries.forEach((cells, position) => {
      const row = append(data, "row", { r: String(position + 5) });
      inline(row, "A", cells[0].textContent ?? "", 0);
      cells.slice(start, end).forEach((cell, offset) => {
        const mark = marks[(cell.textContent ?? "").trim()];
        if (mark) inline(row, columnName(offset + 1), ...mark);
      });
    });
    const merges = append(sheet, "mergeCells", { count: "2" });
    append(merges, "mergeCell", { ref: "B2:F2" });
    append(merges, "mergeCell", { ref: "B3:F3" });

    const id = String(index + 2);
    const relation = `rIdAttendance${id}`;
    const file = `worksheets/sheet${id}.xml`;
    const part = (monthParts.get(month) ?? 0) + 1;
    monthParts.set(month, part);
    const entry = append(sheetList, "sheet", { name: part === 1 ? month : `${month} (${part})`, sheetId: id });
    entry.setAttributeNS(summarySheet.lookupNamespaceURI("r"), "r:id", relation);
    append(relationships.documentElement, "Relationship", { Id: relation, Type: relationships.documentElement.firstElementChild!.getAttribute("Type")!, Target: file });
    append(contentTypes.documentElement, "Override", { PartName: `/xl/${file}`, ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" });
    write(`xl/${file}`, document);
  });
  write("xl/workbook.xml", workbook);
  write("xl/_rels/workbook.xml.rels", relationships);
  write("[Content_Types].xml", contentTypes);
  return new Blob([zipSync(files, { level: 3 })], { type: blob.type });
}
