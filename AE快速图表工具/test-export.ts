import { createDefaultProject } from "./src/models/ProjectModel";
import { buildAEExportJSON } from "./src/exporters/ae/AEExporter";
import { generateJSX } from "./src/exporters/ae/JSXGenerator";

const project = createDefaultProject();
// 模拟验收操作：duration=1, stagger=0.15（默认值即如此）
const json = buildAEExportJSON(project);
const jsx = generateJSX(json);

const bars = json.elements.filter((e) => e.type === "bar");
console.log("bars:", bars.length);
bars.forEach((b) => {
  console.log(b.id, "start:", b.animation!.startTime.toFixed(2), "dur:", b.animation!.duration);
});

const checks: [string, boolean][] = [
  ["5 bars", bars.length === 5],
  ["stagger Bar05 = 0.60s", Math.abs((bars[4].animation?.startTime ?? 0) - 0.6) < 1e-9],
  ["comp duration > 1.6", json.composition.duration > 1.6],
  ["JSX has COMP_Main", jsx.includes('"COMP_Main"')],
  ["JSX has bar-005 (→ PRECOMP_Bar_005)", jsx.includes("bar-005") && jsx.includes('"PRECOMP_" + bar.id')],
  ["JSX has grow animation", jsx.includes("addGrowAnimation")],
  ["easeInfluence no zero (AE range 0.1~100)", jsx.includes("[0.1, 60]") && jsx.includes("[60, 0.1]") && !jsx.includes("KeyframeEase(0, 0)")],
  ["generic applyEase (dimension-aware)", jsx.includes("easeArrayFor(prop, inf[0])") && !jsx.includes("applyEase2D") && !jsx.includes("applyEase1D")],
  ["JSX has slider+expression", jsx.includes("addValueSlider") && jsx.includes("ValueCtrl")],
  ["value slider info in JSON", (json.elements.find((e) => e.type === "value")?.animation?.sliderEnd ?? 0) > 0],
  ["expression uses index (1)", jsx.includes('effect("ValueCtrl")(1) / 100')],
  ["expression assigned to source text", jsx.includes("textProp.expression = anim.expression")],
  ["no old hold keyframes", !jsx.includes("addValueKeyframes") && !jsx.includes("valueKeys")]
];
let fail = 0;
for (const [name, ok] of checks) {
  console.log(ok ? "PASS" : "FAIL", name);
  if (!ok) fail++;
}
process.exit(fail ? 1 : 0);
