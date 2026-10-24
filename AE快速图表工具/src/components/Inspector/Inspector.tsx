import { useState, useRef, useMemo, useEffect } from "react";
import { useProjectStore } from "../../store/useProjectStore";
import { getChartRenderer } from "../../charts/ChartRenderer";
import { elementStartTime } from "../../animation/AnimationEngine";
import { CANVAS_PRESETS } from "../../models/ProjectModel";
import { EasingName } from "../../models/AnimationModel";
import { ValueFormat, GradientMode, GradientShape, createDefaultGradientConfig } from "../../models/StyleModel";
import { getNumericValue } from "../../models/DataModel";
import { extractTheme, applyTheme, listThemes, saveTheme, deleteTheme, exportThemeToFile, importThemeFromFile } from "../../utils/theme";
import HelpIcon from "./HelpIcon";

function SliderField(props: {
  label: React.ReactNode; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <label className="field slider-field">
      <span>{props.label}</span>
      <div className="slider-row">
        <input
          type="range"
          min={props.min ?? 0}
          max={props.max ?? 1}
          step={props.step ?? 0.01}
          value={props.value}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
        <span className="slider-value">{props.value.toFixed(2)}</span>
      </div>
    </label>
  );
}

function NumberField(props: {
  label: React.ReactNode; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="number"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

function ColorField(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input type="color" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  );
}

function CheckField(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="field field-check">
      <span>{props.label}</span>
      <input type="checkbox" checked={props.value} onChange={(e) => props.onChange(e.target.checked)} />
    </label>
  );
}

/** 2D 坐标输入 [x, y] */
function Point2DField(props: {
  label: string;
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  const [x, y] = props.value;
  return (
    <label className="field point2d-field">
      <span>{props.label}</span>
      <div className="point2d-inputs">
        <input type="number" value={x} step={1} onChange={(e) => props.onChange([Number(e.target.value), y])} />
        <input type="number" value={y} step={1} onChange={(e) => props.onChange([x, Number(e.target.value)])} />
      </div>
    </label>
  );
}

/** 渐变编辑器：根据 mode 渲染颜色选择器与位置控制 */
function GradientEditor(props: {
  config: { mode: GradientMode; ramp?: any; fourColor?: any };
  onChange: (cfg: { mode: GradientMode; ramp?: any; fourColor?: any }) => void;
}) {
  const { config, onChange } = props;

  const setMode = (mode: GradientMode) => {
    onChange(createDefaultGradientConfig(mode));
  };

  return (
    <div className="gradient-editor">
      <label className="field">
        <span>渐变模式</span>
        <select value={config.mode} onChange={(e) => setMode(e.target.value as GradientMode)}>
          <option value="none">无渐变</option>
          <option value="ramp">梯度渐变</option>
          <option value="4color">四色渐变</option>
        </select>
      </label>

      {config.mode === "ramp" && config.ramp && (
        <>
          <ColorField label="起始颜色" value={config.ramp.startColor}
            onChange={(v) => onChange({ ...config, ramp: { ...config.ramp, startColor: v } })} />
          <ColorField label="结束颜色" value={config.ramp.endColor}
            onChange={(v) => onChange({ ...config, ramp: { ...config.ramp, endColor: v } })} />
          <Point2DField label="渐变起点" value={config.ramp.startPoint}
            onChange={(v) => onChange({ ...config, ramp: { ...config.ramp, startPoint: v } })} />
          <Point2DField label="渐变终点" value={config.ramp.endPoint}
            onChange={(v) => onChange({ ...config, ramp: { ...config.ramp, endPoint: v } })} />
          <label className="field">
            <span>渐变形状</span>
            <select value={config.ramp.shape}
              onChange={(e) => onChange({ ...config, ramp: { ...config.ramp, shape: e.target.value as GradientShape } })}>
              <option value="linear">线性</option>
              <option value="radial">径向</option>
            </select>
          </label>
        </>
      )}

      {config.mode === "4color" && config.fourColor && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <ColorField
              key={`c${i}`}
              label={`颜色 ${i + 1}`}
              value={config.fourColor.colors[i]}
              onChange={(v) => {
                const colors = [...config.fourColor.colors];
                colors[i] = v;
                onChange({ ...config, fourColor: { ...config.fourColor, colors: colors as [string, string, string, string] } });
              }}
            />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <Point2DField
              key={`p${i}`}
              label={`点 ${i + 1} 位置`}
              value={config.fourColor.points[i]}
              onChange={(v) => {
                const points = [...config.fourColor.points];
                points[i] = v;
                onChange({ ...config, fourColor: { ...config.fourColor, points: points as [[number, number], [number, number], [number, number], [number, number]] } });
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

type SectionKey = "chart" | "theme" | "bar" | "line" | "pie" | "label" | "value" | "axis" | "animation" | "selected";

function CollapsibleSection(props: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={props.open ? "inspector-section open" : "inspector-section"}>
      <h3 onClick={props.onToggle}>
        <span className="toggle-icon">{props.open ? "▼" : "▶"}</span>
        {props.title}
      </h3>
      {props.open && <div className="section-body">{props.children}</div>}
    </section>
  );
}

export default function Inspector() {
  const { project, updateProject, selectedElementId, setSelectedElementId } = useProjectStore();
  const renderer = useMemo(() => getChartRenderer(project), [project]);
  const elements = useMemo(() => renderer.getElements(project), [renderer, project]);
  const s = project.style;
  const a = project.animation;
  const d = project.document;
  const isLine = project.chart.type === "line";
  const isPie = project.chart.type === "pie";

  const [themeName, setThemeName] = useState("");
  const [savedThemes, setSavedThemes] = useState(listThemes());
  const fileRef = useRef<HTMLInputElement>(null);

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    chart: true,
    theme: false,
    bar: false,
    line: false,
    pie: false,
    label: false,
    value: false,
    axis: false,
    animation: false,
    selected: false
  });

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 当选中图层时自动展开「选中图层」面板
  useEffect(() => {
    if (selectedElementId) {
      setOpenSections((prev) => prev.selected ? prev : { ...prev, selected: true });
    }
  }, [selectedElementId]);

  const refreshThemes = () => setSavedThemes(listThemes());

  const handleSaveTheme = () => {
    const name = themeName.trim() || `Theme_${new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/[/\s:]/g, "-")}`;
    saveTheme(extractTheme(project, name));
    setThemeName("");
    refreshThemes();
  };

  const handleLoadTheme = (name: string) => {
    const theme = savedThemes.find((t) => t.name === name);
    if (!theme) return;
    updateProject((p) => {
      applyTheme(p, theme);
    });
  };

  const handleDeleteTheme = (name: string) => {
    deleteTheme(name);
    refreshThemes();
  };

  const handleExportTheme = () => {
    const name = themeName.trim() || "未命名主题";
    exportThemeToFile(extractTheme(project, name));
  };

  const handleImportTheme = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const theme = await importThemeFromFile(file);
      saveTheme(theme);
      updateProject((p) => {
        applyTheme(p, theme);
      });
      refreshThemes();
    } catch (err) {
      alert("导入主题失败：" + (err instanceof Error ? err.message : String(err)));
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  // 饼图有效数据点数量（决定颜色选择器数量）
  const pieDataCount = project.data.rows.filter((row) => getNumericValue(row, project.chart.valueField) !== null).length;
  const pieColorCount = Math.max(1, pieDataCount);

  return (
    <div className="inspector">
      <h2>属性</h2>

      <CollapsibleSection title="图表" open={openSections.chart} onToggle={() => toggleSection("chart")}>
        <label className="field">
          <span>图表类型</span>
          <select
            value={project.chart.type}
            onChange={(e) => updateProject((p) => { p.chart.type = e.target.value as "bar" | "line" | "pie"; })}
          >
            <option value="bar">柱状图</option>
            <option value="line">折线图</option>
            <option value="pie">饼图</option>
          </select>
        </label>
        {!isLine && !isPie && (
          <label className="field">
            <span>方向</span>
            <select
              value={project.chart.orientation}
              onChange={(e) => updateProject((p) => { p.chart.orientation = e.target.value as "vertical" | "horizontal"; })}
            >
              <option value="vertical">纵向柱状图</option>
              <option value="horizontal">横向柱状图</option>
            </select>
          </label>
        )}
        <label className="field">
          <span>画布</span>
          <select
            value={`${d.width}x${d.height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split("x").map(Number);
              updateProject((p) => { p.document.width = w; p.document.height = h; });
            }}
          >
            {CANVAS_PRESETS.map((c) => (
              <option key={c.label} value={`${c.width}x${c.height}`}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>排序</span>
          <select
            value={project.chart.sort}
            onChange={(e) => updateProject((p) => { p.chart.sort = e.target.value as "none" | "asc" | "desc"; })}
          >
            <option value="none">不排序</option>
            <option value="asc">升序</option>
            <option value="desc">降序</option>
          </select>
        </label>
        <NumberField label="FPS" value={d.fps} min={1} max={120}
          onChange={(v) => updateProject((p) => { p.document.fps = v; })} />
        <NumberField label="边距（左右）" value={d.padding.left} min={0}
          onChange={(v) => updateProject((p) => { p.document.padding.left = v; p.document.padding.right = v; })} />
        <NumberField label="边距（上）" value={d.padding.top} min={0}
          onChange={(v) => updateProject((p) => { p.document.padding.top = v; })} />
        <NumberField label="边距（下）" value={d.padding.bottom} min={0}
          onChange={(v) => updateProject((p) => { p.document.padding.bottom = v; })} />
        {!isPie && (
          <NumberField label={<>Y 轴最大值 <HelpIcon tip="0 = 自动根据数据计算最大值" /></>} value={s.maxValue} min={0}
            onChange={(v) => updateProject((p) => { p.style.maxValue = v; })} />
        )}
      </CollapsibleSection>

      <CollapsibleSection title="主题" open={openSections.theme} onToggle={() => toggleSection("theme")}>
        <label className="field">
          <span>主题名称</span>
          <input
            value={themeName}
            onChange={(e) => setThemeName(e.target.value)}
            placeholder="输入名称后保存/导出"
          />
        </label>
        <div className="field field-row" style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={handleSaveTheme}>保存到浏览器</button>
          <button className="btn" onClick={handleExportTheme}>导出 JSON</button>
        </div>
        {savedThemes.length > 0 && (
          <label className="field">
            <span>快速加载</span>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) handleLoadTheme(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">选择已保存主题</option>
              {savedThemes.map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </label>
        )}
        {savedThemes.length > 0 && (
          <div className="field">
            <span>已保存主题</span>
            <ul style={{ margin: "4px 0 0", padding: 0, listStyle: "none" }}>
              {savedThemes.map((t) => (
                <li key={t.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0" }}>
                  <span>{t.name}</span>
                  <button className="btn btn-sm" onClick={() => handleDeleteTheme(t.name)}>删除</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <label className="field">
          <span>导入主题</span>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportTheme}
          />
        </label>
      </CollapsibleSection>

      {!isLine && !isPie && (
        <CollapsibleSection title="柱状图" open={openSections.bar} onToggle={() => toggleSection("bar")}>
          <ColorField label="柱子颜色" value={s.bar.color}
            onChange={(v) => updateProject((p) => { p.style.bar.color = v; })} />
          <NumberField label="柱宽（0=自动）" value={s.bar.width} min={0}
            onChange={(v) => updateProject((p) => { p.style.bar.width = v; })} />
          <NumberField label="柱子间距" value={s.bar.gap} min={0}
            onChange={(v) => updateProject((p) => { p.style.bar.gap = v; })} />
          <NumberField label="圆角" value={s.bar.radius} min={0}
            onChange={(v) => updateProject((p) => { p.style.bar.radius = v; })} />
          <div className="field">
            <span>柱体渐变</span>
          </div>
          <GradientEditor
            config={s.bar.gradient}
            onChange={(cfg) => updateProject((p) => { p.style.bar.gradient = cfg; })}
          />
          <ColorField label="背景颜色" value={s.background.color}
            onChange={(v) => updateProject((p) => { p.style.background.color = v; })} />
        </CollapsibleSection>
      )}

      {isLine && (
        <CollapsibleSection title="折线图" open={openSections.line} onToggle={() => toggleSection("line")}>
          <ColorField label="线条颜色" value={s.line.color}
            onChange={(v) => updateProject((p) => { p.style.line.color = v; })} />
          <NumberField label="线宽" value={s.line.width} min={1}
            onChange={(v) => updateProject((p) => { p.style.line.width = v; })} />
          <ColorField label="数据点颜色" value={s.line.pointColor}
            onChange={(v) => updateProject((p) => { p.style.line.pointColor = v; })} />
          <NumberField label="数据点半径" value={s.line.pointRadius} min={0}
            onChange={(v) => updateProject((p) => { p.style.line.pointRadius = v; })} />
          <ColorField label="数据点描边" value={s.line.pointStroke}
            onChange={(v) => updateProject((p) => { p.style.line.pointStroke = v; })} />
          <NumberField label="描边宽度" value={s.line.pointStrokeWidth} min={0}
            onChange={(v) => updateProject((p) => { p.style.line.pointStrokeWidth = v; })} />
          <CheckField label="显示面积填充" value={s.line.areaVisible}
            onChange={(v) => updateProject((p) => { p.style.line.areaVisible = v; })} />
          {s.line.areaVisible && (
            <>
              <ColorField label="面积颜色" value={s.line.areaColor}
                onChange={(v) => updateProject((p) => { p.style.line.areaColor = v; })} />
              <div className="field">
                <span>面积渐变</span>
              </div>
              <GradientEditor
                config={s.line.areaGradient}
                onChange={(cfg) => updateProject((p) => { p.style.line.areaGradient = cfg; })}
              />
            </>
          )}
          <div className="field">
            <span>线条渐变</span>
          </div>
          <GradientEditor
            config={s.line.gradient}
            onChange={(cfg) => updateProject((p) => { p.style.line.gradient = cfg; })}
          />
          <ColorField label="背景颜色" value={s.background.color}
            onChange={(v) => updateProject((p) => { p.style.background.color = v; })} />
        </CollapsibleSection>
      )}

      {isPie && (
        <CollapsibleSection title="饼图" open={openSections.pie} onToggle={() => toggleSection("pie")}>
          <div className="field">
            <span>颜色序列（{pieColorCount} 项）</span>
          </div>
          {Array.from({ length: pieColorCount }).map((_, i) => (
            <ColorField
              key={i}
              label={`扇形 ${i + 1}`}
              value={s.pie.colors[i] ?? s.pie.colors[i % s.pie.colors.length] ?? "#4C8DFF"}
              onChange={(v) => updateProject((p) => {
                const colors = [...p.style.pie.colors];
                colors[i] = v;
                p.style.pie.colors = colors;
              })}
            />
          ))}
          <NumberField label="外圆半径（0=自动）" value={s.pie.radius} min={0}
            onChange={(v) => updateProject((p) => { p.style.pie.radius = v; })} />
          <NumberField label="内圆半径（0=实心）" value={s.pie.innerRadius} min={0}
            onChange={(v) => updateProject((p) => { p.style.pie.innerRadius = v; })} />
          <NumberField label="扇形间隔" value={s.pie.strokeWidth} min={0}
            onChange={(v) => updateProject((p) => { p.style.pie.strokeWidth = v; })} />
          <ColorField label="间隔颜色" value={s.pie.strokeColor}
            onChange={(v) => updateProject((p) => { p.style.pie.strokeColor = v; })} />
          <label className="field">
            <span>扇形动画</span>
            <select
              value={s.pie.animationType}
              onChange={(e) => updateProject((p) => { p.style.pie.animationType = e.target.value as "expand" | "scale"; })}
            >
              <option value="expand">扇形展开</option>
              <option value="scale">中心缩放</option>
            </select>
          </label>
          <label className="field">
            <span>标签位置</span>
            <select
              value={s.pie.labelPosition}
              onChange={(e) => updateProject((p) => { p.style.pie.labelPosition = e.target.value as "inside" | "outside" | "none"; })}
            >
              <option value="outside">外侧</option>
              <option value="inside">内部</option>
              <option value="none">不显示</option>
            </select>
          </label>
          <CheckField label="显示百分比" value={s.pie.showPercentage}
            onChange={(v) => updateProject((p) => { p.style.pie.showPercentage = v; })} />
          <CheckField label="显示数值" value={s.pie.showValue}
            onChange={(v) => updateProject((p) => { p.style.pie.showValue = v; })} />
          <ColorField label="背景颜色" value={s.background.color}
            onChange={(v) => updateProject((p) => { p.style.background.color = v; })} />
        </CollapsibleSection>
      )}

      <CollapsibleSection title="分类标签" open={openSections.label} onToggle={() => toggleSection("label")}>
        <CheckField label="显示" value={s.label.visible}
          onChange={(v) => updateProject((p) => { p.style.label.visible = v; })} />
        <NumberField label="字号" value={s.label.fontSize} min={1}
          onChange={(v) => updateProject((p) => { p.style.label.fontSize = v; })} />
        <ColorField label="颜色" value={s.label.color}
          onChange={(v) => updateProject((p) => { p.style.label.color = v; })} />
      </CollapsibleSection>

      <CollapsibleSection title="数值标签" open={openSections.value} onToggle={() => toggleSection("value")}>
        <CheckField label="显示" value={s.value.visible}
          onChange={(v) => updateProject((p) => { p.style.value.visible = v; })} />
        <NumberField label="字号" value={s.value.fontSize} min={1}
          onChange={(v) => updateProject((p) => { p.style.value.fontSize = v; })} />
        <ColorField label="颜色" value={s.value.color}
          onChange={(v) => updateProject((p) => { p.style.value.color = v; })} />
        <label className="field">
          <span>数值格式</span>
          <select
            value={s.value.format}
            onChange={(e) => updateProject((p) => { p.style.value.format = e.target.value as ValueFormat; })}
          >
            <option value="raw">原始值</option>
            <option value="integer">整数</option>
            <option value="decimal1">一位小数</option>
            <option value="decimal2">两位小数</option>
            <option value="thousands">千分位</option>
            <option value="percent">百分比</option>
            <option value="custom">自定义前后缀</option>
          </select>
        </label>
        {s.value.format === "custom" && (
          <>
            <label className="field">
              <span>前缀</span>
              <input value={s.value.prefix}
                onChange={(e) => updateProject((p) => { p.style.value.prefix = e.target.value; })} />
            </label>
            <label className="field">
              <span>后缀</span>
              <input value={s.value.suffix}
                onChange={(e) => updateProject((p) => { p.style.value.suffix = e.target.value; })} />
            </label>
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="坐标轴 / 网格" open={openSections.axis} onToggle={() => toggleSection("axis")}>
        <CheckField label="显示坐标轴" value={s.axis.visible}
          onChange={(v) => updateProject((p) => { p.style.axis.visible = v; })} />
        <CheckField label="显示网格线" value={s.grid.visible}
          onChange={(v) => updateProject((p) => { p.style.grid.visible = v; })} />
        <NumberField label="网格数量" value={s.grid.count} min={1} max={20}
          onChange={(v) => updateProject((p) => { p.style.grid.count = v; })} />
        <CheckField label="显示网格数值" value={s.gridLabel.visible}
          onChange={(v) => updateProject((p) => { p.style.gridLabel.visible = v; })} />
        <NumberField label="网格数值字号" value={s.gridLabel.fontSize} min={1}
          onChange={(v) => updateProject((p) => { p.style.gridLabel.fontSize = v; })} />
        <ColorField label="网格数值颜色" value={s.gridLabel.color}
          onChange={(v) => updateProject((p) => { p.style.gridLabel.color = v; })} />
        <NumberField label="网格数值 X 偏移" value={s.gridLabel.offsetX}
          onChange={(v) => updateProject((p) => { p.style.gridLabel.offsetX = v; })} />
        <NumberField label="网格数值 Y 偏移" value={s.gridLabel.offsetY}
          onChange={(v) => updateProject((p) => { p.style.gridLabel.offsetY = v; })} />
      </CollapsibleSection>

      <CollapsibleSection title="动画" open={openSections.animation} onToggle={() => toggleSection("animation")}>
        <SliderField label="Stagger 比例" value={a.staggerRatio} min={0} max={1} step={0.01}
          onChange={(v) => updateProject((p) => { p.animation.staggerRatio = v; })} />
        <NumberField label="Stagger（s）" value={a.stagger} min={0} step={0.05}
          onChange={(v) => updateProject((p) => { p.animation.stagger = v; })} />
        <CheckField label="生长动画" value={a.grow}
          onChange={(v) => updateProject((p) => { p.animation.grow = v; })} />
        <CheckField label="淡入动画" value={a.fade}
          onChange={(v) => updateProject((p) => { p.animation.fade = v; })} />
        <CheckField label="位移动画" value={a.move}
          onChange={(v) => updateProject((p) => { p.animation.move = v; })} />
        <CheckField label="数值变化动画" value={a.count}
          onChange={(v) => updateProject((p) => { p.animation.count = v; })} />
        <NumberField label="开始时间（s）" value={a.startTime} min={0} step={0.1}
          onChange={(v) => updateProject((p) => { p.animation.startTime = v; })} />
        <NumberField label="持续时间（s）" value={a.duration} min={0.1} step={0.1}
          onChange={(v) => updateProject((p) => { p.animation.duration = v; })} />
        <label className="field">
          <span>缓动</span>
          <select
            value={a.easing}
            onChange={(e) => updateProject((p) => { p.animation.easing = e.target.value as EasingName; })}
          >
            <option value="linear">linear</option>
            <option value="easeIn">easeIn</option>
            <option value="easeOut">easeOut</option>
            <option value="easeInOut">easeInOut</option>
          </select>
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="选中图层" open={openSections.selected} onToggle={() => toggleSection("selected")}>
        {selectedElementId ? (
          (() => {
            const groupEls = elements.filter((e) => e.groupId === selectedElementId);
            const representative = groupEls[0];
            const ov = project.elementOverrides[selectedElementId] || {};
            if (!representative) return <div className="field"><span>未找到选中图层</span></div>;
            const index = representative.dataIndex;
            const typeNames = Array.from(new Set(groupEls.map((e) =>
              e.type === "bar" ? "柱" :
              e.type === "line-point" ? "点" :
              e.type === "pie-slice" ? "扇" :
              e.type === "label" ? "标签" :
              e.type === "value" ? "数值" : e.type
            ))).join(" + ");
            const itemLabel = project.chart.type === "line" ? "数据点" : project.chart.type === "pie" ? "扇形" : "柱子";
            return (
              <>
                <div className="field">
                  <span>已选组</span>
                  <span style={{ color: "var(--text)" }}>{itemLabel} {String(index + 1).padStart(2, "0")}（{typeNames}）</span>
                </div>
                <button className="btn btn-sm" onClick={() => setSelectedElementId(null)}>取消选择</button>
                <NumberField label="开始时间（s）" value={ov.startTime ?? elementStartTime(a, index)} min={0} step={0.05}
                  onChange={(v) => updateProject((p) => { p.elementOverrides[selectedElementId] = { ...p.elementOverrides[selectedElementId], startTime: v }; })} />
                <NumberField label="持续时间（s）" value={ov.duration ?? a.duration} min={0.05} step={0.05}
                  onChange={(v) => updateProject((p) => { p.elementOverrides[selectedElementId] = { ...p.elementOverrides[selectedElementId], duration: v }; })} />
                <label className="field">
                  <span>缓动</span>
                  <select value={ov.easing ?? a.easing}
                    onChange={(e) => updateProject((p) => { p.elementOverrides[selectedElementId] = { ...p.elementOverrides[selectedElementId], easing: e.target.value as EasingName }; })}>
                    <option value="linear">linear</option>
                    <option value="easeIn">easeIn</option>
                    <option value="easeOut">easeOut</option>
                    <option value="easeInOut">easeInOut</option>
                  </select>
                </label>
                <CheckField label="生长动画" value={ov.grow ?? a.grow}
                  onChange={(v) => updateProject((p) => { p.elementOverrides[selectedElementId] = { ...p.elementOverrides[selectedElementId], grow: v }; })} />
                <>
                  <CheckField label="淡入动画" value={ov.fade ?? a.fade}
                    onChange={(v) => updateProject((p) => { p.elementOverrides[selectedElementId] = { ...p.elementOverrides[selectedElementId], fade: v }; })} />
                  <CheckField label="位移动画" value={ov.move ?? a.move}
                    onChange={(v) => updateProject((p) => { p.elementOverrides[selectedElementId] = { ...p.elementOverrides[selectedElementId], move: v }; })} />
                </>
                <CheckField label="数值变化动画" value={ov.count ?? a.count}
                  onChange={(v) => updateProject((p) => { p.elementOverrides[selectedElementId] = { ...p.elementOverrides[selectedElementId], count: v }; })} />
                <button className="btn btn-block" onClick={() => updateProject((p) => { delete p.elementOverrides[selectedElementId]; })}>重置该图层覆盖</button>
              </>
            );
          })()
        ) : (
          <div className="field"><span>在时间轴上点击图层块以编辑独立动画</span></div>
        )}
      </CollapsibleSection>
    </div>
  );
}
