# AE 快速矩形插件 · 开发规划

> **状态**：M0 已跑通 → M1 脚本已产出，待实测
> **运行环境**：After Effects 2026 (26.2x49) · 中文界面 (zh_CN) · Windows
> **最后更新**：2026-09-16

---

## 0. M0 实测结论（已跑通）

探测脚本已在 AE 2026 (26.2x49) / zh_CN 上跑通，下面这些**全部实测确认**，不再是猜测：

| 项目 | 实测值 |
|------|--------|
| 矩形路径容器 | `ADBE Vectors Group` |
| 矩形路径 | `ADBE Vector Shape - Rect` |
| 大小 / 位置 / 圆度 | `ADBE Vector Rect Size` / `- Position` / `- Roundness` |
| 填充 / 描边 | `ADBE Vector Graphic - Fill` / `- Stroke` |
| 滑块参数 1 | 显示名「滑块」，matchName `ADBE Slider Control-0001` |
| 点控制参数 1 | 显示名「点」，matchName `ADBE Point Control-0001` |
| 颜色参数 1 | 显示名「颜色」，matchName `ADBE Color Control-0001` |

**表达式取值语法：用索引 `effect("名字")(1)`。** 中文版下写 `"Slider"` 会报「属性或方法缺失」。

**脚本层的另一个坑**：连续 `addProperty` 之后，之前保存的属性引用会失效，报 `ReferenceError: 对象无效`。正确做法是**每次用时重新遍历查找**，绝不跨段保存引用。

**脚本里取控件参数**用 matchName（`fx.property("ADBE Slider Control-0001")`），**表达式里**用索引（`effect("名")(1)`）—— 这两处不一样，别混。

> 以上两点在用户已有的 DataMotion（`AE快速图表工具`）项目里也得到交叉验证，其源码注释明确写了同样的结论。

风险 **R1 / R2 / R3 已解除**。

**补充：形状组的渲染顺序**（M1 实测踩到）：AE 形状组里**越靠上的项渲染越靠前**。
`addProperty` 追加到列表末尾，所以要让描边显示在填充之上，必须**先加描边、后加填充**，
得到「路径 → 描边 → 填充」—— 这正是 AE 原生矩形工具的顺序。反了会导致描边被填充盖住。

### 0.1 v2 修订说明

针对 AE 2026 + 中文界面重新检查后，发现 v1 有 **3 个会直接踩雷的硬伤**，已全部修正：

| # | v1 的问题 | 修正 |
|---|----------|------|
| 🔴 **C1** | 表达式写 `effect("Rect Width")("Slider")`，**中文版 AE 里属性名被本地化了**，大概率取不到值 | 改用**数字索引** `effect("Rect Width")(1)`，任何语言版本都成立 |
| 🔴 **C2** | 没考虑 ExtendScript 是 **ES3 引擎**，`const` / 箭头函数 / 模板字符串 / `JSON.parse` 全部不可用 | 明确语法白名单，配置用字面量对象（§4.2） |
| 🔴 **C3** | 没提文件编码。`.jsx` 里写中文字符串，**不存成 UTF-8 with BOM 必定乱码** | 编码规则写进工程约束（§4.3） |

另外根据新需求调整了控件范围（§3.2），并给 M0 加了一步 **matchName 探测**（§5），把「猜 API」变成「实测 dump 出来」。

---

## 1. 需求与边界

### 1.1 痛点

原生 AE 改矩形尺寸的路径：

```
形状图层 1
└─ 内容                    ← 展开 1
   └─ 矩形 1               ← 展开 2
      └─ 矩形路径 1         ← 展开 3
         ├─ 大小  [X] [Y]   ← 终于到了
         ├─ 位置  [X] [Y]
         └─ 圆度  [○]
```

深层问题：层级深、大小要分 X/Y 两次输入、多矩形时反复展开收起、圆角最常用却藏得最深。

### 1.2 目标状态

在效果控件面板里，一个图层的所有形状参数一屏看全，鼠标直接拖。

### 1.3 本期边界（已确认）

- ✅ 只做矩形（含圆角矩形）
- ✅ 控件范围：**矩形路径的 4 项**（宽 / 高 / 偏移 / 圆角）+ **填充 / 描边**
- ❌ **不要图层变换控件**（位置 / 旋转 / 缩放 / 不透明度）—— 摆放用原生方式拖，职责更清晰
- ⭕ 「给现有矩形补装控件」—— **暂缓**，放到 M3
- ❌ 不做 C++ 插件、不做 UXP

> **去掉图层位置控件是个意外收获**：v1 里的 R4 风险（「矩形位置」和「图层位置」两个语义打架、用户容易混）**自动消解**了。现在职责很干净 —— 效果控件只管形状本身，图层摆放在时间轴里改。

---

## 2. 平台选型

### 2.1 平台现状（2026-09 核实）

- Adobe 的 CEP → UXP 迁移顺序是 **Premiere → Media Encoder → After Effects**，**AE 2026 仍没有 UXP**
- CEP 在 AE 里还能跑但已 EOL
- **ExtendScript（`.jsx`）** 仍是 AE 里最稳、最省事的扩展方式

> 网上很多「AE 插件开发」教程直接上 CEP，对这需求投入产出比很低，不走。

### 2.2 结论

**ExtendScript 起步。M1 一次性脚本 → M2 套 ScriptUI 面板，两阶段共用同一套核心函数。**

### 2.3 补充：`.ffx` 预设

M1 做完后，可把生成的图层手动拖进「效果和预设」面板存成 `.ffx`，以后直接拖拽用。局限是默认值固化、无法自动适配合成尺寸 —— 当补充手段可以，替代不了脚本。

---

## 3. 技术方案

### 3.1 生成的图层结构

```
形状图层「矩形 1」
├─ 内容
│  └─ 矩形 1
│     ├─ 矩形路径 1     ← 大小 / 位置 / 圆度 挂表达式
│     ├─ 填充 1         ← 颜色 / 不透明度 挂表达式
│     └─ 描边 1         ← 颜色 / 宽度 / 不透明度 挂表达式
└─ 效果控件              ← 展开 1 层，全部在这里
   ├─ Rect Width        滑块    → 大小 X
   ├─ Rect Height       滑块    → 大小 Y
   ├─ Rect Offset       点      → 矩形路径 位置
   ├─ Corner Radius     滑块    → 圆度
   ├─ Fill Color        颜色    → 填充 颜色
   ├─ Fill Opacity      滑块    → 填充 不透明度
   ├─ Stroke Color      颜色    → 描边 颜色
   ├─ Stroke Width      滑块    → 描边 宽度
   └─ Stroke Opacity    滑块    → 描边 不透明度
```

原始属性层级**保持不动**，只是数值来源改成了效果控件。

### 3.2 效果控件映射表（v2 最终版）

| # | 控件名 | 类型 | 驱动目标 | 默认值 |
|---|--------|------|---------|--------|
| 1 | `Rect Width` | 滑块控制 | 矩形路径 → 大小 X | 400 |
| 2 | `Rect Height` | 滑块控制 | 矩形路径 → 大小 Y | 400 |
| 3 | `Rect Offset` | 点控制 | 矩形路径 → 位置 | `[0, 0]` |
| 4 | `Corner Radius` | 滑块控制 | 矩形路径 → 圆度 | 0 |
| 5 | `Fill Color` | 颜色控制 | 填充 1 → 颜色 | 白 |
| 6 | `Fill Opacity` | 滑块控制 | 填充 1 → 不透明度 | 100 |
| 7 | `Stroke Color` | 颜色控制 | 描边 1 → 颜色 | 黑 |
| 8 | `Stroke Width` | 滑块控制 | 描边 1 → 描边宽度 | 4 |
| 9 | `Stroke Opacity` | 滑块控制 | 描边 1 → 不透明度 | 100 |

几个决策说明：

- **「大小」用两个滑块而非一个点控制** —— 便于单独驱动做拉伸动画，数值输入也更精确
- **第 3 项改名为 `Rect Offset`（偏移）而不是 `Rect Position`** —— 它是「矩形相对图层锚点的偏移」，不是图层在合成里的位置。名字起错会害人
- **控件名用英文** —— 表达式要按名字引用，中文名在脚本字符串里涉及编码，容易踩雷。界面语言不影响英文控件名的显示
- **描边相关控件可配置开关** —— 只要填充时关掉，面板不至于太挤（`ENABLE_STROKE`）
- **图层位置不绑表达式** —— 生成时一次性写死为合成中心，之后在时间轴里正常拖动即可

### 3.3 表达式写法（v2 修正版）

⚠️ **关键**：第二参数用**数字索引**，不用属性名字符串。

```
矩形路径 → 大小：
    [effect("Rect Width")(1), effect("Rect Height")(1)]

矩形路径 → 位置：
    effect("Rect Offset")(1)

矩形路径 → 圆度：
    effect("Corner Radius")(1)

填充 → 颜色：
    effect("Fill Color")(1)

填充 → 不透明度：
    effect("Fill Opacity")(1)

描边 → 颜色：
    effect("Stroke Color")(1)

描边 → 宽度：
    effect("Stroke Width")(1)

描边 → 不透明度：
    effect("Stroke Opacity")(1)
```

**为什么必须用 `(1)` 而不是 `("Slider")`？**

中文版 AE 里，滑块控制的属性显示为「滑块」、点控制显示为「点」。表达式引擎对效果属性名**通常是本地化的**，写 `"Slider"` 可能取不到值。而滑块 / 点 / 颜色控制的第 1 个属性组就是它唯一的值属性，**索引 `1` 在任何语言版本下都成立**。

> M0 会实测确认这一点。若中文版实际能接受英文属性名，两种都可用，但统一用索引更省心。

带容错的版本（控件被误删时不至于满屏报错）：

```javascript
(function () {
    var w = 400, h = 400;
    try { w = effect("Rect Width")(1); } catch (e) {}
    try { h = effect("Rect Height")(1); } catch (e) {}
    return [w, h];
}())
```

### 3.4 跨语言 / 跨版本：必须用 matchName

中文版 AE 里如果这样找属性：

```javascript
var rectPath = shapeLayer.content("矩形 1").content("矩形路径 1");
```

在**英文版 AE 上会直接报错**（那边叫 `Rectangle 1`）。改用 matchName，它在所有语言版本里固定不变：

```javascript
var contents  = shapeLayer.property("ADBE Root Vectors Group");
var rectGroup = contents.property("ADBE Vector Group");
var rectPath  = rectGroup.property("ADBE Vector Shape - Rect");
```

**预期 matchName（全部待 M0 实测 dump 确认）：**

| 对象 | 预期 matchName |
|------|---------------|
| 根内容组 | `ADBE Root Vectors Group` |
| 形状组 | `ADBE Vector Group` |
| 矩形路径 | `ADBE Vector Shape - Rect` |
| 矩形大小 / 位置 / 圆度 | `ADBE Vector Rect Size` / `- Position` / `- Roundness` |
| 填充 | `ADBE Vector Graphic - Fill` |
| 描边 | `ADBE Vector Graphic - Stroke` |
| 填充颜色 / 不透明度 | `ADBE Vector Fill Color` / `ADBE Vector Fill Opacity` |
| 描边颜色 / 宽度 | `ADBE Vector Stroke Color` / `ADBE Vector Stroke Width` |
| 效果控件：滑块 / 点 / 颜色 | `ADBE Slider Control` / `ADBE Point Control` / `ADBE Color Control` |

---

## 4. 工程约束 ⚠️ 三个必须遵守的硬规则

这三条不遵守，代码一定跑不起来或跑出诡异结果。

### 4.1 ExtendScript 是 ES3 引擎

AE 2026 的 ExtendScript 仍是 **ECMAScript 3**（部分 ES5）。以下**全部不能用**：

| ❌ 禁用 | ✅ 改用 |
|--------|--------|
| `const` / `let` | `var` |
| 箭头函数 `() => {}` | `function () {}` |
| 模板字符串 `` `a${b}` `` | 字符串拼接 `'a' + b` |
| `for...of` / `for...in` | 传统 `for (var i = 0; ...)` |
| `Array.forEach / map / filter / indexOf` | 手写循环（**ExtendScript 基本不支持这些**） |
| `JSON.parse / JSON.stringify` | ❗**完全不支持**，配置直接用对象字面量 |
| `Object.keys` | 手写循环 |
| `try...catch` | ✅ 可用 |

> 表达式引擎比 ExtendScript 宽松些，但为统一，表达式也一律用 ES5 写法。

### 4.2 配置写在脚本顶部的对象字面量里

因为 `JSON.parse` 不可用，配置必须这样写：

```javascript
var CONFIG = {
    width: 400,
    height: 400,
    radius: 0,
    centerOnCreate: true,
    enableStroke: true,
    layerName: "矩形"
};
```

改参数 = 改这个对象，保存后重跑脚本。M2 做面板时把这些值暴露成输入框即可。

### 4.3 `.jsx` 文件必须存为 **UTF-8 with BOM**

脚本里会有中文（图层名、提示文案）。ExtendScript 读取**无 BOM** 的 UTF-8 文件时会按系统 ANSI（GBK）解析，**中文必定乱码**。

- 生成 `.jsx` 后必须确保带 BOM
- VS Code 用户：右下角编码 → 「通过编码保存」→ 选 `UTF-8 with BOM`
- 后续若写入文件（如 dump 日志），需在 AE「首选项 → 脚本和表达式」中开启**允许脚本写入文件和访问网络**

### 4.4 目录结构

```
AE快速矩形插件/
├─ PLAN.md                    # 本文档
└─ panel/
   └─ QuickRectPanel.jsx      # 唯一脚本：停靠面板（自包含，含全部功能）
```

> 原 `jsx/` 下的弹窗版、属性探测脚本、渐变探测脚本、安装脚本，
> 以及所有探测输出文件，已按需求删除，只保留面板版。

### 4.5 安装与更新方式（安装脚本已删除）

面板脚本必须放在 AE 的 `ScriptUI Panels` 目录才能常驻。
删掉安装脚本后，**更新面板时手动复制**：

| 环境 | 目标目录 |
|------|---------|
| Windows | `C:\Program Files\Adobe\Adobe After Effects <版本>\Support Files\Scripts\ScriptUI Panels\` |

复制后重启 AE，在菜单「窗口」底部找到「快速矩形」。
写入 Program Files 可能需要管理员权限。

临时试用（不常驻）：直接运行 `panel/QuickRectPanel.jsx`，
会以浮动窗口打开，仅当次会话有效。

---

## 5. 版本规划

### M0 · 探测 + 可行性验证 ⚠️ **先做这个**

原来 v1 的 M0 只验证表达式，现在**加一步探测**，把 matchName 从「猜」变成「实测」：

- [ ] **`_probe_matchName.jsx`**：递归遍历形状图层属性树，dump 出每个节点的 `name` + `matchName` + 索引
  - 一次跑完，§3.4 那张表里所有「预期值」全部落实
  - 输出方式：写 txt 文件（需开启§4.3 权限）；不开权限则用 `alert` 分批显示
- [ ] 验证 `effect("名字")(1)` 在中文版能否取到值（对比 `"Slider"` 写法）
- [ ] 验证形状路径属性上的表达式能否访问图层效果控件 ← **地基**
- [ ] 拖滑块，确认矩形实时跟随

**验收**：拖滑块 → 矩形变。matchName 表全部落实。不通过就走退路（§6 R1）。

### M1 · MVP 脚本

- [ ] 一键生成：形状图层 + 矩形 + 填充 + 描边
- [ ] 9 个效果控件 + 表达式绑定
- [ ] 自动居中到当前合成（静态写入图层位置，不绑表达式）
- [ ] 顶部 `CONFIG` 对象可配（宽 / 高 / 圆角 / 是否生成描边 / 图层名）
- [ ] `beginUndoGroup` 包裹，一次撤销干净
- [ ] 生成后自动选中新图层
- [ ] 防呆：重复生成的处理

### M2 · 停靠面板 ✅ 已完成

- [x] `panel/QuickRectPanel.jsx` —— ScriptUI 面板（**自包含**，不 `#include` 外部文件，避免复制到 AE 目录后路径失效）
- [x] `jsx/installPanel.jsx` —— 安装脚本，自动复制到 AE 的 `ScriptUI Panels` 目录
- [x] 参数区：宽 / 高 / 圆角 / 描边开关+宽度 / 居中 / 图层名
- [x] 预设按钮：正方形 / 16:9 / 圆角卡片 / 分隔线
- [x] 状态栏反馈（不弹 alert，避免每次打扰），面板常驻可连续生成

**安装**：AE → 文件 → 脚本 → 运行脚本文件 → 选 `jsx/installPanel.jsx` → 重启 AE → 菜单「窗口」底部出现「快速矩形」。

**卸载**：删除 AE 目录下 `Scripts/ScriptUI Panels/QuickRectPanel.jsx`。

**不安装也能用**：直接运行面板文件，以浮动窗口打开（本次会话有效，不常驻）。

> 写入 Program Files 可能需要管理员权限。安装失败时脚本会给出手动复制的源路径与目标路径。

### M3 · 后续（暂缓项）

- [ ] 「给现有矩形补装控件」—— 选中已有形状图层，注入效果控件 + 表达式
- [ ] 扩展椭圆 / 多边形 / 星形 —— 配置表驱动，不写重复代码

---

## 6. 风险清单

| 编号 | 风险 | 影响 | 应对 |
|------|------|------|------|
| **R1** | 形状路径属性上的表达式能否访问图层效果控件 | 🔴 地基级 | M0 首先实测；退路见下 |
| **R2** | 中文版表达式属性名被本地化（`"Slider"` 取不到） | 🔴 直接失效 | 统一用数字索引 `(1)` |
| **R3** | matchName 记错 / 版本间变动 | 🔴 找不到属性 | M0 探测脚本实测 dump，不靠记忆 |
| **R4** | ExtendScript 用了 ES6 语法 | 🔴 脚本直接报错 | 遵守 §4.1 语法白名单 |
| **R5** | `.jsx` 无 BOM 导致中文乱码 | 🟠 诡异难查 | 强制 UTF-8 with BOM |
| **R6** | 表达式写入后，手动改属性值失效 | 🟡 用户困惑 | 使用说明里明确：数据源已转移到效果控件 |
| **R7** | 用户重命名效果控件导致表达式断裂 | 🟡 易踩坑 | 说明里注明不要改名 |
| **R8** | 同一图层重复生成导致控件重名 | 🟡 引用歧义 | 每次生成独立图层；生成前检测 |
| ~~R4(v1)~~ | ~~矩形位置 vs 图层位置语义混淆~~ | ✅ **已消解** | 移除图层位置控件后不再存在 |

### R1 退路方案

若实测发现形状路径属性无法引用图层效果控件：

1. **显式引用**：`thisComp.layer("矩形 1").effect("Rect Width")(1)`
2. **绕开形状路径**：把「大小」落到图层「缩放」上实现
3. **降级为纯脚本**：脚本读参数 → 直接写属性值（失去实时绑定，但解决「一键生成」）

---

## 7. 待确认

| # | 事项 | 状态 |
|---|------|------|
| 1 | AE 2026 · 中文界面 · Windows | ✅ 已确认 |
| 2 | 控件范围：矩形 4 项 + 填充/描边，不要图层变换 | ✅ 已确认 |
| 3 | 补装控件功能暂缓 | ✅ 已确认 |
| 4 | **交付形态：M1 一次性脚本 vs 直接做常驻面板** | ✅ 采用**方案 A**（先脚本，后面板） |

---

## 8. 关于「不止是矩形」

架构上提前留出扩展位：

```
形状配置表 = [
  { 类型: "矩形", matchName: "ADBE Vector Shape - Rect",
    控件: [宽度, 高度, 偏移, 圆角, 填充色, 填充透明, 描边色, 描边宽, 描边透明] },
  { 类型: "椭圆", matchName: "ADBE Vector Shape - Ellipse",
    控件: [宽度, 高度, 偏移, 填充...] },
  { 类型: "星形", matchName: "ADBE Vector Shape - Star",
    控件: [外径, 内径, 点数, 旋转, ...] },
  ...
]
```

同一套生成引擎，只换配置就能出新形状工具 —— M3 的核心思路。

再往后可能的方向：多矩形批量生成、网格/等分切图、导出 `.ffx` 分发。

---

## 附：参考

- Adobe CEP / UXP 迁移现状：`filmit.io/blog/future-of-adobe-plugins-uxp-cep-ai`
- After Effects UXP 支持时间线讨论：Adobe Creative Cloud Developer Forums
- 脚本 vs 扩展 vs 插件：Hyper Brew Blog
