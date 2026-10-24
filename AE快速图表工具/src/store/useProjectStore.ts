/**
 * 集中式项目状态（§31/§32）
 * React UI 只负责修改 Project State；Renderer 根据 State 渲染
 */

import { create } from "zustand";
import { ProjectModel, createDefaultProject } from "../models/ProjectModel";
import { DataModel, validateData, DataValidationIssue } from "../models/DataModel";
import { computeProjectDuration } from "../animation/AnimationEngine";
import { getChartDataPointCount, getChartRenderer } from "../charts/ChartRenderer";
import { HealthReport } from "../importers/CSVHealth";

export type PlayState = "stopped" | "playing" | "paused";

interface ProjectStore {
  project: ProjectModel;
  issues: DataValidationIssue[];
  importError: string | null;
  exportError: string | null;
  /** 最近一次导入的体检报告（编码 / 分隔符 / 格式问题） */
  importReport: HealthReport | null;

  // 播放状态
  playState: PlayState;
  currentTime: number;
  /** 时间轴/Inspector 中选中的元素 id */
  selectedElementId: string | null;

  // actions
  setProject: (p: ProjectModel) => void;
  updateProject: (recipe: (p: ProjectModel) => void) => void;
  setData: (d: DataModel) => void;
  setCell: (rowIndex: number, columnId: string, raw: string) => void;
  addRow: () => void;
  removeRow: (rowIndex: number) => void;
  setImportError: (msg: string | null) => void;
  setExportError: (msg: string | null) => void;
  setImportReport: (r: HealthReport | null) => void;
  setSelectedElementId: (id: string | null) => void;

  play: () => void;
  pause: () => void;
  reset: () => void;
  seek: (t: number) => void;
  tick: (t: number) => void;
}

function syncDuration(p: ProjectModel): void {
  const count = getChartDataPointCount(p);
  const ids = getChartRenderer(p).getAnimationTargets(p);
  p.document.duration = computeProjectDuration(p.animation, count, p.elementOverrides, ids);
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: (() => {
    const p = createDefaultProject();
    syncDuration(p);
    return p;
  })(),
  issues: [],
  importError: null,
  exportError: null,
  importReport: null,
  playState: "stopped",
  currentTime: 0,
  selectedElementId: null,

  setProject: (p) => {
    syncDuration(p);
    set({ project: p, issues: validateData(p.data) });
  },

  updateProject: (recipe) => {
    const p = structuredClone(get().project);
    recipe(p);
    syncDuration(p);
    set({ project: p, issues: validateData(p.data) });
  },

  setData: (d) => {
    const p = structuredClone(get().project);
    p.data = d;
    // 字段变化后尽量保持映射
    if (!d.columns.find((c) => c.id === p.chart.categoryField)) p.chart.categoryField = d.columns[0]?.id ?? "category";
    if (!d.columns.find((c) => c.id === p.chart.valueField)) {
      const numCol = d.columns.find((c) => c.type === "number");
      p.chart.valueField = numCol?.id ?? d.columns[1]?.id ?? "value";
    }
    syncDuration(p);
    set({ project: p, issues: validateData(d) });
  },

  setCell: (rowIndex, columnId, raw) => {
    const p = structuredClone(get().project);
    const col = p.data.columns.find((c) => c.id === columnId);
    if (!col || !p.data.rows[rowIndex]) return;
    if (raw === "") p.data.rows[rowIndex][columnId] = null;
    else if (col.type === "number") {
      const n = Number(raw.replace(/,/g, ""));
      p.data.rows[rowIndex][columnId] = Number.isNaN(n) ? raw : n;
    } else p.data.rows[rowIndex][columnId] = raw;
    syncDuration(p);
    set({ project: p, issues: validateData(p.data) });
  },

  addRow: () => {
    const p = structuredClone(get().project);
    const row: Record<string, string | number | null> = {};
    p.data.columns.forEach((c) => (row[c.id] = c.type === "number" ? 0 : ""));
    p.data.rows.push(row);
    syncDuration(p);
    set({ project: p });
  },

  removeRow: (rowIndex) => {
    const p = structuredClone(get().project);
    p.data.rows.splice(rowIndex, 1);
    syncDuration(p);
    set({ project: p, issues: validateData(p.data) });
  },

  setImportError: (msg) => set({ importError: msg }),
  setExportError: (msg) => set({ exportError: msg }),
  setImportReport: (r) => set({ importReport: r }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),

  play: () => set({ playState: "playing" }),
  pause: () => set({ playState: "paused" }),
  reset: () => set({ playState: "stopped", currentTime: 0 }),
  seek: (t) => set({ currentTime: Math.max(0, Math.min(t, get().project.document.duration)) }),
  tick: (t) => {
    const dur = get().project.document.duration;
    if (t >= dur) set({ currentTime: dur, playState: "paused" });
    else set({ currentTime: t });
  }
}));
