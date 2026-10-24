/**
 * ChartElement — 统一元素模型（§36）
 * 所有图表最终都产生 ChartElement，Preview 与 AE Renderer 直接消费
 */

import { ValueFormat } from "./StyleModel";

export type ElementType = "bar" | "label" | "value" | "grid-label" | "axis" | "grid" | "line-path" | "line-point" | "line-area" | "pie-slice";

export interface RectGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
}

export interface TextGeometry {
  x: number;
  y: number;
  /** 文本锚点 */
  anchor: "start" | "middle" | "end";
  /** 相对柱子最终位置的位移方向（供位移动画/AE 使用） */
  baseline: "top" | "middle" | "bottom";
}

export interface LineGeometry {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PathGeometry {
  /** 路径点序列（折线图用） */
  points: { x: number; y: number }[];
  /** 是否闭合（面积图用） */
  closed?: boolean;
}

export interface PieSliceGeometry {
  /** 圆心合成坐标 */
  cx: number;
  cy: number;
  /** 外圆半径 */
  radius: number;
  /** 内圆半径（0 = 实心） */
  innerRadius: number;
  /** 起始角度（度，0=3点钟方向，逆时针递增） */
  startAngle: number;
  /** 结束角度（度） */
  endAngle: number;
}

export interface ChartElementBase {
  /** 稳定 ID，如 bar-001 / label-001 / value-001 / line-path-001 */
  id: string;
  type: ElementType;
  /** 所属数据行索引，非数据元素（如全局网格/坐标轴/折线路径）为 -1 */
  dataIndex: number;
  /** 动画分组 ID，同一数据项的柱子/点/扇/文字/数值共享同一 groupId */
  groupId: string;
}

import { GradientConfig } from "./StyleModel";

export interface BarElement extends ChartElementBase {
  type: "bar";
  geometry: RectGeometry;
  style: { fill: string; gradient?: GradientConfig };
  /** 该柱子的原始数值与分类（供数值动画/导出命名） */
  meta: { category: string; value: number };
}

export interface TextElement extends ChartElementBase {
  type: "label" | "value" | "grid-label";
  geometry: TextGeometry;
  style: {
    fill: string;
    fontFamily: string;
    fontSize: number;
    /** value 元素专用：覆盖全局 value 格式 */
    format?: ValueFormat;
    prefix?: string;
    suffix?: string;
  };
  text: string;
  /** 关联的柱子/数据点 id */
  barId: string;
  meta: { category: string; value: number };
}

export interface LineElement extends ChartElementBase {
  type: "axis" | "grid";
  geometry: LineGeometry;
  style: { stroke: string; strokeWidth: number };
}

export interface LinePathElement extends ChartElementBase {
  type: "line-path";
  geometry: PathGeometry;
  style: { stroke: string; strokeWidth: number; fill?: string; gradient?: GradientConfig };
  /** 全局动画进度 0~1 时对应的路径绘制进度 */
  meta: { category: string; value: number };
}

export interface LinePointElement extends ChartElementBase {
  type: "line-point";
  geometry: { x: number; y: number; radius: number };
  style: { fill: string; stroke?: string; strokeWidth?: number };
  meta: { category: string; value: number };
}

export interface LineAreaElement extends ChartElementBase {
  type: "line-area";
  geometry: PathGeometry;
  style: { fill: string; gradient?: GradientConfig };
  meta: { category: string; value: number };
}

export interface PieSliceElement extends ChartElementBase {
  type: "pie-slice";
  geometry: PieSliceGeometry;
  style: { fill: string; stroke: string; strokeWidth: number };
  meta: { category: string; value: number; percentage: number };
}

export type ChartElement = BarElement | TextElement | LineElement | LinePathElement | LinePointElement | LineAreaElement | PieSliceElement;
