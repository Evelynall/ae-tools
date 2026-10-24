/**
 * StyleModel — 独立样式系统（§10）
 * 所有视觉参数都可从 UI 修改
 */

export type ValueFormat = "raw" | "integer" | "decimal1" | "decimal2" | "thousands" | "percent" | "custom";

export type GradientMode = "none" | "ramp" | "4color";
export type GradientShape = "linear" | "radial";

export interface GradientConfig {
  /** 渐变模式：none=无渐变，ramp=梯度渐变，4color=四色渐变 */
  mode: GradientMode;
  /** 兼容旧主题：如果 ramp/fourColor 不存在，从 colors 迁移 */
  colors?: string[];
  /** 梯度渐变（Gradient Ramp）参数 */
  ramp?: {
    startColor: string;
    endColor: string;
    /** 渐变起点 [x, y]，径向渐变下为圆心 */
    startPoint: [number, number];
    /** 渐变终点 [x, y]，径向渐变下为半径边缘参考点 */
    endPoint: [number, number];
    /** 渐变形状：linear 或 radial */
    shape: GradientShape;
  };
  /** 四色渐变（4-Color Gradient）参数 */
  fourColor?: {
    colors: [string, string, string, string];
    /** 四个点的位置 [x, y]，顺序与 colors 一一对应 */
    points: [[number, number], [number, number], [number, number], [number, number]];
  };
}

/** 创建指定模式的默认渐变配置 */
export function createDefaultGradientConfig(mode: GradientMode = "none"): GradientConfig {
  if (mode === "ramp") {
    return {
      mode,
      ramp: {
        startColor: "#4C8DFF",
        endColor: "#FF6B6B",
        startPoint: [960, 0],
        endPoint: [960, 1080],
        shape: "linear"
      }
    };
  }
  if (mode === "4color") {
    return {
      mode,
      fourColor: {
        colors: ["#4C8DFF", "#FF6B6B", "#51CF66", "#FFD43B"],
        points: [[192, 108], [1728, 108], [192, 972], [1728, 972]]
      }
    };
  }
  return { mode };
}

/** 把旧版基于 colors 数组的渐变配置迁移到新结构 */
export function migrateGradientConfig(cfg: GradientConfig): GradientConfig {
  if (!cfg) return createDefaultGradientConfig();
  if (cfg.mode === "none") return { mode: "none" };

  // 已经升级过
  if (cfg.mode === "ramp" && cfg.ramp) return cfg;
  if (cfg.mode === "4color" && cfg.fourColor) return cfg;

  const colors = cfg.colors && cfg.colors.length > 0 ? cfg.colors : ["#4C8DFF"];
  if (cfg.mode === "ramp") {
    return {
      mode: "ramp",
      ramp: {
        startColor: colors[0],
        endColor: colors[1] ?? colors[0],
        startPoint: [960, 0],
        endPoint: [960, 1080],
        shape: "linear"
      }
    };
  }
  if (cfg.mode === "4color") {
    const c = colors.length < 4
      ? ([...colors, ...Array(4 - colors.length).fill(colors[colors.length - 1] || "#4C8DFF")] as [string, string, string, string])
      : (colors.slice(0, 4) as [string, string, string, string]);
    return {
      mode: "4color",
      fourColor: {
        colors: c,
        points: [[192, 108], [1728, 108], [192, 972], [1728, 972]]
      }
    };
  }
  return createDefaultGradientConfig();
}

export interface LineStyleModel {
  /** 折线颜色 */
  color: string;
  /** 线宽 */
  width: number;
  /** 数据点半径 */
  pointRadius: number;
  /** 数据点颜色 */
  pointColor: string;
  /** 数据点描边颜色，空字符串表示无描边 */
  pointStroke: string;
  /** 数据点描边宽度 */
  pointStrokeWidth: number;
  /** 是否显示面积填充 */
  areaVisible: boolean;
  /** 面积填充颜色（建议带透明度） */
  areaColor: string;
}

export interface PieStyleModel {
  /** 扇形颜色序列，按数据行循环使用 */
  colors: string[];
  /** 外圆半径（0 = 自动根据画布计算） */
  radius: number;
  /** 内圆半径（0 = 实心饼图，>0 = 环形图） */
  innerRadius: number;
  /** 扇形间隔宽度 */
  strokeWidth: number;
  /** 扇形间隔颜色 */
  strokeColor: string;
  /** 分类标签位置 */
  labelPosition: "inside" | "outside" | "none";
  /** 是否显示百分比 */
  showPercentage: boolean;
  /** 是否显示数值 */
  showValue: boolean;
  /** 饼图扇形动画类型：expand=扇形展开（Trim Paths），scale=中心缩放 */
  animationType: "expand" | "scale";
}

export interface StyleModel {
  background: { color: string };
  bar: {
    color: string;
    /** 柱宽，0 = 自动根据空间计算 */
    width: number;
    gap: number;
    radius: number;
    /** 柱体渐变 */
    gradient: GradientConfig;
  };
  line: LineStyleModel & {
    /** 折线渐变 */
    gradient: GradientConfig;
    /** 面积填充渐变 */
    areaGradient: GradientConfig;
  };
  pie: PieStyleModel;
  label: {
    visible: boolean;
    fontFamily: string;
    fontSize: number;
    color: string;
  };
  value: {
    visible: boolean;
    fontFamily: string;
    fontSize: number;
    color: string;
    format: ValueFormat;
    /** custom 格式时的前后缀 */
    prefix: string;
    suffix: string;
  };
  axis: { visible: boolean; color: string };
  grid: { visible: boolean; color: string; count: number };
  /** 网格线数值标签 */
  gridLabel: {
    visible: boolean;
    fontFamily: string;
    fontSize: number;
    color: string;
    format: ValueFormat;
    prefix: string;
    suffix: string;
    /** 相对网格线端点的水平偏移 */
    offsetX: number;
    /** 相对网格线端点的垂直偏移 */
    offsetY: number;
  };
  /** Y 轴最大值，0 = 自动 */
  maxValue: number;
}

export function createDefaultStyle(): StyleModel {
  return {
    background: { color: "#111111" },
    bar: {
      color: "#4C8DFF",
      width: 0,
      gap: 30,
      radius: 8,
      gradient: createDefaultGradientConfig("none")
    },
    line: {
      color: "#4C8DFF",
      width: 6,
      pointRadius: 10,
      pointColor: "#FFFFFF",
      pointStroke: "#4C8DFF",
      pointStrokeWidth: 4,
      areaVisible: false,
      areaColor: "#4C8DFF33",
      gradient: createDefaultGradientConfig("none"),
      areaGradient: createDefaultGradientConfig("none")
    },
    pie: {
      colors: ["#4C8DFF", "#FF6B6B", "#51CF66", "#FFD43B", "#A77DFE", "#33D4D4"],
      radius: 0,
      innerRadius: 0,
      strokeWidth: 2,
      strokeColor: "#111111",
      labelPosition: "outside",
      showPercentage: true,
      showValue: false,
      animationType: "expand"
    },
    label: { visible: true, fontFamily: "Arial", fontSize: 32, color: "#FFFFFF" },
    value: {
      visible: true,
      fontFamily: "Arial",
      fontSize: 28,
      color: "#FFFFFF",
      format: "decimal1",
      prefix: "",
      suffix: ""
    },
    axis: { visible: true, color: "#555555" },
    grid: { visible: true, color: "#333333", count: 4 },
    gridLabel: {
      visible: true,
      fontFamily: "Arial",
      fontSize: 22,
      color: "#888888",
      format: "integer",
      prefix: "",
      suffix: "",
      offsetX: 8,
      offsetY: -8
    },
    maxValue: 0
  };
}
