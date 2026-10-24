/**
 * DataModel — 通用数据结构（不只为柱状图设计）
 * 对应文档 §6
 */
export type FieldType = "string" | "number";

export interface DataColumn {
  id: string;
  name: string;
  type: FieldType;
}

export type DataRow = Record<string, string | number | null>;

export interface DataModel {
  columns: DataColumn[];
  rows: DataRow[];
}

export interface DataValidationIssue {
  rowIndex: number;
  columnId: string;
  message: string;
}

export function createEmptyData(): DataModel {
  return { columns: [], rows: [] };
}

export function createSampleData(): DataModel {
  return {
    columns: [
      { id: "category", name: "分类", type: "string" },
      { id: "value", name: "数值", type: "number" }
    ],
    rows: [
      { category: "中国", value: 18.7 },
      { category: "美国", value: 28.7 },
      { category: "日本", value: 4.2 },
      { category: "德国", value: 4.7 },
      { category: "英国", value: 3.7 }
    ]
  };
}

/** 数据校验：数值字段包含无法解析的数据时给出提示（§39） */
export function validateData(data: DataModel): DataValidationIssue[] {
  const issues: DataValidationIssue[] = [];
  if (data.rows.length === 0) return issues;
  data.rows.forEach((row, rowIndex) => {
    for (const col of data.columns) {
      const v = row[col.id];
      if (v === null || v === undefined || v === "") continue; // 空值允许
      if (col.type === "number") {
        const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
        if (Number.isNaN(n)) {
          issues.push({
            rowIndex,
            columnId: col.id,
            message: `第 ${rowIndex + 1} 行「${col.name}」包含无法解析的数值: ${String(v)}`
          });
        }
      }
    }
  });
  return issues;
}

/** 读取某行的数值字段，非法时返回 null */
export function getNumericValue(row: DataRow, columnId: string): number | null {
  const v = row[columnId];
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}
