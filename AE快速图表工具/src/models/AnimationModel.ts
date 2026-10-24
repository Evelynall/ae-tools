/**
 * AnimationModel — 动画独立于图表（§12）
 * stagger 属于通用动画系统，不写死在柱状图代码里（§14）
 */

export type EasingName = "linear" | "easeIn" | "easeOut" | "easeInOut";

export interface ElementAnimOverride {
  /** 覆盖开始时间（秒），未设置则使用全局计算 */
  startTime?: number;
  /** 覆盖动画时长（秒），未设置则使用全局 duration */
  duration?: number;
  /** 覆盖缓动 */
  easing?: EasingName;
  /** 覆盖是否启用生长动画 */
  grow?: boolean;
  /** 覆盖是否启用淡入动画 */
  fade?: boolean;
  /** 覆盖是否启用位移动画 */
  move?: boolean;
  /** 覆盖是否启用数值变化动画 */
  count?: boolean;
}

export interface AnimationModel {
  /** 全局开始时间（秒） */
  startTime: number;
  /** 单个元素动画时长（秒） */
  duration: number;
  /** 元素间依次延迟（秒）：startTime_i = startTime + index * stagger * staggerRatio */
  stagger: number;
  /** stagger 比例 0~1：0=全部同步，1=完全依次 */
  staggerRatio: number;
  easing: EasingName;
  /** 动画开关 */
  grow: boolean;   // 柱子生长（底部固定，顶部向上）
  fade: boolean;   // 标签/数值淡入
  move: boolean;   // 标签/数值位移（Y +30 → 0）
  count: boolean;  // 数值变化动画（0 → 实际值，与柱子动画同步）
}

export function createDefaultAnimation(): AnimationModel {
  return {
    startTime: 0,
    duration: 1,
    stagger: 0.15,
    staggerRatio: 1,
    easing: "easeOut",
    grow: true,
    fade: true,
    move: false,
    count: true
  };
}
