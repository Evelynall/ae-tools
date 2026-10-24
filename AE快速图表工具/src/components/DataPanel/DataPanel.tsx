import { useRef, useState, useEffect } from "react";
import { useProjectStore } from "../../store/useProjectStore";
import { importCSV } from "../../importers/CSVImporter";
import { importJSON } from "../../importers/JSONImporter";
import {
  readCsvBuffer, inspectJson,
  CsvEncoding, ENCODING_LABEL, HealthReport, HealthIssue
} from "../../importers/CSVHealth";
import { CsvDelimiter, DELIMITER_LABEL, DELIMITER_LIST } from "../../importers/csvCore";
import { DATA_TEMPLATES } from "../../importers/templates";
import { downloadText } from "../../utils/download";

type EncodingChoice = "auto" | CsvEncoding;
type DelimiterChoice = "auto" | CsvDelimiter;

const ENCODING_CHOICES: EncodingChoice[] = ["auto", "utf-8", "gbk", "utf-16le", "utf-16be"];

export default function DataPanel() {
  const {
    project, issues, importError, importReport,
    setImportError, setImportReport,
    setData, setCell, addRow, removeRow
  } = useProjectStore();

  const fileRef = useRef<HTMLInputElement>(null);
  const formatRef = useRef<"csv" | "json">("csv");
  const bufferRef = useRef<Uint8Array | null>(null);
  const fileNameRef = useRef<string>("data.csv");

  const [tplOpen, setTplOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(true);
  const [encoding, setEncoding] = useState<EncodingChoice>("auto");
  const [delimiter, setDelimiter] = useState<DelimiterChoice>("auto");

  const { data } = project;

  // 点击空白处关闭模板菜单
  useEffect(() => {
    if (!tplOpen) return;
    const close = () => setTplOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [tplOpen]);

  const pickFile = (fmt: "csv" | "json") => {
    formatRef.current = fmt;
    if (fileRef.current) {
      fileRef.current.accept = fmt === "csv" ? ".csv,.tsv,.txt,text/csv,text/plain" : ".json,application/json";
      fileRef.current.click();
    }
  };

  /** 用指定编码 / 分隔符重新解析最近一次的文件 */
  const reparse = (enc: EncodingChoice, delim: DelimiterChoice) => {
    const buf = bufferRef.current;
    if (!buf) return;
    try {
      setImportError(null);
      const { text, report } = readCsvBuffer(fileNameRef.current, buf, { encoding: enc, delimiter: delim });

      // 文件类型根本不是 CSV（xlsx / xls / HTML）——直接报错，不再尝试解析
      if (report.kind !== "csv" && report.kind !== "json") {
        setImportReport(report);
        setImportError(report.issues[0]?.message ?? "文件格式不支持。");
        return;
      }

      const parsed = importCSV(text, report.delimiter);
      if (parsed.rows.length === 0) {
        setImportReport(report);
        setImportError(report.issues[0]?.message ?? "解析后没有可用数据，试试换一个编码或分隔符。");
        return;
      }
      setData(parsed);
      setImportReport(report);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    setEncoding("auto");
    setDelimiter("auto");
    setReportOpen(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      bufferRef.current = bytes;
      fileNameRef.current = file.name;

      if (formatRef.current === "json") {
        const { text, report } = inspectJson(file.name, bytes);
        const parsed = importJSON(text);
        if (parsed.rows.length === 0) {
          setImportReport(report);
          setImportError("当前没有可用于生成图表的数据。");
          return;
        }
        setData(parsed);
        setImportReport(report);
        return;
      }

      reparse("auto", "auto");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  /** 报告里的问题：错误全列，提醒最多 5 条，提示最多 2 条 */
  const visibleIssues = (report: HealthReport): HealthIssue[] => {
    const errs = report.issues.filter((i) => i.level === "error");
    const warns = report.issues.filter((i) => i.level === "warn");
    const infos = report.issues.filter((i) => i.level === "info");
    const out: HealthIssue[] = [...errs, ...warns.slice(0, 5)];
    if (warns.length > 5) out.push({ level: "warn", code: "", message: `…还有 ${warns.length - 5} 条提醒` });
    out.push(...infos.slice(0, 2));
    if (infos.length > 2) out.push({ level: "info", code: "", message: `…还有 ${infos.length - 2} 条提示` });
    return out;
  };

  const downloadTemplate = (id: string) => {
    const tpl = DATA_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    downloadText(tpl.fileName, tpl.content, { mime: tpl.mime, bom: true });
  };

  return (
    <div className="data-panel">
      <h2>数据</h2>

      <div className="btn-row">
        <button className="btn" onClick={() => pickFile("csv")}>Import CSV</button>
        <button className="btn" onClick={() => pickFile("json")}>Import JSON</button>
        <div className="tpl-wrap">
          <button className="btn" onClick={(e) => { e.stopPropagation(); setTplOpen((v) => !v); }}>
            模板 ▾
          </button>
          {tplOpen && (
            <div className="tpl-menu" onClick={(e) => e.stopPropagation()}>
              {DATA_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => { downloadTemplate(t.id); setTplOpen(false); }}>
                  {t.name}
                  <span className="tpl-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" hidden onChange={onFile} />
      </div>

      <button className="link-btn" onClick={() => setGuideOpen((v) => !v)}>
        {guideOpen ? "▾" : "▸"} CSV 格式说明 / WPS 避坑
      </button>
      {guideOpen && (
        <div className="guide-box">
          <p>第一行是表头，第二行起是数据。<b>第一列 = 分类</b>（文本），<b>第二列起 = 数值</b>（纯数字）。</p>
          <p>WPS 保存请选 <code>文件 → 另存为 → CSV UTF-8（逗号分隔）</code>；直接改后缀或存 .xlsx 会读不出来。</p>
          <p>数值列不要放单位、百分号、说明文字；表格里不要有标题行和合并单元格。</p>
          <p>不确定格式？点上面的「模板 ▾」直接下载一份现成的。</p>
        </div>
      )}

      {importError && <div className="error-box">{importError}</div>}

      {importReport && (
        <div className={`health-box ${importReport.level}`}>
          <div className="health-head" onClick={() => setReportOpen((v) => !v)}>
            <span>
              {importReport.level === "ok" ? "✓ 导入体检通过" : importReport.level === "warn" ? "⚠ 导入体检有提醒" : "✕ 导入失败"}
            </span>
            <span className="health-toggle">{reportOpen ? "收起" : "展开"}</span>
          </div>

          {reportOpen && (
            <>
              <div className="health-meta">
                {importReport.encodingLabel} · 分隔符 {DELIMITER_LABEL[importReport.delimiter]} ·{" "}
                {importReport.columnCount} 列 × {importReport.rowCount} 行 · {importReport.fileName}
              </div>

              {importReport.issues.length > 0 && (
                <ul>
                  {visibleIssues(importReport).map((i, k) => (
                    <li key={k}>
                      {i.message}
                      {i.fix && <span className="health-fix-tip">→ {i.fix}</span>}
                    </li>
                  ))}
                </ul>
              )}

              {importReport.kind !== "json" && (
                <div className="health-fix">
                  <label>
                    编码
                    <select
                      value={encoding}
                      onChange={(e) => {
                        const v = e.target.value as EncodingChoice;
                        setEncoding(v);
                        reparse(v, delimiter);
                      }}
                    >
                      {ENCODING_CHOICES.map((c) => (
                        <option key={c} value={c}>
                          {c === "auto" ? "自动" : ENCODING_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    分隔
                    <select
                      value={delimiter}
                      onChange={(e) => {
                        const v = e.target.value as DelimiterChoice;
                        setDelimiter(v);
                        reparse(encoding, v);
                      }}
                    >
                      <option value="auto">自动</option>
                      {DELIMITER_LIST.map((d) => (
                        <option key={d} value={d}>{DELIMITER_LABEL[d]}</option>
                      ))}
                    </select>
                  </label>
                  {(encoding !== "auto" || delimiter !== "auto") && (
                    <button className="link-btn" onClick={() => { setEncoding("auto"); setDelimiter("auto"); reparse("auto", "auto"); }}>
                      恢复自动
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {issues.length > 0 && (
        <div className="warn-box">
          数值字段包含无法解析的数据：
          <ul>
            {issues.slice(0, 5).map((i, k) => <li key={k}>{i.message}</li>)}
            {issues.length > 5 && <li>…共 {issues.length} 处</li>}
          </ul>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            {data.columns.map((c) => (
              <th key={c.id}>{c.name}<span className="col-type">{c.type === "number" ? "#" : "T"}</span></th>
            ))}
            <th className="row-op"></th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={ri}>
              {data.columns.map((c) => (
                <td key={c.id}>
                  <input
                    value={row[c.id] === null || row[c.id] === undefined ? "" : String(row[c.id])}
                    onChange={(e) => setCell(ri, c.id, e.target.value)}
                  />
                </td>
              ))}
              <td className="row-op">
                <button className="btn-icon" title="删除行" onClick={() => removeRow(ri)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn-block" onClick={addRow}>+ 添加行</button>
    </div>
  );
}
