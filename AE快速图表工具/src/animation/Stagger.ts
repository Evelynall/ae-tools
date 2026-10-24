/**
 * Stagger — 通用元素依次出现计算（§14）
 * 不属于柱状图，未来其他图表复用
 */

/** 第 index 个元素的动画开始时间 */
export function staggerStart(baseStartTime: number, index: number, stagger: number): number {
  return baseStartTime + index * stagger;
}

/** 一组元素动画的总时长（用于自动推导合成时长） */
export function staggeredTotalDuration(
  baseStartTime: number,
  count: number,
  stagger: number,
  duration: number
): number {
  if (count <= 0) return baseStartTime + duration;
  return staggerStart(baseStartTime, count - 1, stagger) + duration;
}
