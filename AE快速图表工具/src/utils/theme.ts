/**
 * Theme — 项目样式主题导出/导入与本地缓存
 * 主题包含：style / animation / document / chart（不含数据）
 */

import { ProjectModel } from "../models/ProjectModel";
import { StyleModel, migrateGradientConfig } from "../models/StyleModel";
import { AnimationModel } from "../models/AnimationModel";

export interface ThemeConfig {
  name: string;
  version: string;
  style: StyleModel;
  animation: AnimationModel;
  document: Pick<ProjectModel["document"], "width" | "height" | "fps" | "padding">;
  chart: Pick<ProjectModel["chart"], "type" | "orientation" | "sort">;
}

const STORAGE_KEY = "datamotion_themes";

export function extractTheme(project: ProjectModel, name: string): ThemeConfig {
  return {
    name,
    version: project.version,
    style: JSON.parse(JSON.stringify(project.style)),
    animation: JSON.parse(JSON.stringify(project.animation)),
    document: {
      width: project.document.width,
      height: project.document.height,
      fps: project.document.fps,
      padding: JSON.parse(JSON.stringify(project.document.padding))
    },
    chart: {
      type: project.chart.type,
      orientation: project.chart.orientation,
      sort: project.chart.sort
    }
  };
}

function migrateStyle(style: StyleModel): StyleModel {
  style.bar.gradient = migrateGradientConfig(style.bar.gradient);
  style.line.gradient = migrateGradientConfig(style.line.gradient);
  style.line.areaGradient = migrateGradientConfig(style.line.areaGradient);
  return style;
}

export function applyTheme(project: ProjectModel, theme: ThemeConfig): void {
  project.version = theme.version ?? project.version;
  project.style = migrateStyle(JSON.parse(JSON.stringify(theme.style)));
  project.animation = JSON.parse(JSON.stringify(theme.animation));
  if (project.animation.staggerRatio === undefined) project.animation.staggerRatio = 1;
  project.document.width = theme.document.width ?? project.document.width;
  project.document.height = theme.document.height ?? project.document.height;
  project.document.fps = theme.document.fps ?? project.document.fps;
  project.document.padding = theme.document.padding
    ? JSON.parse(JSON.stringify(theme.document.padding))
    : project.document.padding;
  project.chart.type = theme.chart.type ?? project.chart.type;
  project.chart.orientation = theme.chart.orientation ?? project.chart.orientation;
  project.chart.sort = theme.chart.sort ?? project.chart.sort;
}

export function listThemes(): ThemeConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ThemeConfig[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTheme(theme: ThemeConfig): void {
  const themes = listThemes().filter((t) => t.name !== theme.name);
  themes.unshift(theme);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
}

export function deleteTheme(name: string): void {
  const themes = listThemes().filter((t) => t.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
}

export function exportThemeToFile(theme: ThemeConfig): void {
  const blob = new Blob([JSON.stringify(theme, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `DataMotion_Theme_${theme.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, "_")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importThemeFromFile(file: File): Promise<ThemeConfig> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const theme = JSON.parse(reader.result as string) as ThemeConfig;
        if (!theme.style || !theme.animation) throw new Error("无效的主题文件");
        resolve(theme);
      } catch (e) {
        reject(e instanceof Error ? e : new Error("解析失败"));
      }
    };
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsText(file);
  });
}
