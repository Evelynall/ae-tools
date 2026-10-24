import { useEffect, useMemo, useRef } from "react";
import { useProjectStore } from "../../store/useProjectStore";
import { getChartRenderer, getChartDataPointCount } from "../../charts/ChartRenderer";
import {
  BarElement,
  TextElement,
  LineElement,
  LinePathElement,
  LinePointElement,
  LineAreaElement,
  PieSliceElement
} from "../../models/ChartElement";
import { pieSlicePath } from "../../charts/pie/PieLayout";
import { getElementAnimState, getGlobalAnimProgress } from "../../animation/AnimationEngine";
import { formatValue } from "../../utils/format";
import { GradientConfig } from "../../models/StyleModel";

/** SVG Preview Renderer — 与 AE Renderer 消费同一份 Model（§20） */
export default function Preview() {
  const {
    project, playState, currentTime,
    play, pause, reset, tick,
    setSelectedElementId
  } = useProjectStore();

  const renderer = useMemo(() => getChartRenderer(project), [project]);
  const elements = useMemo(() => renderer.getElements(project), [renderer, project]);
  const dataPointCount = useMemo(() => getChartDataPointCount(project), [project]);
  const anim = project.animation;
  const overrides = project.elementOverrides;
  const doc = project.document;
  const isVertical = project.chart.orientation === "vertical";
  const isLine = project.chart.type === "line";
  const isPie = project.chart.type === "pie";
  const animTargetIds = useMemo(() => renderer.getAnimationTargets(project), [renderer, project]);

  // 播放循环
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  useEffect(() => {
    if (playState !== "playing") return;
    lastRef.current = performance.now();
    const loop = (now: number) => {
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      tick(useProjectStore.getState().currentTime + dt);
      if (useProjectStore.getState().playState === "playing") {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playState, tick]);

  /** 计算 polyline 总长度（直线段求和，足够精确） */
  const pathLength = (points: { x: number; y: number }[]): number => {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  };

  /** 将点序列转换为 SVG path d 字符串 */
  const pointsToPath = (points: { x: number; y: number }[]): string => {
    if (points.length === 0) return "";
    return `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
  };

  /** 根据渐变配置生成 SVG 渐变（支持线性/径向 Gradient Ramp 与 4-Color Gradient） */
  const renderGradient = (id: string, cfg: GradientConfig | undefined) => {
    if (!cfg || cfg.mode === "none") return null;

    if (cfg.mode === "ramp" && cfg.ramp) {
      const { startColor, endColor, startPoint, endPoint, shape } = cfg.ramp;
      if (shape === "radial") {
        const [cx, cy] = startPoint;
        const [ex, ey] = endPoint;
        const r = Math.sqrt((ex - cx) * (ex - cx) + (ey - cy) * (ey - cy));
        return (
          <radialGradient id={id} cx={cx} cy={cy} r={r} fx={cx} fy={cy} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={startColor} />
            <stop offset="100%" stopColor={endColor} />
          </radialGradient>
        );
      }
      return (
        <linearGradient id={id} x1={startPoint[0]} y1={startPoint[1]} x2={endPoint[0]} y2={endPoint[1]} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={startColor} />
          <stop offset="100%" stopColor={endColor} />
        </linearGradient>
      );
    }

    if (cfg.mode === "4color" && cfg.fourColor) {
      const { colors, points } = cfg.fourColor;
      const [x1, y1] = points[0];
      const [x2, y2] = points[3] ?? points[1] ?? points[0];
      return (
        <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="33%" stopColor={colors[1] ?? colors[0]} />
          <stop offset="66%" stopColor={colors[2] ?? colors[1] ?? colors[0]} />
          <stop offset="100%" stopColor={colors[3] ?? colors[0]} />
        </linearGradient>
      );
    }

    return null;
  };

  const renderElement = (id: string) => {
    const el = elements.find((e) => e.id === id);
    if (!el) return null;

    // 非数据项元素（网格/坐标轴/无 groupId）不可选中
    const selectable =
      el.groupId &&
      el.groupId !== "" &&
      el.type !== "grid" &&
      el.type !== "axis" &&
      el.type !== "grid-label" &&
      el.type !== "line-area" &&
      el.type !== "line-path";
    const selectProps = selectable
      ? {
          style: { cursor: "pointer" as const },
          onMouseDown: (e: React.MouseEvent) => { e.stopPropagation(); setSelectedElementId(el.groupId); }
        }
      : {};

    if (el.type === "grid" || el.type === "axis") {
      const l = el as LineElement;
      return (
        <line
          key={l.id} id={l.id}
          x1={l.geometry.x1} y1={l.geometry.y1} x2={l.geometry.x2} y2={l.geometry.y2}
          stroke={l.style.stroke} strokeWidth={l.style.strokeWidth}
        />
      );
    }

    if (el.type === "line-area") {
      const a = el as LineAreaElement;
      const areaUseGradient = a.style.gradient && a.style.gradient.mode !== "none";
      return (
        <path
          key={a.id} id={a.id}
          d={pointsToPath(a.geometry.points) + (a.geometry.closed ? " Z" : "")}
          fill={areaUseGradient ? "url(#areaGradient)" : a.style.fill}
          opacity={1}
        />
      );
    }

    if (el.type === "line-path") {
      const lp = el as LinePathElement;
      const globalProgress = anim.grow ? getGlobalAnimProgress(anim, dataPointCount, currentTime, overrides, animTargetIds) : 1;
      const len = pathLength(lp.geometry.points);
      const d = pointsToPath(lp.geometry.points);
      const lineUseGradient = lp.style.gradient && lp.style.gradient.mode !== "none";
      return (
        <path
          key={lp.id} id={lp.id}
          d={d}
          fill="none"
          stroke={lineUseGradient ? "url(#lineGradient)" : lp.style.stroke}
          strokeWidth={lp.style.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={len > 0 ? len : undefined}
          strokeDashoffset={len > 0 ? len * (1 - globalProgress) : undefined}
        />
      );
    }

    if (el.type === "line-point") {
      const pt = el as LinePointElement;
      const s = getElementAnimState(anim, pt.dataIndex, currentTime, overrides, pt.groupId, pt.id);
      const r = Math.max(0, pt.geometry.radius * s.growProgress);
      if (r <= 0) return null;
      return (
        <circle
          key={pt.id} id={pt.id}
          cx={pt.geometry.x} cy={pt.geometry.y} r={r}
          fill={pt.style.fill}
          stroke={pt.style.stroke}
          strokeWidth={pt.style.strokeWidth ?? 0}
          opacity={s.opacity}
          {...selectProps}
        />
      );
    }

    if (el.type === "pie-slice") {
      const slice = el as PieSliceElement;
      const s = getElementAnimState(anim, slice.dataIndex, currentTime, overrides, slice.groupId, slice.id);
      const g = slice.geometry;
      const pieAnimType = project.style.pie.animationType ?? "expand";
      const d = pieSlicePath(g.cx, g.cy, g.radius, g.innerRadius, g.startAngle, g.endAngle);
      if (pieAnimType === "expand") {
        const span = g.endAngle - g.startAngle;
        const currentEnd = g.startAngle + span * s.growProgress;
        const expandD = pieSlicePath(g.cx, g.cy, g.radius, g.innerRadius, g.startAngle, currentEnd);
        return (
          <path
            key={slice.id} id={slice.id}
            d={expandD}
            fill={slice.style.fill}
            stroke={slice.style.stroke}
            strokeWidth={slice.style.strokeWidth}
            opacity={s.opacity}
            {...selectProps}
          />
        );
      }
      // scale：整体从中心缩放
      return (
        <path
          key={slice.id} id={slice.id}
          d={d}
          fill={slice.style.fill}
          stroke={slice.style.stroke}
          strokeWidth={slice.style.strokeWidth}
          opacity={s.opacity}
          style={{
            ...((selectProps.style || {}) as React.CSSProperties),
            transformOrigin: `${g.cx}px ${g.cy}px`,
            transform: `scale(${Math.max(0, s.growProgress)})`
          }}
          onMouseDown={selectProps.onMouseDown}
        />
      );
    }

    if (el.type === "bar") {
      const b = el as BarElement;
      const s = getElementAnimState(anim, b.dataIndex, currentTime, overrides, b.groupId, b.id);
      const g = b.geometry;
      // 生长：底部（或左侧）固定，按进度收缩
      let x = g.x, y = g.y, w = g.width, h = g.height;
      if (isVertical) {
        h = g.height * s.growProgress;
        y = g.y + g.height - h;
      } else {
        w = g.width * s.growProgress;
      }
      const r = Math.min(g.radius ?? 0, w / 2, h / 2);
      if (w <= 0 || h <= 0) return null;
      const useGradient = b.style.gradient && b.style.gradient.mode !== "none";
      const fill = useGradient ? "url(#barGradient)" : b.style.fill;
      return (
        <rect
          key={b.id} id={b.id}
          x={x} y={y} width={w} height={h} rx={r}
          fill={fill}
          {...selectProps}
        />
      );
    }

    // label / value
    const t = el as TextElement;
    const s = getElementAnimState(anim, t.dataIndex, currentTime, overrides, t.groupId, t.id);
    let text = t.text;
    if (t.type === "value" && anim.count) {
      const valueFormat = t.style.format ?? project.style.value.format;
      const valuePrefix = t.style.prefix ?? project.style.value.prefix;
      const valueSuffix = t.style.suffix ?? project.style.value.suffix;
      text = formatValue(
        t.meta.value * s.countProgress,
        valueFormat,
        valuePrefix,
        valueSuffix
      );
    }
    const baselineMap = { top: "hanging", middle: "central", bottom: "auto" } as const;
    return (
      <text
        key={t.id} id={t.id}
        x={t.geometry.x} y={t.geometry.y + s.offsetY}
        textAnchor={t.geometry.anchor}
        dominantBaseline={baselineMap[t.geometry.baseline]}
        fill={t.style.fill}
        fontFamily={t.style.fontFamily}
        fontSize={t.style.fontSize}
        opacity={s.opacity}
        {...selectProps}
      >
        {text}
      </text>
    );
  };

  return (
    <div className="preview">
      <div className="preview-stage">
        <svg
          viewBox={`0 0 ${doc.width} ${doc.height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ background: project.style.background.color }}
        >
          <defs>
            {renderGradient("barGradient", project.style.bar.gradient)}
            {renderGradient("lineGradient", project.style.line.gradient)}
            {renderGradient("areaGradient", project.style.line.areaGradient)}
          </defs>
          {elements.map((e) => renderElement(e.id))}
        </svg>
      </div>
      <div className="preview-controls">
        <button className="btn" onClick={playState === "playing" ? pause : play}>
          {playState === "playing" ? "⏸ Pause" : "▶ Play"}
        </button>
        <button className="btn" onClick={reset}>⏮ Reset</button>
        <input
          className="scrubber"
          type="range"
          min={0}
          max={doc.duration}
          step={0.01}
          value={currentTime}
          onChange={(e) => useProjectStore.getState().seek(Number(e.target.value))}
        />
        <span className="time-display">
          {currentTime.toFixed(2)}s / {doc.duration.toFixed(2)}s
        </span>
        <span className="canvas-info">{doc.width}×{doc.height} · {doc.fps}fps</span>
      </div>
    </div>
  );
}
