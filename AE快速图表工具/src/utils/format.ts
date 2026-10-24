/**
 * 数值格式化（§17）：整数 / 小数 / 千分位 / 百分比 / 单位
 */

import { ValueFormat } from "../models/StyleModel";

export function formatValue(
  v: number,
  format: ValueFormat,
  prefix = "",
  suffix = ""
): string {
  let core: string;
  switch (format) {
    case "integer":
      core = String(Math.round(v));
      break;
    case "decimal1":
      core = v.toFixed(1);
      break;
    case "decimal2":
      core = v.toFixed(2);
      break;
    case "thousands":
      core = Math.round(v).toLocaleString("en-US");
      break;
    case "percent":
      core = v.toFixed(1) + "%";
      break;
    case "custom":
      core = v.toFixed(1);
      break;
    case "raw":
    default:
      core = String(v);
  }
  return prefix + core + suffix;
}
