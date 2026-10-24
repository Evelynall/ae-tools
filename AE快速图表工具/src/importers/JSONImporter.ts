/**
 * JSONImporter — JSON → DataModel
 * 接受两种形态：
 *  1) 完整 DataModel：{ columns: [...], rows: [...] }
 *  2) 对象数组：[{ "国家": "中国", "数值": 18.7 }, ...]
 */

import { DataModel, DataColumn, DataRow } from "../models/DataModel";

export function importJSON(text: string): DataModel {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("JSON 解析失败：请检查文件格式。");
  }

  // 形态 1：完整 DataModel
  if (
    parsed && typeof parsed === "object" && !Array.isArray(parsed) &&
    Array.isArray((parsed as DataModel).columns) && Array.isArray((parsed as DataModel).rows)
  ) {
    const dm = parsed as DataModel;
    if (dm.columns.length === 0) throw new Error("JSON 数据为空：columns 不能为空。");
    return dm;
  }

  // 形态 2：对象数组
  if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
    const keys = Object.keys(parsed[0] as object);
    const columns: DataColumn[] = keys.map((k, i) => {
      const id = i === 0 ? "category" : i === 1 ? "value" : `col_${i}`;
      const isNumber =
        i > 0 &&
        (parsed as Record<string, unknown>[]).every(
          (r) => r[k] === null || r[k] === undefined || typeof r[k] === "number"
        );
      return { id, name: k, type: isNumber ? "number" : "string" };
    });
    const rows: DataRow[] = (parsed as Record<string, unknown>[]).map((r) => {
      const row: DataRow = {};
      columns.forEach((col, i) => {
        const v = r[keys[i]];
        row[col.id] = v === undefined ? null : (v as string | number | null);
      });
      return row;
    });
    return { columns, rows };
  }

  throw new Error("JSON 结构不支持：请提供 DataModel 结构或对象数组。");
}
