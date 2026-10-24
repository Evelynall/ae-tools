/**
 * ChartModel — 图表独立数据结构（§7）
 * 第一阶段只实现 bar，但类型上预留扩展
 */

export type ChartType = "bar" | "line" | "pie" | "scatter" | "area" | "stackedBar";
export type Orientation = "vertical" | "horizontal";
export type SortMode = "none" | "asc" | "desc";

export interface ChartModel {
  type: ChartType;
  orientation: Orientation;
  categoryField: string;
  valueField: string;
  sort: SortMode;
}

export function createDefaultChart(): ChartModel {
  return {
    type: "bar",
    orientation: "vertical",
    categoryField: "category",
    valueField: "value",
    sort: "none"
  };
}
