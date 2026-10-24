/**
 * AnimationEngine — 按时间 t 计算元素动画状态
 * 同一份 AnimationModel 同时供 Preview 与 AE Exporter 使用（§20）
 * 动画覆盖以 groupId 为键，同一数据项的柱子/点/扇/文字/数值同步动画
 */

import { AnimationModel, ElementAnimOverride } from "../models/AnimationModel";
import { applyEasing } from "./Easing";
import { staggerStart } from "./Stagger";

export interface ElementAnimState {
  /** 生长进度 0~1（柱子高度/宽度比例） */
  growProgress: number;
  /** 不透明度 0~1 */
  opacity: number;
  /** 位移偏移（像素，最终为 0） */
  offsetY: number;
  /** 数值动画进度 0~1 */
  countProgress: number;
  /** 该元素动画是否已开始 */
  started: boolean;
}

function effectiveStagger(anim: AnimationModel): number {
  return anim.stagger * (anim.staggerRatio ?? 1);
}

/**
 * 获取覆盖配置。
 * 优先按 groupId 查找；找不到时回退到 elementId（兼容旧项目数据）。
 */
function getOverride(
  overrides: Record<string, ElementAnimOverride> | undefined,
  groupId: string,
  elementId?: string
): ElementAnimOverride | undefined {
  if (!overrides) return undefined;
  if (groupId && overrides[groupId]) return overrides[groupId];
  if (elementId && overrides[elementId]) return overrides[elementId];
  return undefined;
}

/** 计算元素动画开始时间（支持全局 staggerRatio 与组级覆盖） */
export function elementStartTime(
  anim: AnimationModel,
  index: number,
  overrides?: Record<string, ElementAnimOverride>,
  groupId?: string,
  elementId?: string
): number {
  const ov = getOverride(overrides, groupId || "", elementId);
  if (ov?.startTime !== undefined) {
    return ov.startTime!;
  }
  return staggerStart(anim.startTime, index, effectiveStagger(anim));
}

/** 计算元素动画时长（支持组级覆盖） */
export function elementDuration(
  anim: AnimationModel,
  overrides?: Record<string, ElementAnimOverride>,
  groupId?: string,
  elementId?: string
): number {
  const ov = getOverride(overrides, groupId || "", elementId);
  if (ov?.duration !== undefined) {
    return ov.duration!;
  }
  return anim.duration;
}

/** 计算元素缓动（支持组级覆盖） */
export function elementEasing(
  anim: AnimationModel,
  overrides?: Record<string, ElementAnimOverride>,
  groupId?: string,
  elementId?: string
): AnimationModel["easing"] {
  const ov = getOverride(overrides, groupId || "", elementId);
  if (ov?.easing !== undefined) {
    return ov.easing!;
  }
  return anim.easing;
}

/** 计算某个元素在时间 t 的动画状态 */
export function getElementAnimState(
  anim: AnimationModel,
  index: number,
  t: number,
  overrides?: Record<string, ElementAnimOverride>,
  groupId?: string,
  elementId?: string
): ElementAnimState {
  const start = elementStartTime(anim, index, overrides, groupId, elementId);
  const duration = elementDuration(anim, overrides, groupId, elementId);
  const raw = duration > 0 ? (t - start) / duration : 1;
  const clamped = Math.min(1, Math.max(0, raw));
  const eased = applyEasing(elementEasing(anim, overrides, groupId, elementId), clamped);

  const ov = getOverride(overrides, groupId || "", elementId);
  const useGrow = ov?.grow !== undefined ? ov.grow : anim.grow;
  const useFade = ov?.fade !== undefined ? ov.fade : anim.fade;
  const useMove = ov?.move !== undefined ? ov.move : anim.move;
  const useCount = ov?.count !== undefined ? ov.count : anim.count;

  return {
    growProgress: useGrow ? eased : 1,
    opacity: useFade ? eased : 1,
    offsetY: useMove ? 30 * (1 - eased) : 0,
    countProgress: useCount ? eased : 1,
    started: t >= start
  };
}

/** 项目实际需要的合成时长：最后一个元素动画结束时间 + 余量 */
export function computeProjectDuration(
  anim: AnimationModel,
  elementCount: number,
  overrides?: Record<string, ElementAnimOverride>,
  ids?: string[]
): number {
  if (elementCount === 0) return anim.startTime + anim.duration;
  let maxEnd = 0;
  for (let i = 0; i < elementCount; i++) {
    const id = ids?.[i];
    const start = elementStartTime(anim, i, overrides, id);
    const duration = elementDuration(anim, overrides, id);
    maxEnd = Math.max(maxEnd, start + duration);
  }
  return Math.max(maxEnd + 1, 1); // 结尾留 1s 余量
}

/**
 * 计算整个动画序列的全局进度 0~1（用于折线路径整体绘制）
 * 从第一个元素开始到最后一个元素结束，应用 easing
 */
export function getGlobalAnimProgress(
  anim: AnimationModel,
  elementCount: number,
  t: number,
  overrides?: Record<string, ElementAnimOverride>,
  ids?: string[]
): number {
  if (elementCount <= 0) return 1;
  const start = anim.startTime;
  const end = (() => {
    let maxEnd = 0;
    for (let i = 0; i < elementCount; i++) {
      const id = ids?.[i];
      maxEnd = Math.max(maxEnd, elementStartTime(anim, i, overrides, id) + elementDuration(anim, overrides, id));
    }
    return maxEnd;
  })();
  const duration = end - start;
  if (duration <= 0) return 1;
  const raw = (t - start) / duration;
  return applyEasing(anim.easing, Math.min(1, Math.max(0, raw)));
}
