/**
 * BarLayout — 柱状图布局计算（纵/横共享引擎，§8/§9）
 * 只改变坐标计算和布局方向，不复制两套逻辑
 */

import { ProjectModel } from "../../models/ProjectModel";
import { getNumericValue } from "../../models/DataModel";
import { BarElement, TextElement, LineElement, ChartElement } from "../../models/ChartElement";
import { formatValue } from "../../utils/format";

export interface BarDataPoint {
  index: number;
  category: string;
  value: number;
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

/** 提取并排序数据点 */
export function getDataPoints(project: ProjectModel): BarDataPoint[] {
  const { data, chart } = project;
  const points: BarDataPoint[] = [];
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

/** 计算值域最大值（自动或固定） */
export function getMaxValue(project: ProjectModel, points: BarDataPoint[]): number {
  if (project.style.maxValue > 0) return project.style.maxValue;
  const max = points.reduce((m, p) => Math.max(m, p.value), 0);
  return max > 0 ? max * 1.05 : 1; // 自动最大值留 5% 头部空间
}

/**
 * 核心布局：产出统一 ChartElement 列表
 * 坐标系与画布一致（像素），供 SVG 预览与 AE 导出共用
 */
export function calculateBarLayout(project: ProjectModel): ChartElement[] {
  const { document: doc, chart, style } = project;
  const elements: ChartElement[] = [];
  const points = getDataPoints(project);
  if (points.length === 0) return elements;

  const maxValue = getMaxValue(project, points);
  const { top, right, bottom, left } = doc.padding;
  const plotW = doc.width - left - right;
  const plotH = doc.height - top - bottom;
  const n = points.length;
  const isVertical = chart.orientation === "vertical";

  // 沿主轴的可用长度 / 每柱槽位
  const axisLen = isVertical ? plotW : plotH;
  const slot = axisLen / n;
  const autoBarWidth = Math.max(1, slot - style.bar.gap);
  const barThickness = style.bar.width > 0 ? Math.min(style.bar.width, slot) : autoBarWidth;

  const valueFmt = (v: number) =>
    formatValue(v, style.value.format, style.value.prefix, style.value.suffix);

  // 网格线（沿数值轴）先加入，网格数值标签在柱子之后加入以确保不被遮挡
  const gridLabels: TextElement[] = [];
  if (style.grid.visible) {
    const count = Math.max(1, style.grid.count);
    for (let g = 0; g <= count; g++) {
      const ratio = g / count;
      const gridValue = maxValue * ratio;
      const line: LineElement =
        isVertical
          ? {
              id: `grid-${pad3(g + 1)}`, type: "grid", dataIndex: -1, groupId: "",
              geometry: { x1: left, y1: top + plotH - ratio * plotH, x2: left + plotW, y2: top + plotH - ratio * plotH },
              style: { stroke: style.grid.color, strokeWidth: 1 }
            }
          : {
              id: `grid-${pad3(g + 1)}`, type: "grid", dataIndex: -1, groupId: "",
              geometry: { x1: left + ratio * plotW, y1: top, x2: left + ratio * plotW, y2: top + plotH },
              style: { stroke: style.grid.color, strokeWidth: 1 }
            };
      elements.push(line);

      if (style.gridLabel.visible) {
        const gridText = formatValue(gridValue, style.gridLabel.format, style.gridLabel.prefix, style.gridLabel.suffix);
        const gridLabel: TextElement = isVertical
          ? {
              id: `grid-label-${pad3(g + 1)}`,
              type: "grid-label",
              dataIndex: 0,
              groupId: "",
              barId: "",
              geometry: {
                // 纵向：标签放在 Y 轴左侧，anchor=end 向左延伸，避免被柱子覆盖
                x: left + style.gridLabel.offsetX,
                y: top + plotH - ratio * plotH + style.gridLabel.offsetY,
                anchor: "end",
                baseline: "middle"
              },
              style: {
                fill: style.gridLabel.color,
                fontFamily: style.gridLabel.fontFamily,
                fontSize: style.gridLabel.fontSize
              },
              text: gridText,
              meta: { category: "", value: gridValue }
            }
          : {
              id: `grid-label-${pad3(g + 1)}`,
              type: "grid-label",
              dataIndex: 0,
              groupId: "",
              barId: "",
              geometry: {
                x: left + ratio * plotW + style.gridLabel.offsetX,
                y: top + plotH + style.gridLabel.fontSize + style.gridLabel.offsetY,
                anchor: "middle",
                baseline: "top"
              },
              style: {
                fill: style.gridLabel.color,
                fontFamily: style.gridLabel.fontFamily,
                fontSize: style.gridLabel.fontSize
              },
              text: gridText,
              meta: { category: "", value: gridValue }
            };
        gridLabels.push(gridLabel);
      }
    }
  }

  // 零基线 / 坐标轴
  if (style.axis.visible) {
    const axis: LineElement =
      isVertical
        ? {
            id: "axis-001", type: "axis", dataIndex: -1, groupId: "",
            geometry: { x1: left, y1: top + plotH, x2: left + plotW, y2: top + plotH },
            style: { stroke: style.axis.color, strokeWidth: 2 }
          }
        : {
            id: "axis-001", type: "axis", dataIndex: -1, groupId: "",
            geometry: { x1: left, y1: top, x2: left, y2: top + plotH },
            style: { stroke: style.axis.color, strokeWidth: 2 }
          };
    elements.push(axis);
  }

  // 柱子 + 标签 + 数值
  points.forEach((p, i) => {
    const id = pad3(i + 1);
    const groupId = `item-${id}`;
    const ratio = Math.min(1, Math.max(0, p.value / maxValue));

    let bar: BarElement;
    if (isVertical) {
      const h = ratio * plotH;
      const x = left + i * slot + (slot - barThickness) / 2;
      bar = {
        id: `bar-${id}`, type: "bar", dataIndex: i, groupId,
        geometry: { x, y: top + plotH - h, width: barThickness, height: h, radius: style.bar.radius },
        style: { fill: style.bar.color, gradient: style.bar.gradient },
        meta: { category: p.category, value: p.value }
      };
    } else {
      const w = ratio * plotW;
      const y = top + i * slot + (slot - barThickness) / 2;
      bar = {
        id: `bar-${id}`, type: "bar", dataIndex: i, groupId,
        geometry: { x: left, y, width: w, height: barThickness, radius: style.bar.radius },
        style: { fill: style.bar.color, gradient: style.bar.gradient },
        meta: { category: p.category, value: p.value }
      };
    }
    elements.push(bar);

    // 分类标签
    if (style.label.visible) {
      const g = bar.geometry;
      const label: TextElement =
        isVertical
          ? {
              id: `label-${id}`, type: "label", dataIndex: i, groupId, barId: bar.id,
              geometry: { x: g.x + g.width / 2, y: top + plotH + style.label.fontSize * 1.4, anchor: "middle", baseline: "top" },
              style: { fill: style.label.color, fontFamily: style.label.fontFamily, fontSize: style.label.fontSize },
              text: p.category, meta: bar.meta
            }
          : {
              id: `label-${id}`, type: "label", dataIndex: i, groupId, barId: bar.id,
              geometry: { x: left - 16, y: g.y + g.height / 2, anchor: "end", baseline: "middle" },
              style: { fill: style.label.color, fontFamily: style.label.fontFamily, fontSize: style.label.fontSize },
              text: p.category, meta: bar.meta
            };
      elements.push(label);
    }

    // 数值标签
    if (style.value.visible) {
      const g = bar.geometry;
      const value: TextElement =
        isVertical
          ? {
              id: `value-${id}`, type: "value", dataIndex: i, groupId, barId: bar.id,
              geometry: { x: g.x + g.width / 2, y: g.y - style.value.fontSize * 0.5, anchor: "middle", baseline: "bottom" },
              style: { fill: style.value.color, fontFamily: style.value.fontFamily, fontSize: style.value.fontSize },
              text: valueFmt(p.value), meta: bar.meta
            }
          : {
              id: `value-${id}`, type: "value", dataIndex: i, groupId, barId: bar.id,
              geometry: { x: g.x + g.width + 16, y: g.y + g.height / 2, anchor: "start", baseline: "middle" },
              style: { fill: style.value.color, fontFamily: style.value.fontFamily, fontSize: style.value.fontSize },
              text: valueFmt(p.value), meta: bar.meta
            };
      elements.push(value);
    }
  });

  // 网格数值标签最后渲染，确保位于柱子之上
  elements.push(...gridLabels);

  return elements;
}
