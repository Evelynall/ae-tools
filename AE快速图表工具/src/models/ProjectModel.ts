/**
 * ProjectModel — 集中管理的项目状态（§32、§38）
 * UI 只负责修改 Project State，Renderer 根据 Project State 渲染
 */

import { DataModel, createSampleData } from "./DataModel";
import { ChartModel, createDefaultChart } from "./ChartModel";
import { StyleModel, createDefaultStyle } from "./StyleModel";
import { AnimationModel, ElementAnimOverride, createDefaultAnimation } from "./AnimationModel";

export const PROJECT_VERSION = "0.1";

export interface DocumentModel {
  width: number;
  height: number;
  fps: number;
  /** 合成总时长（秒） */
  duration: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

export interface ProjectModel {
  version: string;
  name: string;
  document: DocumentModel;
  data: DataModel;
  chart: ChartModel;
  style: StyleModel;
  animation: AnimationModel;
  /** 元素级动画覆盖，不保存到主题（图层数量不固定） */
  elementOverrides: Record<string, ElementAnimOverride>;
}

export function createDefaultProject(): ProjectModel {
  return {
    version: PROJECT_VERSION,
    name: "DataMotion_Project",
    document: {
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 5,
      padding: { top: 120, right: 120, bottom: 140, left: 120 }
    },
    data: createSampleData(),
    chart: createDefaultChart(),
    style: createDefaultStyle(),
    animation: createDefaultAnimation(),
    elementOverrides: {}
  };
}

export const CANVAS_PRESETS = [
  { label: "1920 × 1080（横屏）", width: 1920, height: 1080 },
  { label: "1080 × 1920（竖屏）", width: 1080, height: 1920 },
  { label: "1080 × 1080（方形）", width: 1080, height: 1080 }
];
