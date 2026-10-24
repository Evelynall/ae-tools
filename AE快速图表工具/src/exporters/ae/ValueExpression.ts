/**
 * ValueExpression — 生成「源文本绑定滑块」的 AE 表达式（跨语言安全）
 *
 * 跨语言要点：
 * - 滑块效果使用自定义 ASCII 名字 "ValueCtrl"（效果名不会被本地化）
 * - 表达式内用 effect("ValueCtrl")(1) 访问：参数索引 1 即 Slider 参数，
 *   避免直接写 "Slider"（该参数名在不同语言 AE 中会被本地化）
 * - 滑块默认不显示小数点：值放大 100 倍存滑块，表达式内 ÷100 还原
 *
 * 表达式引擎为 ES3 子集：只使用 var / 函数声明 / charAt，不用 ES6 语法
 */

import { StyleModel, ValueFormat } from "../../models/StyleModel";

/** 滑块效果的自定义名字（表达式查询用，必须为 ASCII） */
export const SLIDER_EFFECT_NAME = "ValueCtrl";

const THOUSANDS_FN =
  '(function(n){var s=String(Math.round(n)),o="",c=0;for(var i=s.length-1;i>=0;i--){o=s.charAt(i)+(c>0&&c%3===0?",":"")+o;c++;}return o;})(v)';

function formatCode(format: ValueFormat): string {
  switch (format) {
    case "raw":
      return "var s = v.toString();";
    case "integer":
      return "var s = Math.round(v).toString();";
    case "decimal1":
      return "var s = v.toFixed(1);";
    case "decimal2":
      return "var s = v.toFixed(2);";
    case "thousands":
      return "var s = " + THOUSANDS_FN + ";";
    case "percent":
      return 'var s = v.toFixed(1) + "%";';
    case "custom":
      return "var s = v.toFixed(1);";
    default:
      return "var s = v.toString();";
  }
}

export function buildValueExpression(cfg: { format: ValueFormat; prefix: string; suffix: string }): string {
  const prefix = JSON.stringify(cfg.prefix ?? "");
  const suffix = JSON.stringify(cfg.suffix ?? "");
  const lines = [
    `var v = effect("${SLIDER_EFFECT_NAME}")(1) / 100;`,
    formatCode(cfg.format),
    "(" + prefix + ") + s + (" + suffix + ");"
  ];
  return lines.join("\n");
}
