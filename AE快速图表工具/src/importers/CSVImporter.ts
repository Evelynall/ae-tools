/**
 * CSVImporter — CSV → DataModel
 *
 * 基于 csvCore：支持任意分隔符、引号内换行、不可见字符清洗、宽松数值解析。
 * 出错时抛出带中文说明的 Error，由 DataPanel 捕获展示。
 */

import { DataModel, DataColumn, DataRow } from "../models/DataModel";
import { CsvDelimiter, parseCsvRows, sanitizeCell, parseNumberLoose } from "./csvCore";

/** 数值列判定阈值：允许少量脏值，避免一整列被降级成文本 */
const NUMERIC_RATIO = 0.8;

export function importCSV(text: string, delimiter: CsvDelimiter = ","): DataModel {
  const rows = parseCsvRows(text, delimiter);
  if (rows.length < 2) throw new Error("CSV 内容不足：需要一行表头 + 至少一行数据。");

  const headers = rows[0].map((h) => sanitizeCell(h));
  const rawRows = rows.slice(1);

  // 先按原始字符串收集，再推断列类型
  const columns: DataColumn[] = headers.map((h, i) => {
    const id = i === 0 ? "category" : i === 1 ? "value" : `col_${i}`;
    const cells = rawRows.map((r) => sanitizeCell(r[i] ?? "")).filter((v) => v !== "");
    const numeric = cells.filter((v) => parseNumberLoose(v).value !== null).length;
    const ratio = cells.length > 0 ? numeric / cells.length : 0;
    const isNumber = i > 0 && numeric > 0 && ratio >= NUMERIC_RATIO;
    return { id, name: h || id, type: isNumber ? "number" : "string" };
  });

  const dataRows: DataRow[] = rawRows.map((cells) => {
    const row: DataRow = {};
    columns.forEach((col, i) => {
      const raw = sanitizeCell(cells[i] ?? "");
      if (raw === "") { row[col.id] = null; return; }
      if (col.type === "number") {
        const p = parseNumberLoose(raw);
        row[col.id] = p.value === null ? raw : p.value; // 保留原值，交给校验提示
      } else {
        row[col.id] = raw;
      }
    });
    return row;
  });

  return { columns, rows: dataRows };
}
