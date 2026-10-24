/**
 * LineLayout — 折线图布局计算
 * 与 BarLayout 共享同一套坐标系与数值域计算，只改变元素形态
 */

import { ProjectModel } from "../../models/ProjectModel";
import { getNumericValue } from "../../models/DataModel";
import {
  ChartElement,
  LineElement,
  LinePathElement,
  LinePointElement,
  LineAreaElement,
  TextElement
} from "../../models/ChartElement";
import { formatValue } from "../../utils/format";

export interface LineDataPoint {
  index: number;
  category: string;
  value: number;
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

/** 提取数据点（折线图保持原始顺序，不依值排序，避免破坏序列含义） */
export function getLineDataPoints(project: ProjectModel): LineDataPoint[] {
  const { data, chart } = project;
  const points: LineDataPoint[] = [];
  data.rows.forEach((row, i) => {
    const v = getNumericValue(row, chart.valueField);
    if (v === null) return;
    const cat = row[chart.categoryField];
    points.push({ index: i, category: cat === null || cat === undefined ? "" : String(cat), value: v });
  });
  return points.map((p, i) => ({ ...p, index: i }));
}

/** 计算值域最大值（自动或固定） */
export function getMaxValue(project: ProjectModel, points: LineDataPoint[]): number {
  if (project.style.maxValue > 0) return project.style.maxValue;
  const max = points.reduce((m, p) => Math.max(m, p.value), 0);
  return max > 0 ? max * 1.05 : 1; // 自动最大值留 5% 头部空间
}

/**
 * 核心布局：产出统一 ChartElement 列表
 */
export function calculateLineLayout(project: ProjectModel): ChartElement[] {
  const { document: doc, style } = project;
  const elements: ChartElement[] = [];
  const points = getLineDataPoints(project);
  if (points.length === 0) return elements;

  const maxValue = getMaxValue(project, points);
  const { top, right, bottom, left } = doc.padding;
  const plotW = doc.width - left - right;
  const plotH = doc.height - top - bottom;
  const n = points.length;

  const slot = plotW / n;
  const valueFmt = (v: number) =>
    formatValue(v, style.value.format, style.value.prefix, style.value.suffix);

  // 数据点坐标
  const coords = points.map((p, i) => {
    const ratio = Math.min(1, Math.max(0, p.value / maxValue));
    return {
      x: left + (i + 0.5) * slot,
      y: top + plotH - ratio * plotH
    };
  });

  // 网格线先加入，网格数值标签在折线/数据点之后加入以确保不被遮挡
  const gridLabels: TextElement[] = [];
  if (style.grid.visible) {
    const count = Math.max(1, style.grid.count);
    for (let g = 0; g <= count; g++) {
      const ratio = g / count;
      const gridValue = maxValue * ratio;
      const line: LineElement = {
        id: `grid-${pad3(g + 1)}`,
        type: "grid",
        dataIndex: -1,
        groupId: "",
        geometry: {
          x1: left,
          y1: top + plotH - ratio * plotH,
          x2: left + plotW,
          y2: top + plotH - ratio * plotH
        },
        style: { stroke: style.grid.color, strokeWidth: 1 }
      };
      elements.push(line);

      if (style.gridLabel.visible) {
        const gridText = formatValue(gridValue, style.gridLabel.format, style.gridLabel.prefix, style.gridLabel.suffix);
        const gridLabel: TextElement = {
          id: `grid-label-${pad3(g + 1)}`,
          type: "grid-label",
          dataIndex: 0,
          groupId: "",
          barId: "",
          geometry: {
            // 标签放在 Y 轴左侧，anchor=end 向左延伸，避免被折线/数据点覆盖
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
        };
        gridLabels.push(gridLabel);
      }
    }
  }

  // 零基线 / 坐标轴
  if (style.axis.visible) {
    const axis: LineElement = {
      id: "axis-001",
      type: "axis",
      dataIndex: -1,
      groupId: "",
      geometry: { x1: left, y1: top + plotH, x2: left + plotW, y2: top + plotH },
      style: { stroke: style.axis.color, strokeWidth: 2 }
    };
    elements.push(axis);
  }

  // 面积填充（置于折线下方，避免遮挡）
  if (style.line.areaVisible && coords.length > 0) {
    const areaPoints = [
      { x: coords[0].x, y: top + plotH },
      ...coords,
      { x: coords[coords.length - 1].x, y: top + plotH }
    ];
    const area: LineAreaElement = {
      id: "line-area-001",
      type: "line-area",
      dataIndex: -1,
      groupId: "line-global",
      geometry: { points: areaPoints, closed: true },
      style: { fill: style.line.areaColor, gradient: style.line.areaGradient },
      meta: { category: "", value: 0 }
    };
    elements.push(area);
  }

  // 折线路径
  if (coords.length > 1) {
    const path: LinePathElement = {
      id: "line-path-001",
      type: "line-path",
      dataIndex: -1,
      groupId: "line-global",
      geometry: { points: coords },
      style: { stroke: style.line.color, strokeWidth: style.line.width, fill: "none", gradient: style.line.gradient },
      meta: { category: "", value: 0 }
    };
    elements.push(path);
  }

  // 数据点 + 标签 + 数值
  points.forEach((p, i) => {
    const id = pad3(i + 1);
    const groupId = `item-${id}`;
    const c = coords[i];

    // 数据点
    const point: LinePointElement = {
      id: `line-point-${id}`,
      type: "line-point",
      dataIndex: i,
      groupId,
      geometry: { x: c.x, y: c.y, radius: style.line.pointRadius },
      style: {
        fill: style.line.pointColor,
        stroke: style.line.pointStroke || undefined,
        strokeWidth: style.line.pointStrokeWidth || undefined
      },
      meta: { category: p.category, value: p.value }
    };
    elements.push(point);

    // 分类标签
    if (style.label.visible) {
      const label: TextElement = {
        id: `label-${id}`,
        type: "label",
        dataIndex: i,
        groupId,
        barId: point.id,
        geometry: {
          x: c.x,
          y: top + plotH + style.label.fontSize * 1.4,
          anchor: "middle",
          baseline: "top"
        },
        style: { fill: style.label.color, fontFamily: style.label.fontFamily, fontSize: style.label.fontSize },
        text: p.category,
        meta: point.meta
      };
      elements.push(label);
    }

    // 数值标签
    if (style.value.visible) {
      const value: TextElement = {
        id: `value-${id}`,
        type: "value",
        dataIndex: i,
        groupId,
        barId: point.id,
        geometry: {
          x: c.x,
          y: c.y - style.value.fontSize * 0.8 - style.line.pointRadius,
          anchor: "middle",
          baseline: "bottom"
        },
        style: { fill: style.value.color, fontFamily: style.value.fontFamily, fontSize: style.value.fontSize },
        text: valueFmt(p.value),
        meta: point.meta
      };
      elements.push(value);
    }
  });

  // 网格数值标签最后渲染，确保位于折线/数据点之上
  elements.push(...gridLabels);

  return elements;
}
