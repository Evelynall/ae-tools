/**
 * Easing — 统一缓动函数（§18）
 * 动画模型使用统一名称，禁止在图表组件中写死 easing
 */

import { EasingName } from "../models/AnimationModel";

export type EasingFn = (t: number) => number;

export const EASINGS: Record<EasingName, EasingFn> = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
};

export function applyEasing(name: EasingName, t: number): number {
  const fn = EASINGS[name] ?? EASINGS.linear;
  return fn(Math.min(1, Math.max(0, t)));
}

/**
 * 映射到 AE Temporal Ease 的 influence 值（供 JSX 生成器使用）
 * linear 不需要 ease；其余用 speed=0 + influence 近似
 * 注意：AE KeyframeEase 的 influence 合法范围是 0.1 ~ 100
 */
export const AE_EASE_INFLUENCE: Record<EasingName, { easeIn: number; easeOut: number } | null> = {
  linear: null,
  easeIn: { easeIn: 0.1, easeOut: 60 },
  easeOut: { easeIn: 60, easeOut: 0.1 },
  easeInOut: { easeIn: 60, easeOut: 60 }
};
