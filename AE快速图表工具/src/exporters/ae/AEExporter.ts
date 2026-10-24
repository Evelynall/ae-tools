/**
 * AEExporter — 生成中间层 Project JSON（§37）
 * 这是整个系统最重要的中间层：JSX Generator 只消费这份 JSON
 */

import { ProjectModel } from "../../models/ProjectModel";
import {
  ChartElement,
  BarElement,
  TextElement,
  LinePathElement,
  LinePointElement,
  LineAreaElement,
  PieSliceElement
} from "../../models/ChartElement";
import { getChartRenderer, getChartDataPointCount } from "../../charts/ChartRenderer";
import { elementStartTime, elementDuration, elementEasing } from "../../animation/AnimationEngine";
import { buildValueExpression } from "./ValueExpression";
import { ValueFormat } from "../../models/StyleModel";

export interface AEExportElement {
  id: string;
  type: string;
  dataIndex: number;
  geometry: Record<string, unknown>;
  style: Record<string, unknown>;
  text?: string;
  barId?: string;
  meta?: { category: string; value: number };
  animation?: {
    startTime: number;
    duration: number;
    easing: string;
    growAxis: "x" | "y" | "point" | null;
    fade: boolean;
    move: boolean;
    /**
     * 折线路径专用：全局动画进度 0~1 控制 Trim Paths
     */
    globalProgress?: number;
    /**
     * 饼图专用："expand"=扇形展开（Trim Paths），"scale"=中心缩放
     */
    pieAnimationType?: "expand" | "scale";
    /**
     * 滑块控制方案（替代 Source Text 关键帧）：
     * - expression：绑定在源文本上的表达式，从滑块取值
     * - sliderEnd：滑块终值（= 实际值 × 100，取整）
     * AE 的 Slider 是无范围限制的数值属性，任何值均可设置，UI 不报错；
     * 源文本 = 滑块值 ÷100 还原（滑块默认不显示小数点）
     */
    expression?: string;
    sliderEnd?: number;
  };
}

export interface AEExportJSON {
  version: string;
  name: string;
  composition: {
    width: number;
    height: number;
    fps: number;
    duration: number;
    background: string;
  };
  chart: { type: string; orientation: string };
  animation: {
    startTime: number;
    duration: number;
    stagger: number;
    easing: string;
  };
  elements: AEExportElement[];
}

/** 数值动画（滑块方案）：计算滑块终值与源文本表达式 */
function buildValueSliderInfo(
  project: ProjectModel,
  finalValue: number,
  format?: ValueFormat,
  prefix?: string,
  suffix?: string
): { expression: string; sliderEnd: number } {
  // 滑块默认不显示小数点：值统一放大 100 倍放入滑块，表达式里 ÷100 还原
  const sliderEnd = Math.round(finalValue * 100);
  const cfg = {
    format: format ?? project.style.value.format,
    prefix: prefix ?? project.style.value.prefix,
    suffix: suffix ?? project.style.value.suffix
  };
  const expression = buildValueExpression(cfg);
  return { expression, sliderEnd };
}

export function buildAEExportJSON(project: ProjectModel): AEExportJSON {
  const renderer = getChartRenderer(project);
  const elements = renderer.getElements(project);
  const anim = project.animation;
  const isVertical = project.chart.orientation === "vertical";
  const isLine = project.chart.type === "line";
  const isPie = project.chart.type === "pie";
  const dataPointCount = getChartDataPointCount(project);
  const animTargetIds = renderer.getAnimationTargets(project);

  const out: AEExportElement[] = elements.map((el: ChartElement) => {
    const base: AEExportElement = {
      id: el.id,
      type: el.type,
      dataIndex: el.dataIndex,
      geometry: el.geometry as unknown as Record<string, unknown>,
      style: el.style as unknown as Record<string, unknown>
    };
    if (el.type === "bar") {
      const b = el as BarElement;
      base.meta = b.meta;
      base.animation = {
        startTime: elementStartTime(anim, b.dataIndex, project.elementOverrides, b.groupId, b.id),
        duration: elementDuration(anim, project.elementOverrides, b.groupId, b.id),
        easing: elementEasing(anim, project.elementOverrides, b.groupId, b.id),
        growAxis: anim.grow ? (isVertical ? "y" : "x") : null,
        fade: anim.fade,
        move: anim.move
      };
    } else if (el.type === "line-path") {
      const lp = el as LinePathElement;
      base.meta = lp.meta;
      const start = anim.startTime;
      const end = dataPointCount > 0
        ? elementStartTime(anim, dataPointCount - 1, project.elementOverrides, animTargetIds[dataPointCount - 1]) + elementDuration(anim, project.elementOverrides, animTargetIds[dataPointCount - 1])
        : start + anim.duration;
      base.animation = {
        startTime: start,
        duration: end - start,
        easing: anim.easing,
        growAxis: anim.grow ? "x" : null,
        fade: false,
        move: false
      };
    } else if (el.type === "line-area") {
      const la = el as LineAreaElement;
      base.meta = la.meta;
      // 面积填充通常作为静态背景，不单独做动画
      base.animation = {
        startTime: anim.startTime,
        duration: 0,
        easing: anim.easing,
        growAxis: null,
        fade: false,
        move: false
      };
    } else if (el.type === "line-point") {
      const pt = el as LinePointElement;
      base.meta = pt.meta;
      base.animation = {
        startTime: elementStartTime(anim, pt.dataIndex, project.elementOverrides, pt.groupId, pt.id),
        duration: elementDuration(anim, project.elementOverrides, pt.groupId, pt.id),
        easing: elementEasing(anim, project.elementOverrides, pt.groupId, pt.id),
        growAxis: anim.grow ? "point" : null,
        fade: anim.fade,
        move: anim.move
      };
    } else if (el.type === "pie-slice") {
      const slice = el as PieSliceElement;
      base.meta = slice.meta;
      const pieAnimType = project.style.pie.animationType ?? "expand";
      base.animation = {
        startTime: elementStartTime(anim, slice.dataIndex, project.elementOverrides, slice.groupId, slice.id),
        duration: elementDuration(anim, project.elementOverrides, slice.groupId, slice.id),
        easing: elementEasing(anim, project.elementOverrides, slice.groupId, slice.id),
        growAxis: anim.grow ? (pieAnimType === "scale" ? "point" : null) : null,
        pieAnimationType: pieAnimType,
        fade: anim.fade,
        move: anim.move
      };
    } else if (el.type === "label" || el.type === "value" || el.type === "grid-label") {
      const t = el as TextElement;
      base.text = t.text;
      base.barId = t.barId;
      base.meta = t.meta;
      const startTime = elementStartTime(anim, t.dataIndex, project.elementOverrides, t.groupId, t.id);
      base.animation = {
        startTime,
        duration: elementDuration(anim, project.elementOverrides, t.groupId, t.id),
        easing: elementEasing(anim, project.elementOverrides, t.groupId, t.id),
        growAxis: null,
        fade: anim.fade,
        move: anim.move,
        ...(el.type === "value" && anim.count
          ? buildValueSliderInfo(
              project,
              t.meta.value,
              t.style.format,
              t.style.prefix,
              t.style.suffix
            )
          : {})
      };
    }
    return base;
  });

  return {
    version: project.version,
    name: project.name,
    composition: {
      width: project.document.width,
      height: project.document.height,
      fps: project.document.fps,
      duration: project.document.duration,
      background: project.style.background.color
    },
    chart: { type: project.chart.type, orientation: project.chart.orientation },
    animation: {
      startTime: anim.startTime,
      duration: anim.duration,
      stagger: anim.stagger,
      easing: anim.easing
    },
    elements: out
  };
}
