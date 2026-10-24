import { useProjectStore } from "./store/useProjectStore";
import DataPanel from "./components/DataPanel/DataPanel";
import Preview from "./components/Preview/Preview";
import Inspector from "./components/Inspector/Inspector";
import Timeline from "./components/Timeline/Timeline";
import { buildAEExportJSON } from "./exporters/ae/AEExporter";
import { generateJSX } from "./exporters/ae/JSXGenerator";
import { downloadText } from "./utils/download";

export default function App() {
  const { project, exportError, setExportError } = useProjectStore();

  const handleExport = () => {
    try {
      setExportError(null);
      const json = buildAEExportJSON(project);
      const hasRenderable = json.elements.some(
        (e) => e.type === "bar" || e.type === "line-path" || e.type === "line-point" || e.type === "pie-slice"
      );
      if (!hasRenderable) {
        setExportError("当前没有可用于生成图表的数据。");
        return;
      }
      const jsx = generateJSX(json);
      const stamp = new Date().toISOString().slice(0, 10);
      // JSX / JSON 不能带 BOM：AE 执行脚本和 JSON.parse 都会出问题
      downloadText(`DataMotion_${stamp}.jsx`, jsx, { mime: "text/plain;charset=utf-8" });
      downloadText(`DataMotion_${stamp}.json`, JSON.stringify(json, null, 2), { mime: "application/json" });
    } catch (e) {
      setExportError(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">🎬 DataMotion</div>
        <div className="app-header-right">
          {exportError && <span className="error-text">{exportError}</span>}
          <button className="btn-primary" onClick={handleExport}>
            Export AE
          </button>
        </div>
      </header>
      <div className="app-body">
        <aside className="panel-left">
          <DataPanel />
        </aside>
        <main className="panel-center">
          <Preview />
        </main>
        <aside className="panel-right">
          <Inspector />
        </aside>
      </div>
      <footer className="panel-timeline">
        <Timeline />
      </footer>
    </div>
  );
}
