/**
 * ChartRenderer — 统一图表渲染接口（§35）
 * 第一阶段实现 BarChartRenderer，第二阶段接入 LineChartRenderer
 */

import { ProjectModel } from "../models/ProjectModel";
import { ChartElement } from "../models/ChartElement";
import { calculateBarLayout, getDataPoints } from "./bar/BarLayout";
import { calculateLineLayout, getLineDataPoints } from "./line/LineLayout";
import { calculatePieLayout, getPieDataPoints } from "./pie/PieLayout";

export interface ChartRenderer {
  /** 计算布局并产出统一元素列表 */
  calculateLayout(project: ProjectModel): ChartElement[];
  /** 元素列表（当前实现等同 calculateLayout 结果） */
  getElements(project: ProjectModel): ChartElement[];
  /** 动画目标分组 id（每个数据项一个 groupId，包含其视觉元素） */
  getAnimationTargets(project: ProjectModel): string[];
  /** 用于时间轴与合成时长的数据点数量 */
  getDataPointCount(project: ProjectModel): number;
}

export const BarChartRenderer: ChartRenderer = {
  calculateLayout: (p) => calculateBarLayout(p),
  getElements: (p) => calculateBarLayout(p),
  getAnimationTargets: (p) => {
    const groups = new Set<string>();
    calculateBarLayout(p)
      .filter((e) => e.type === "bar" || e.type === "label" || e.type === "value")
      .forEach((e) => { if (e.groupId) groups.add(e.groupId); });
    return Array.from(groups);
  },
  getDataPointCount: (p) => getDataPoints(p).length
};

export const LineChartRenderer: ChartRenderer = {
  calculateLayout: (p) => calculateLineLayout(p),
  getElements: (p) => calculateLineLayout(p),
  getAnimationTargets: (p) => {
    const groups = new Set<string>();
    calculateLineLayout(p)
      .filter((e) => e.type === "line-point" || e.type === "label" || e.type === "value")
      .forEach((e) => { if (e.groupId) groups.add(e.groupId); });
    return Array.from(groups);
  },
  getDataPointCount: (p) => getLineDataPoints(p).length
};

export const PieChartRenderer: ChartRenderer = {
  calculateLayout: (p) => calculatePieLayout(p),
  getElements: (p) => calculatePieLayout(p),
  getAnimationTargets: (p) => {
    const groups = new Set<string>();
    calculatePieLayout(p)
      .filter((e) => e.type === "pie-slice" || e.type === "label" || e.type === "value")
      .forEach((e) => { if (e.groupId) groups.add(e.groupId); });
    return Array.from(groups);
  },
  getDataPointCount: (p) => getPieDataPoints(p).length
};

// TODO: ScatterChartRenderer / AreaChartRenderer / StackedBarRenderer

export function getChartRenderer(project: ProjectModel): ChartRenderer {
  switch (project.chart.type) {
    case "bar":
      return BarChartRenderer;
    case "line":
      return LineChartRenderer;
    case "pie":
      return PieChartRenderer;
    default:
      // 其他类型回退到 bar（架构预留）
      return BarChartRenderer;
  }
}

/** 通用数据点数量（供 Timeline 与合成时长计算使用） */
export function getChartDataPointCount(project: ProjectModel): number {
  return getChartRenderer(project).getDataPointCount(project);
}
