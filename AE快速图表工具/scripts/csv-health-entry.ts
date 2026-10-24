// ============================================================
// csv-health-entry.ts — CSV 导入体检自测（编码 / 分隔符 / WPS 脏数据）
// 由 scripts/run-csv-tests.mjs 打包执行
// ============================================================

import { readCsvBuffer, decodeBytes, detectFileKind } from "../src/importers/CSVHealth";
import { importCSV } from "../src/importers/CSVImporter";
import { parseNumberLoose } from "../src/importers/csvCore";

let pass = 0;
let fail = 0;

function ok(name: string, cond: boolean, extra = ""): void {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, extra); }
}

console.log("\n[1] UTF-8 无 BOM");
{
  const bytes = new TextEncoder().encode("分类,数值\r\n中国,18.7\r\n美国,28.7\r\n");
  const { report } = readCsvBuffer("a.csv", bytes, {});
  ok("识别为 UTF-8", report.encoding === "utf-8", report.encoding);
  ok("分隔符为逗号", report.delimiter === ",");
  ok("2 行 × 2 列", report.rowCount === 2 && report.columnCount === 2);
  ok("无 error 级问题", report.level !== "error");
}

console.log("\n[2] UTF-8 带 BOM（WPS 存 UTF-8 的产物）");
{
  const body = new TextEncoder().encode("分类,数值\n中国,18.7\n美国,28.7\n");
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...body]);
  const { text, report } = readCsvBuffer("a.csv", bytes, {});
  ok("识别为 utf-8-bom", report.encoding === "utf-8-bom", report.encoding);
  ok("BOM 已剥离", !text.startsWith("\uFEFF"));
  const dm = importCSV(text, report.delimiter);
  ok("表头无乱码", dm.columns[0].name === "分类", dm.columns[0].name);
  ok("数值列识别为 number", dm.columns[1].type === "number");
}

console.log("\n[3] GBK / ANSI（WPS 默认「CSV 逗号分隔」的产物）");
{
  // 分类,数值\r\n中国,18.7\r\n美国,28.7
  const gbk = [
    0xb7, 0xd6, 0xc0, 0xe0, 0x2c, 0xca, 0xfd, 0xd6, 0xb5, 0x0d, 0x0a,
    0xd6, 0xd0, 0xb9, 0xfa, 0x2c, 0x31, 0x38, 0x2e, 0x37, 0x0d, 0x0a,
    0xc3, 0xc0, 0xb9, 0xfa, 0x2c, 0x32, 0x38, 0x2e, 0x37
  ];
  const { text, report } = readCsvBuffer("a.csv", new Uint8Array(gbk), {});
  ok("识别为 GBK", report.encoding === "gbk", report.encoding);
  ok("给出 WPS 相关提醒", report.issues.some((i) => i.code === "ENC_GBK"));
  const dm = importCSV(text, report.delimiter);
  ok("中文未乱码", dm.columns[0].name === "分类", dm.columns[0].name);
  ok("数据行正确", dm.rows.length === 2 && dm.rows[0].category === "中国");
}

console.log("\n[4] 分号分隔（区域设置问题）");
{
  const bytes = new TextEncoder().encode("分类;数值\n中国;18.7\n美国;28.7\n");
  const { text, report } = readCsvBuffer("a.csv", bytes, {});
  ok("嗅探为分号", report.delimiter === ";", report.delimiter);
  ok("提示分隔符异常", report.issues.some((i) => i.code === "DELIM"));
  const dm = importCSV(text, report.delimiter);
  ok("数据正常解析", dm.rows.length === 2 && dm.columns.length === 2);
}

console.log("\n[5] 制表符分隔（WPS 另存为「文本文件」）");
{
  const bytes = new TextEncoder().encode("分类\t数值\n中国\t18.7\n");
  const { report } = readCsvBuffer("a.csv", bytes, {});
  ok("嗅探为 Tab", report.delimiter === "\t", report.delimiter);
}

console.log("\n[6] 误传 xlsx / xls");
{
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
  ok("识别为 xlsx", detectFileKind(bytes) === "xlsx");
  const { report } = readCsvBuffer("a.xlsx", bytes, {});
  ok("给出另存为 CSV 的指引", report.issues.some((i) => i.code === "KIND_XLSX" && /另存为/.test(i.fix ?? "")));
}

console.log("\n[7] WPS 常见脏数据：千分位 / 货币 / 不换行空格 / 空行");
{
  const csv = "分类,数值,备注\n中国,\"1,234\",\u00A0\n美国,¥560,ok\n,,\n";
  const { text, report } = readCsvBuffer("a.csv", new TextEncoder().encode(csv), {});
  ok("空行不干扰分隔符判断", !report.issues.some((i) => i.code === "DELIM_UNSTABLE"));
  ok("提示千分位已处理", report.issues.some((i) => i.code === "NUMBER_THOUSANDS"));
  ok("提示货币符号", report.issues.some((i) => i.code === "NUMBER_CURRENCY"));
  ok("提示不可见字符", report.issues.some((i) => i.code === "INVISIBLE"));
  const dm = importCSV(text, report.delimiter);
  ok("千分位被正确解析", dm.rows[0].value === 1234, String(dm.rows[0].value));
  ok("货币被正确解析", dm.rows[1].value === 560, String(dm.rows[1].value));
  ok("空行被丢弃", dm.rows.length === 2, String(dm.rows.length));
}

console.log("\n[8] 列数不齐 / 空列名 / 非法数值");
{
  const csv = "分类,,数值\n中国,x,1\n美国,2\n日本,3,3\n";
  const { report } = readCsvBuffer("a.csv", new TextEncoder().encode(csv), {});
  ok("提示空列名", report.issues.some((i) => i.code === "EMPTY_HEADER"));
  ok("提示列数不齐", report.issues.some((i) => i.code === "RAGGED"));
  ok("提示非法数值", report.issues.some((i) => i.code === "BAD_NUMBER"));
}

console.log("\n[9] 数据全挤在一列（分隔符选错）");
{
  const bytes = new TextEncoder().encode("分类;数值\n中国;18.7\n");
  const { report } = readCsvBuffer("a.csv", bytes, { delimiter: "|" });
  ok("给出 error 级提示", report.level === "error", report.level);
  ok("提示单列塌陷", report.issues.some((i) => i.code === "SINGLE_COL"));
}

console.log("\n[10] 数值宽松解析");
{
  ok("千分位", parseNumberLoose("1,234").value === 1234);
  ok("货币", parseNumberLoose("¥560").value === 560);
  ok("百分号", parseNumberLoose("18.7%").value === 18.7);
  ok("括号负数", parseNumberLoose("(120)").value === -120);
  ok("全角数字", parseNumberLoose("１２３").value === 123);
  ok("带中文单位返回 null", parseNumberLoose("18.7万").value === null);
  ok("普通负数", parseNumberLoose("-3.5").value === -3.5);
}

console.log("\n[11] 手动覆盖编码");
{
  const gbk = new Uint8Array([0xb7, 0xd6, 0xc0, 0xe0, 0x2c, 0xca, 0xfd, 0xd6, 0xb5]);
  ok("强制 UTF-8 会拿到乱码", decodeBytes(gbk, "utf-8").text.includes("\uFFFD"));
  ok("强制 GBK 正常", decodeBytes(gbk, "gbk").text === "分类,数值", decodeBytes(gbk, "gbk").text);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
if (fail > 0) process.exit(1);
