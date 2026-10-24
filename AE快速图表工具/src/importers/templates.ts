/**
 * 数据模板 —— 让用户不用猜格式。
 * 所有 CSV 模板都带 UTF-8 BOM，WPS / Excel 双击打开中文不乱码。
 */

export interface DataTemplate {
  id: string;
  name: string;
  desc: string;
  fileName: string;
  mime: string;
  content: string;
}

const CRLF = "\r\n";

const BASIC_CSV = [
  "分类,数值",
  "类别 A,32",
  "类别 B,58",
  "类别 C,44",
  "类别 D,71",
  "类别 E,26"
].join(CRLF) + CRLF;

const MULTI_CSV = [
  "分类,2024,2025,2026",
  "类别 A,32,45,52",
  "类别 B,58,49,63",
  "类别 C,44,60,58",
  "类别 D,71,66,80",
  "类别 E,26,35,41"
].join(CRLF) + CRLF;

const GUIDE_TXT = [
  "DataMotion · 数据模板填写说明",
  "=====================================",
  "",
  "【文件怎么填】",
  "1. 第一行必须是表头（列名），第二行开始是数据。",
  "2. 第一列 = 分类（X 轴标签，文本）；第二列起 = 数值（只能放数字）。",
  "3. 数值列里不要写单位、百分号、说明文字；空单元格会被当作空值跳过。",
  "4. 一个 CSV 只放一张表：不要有标题行、合并单元格、小计行、多个表格。",
  "5. 想做多系列对比，就用「多系列模板」—— 导入后在右侧选择要用哪一列做数值。",
  "",
  "【用 WPS / Excel 编辑后怎么保存】",
  "· 推荐：文件 → 另存为 → 文件类型选「CSV UTF-8（逗号分隔）(*.csv)」。中文不会乱码。",
  "· 次选：「CSV（逗号分隔）(*.csv)」。中文 Windows 下会存成 GBK/ANSI，",
  "  本工具能自动识别，但换台电脑或换系统就可能乱码，不推荐。",
  "· 不要：直接把 .xlsx 改后缀成 .csv（内容其实还是 Excel 格式，读不出来）。",
  "· 不要：存成「网页(*.htm;*.html)」或「Unicode 文本」，本工具读不了。",
  "",
  "【导入后提示问题怎么办】",
  "· 提示编码是 GBK：已自动按 GBK 读取，能用；但建议重新存成 CSV UTF-8。",
  "· 提示分隔符不是逗号：系统区域设置造成的，已自动适配，",
  "  或在导入面板的体检卡片里手动切换分隔符。",
  "· 所有数据挤在一列：分隔符选错了，在体检卡片里换成分号 / 制表符试试。",
  "· 中文全是乱码：在体检卡片里把编码在 UTF-8 和 GBK 之间切换一下。",
  "· 数值变成了一长串数字或日期：WPS 自动格式化了单元格，",
  "  把这一列设为「文本」或「常规」后重新填数字。",
  "",
  "【字段说明】",
  "· 分类（category）：X 轴标签，文本。",
  "· 数值（value）  ：Y 轴数值，纯数字，支持负数与小数。",
  ""
].join(CRLF);

export const DATA_TEMPLATES: DataTemplate[] = [
  {
    id: "basic",
    name: "基础模板（分类 + 数值）",
    desc: "最常用：一列标签 + 一列数字",
    fileName: "DataMotion_数据模板_基础.csv",
    mime: "text/csv;charset=utf-8",
    content: BASIC_CSV
  },
  {
    id: "multi",
    name: "多系列模板（分类 + 多列数值）",
    desc: "做多组对比，导入后切换数值列",
    fileName: "DataMotion_数据模板_多系列.csv",
    mime: "text/csv;charset=utf-8",
    content: MULTI_CSV
  },
  {
    id: "guide",
    name: "填写说明（TXT）",
    desc: "WPS 保存姿势 + 常见坑",
    fileName: "DataMotion_填写说明.txt",
    mime: "text/plain;charset=utf-8",
    content: GUIDE_TXT
  }
];
