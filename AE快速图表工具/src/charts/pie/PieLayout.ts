/**
 * PieLayout — 饼图布局计算
 * 产出 pie-slice / label / value 统一元素
 */

import { ProjectModel } from "../../models/ProjectModel";
import { getNumericValue } from "../../models/DataModel";
import { PieSliceElement, TextElement, ChartElement } from "../../models/ChartElement";
import { formatValue } from "../../utils/format";
import { ValueFormat } from "../../models/StyleModel";

export interface PieDataPoint {
  index: number;
  category: string;
  value: number;
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

/** 提取并排序数据点 */
export function getPieDataPoints(project: ProjectModel): PieDataPoint[] {
  const { data, chart } = project;
  const points: PieDataPoint[] = [];
  data.rows.forEach((row, i) => {
    const v = getNumericValue(row, chart.valueField);
    if (v === null) return;
    const cat = row[chart.categoryField];
    points.push({ index: i, category: cat === null || cat === undefined ? "" : String(cat), value: v });
  });
  if (chart.sort === "asc") points.sort((a, b) => a.value - b.value);
  else if (chart.sort === "desc") points.sort((a, b) => b.value - a.value);
  // 重新编号为显示顺序
  return points.map((p, i) => ({ ...p, index: i }));
}

/** 角度转弧度 */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 极坐标转笛卡尔坐标（0°=3点钟，逆时针） */
function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = toRad(deg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * 核心布局
 */
export function calculatePieLayout(project: ProjectModel): ChartElement[] {
  const { document: doc, style } = project;
  const elements: ChartElement[] = [];
  const points = getPieDataPoints(project);
  if (points.length === 0) return elements;

  const total = points.reduce((sum, p) => sum + p.value, 0);
  if (total <= 0) return elements;

  const { top, right, bottom, left } = doc.padding;
  const plotW = doc.width - left - right;
  const plotH = doc.height - top - bottom;
  const cx = left + plotW / 2;
  const cy = top + plotH / 2;
  const autoRadius = Math.min(plotW, plotH) / 2 * 0.85;
  const radius = style.pie.radius > 0 ? style.pie.radius : autoRadius;
  const innerRadius = Math.min(style.pie.innerRadius, radius * 0.9);

  const valueFmt = (v: number) =>
    formatValue(v, style.value.format, style.value.prefix, style.value.suffix);

  let currentAngle = -90; // 从 12 点钟方向开始

  points.forEach((p, i) => {
    const id = pad3(i + 1);
    const groupId = `item-${id}`;
    const sliceAngle = (p.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    const midAngle = startAngle + sliceAngle / 2;
    const percentage = p.value / total;

    const slice: PieSliceElement = {
      id: `pie-slice-${id}`,
      type: "pie-slice",
      dataIndex: i,
      groupId,
      geometry: { cx, cy, radius, innerRadius, startAngle, endAngle },
      style: {
        fill: style.pie.colors[i % style.pie.colors.length],
        stroke: style.pie.strokeColor,
        strokeWidth: style.pie.strokeWidth
      },
      meta: { category: p.category, value: p.value, percentage }
    };
    elements.push(slice);

    // 分类标签
    if (style.label.visible && style.pie.labelPosition !== "none") {
      const labelR = style.pie.labelPosition === "inside"
        ? (radius + innerRadius) / 2
        : radius + Math.max(24, style.label.fontSize * 0.8);
      const pos = polar(cx, cy, labelR, midAngle);
      const label: TextElement = {
        id: `label-${id}`,
        type: "label",
        dataIndex: i,
        groupId,
        barId: slice.id,
        geometry: { x: pos.x, y: pos.y, anchor: "middle", baseline: "middle" },
        style: { fill: style.label.color, fontFamily: style.label.fontFamily, fontSize: style.label.fontSize },
        text: p.category,
        meta: { category: p.category, value: p.value }
      };
      elements.push(label);
    }

    // 数值 / 百分比标签
    if (style.value.visible && (style.pie.showValue || style.pie.showPercentage)) {
      const valueR = style.pie.labelPosition === "inside"
        ? (radius + innerRadius) / 2
        : radius + Math.max(24, style.value.fontSize * 0.8);
      const pos = polar(cx, cy, valueR, midAngle);
      let text = "";
      let valueForCount = p.value;
      let valueFormat: ValueFormat | undefined = style.value.format;
      let valuePrefix = style.value.prefix;
      let valueSuffix = style.value.suffix;
      if (style.pie.showValue && style.pie.showPercentage) {
        text = `${valueFmt(p.value)} (${(percentage * 100).toFixed(1)}%)`;
        valueSuffix = valueSuffix + ` (${(percentage * 100).toFixed(1)}%)`;
      } else if (style.pie.showPercentage) {
        text = `${(percentage * 100).toFixed(1)}%`;
        valueForCount = percentage * 100;
        valueFormat = "percent";
        valuePrefix = "";
        valueSuffix = "";
      } else {
        text = valueFmt(p.value);
      }
      const value: TextElement = {
        id: `value-${id}`,
        type: "value",
        dataIndex: i,
        groupId,
        barId: slice.id,
        geometry: { x: pos.x, y: pos.y + style.value.fontSize * 1.1, anchor: "middle", baseline: "middle" },
        style: {
          fill: style.value.color,
          fontFamily: style.value.fontFamily,
          fontSize: style.value.fontSize,
          format: valueFormat,
          prefix: valuePrefix,
          suffix: valueSuffix
        },
        text,
        meta: { category: p.category, value: valueForCount }
      };
      elements.push(value);
    }

    currentAngle = endAngle;
  });

  return elements;
}

/** 生成 SVG 扇形 path d 字符串 */
export function pieSlicePath(
  cx: number,
  cy: number,
  radius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  if (Math.abs(endAngle - startAngle) >= 360) {
    // 整圆
    if (innerRadius > 0) {
      // 圆环
      const outer = polar(cx, cy, radius, startAngle);
      const inner = polar(cx, cy, innerRadius, startAngle);
      return [
        `M ${outer.x} ${outer.y}`,
        `A ${radius} ${radius} 0 1 1 ${outer.x} ${outer.y + 0.001}`,
        `L ${inner.x} ${inner.y}`,
        `A ${innerRadius} ${innerRadius} 0 1 0 ${inner.x} ${inner.y + 0.001}`,
        "Z"
      ].join(" ");
    }
    return `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius} Z`;
  }

  const startOuter = polar(cx, cy, radius, startAngle);
  const endOuter = polar(cx, cy, radius, endAngle);
  const startInner = polar(cx, cy, innerRadius, startAngle);
  const endInner = polar(cx, cy, innerRadius, endAngle);

  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const sweep = endAngle > startAngle ? 1 : 0;

  if (innerRadius <= 0) {
    // 实心扇形
    return [
      `M ${cx} ${cy}`,
      `L ${startOuter.x} ${startOuter.y}`,
      `A ${radius} ${radius} 0 ${largeArc} ${sweep} ${endOuter.x} ${endOuter.y}`,
      "Z"
    ].join(" ");
  }

  // 环形扇形
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${radius} ${radius} 0 ${largeArc} ${sweep} ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} ${1 - sweep} ${startInner.x} ${startInner.y}`,
    "Z"
  ].join(" ");
}
