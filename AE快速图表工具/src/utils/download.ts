/**
 * 下载工具
 * bom 参数很关键：CSV 必须带 BOM（否则 WPS / Excel 打开中文是乱码），
 * 而 JSX / JSON 绝不能带（AE 脚本会报语法错、JSON.parse 会失败）。
 */

export function downloadText(
  filename: string,
  content: string,
  opts: { mime?: string; bom?: boolean } = {}
): void {
  const mime = opts.mime ?? "text/plain;charset=utf-8";
  const blob = new Blob([(opts.bom ? "\uFEFF" : "") + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
