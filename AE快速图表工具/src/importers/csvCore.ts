/**
 * csvCore — CSV 解析核心
 *
 * 针对 WPS / Excel 编辑过的 CSV 做加固：
 *  - 分隔符可配置（逗号 / 分号 / 制表符 / 竖线 / 全角逗号）
 *  - 正确处理引号包裹的换行与转义双引号
 *  - 自动清洗不可见字符（BOM、NBSP、全角空格、零宽字符）
 *  - 宽松数值解析（千分位、货币符号、百分号、全角数字、括号负数）
 */

export type CsvDelimiter = "," | ";" | "\t" | "|" | "，";

export const DELIMITER_LABEL: Record<CsvDelimiter, string> = {
  ",": "逗号 ,",
  ";": "分号 ;",
  "\t": "制表符 (Tab)",
  "|": "竖线 |",
  "，": "全角逗号 ，"
};

export const DELIMITER_LIST: CsvDelimiter[] = [",", ";", "\t", "|", "，"];

/** 清洗单元格：去 BOM / 零宽字符 / NBSP / 全角空格，并 trim */
export function sanitizeCell(raw: string): string {
  return raw
    .replace(/[\uFEFF\u200B\u200C\u200D\u2060]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\u3000/g, " ")
    .trim();
}

/** 单元格里是否含"看不见但会毁掉解析"的字符 */
export function hasInvisibleChars(raw: string): boolean {
  return /[\uFEFF\u200B\u200C\u200D\u2060\u00A0\u3000]/.test(raw);
}

/**
 * 把整段文本解析成二维数组。
 * 支持引号内换行、CRLF / LF / CR，自动丢弃全空行（WPS 常留下大量 `,,,,,` 尾行）。
 */
export function parseCsvRows(text: string, delimiter: CsvDelimiter): string[][] {
  const rows: string[][] = [];
  let cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  let i = 0;

  const endRow = () => { cells.push(cur); rows.push(cells); cells = []; cur = ""; };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cur += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === delimiter) { cells.push(cur); cur = ""; i++; continue; }
    if (ch === "\r") { endRow(); i += text[i + 1] === "\n" ? 2 : 1; continue; }
    if (ch === "\n") { endRow(); i++; continue; }
    cur += ch; i++;
  }
  if (cur !== "" || cells.length > 0) endRow();

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface NumericParseResult {
  value: number | null;
  /** 清洗过程中触发的标记，用于给用户提示 */
  flags: ("thousands" | "currency" | "percent" | "fullwidth" | "paren-negative" | "unit")[];
}

const FULLWIDTH_NUM: Record<string, string> = {
  "％": "%", "－": "-", "＋": "+", "．": ".",
  "０": "0", "１": "1", "２": "2", "３": "3", "４": "4",
  "５": "5", "６": "6", "７": "7", "８": "8", "９": "9"
};

/**
 * 宽松数值解析：把 WPS 里"看起来像数字"的东西尽量救回来。
 * 百分号只做标记不除 100（图表里 18.7% 通常希望显示 18.7）。
 */
export function parseNumberLoose(raw: string): NumericParseResult {
  const flags: NumericParseResult["flags"] = [];
  let s = sanitizeCell(raw);
  if (s === "") return { value: null, flags };

  if (/[０-９％－＋．]/.test(s)) {
    s = s.replace(/[０-９％－＋．]/g, (m) => FULLWIDTH_NUM[m] ?? m);
    flags.push("fullwidth");
  }

  // 中文单位（万/亿/个/人/次 …）—— 无法安全换算，标记后交给上层提示
  if (/[\u4E00-\u9FA5]/.test(s.replace(/[¥$€￥元]/g, ""))) {
    flags.push("unit");
    return { value: null, flags };
  }

  if (/[¥$€￥元]/.test(s)) { flags.push("currency"); s = s.replace(/[¥$€￥元]/g, ""); }
  if (/[%％]$/.test(s)) { flags.push("percent"); s = s.replace(/[%％]$/, ""); }
  if (s.includes(",")) flags.push("thousands");
  s = s.replace(/,/g, "").replace(/\s/g, "");

  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); flags.push("paren-negative"); }

  if (s === "" || s === "-" || s === "+" || s === ".") return { value: null, flags };
  let n = Number(s);
  if (Number.isNaN(n) || !Number.isFinite(n)) return { value: null, flags };
  if (neg) n = -n;
  return { value: n, flags };
}
