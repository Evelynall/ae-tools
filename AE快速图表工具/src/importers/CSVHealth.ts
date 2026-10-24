/**
 * CSVHealth — 导入体检
 *
 * 专治 WPS / Excel 编辑 CSV 后的各种"明明有数据却读不出来"：
 *  1. 编码：UTF-8 / UTF-8 BOM / GBK(ANSI) / UTF-16 自动识别
 *  2. 分隔符：逗号 / 分号 / 制表符 / 全角逗号 自动嗅探
 *  3. 文件类型：误传 .xlsx / .xls / HTML 表格时给出明确指引
 *  4. 结构：空列名、重复列名、列数不齐、单列塌陷、数值列混进单位等
 */

import { CsvDelimiter, DELIMITER_LIST, parseCsvRows, sanitizeCell, parseNumberLoose, hasInvisibleChars } from "./csvCore";

export type CsvEncoding = "utf-8" | "utf-8-bom" | "utf-16le" | "utf-16be" | "gbk" | "unknown";

export const ENCODING_LABEL: Record<CsvEncoding, string> = {
  "utf-8": "UTF-8",
  "utf-8-bom": "UTF-8（带 BOM）",
  "utf-16le": "UTF-16 LE",
  "utf-16be": "UTF-16 BE",
  gbk: "GBK / ANSI",
  unknown: "未知"
};

export type FileKind = "csv" | "xlsx" | "xls" | "html" | "json" | "unknown";

export type IssueLevel = "error" | "warn" | "info";

export interface HealthIssue {
  level: IssueLevel;
  code: string;
  message: string;
  fix?: string;
}

export interface DecodeResult {
  text: string;
  encoding: CsvEncoding;
  bom: boolean;
  /** 是否走了兜底解码（置信度低） */
  fallback: boolean;
}

export interface HealthReport {
  fileName: string;
  kind: FileKind;
  encoding: CsvEncoding;
  encodingLabel: string;
  bom: boolean;
  delimiter: CsvDelimiter;
  lineBreak: "CRLF" | "LF" | "CR" | "未知";
  rowCount: number;
  columnCount: number;
  raggedRows: number[];
  level: "ok" | "warn" | "error";
  issues: HealthIssue[];
}

export interface CsvReadOptions {
  encoding?: CsvEncoding | "auto";
  delimiter?: CsvDelimiter | "auto";
}

export interface CsvReadResult {
  text: string;
  report: HealthReport;
}

/* ------------------------------------------------------------------ */
/* 文件类型                                                             */
/* ------------------------------------------------------------------ */

export function detectFileKind(bytes: Uint8Array): FileKind {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)) {
    return "xlsx"; // ZIP 容器：xlsx / et / ods
  }
  if (bytes.length >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return "xls"; // OLE2：老版 .xls
  }
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 512)).trimStart();
  if (/^<(?:\?xml|!doctype\s+html|html|table)/i.test(head)) return "html";
  if (/^[{[]/.test(head)) return "json";
  return "csv";
}

/* ------------------------------------------------------------------ */
/* 编码识别                                                             */
/* ------------------------------------------------------------------ */

function tryDecode(bytes: Uint8Array, label: string, fatal: boolean): string | null {
  try {
    return new TextDecoder(label, { fatal }).decode(bytes);
  } catch {
    return null;
  }
}

function countMatch(s: string, re: RegExp): number {
  const m = s.match(re);
  return m ? m.length : 0;
}

/** 典型乱码字（UTF-8 被当 GBK 读 / 或反之） */
const MOJIBAKE_RE = /[\uFFFD\uFFFC\u951F\u65A4\u62F7\u9518\u70EB]/g;

/** 给解码结果打分，越高越像"正常文本" */
function scoreText(t: string): number {
  const len = Math.max(1, t.length);
  let score = 100;
  const rep = countMatch(t, /\uFFFD/g);
  score -= (rep / len) * 8000 + rep * 10;
  score -= countMatch(t, MOJIBAKE_RE) * 6;
  const ctrl = countMatch(t, /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g);
  score -= (ctrl / len) * 3000;
  const cjk = countMatch(t, /[\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/g);
  score += (cjk / len) * 60;
  return score;
}

/** 无 BOM 的 UTF-16 检测：奇数位或偶数位大量 0x00 */
function guessUtf16(bytes: Uint8Array): "utf-16le" | "utf-16be" | null {
  if (bytes.length < 4 || bytes.length % 2 !== 0) return null;
  let evenZero = 0;
  let oddZero = 0;
  const n = Math.min(bytes.length, 1024);
  for (let i = 0; i < n; i += 2) {
    if (bytes[i] === 0) evenZero++;
    if (bytes[i + 1] === 0) oddZero++;
  }
  const half = n / 2;
  if (oddZero / half > 0.6) return "utf-16le";
  if (evenZero / half > 0.6) return "utf-16be";
  return null;
}

function stripBomChar(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

export function decodeBytes(bytes: Uint8Array, forced?: CsvEncoding | "auto"): DecodeResult {
  // ---- 手动指定 ----
  if (forced && forced !== "auto") {
    const label = forced === "gbk" ? "gbk" : forced === "utf-16be" ? "utf-16be" : forced === "utf-16le" ? "utf-16le" : "utf-8";
    const text = tryDecode(bytes, label, false);
    if (text === null) {
      return { text: tryDecode(bytes, "utf-8", false) ?? "", encoding: "unknown", bom: false, fallback: true };
    }
    return { text: stripBomChar(text), encoding: forced, bom: text.charCodeAt(0) === 0xfeff, fallback: false };
  }

  // ---- BOM 直判 ----
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    const raw = tryDecode(bytes, "utf-8", false) ?? "";
    return { text: stripBomChar(raw), encoding: "utf-8-bom", bom: true, fallback: false };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    const raw = tryDecode(bytes, "utf-16le", false) ?? "";
    return { text: stripBomChar(raw), encoding: "utf-16le", bom: true, fallback: false };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const raw = tryDecode(bytes, "utf-16be", false) ?? "";
    return { text: stripBomChar(raw), encoding: "utf-16be", bom: true, fallback: false };
  }

  // ---- UTF-16 无 BOM ----
  const u16 = guessUtf16(bytes);
  if (u16) {
    const raw = tryDecode(bytes, u16, false);
    if (raw !== null) return { text: stripBomChar(raw), encoding: u16, bom: false, fallback: false };
  }

  // ---- UTF-8 严格校验：通过即可高置信判定为 UTF-8 ----
  const strict = tryDecode(bytes, "utf-8", true);
  if (strict !== null) return { text: stripBomChar(strict), encoding: "utf-8", bom: false, fallback: false };

  // ---- 中文 Windows 默认：GBK / ANSI ----
  const gbk = tryDecode(bytes, "gbk", false);
  if (gbk !== null && gbk.length > 0) return { text: stripBomChar(gbk), encoding: "gbk", bom: false, fallback: false };

  const loose = tryDecode(bytes, "utf-8", false) ?? "";
  return { text: stripBomChar(loose), encoding: "unknown", bom: false, fallback: true };
}

/* ------------------------------------------------------------------ */
/* 分隔符嗅探                                                           */
/* ------------------------------------------------------------------ */

export function detectDelimiter(text: string): { delimiter: CsvDelimiter; consistent: boolean } {
  // 忽略只由分隔符/引号/空白组成的空行（WPS 常留下 ",,," 尾行，会干扰判断）
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .filter((l) => l.replace(/[,\t;|，"\s]/g, "") !== "")
    .slice(0, 10);
  if (lines.length === 0) return { delimiter: ",", consistent: true };

  let best: CsvDelimiter = ",";
  let bestScore = -1;
  let bestConsistent = false;

  for (const d of DELIMITER_LIST) {
    const counts = lines.map((l) => countOutsideQuotes(l, d));
    const first = counts[0];
    if (first <= 0) continue;
    const consistent = counts.every((c) => c === first && c > 0);
    const score = first * 2 + (consistent ? 20 : 0) + (d === "," ? 1 : 0);
    if (score > bestScore) { bestScore = score; best = d; bestConsistent = consistent; }
  }

  return { delimiter: best, consistent: bestConsistent };
}

function countOutsideQuotes(line: string, delimiter: CsvDelimiter): number {
  let n = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (!inQuotes && ch === delimiter) n++;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* 体检                                                                */
/* ------------------------------------------------------------------ */

interface InspectArgs {
  fileName: string;
  kind: FileKind;
  decode: DecodeResult;
  delimiter: CsvDelimiter;
  autoDelimiter: boolean;
  delimiterConsistent: boolean;
  rawText: string;
  rows: string[][];
}

function inspectCsv(a: InspectArgs): HealthReport {
  const issues: HealthIssue[] = [];
  const rows = a.rows;

  if (a.kind === "xlsx") {
    issues.push({
      level: "error", code: "KIND_XLSX",
      message: "这是 Excel 工作簿（.xlsx / .et），本工具只能读取纯文本 CSV。",
      fix: "在 WPS 里打开后：文件 → 另存为 → 文件类型选「CSV UTF-8（逗号分隔）(*.csv)」，再导入。"
    });
  } else if (a.kind === "xls") {
    issues.push({
      level: "error", code: "KIND_XLS",
      message: "这是老版 Excel 二进制文件（.xls），本工具读不了。",
      fix: "请用 WPS / Excel 打开后另存为「CSV UTF-8（逗号分隔）(*.csv)」。"
    });
  } else if (a.kind === "html") {
    issues.push({
      level: "error", code: "KIND_HTML",
      message: "文件内部其实是 HTML（WPS 把表格存成了网页），不是 CSV。",
      fix: "重新另存为「CSV UTF-8（逗号分隔）(*.csv)」，不要选「网页(*.htm;*.html)」。"
    });
  }

  // ---- 编码 ----
  if (a.decode.encoding === "gbk") {
    issues.push({
      level: "warn", code: "ENC_GBK",
      message: "检测到 GBK / ANSI 编码 —— 这正是 WPS 默认「CSV（逗号分隔）」的产物，已自动按 GBK 读取。",
      fix: "建议改用「文件 → 另存为 → CSV UTF-8（逗号分隔）」，跨设备/跨系统才不会乱码。"
    });
  } else if (a.decode.encoding === "utf-16le" || a.decode.encoding === "utf-16be") {
    issues.push({
      level: "warn", code: "ENC_UTF16",
      message: "检测到 UTF-16 编码（WPS 另存为「Unicode 文本」会产生），已自动转换。",
      fix: "建议另存为「CSV UTF-8（逗号分隔）」，兼容性最好。"
    });
  } else if (a.decode.encoding === "unknown" || a.decode.fallback) {
    issues.push({
      level: "warn", code: "ENC_UNKNOWN",
      message: "编码无法可靠识别，已按 UTF-8 兜底读取。若中文显示为乱码，请在下方手动切换为 GBK。"
    });
  }
  if (a.decode.bom) {
    issues.push({
      level: "info", code: "ENC_BOM",
      message: "文件带 UTF-8 BOM（WPS 存 UTF-8 时会加），已自动去除，不影响数据。"
    });
  }

  const header = rows[0] ?? [];
  const colCount = header.length;
  const body = rows.slice(1);

  // ---- 分隔符 ----
  if (a.delimiter !== ",") {
    issues.push({
      level: "warn", code: "DELIM",
      message: `检测到分隔符是「${a.delimiter === "\t" ? "制表符" : a.delimiter}」而不是逗号${a.autoDelimiter ? "，已自动适配" : ""}。`,
      fix: "这通常是因为系统区域设置把列表分隔符改成了分号或制表符。建议用逗号重新保存，或在下方手动切换。"
    });
  } else if (a.autoDelimiter && !a.delimiterConsistent && a.rows.length > 1) {
    issues.push({
      level: "warn", code: "DELIM_UNSTABLE",
      message: "各行的分隔符数量不一致，自动嗅探的结果可能不准。",
      fix: "如果数据看起来错位了，在下方手动换一个分隔符试试。"
    });
  }

  if (rows.length === 0) {
    issues.push({ level: "error", code: "EMPTY", message: "文件里没有任何有效内容。" });
  } else if (rows.length === 1) {
    issues.push({
      level: "error", code: "NO_DATA",
      message: "只解析到表头，没有数据行。",
      fix: "确认文件至少有一行数据；若分隔符不对可在下方手动切换。"
    });
  } else if (colCount <= 1) {
    issues.push({
      level: "error", code: "SINGLE_COL",
      message: "整张表只解析出 1 列，数据全挤在一起了 —— 基本可以肯定是分隔符选错。",
      fix: "在下方把分隔符切换为分号 / 制表符，或让 WPS 用逗号重新保存。"
    });
  }

  // ---- 表头 ----
  const names = header.map((h) => sanitizeCell(h));
  if (rows.length > 0) {
    const emptyIdx = names.map((n, i) => (n === "" ? i + 1 : 0)).filter(Boolean);
    if (emptyIdx.length > 0) {
      issues.push({
        level: "warn", code: "EMPTY_HEADER",
        message: `表头第 ${emptyIdx.join("、")} 列没有列名（WPS 常留下多余空列）。`,
        fix: "删掉表格右侧多余的空列后重新保存。"
      });
    }
    const seen = new Map<string, number>();
    const dup: string[] = [];
    names.forEach((n, i) => {
      if (n === "") return;
      if (seen.has(n)) dup.push(`${n}（第 ${seen.get(n)! + 1}、${i + 1} 列）`);
      else seen.set(n, i);
    });
    if (dup.length > 0) {
      issues.push({
        level: "warn", code: "DUP_HEADER",
        message: `存在重复列名：${dup.join("；")}。`,
        fix: "列名重复会让字段映射混淆，建议在表格里改成不同名字。"
      });
    }
    if (names.some((n) => /\uFFFD/.test(n))) {
      issues.push({
        level: "error", code: "HEADER_MOJIBAKE",
        message: "表头里出现乱码字符（�），说明编码判断不对。",
        fix: "在下方手动切换编码（UTF-8 ⇄ GBK），或用「CSV UTF-8」重新另存。"
      });
    }
  }

  // ---- 结构 ----
  const ragged: number[] = [];
  body.forEach((r, i) => { if (r.length !== colCount) ragged.push(i + 2); });
  if (ragged.length > 0) {
    issues.push({
      level: "warn", code: "RAGGED",
      message: `有 ${ragged.length} 行的列数与表头不一致（第 ${ragged.slice(0, 5).join("、")}${ragged.length > 5 ? "…" : ""} 行）。`,
      fix: "WPS 的合并单元格、末尾空列、多行标题都会造成这个。建议表格只保留「一行表头 + 纯数据」。"
    });
  }

  // ---- 数值列体检 ----
  for (let c = 1; c < colCount; c++) {
    const colName = names[c] || `第 ${c + 1} 列`;
    let total = 0;
    let bad = 0;
    let sample = "";
    const flags = new Set<string>();
    for (const r of body) {
      const raw = r[c];
      if (raw === undefined || sanitizeCell(raw) === "") continue;
      total++;
      const p = parseNumberLoose(raw);
      if (p.value === null) { bad++; if (!sample) sample = raw.slice(0, 12); }
      p.flags.forEach((f) => flags.add(f));
    }
    if (total === 0) continue;

    if (bad > 0) {
      issues.push({
        level: "warn", code: "BAD_NUMBER",
        message: `「${colName}」有 ${bad}/${total} 个值不是数字${sample ? `（例如「${sample}」）` : ""}，这些点会被跳过。`,
        fix: "数值列里不要放单位、说明文字或合并单元格。"
      });
    }
    if (flags.has("unit")) {
      issues.push({
        level: "warn", code: "NUMBER_UNIT",
        message: `「${colName}」里有带中文单位的数字（如「18.7万」），无法安全换算。`,
        fix: "请改成纯数字（187000），单位放到图表标题或后缀里。"
      });
    }
    if (flags.has("currency")) {
      issues.push({
        level: "info", code: "NUMBER_CURRENCY",
        message: `「${colName}」含货币符号（¥ $ 元），已自动去除符号后按数字读取。`
      });
    }
    if (flags.has("percent")) {
      issues.push({
        level: "info", code: "NUMBER_PERCENT",
        message: `「${colName}」含百分号，已按原数值读取（18.7% → 18.7，不做除以 100）。`
      });
    }
    if (flags.has("thousands")) {
      issues.push({
        level: "info", code: "NUMBER_THOUSANDS",
        message: `「${colName}」含千分位逗号，已自动去掉。`
      });
    }
    if (flags.has("fullwidth")) {
      issues.push({
        level: "info", code: "NUMBER_FULLWIDTH",
        message: `「${colName}」含全角数字或全角符号，已自动转为半角。`
      });
    }
  }

  if (hasInvisibleChars(a.rawText)) {
    issues.push({
      level: "info", code: "INVISIBLE",
      message: "检测到不可见字符（不换行空格 / 全角空格 / 零宽字符），已自动清洗。"
    });
  }

  const level: HealthReport["level"] =
    issues.some((i) => i.level === "error") ? "error" : issues.some((i) => i.level === "warn") ? "warn" : "ok";

  const crlf = a.rawText.includes("\r\n");
  const crOnly = !crlf && a.rawText.includes("\r");

  return {
    fileName: a.fileName,
    kind: a.kind,
    encoding: a.decode.encoding,
    encodingLabel: ENCODING_LABEL[a.decode.encoding],
    bom: a.decode.bom,
    delimiter: a.delimiter,
    lineBreak: crlf ? "CRLF" : crOnly ? "CR" : a.rawText.includes("\n") ? "LF" : "未知",
    rowCount: body.length,
    columnCount: colCount,
    raggedRows: ragged,
    level,
    issues
  };
}

/* ------------------------------------------------------------------ */
/* 主入口                                                              */
/* ------------------------------------------------------------------ */

export function readCsvBuffer(
  fileName: string,
  bytes: Uint8Array,
  opts: CsvReadOptions = {}
): CsvReadResult {
  const kind = detectFileKind(bytes);
  const decode = decodeBytes(bytes, opts.encoding ?? "auto");

  if (kind === "xlsx" || kind === "xls" || kind === "html") {
    const report = inspectCsv({
      fileName, kind, decode,
      delimiter: ",", autoDelimiter: true, delimiterConsistent: true,
      rawText: decode.text, rows: []
    });
    return { text: decode.text, report };
  }

  const detected = detectDelimiter(decode.text);
  const autoDelimiter = !opts.delimiter || opts.delimiter === "auto";
  const delimiter: CsvDelimiter = autoDelimiter ? detected.delimiter : (opts.delimiter as CsvDelimiter);

  const rows = parseCsvRows(decode.text, delimiter);
  const report = inspectCsv({
    fileName, kind, decode,
    delimiter, autoDelimiter, delimiterConsistent: detected.consistent,
    rawText: decode.text, rows
  });

  return { text: decode.text, report };
}

/** JSON 文件的轻量体检（JSON 带 BOM 会直接 parse 失败，这里先解码） */
export function inspectJson(fileName: string, bytes: Uint8Array): { text: string; report: HealthReport } {
  const decode = decodeBytes(bytes, "auto");
  const issues: HealthIssue[] = [];
  if (decode.encoding === "gbk") {
    issues.push({
      level: "warn", code: "ENC_GBK",
      message: "JSON 文件是 GBK 编码，已自动转换。建议存成 UTF-8 无 BOM。"
    });
  }
  if (decode.bom) {
    issues.push({ level: "info", code: "ENC_BOM", message: "文件带 UTF-8 BOM，已自动去除（否则 JSON 会解析失败）。" });
  }
  return {
    text: decode.text,
    report: {
      fileName,
      kind: "json",
      encoding: decode.encoding,
      encodingLabel: ENCODING_LABEL[decode.encoding],
      bom: decode.bom,
      delimiter: ",",
      lineBreak: decode.text.includes("\r\n") ? "CRLF" : "LF",
      rowCount: 0,
      columnCount: 0,
      raggedRows: [],
      level: issues.some((i) => i.level === "warn") ? "warn" : "ok",
      issues
    }
  };
}
