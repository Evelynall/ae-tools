# DataMotion — 数据图表动画与 After Effects 工程生成工具
## MVP 产品需求与技术规格文档

---

# 1. 项目概述

## 1.1 项目名称

暂定名称：**DataMotion**

项目定位：

> 一个面向视频创作者的数据可视化动画工具。
>
> 用户可以导入结构化数据，在浏览器界面中快速生成和调整图表，设置简单动画，并实时预览；最终将图表及动画导出为结构清晰、元素独立、动画使用 AE 关键帧的 After Effects 工程，方便用户继续在 AE 中进行后期编辑。

---

# 2. 核心目标

本项目不是单纯的在线图表生成器。

核心目标是：

> **数据 → 图表 → 动画 → 可编辑 AE 工程**

最终用户工作流：

```text
导入数据
   ↓
选择图表
   ↓
调整图表样式
   ↓
设置动画
   ↓
浏览器实时预览
   ↓
导出 AE 工程
   ↓
在 AE 中继续编辑
```

第一阶段只需要完整跑通：

```text
CSV / JSON
   ↓
柱状图
   ↓
样式调整
   ↓
生长动画
   ↓
动画预览
   ↓
AE 工程生成
   ↓
独立预合成
   ↓
AE 关键帧
```

其他图表类型暂时不实现，但底层架构必须预留扩展能力。

---

# 3. MVP 范围

## 3.1 第一阶段必须实现

### 数据

- CSV 导入
- JSON 导入
- 手动输入/编辑数据
- 数据实时修改
- 数据校验

### 图表

第一阶段只实现：

- 纵向柱状图
- 横向柱状图

### 样式

支持：

- 柱子颜色
- 背景颜色
- 柱子宽度
- 柱子间距
- 柱子圆角
- 图表整体尺寸
- 图表边距
- 数值标签
- 分类标签
- 标签字号
- 标签颜色
- 数值格式
- Y 轴最大值
- 是否显示坐标轴
- 是否显示网格线

### 动画

第一阶段实现：

- 柱子生长动画
- 淡入动画
- 位移动画
- 数值变化动画
- Stagger 延迟
- 动画持续时间
- 动画开始时间
- 基础缓动

### 预览

必须支持：

- 实时刷新
- 播放
- 暂停
- 重置
- 时间轴
- 当前时间显示
- 动画实时预览

### AE 导出

必须实现：

- 创建 AE Composition
- 创建独立图表元素
- 每个柱子独立预合成
- 标签独立预合成或独立图层
- 数值独立图层/预合成
- 创建 Shape Layer
- 创建 Text Layer
- 创建关键帧
- 根据动画时间生成关键帧
- 根据 Stagger 自动计算不同元素的开始时间
- 自动命名
- 自动整理 AE 工程结构

---

# 4. 明确暂不实现的功能

以下功能第一阶段不要开发具体实现：

- 折线图
- 饼图
- 散点图
- 面积图
- 堆叠柱状图
- 双轴图
- 雷达图
- 动态排名图
- Bar Chart Race
- 多图表组合
- 复杂表达式系统
- 3D 图表
- 复杂粒子动画
- AE 插件
- Premiere 导出
- Lottie 导出
- 云端项目
- 用户账号系统

但是架构必须允许未来添加这些功能。

---

# 5. 产品设计原则

## 5.1 数据、图表、样式、动画必须解耦

禁止把数据直接写死在图表组件中。

必须采用：

```text
Data Model
    ↓
Chart Model
    ↓
Style Model
    ↓
Animation Model
    ↓
Renderer
```

其中 Renderer 至少有：

```text
Preview Renderer
AE Renderer
```

未来可以扩展：

```text
SVG Renderer
Lottie Renderer
Premiere Renderer
```

---

# 6. 数据模型

数据应该使用通用结构，而不是只为柱状图设计。

示例：

```json
{
  "columns": [
    {
      "id": "category",
      "name": "国家",
      "type": "string"
    },
    {
      "id": "value",
      "name": "数值",
      "type": "number"
    }
  ],
  "rows": [
    {
      "category": "中国",
      "value": 18.7
    },
    {
      "category": "美国",
      "value": 28.7
    },
    {
      "category": "日本",
      "value": 4.2
    }
  ]
}
```

必须支持：

- 字符串字段
- 数值字段
- 空值
- 数值格式化
- 数据排序

---

# 7. Chart Model

图表必须拥有独立的数据结构。

示例：

```json
{
  "type": "bar",
  "orientation": "vertical",
  "categoryField": "category",
  "valueField": "value",
  "sort": "none"
}
```

未来可以扩展：

```text
bar
line
pie
scatter
area
stackedBar
```

但第一阶段只实现：

```text
bar
```

---

# 8. 柱状图功能

## 8.1 纵向柱状图

默认形式：

```text
        █
        █
        █
   █    █
   █    █    █
   █    █    █
──────────────────
 A    B    C
```

要求：

- 根据数据自动计算高度
- 支持 Y 轴
- 支持自动最大值
- 支持固定最大值
- 支持零基线
- 支持分类标签
- 支持数值标签

---

# 9. 横向柱状图

支持：

```text
A █████████████
B █████████
C █████
D ███
```

通过：

```json
{
  "orientation": "horizontal"
}
```

控制。

不要复制两套完全独立的图表逻辑。

纵向和横向柱状图应该共享：

```text
Bar Chart Engine
```

只改变坐标计算和布局方向。

---

# 10. 图表样式系统

建立独立 Style Model。

示例：

```json
{
  "background": {
    "color": "#111111"
  },
  "bar": {
    "color": "#4C8DFF",
    "width": 80,
    "gap": 30,
    "radius": 8
  },
  "label": {
    "visible": true,
    "fontFamily": "Arial",
    "fontSize": 32,
    "color": "#FFFFFF"
  },
  "value": {
    "visible": true,
    "fontFamily": "Arial",
    "fontSize": 28,
    "color": "#FFFFFF"
  }
}
```

所有视觉参数都必须可以从 UI 修改。

---

# 11. 图表尺寸

默认：

```text
1920 × 1080
```

但必须预留：

```text
1920 × 1080
1080 × 1920
1080 × 1080
```

等画布比例。

建议内部统一使用：

```text
width
height
fps
duration
```

而不是把尺寸写死。

---

# 12. 动画系统

动画必须独立于图表。

建立 Animation Model。

示例：

```json
{
  "type": "grow",
  "target": "bar",
  "property": "height",
  "from": 0,
  "to": 1,
  "startTime": 0,
  "duration": 1,
  "easing": "easeOut"
}
```

---

# 13. 柱子生长动画

第一阶段最重要的动画。

例如：

```text
0s       0.5s       1s

          █
        █ █
      █ █ █
    █ █ █ █
```

柱子从：

```text
height = 0
```

增长到：

```text
height = actualValue
```

动画参数：

- Start Time
- Duration
- Delay
- Easing

---

# 14. Stagger

必须支持元素依次出现。

例如：

```text
Bar 1: 0.00s
Bar 2: 0.10s
Bar 3: 0.20s
Bar 4: 0.30s
```

使用：

```text
stagger = 0.1
```

自动计算：

```text
startTime = baseStartTime + index × stagger
```

Stagger 不应该写死在柱状图代码中，而应该属于通用 Animation System。

未来其他图表也可以使用。

---

# 15. 淡入动画

支持：

```text
opacity:
0 → 100
```

示例：

```json
{
  "type": "fade",
  "property": "opacity",
  "from": 0,
  "to": 1,
  "duration": 0.5
}
```

---

# 16. 位移动画

支持：

```text
position:
offset → final
```

例如：

```text
Y = +30
↓
Y = 0
```

---

# 17. 数值变化动画

例如：

```text
0
↓
10
↓
20
↓
30
```

最终数值必须与柱子的动画状态同步。

需要考虑：

- 整数
- 小数
- 千分位
- 百分比
- 单位

示例：

```text
1,234
12.5
12.5%
1.23M
```

---

# 18. Easing

第一阶段至少支持：

```text
linear
easeIn
easeOut
easeInOut
```

动画模型使用统一名称。

禁止在 Chart Component 中写死 easing。

---

# 19. 浏览器预览

预览层推荐使用：

**SVG**

而不是 Canvas。

原因：

- 图表元素天然是矢量对象
- 方便元素级控制
- 方便调试
- 与 AE Shape Layer 思维更加接近
- 未来可以扩展 SVG 导出

浏览器中的每一个重要图表元素都应该有稳定 ID。

例如：

```text
bar-001
bar-002
bar-003
label-001
value-001
```

---

# 20. HTML Preview 与 AE Export 的关系

不要采用：

```text
HTML
 ↓
直接转换成 AE
```

而应该采用：

```text
                Chart Model
                     ↓
              Animation Model
                ↙         ↘
               ↓           ↓
       Preview Renderer   AE Renderer
               ↓           ↓
              SVG         AE
```

浏览器和 AE 使用相同的：

- 数据
- 图表参数
- 样式参数
- 动画参数

保证两者逻辑一致。

---

# 21. AE 导出策略

第一阶段不要尝试直接解析或生成原始 `.aep` 二进制格式。

采用：

```text
Web App
   ↓
Project JSON
   ↓
AE JSX Script
   ↓
After Effects
   ↓
AEP
```

由 JSX 脚本：

- 创建 Composition
- 创建图层
- 创建预合成
- 设置属性
- 创建关键帧
- 保存项目

---

# 22. AE 工程结构

最终生成的工程建议：

```text
DataMotion_Project
│
├── 01_MAIN
│   └── COMP_Main
│
├── 02_CHART
│   ├── PRECOMP_Bar_001
│   ├── PRECOMP_Bar_002
│   ├── PRECOMP_Bar_003
│   └── ...
│
├── 03_LABEL
│   ├── PRECOMP_Label_001
│   ├── PRECOMP_Label_002
│   └── ...
│
├── 04_CONTROL
│   └── CTRL_Global
│
└── 05_ASSETS
```

具体实现可以根据 AE 脚本能力调整。

---

# 23. 元素独立性

这是项目的核心要求。

每一根柱子必须能够单独编辑。

例如：

```text
PRECOMP_Bar_001
```

内部至少包含：

```text
Bar Body
Value
Label
```

用户进入 AE 后可以单独：

- 改颜色
- 改位置
- 改尺寸
- 改文字
- 改动画

---

# 24. AE 关键帧

浏览器中的：

```text
startTime
duration
from
to
easing
```

必须转换成 AE 中真实存在的关键帧。

例如：

```text
0s     Scale Y = 0
1s     Scale Y = 100
```

或者根据具体实现使用：

```text
Shape Path
Size
Position
Opacity
```

不要将动画最终实现成视频或 GIF。

**AE 工程必须保留真正的可编辑动画。**

---

# 25. 锚点与柱子生长

柱状图生长时默认从底部向上。

因此柱子的动画实现必须避免：

```text
从中心向上下同时缩放
```

优先考虑：

- 调整 Shape Path
- 或正确设置 Anchor Point 后使用 Scale Y

具体采用哪一种，由 AE Renderer 根据稳定性决定。

但视觉结果必须是：

```text
底部固定
顶部向上增长
```

---

# 26. UI 布局

建议采用三栏结构：

```text
┌─────────────────────────────────────────────┐
│ DataMotion                     Export AE    │
├────────────┬───────────────────┬────────────┤
│            │                   │            │
│ 数据       │                   │ 属性       │
│            │                   │            │
│ 数据表     │     SVG Preview   │ 图表       │
│            │                   │ 样式       │
│            │                   │ 动画       │
│            │                   │            │
├────────────┴───────────────────┴────────────┤
│                 Timeline                     │
└─────────────────────────────────────────────┘
```

---

# 27. 左侧：数据面板

功能：

### 导入

按钮：

```text
Import CSV
Import JSON
```

### 数据表

允许用户直接修改：

```text
分类 | 数值
-----|-----
中国 | 18.7
美国 | 28.7
日本 | 4.2
```

修改后图表立即更新。

---

# 28. 中间：预览区域

必须显示：

- 当前图表
- 动画
- 播放控制
- 时间
- 画布比例

控制：

```text
Play
Pause
Reset
```

支持：

```text
拖动时间轴
```

实时查看任意时间点。

---

# 29. 右侧：属性面板

建议分组：

### Chart

- Orientation
- Width
- Height
- Padding
- Sort

### Bar

- Color
- Width
- Gap
- Radius

### Label

- Visible
- Font
- Size
- Color

### Value

- Visible
- Font
- Size
- Color
- Format

### Animation

- Start
- Duration
- Stagger
- Easing

---

# 30. Timeline

第一阶段不需要做复杂剪辑软件级时间轴。

只需要：

```text
0s        1s        2s        3s

Bar 01
██████████

Bar 02
   ██████████

Bar 03
      ██████████
```

支持：

- 当前时间
- 播放头
- 动画开始时间
- 动画结束时间

---

# 31. Undo / Redo

建议第一阶段加入基础：

```text
Ctrl + Z
Ctrl + Shift + Z
```

但如果开发时间有限，可以在 MVP 第二优先级实现。

项目状态必须集中管理，避免 UI 各组件自己维护一套数据。

---

# 32. 项目状态

建议统一：

```text
Project
├── Document
├── Data
├── Chart
├── Style
├── Animation
├── Timeline
└── Export
```

React UI 只负责修改 Project State。

Renderer 根据 Project State 渲染。

---

# 33. 技术架构建议

推荐：

```text
Frontend
├── React
├── TypeScript
├── Vite
└── Zustand
```

图表：

```text
SVG
```

数据：

```text
CSV Parser
JSON Parser
```

AE：

```text
JSX Generator
```

如果 AI 工具认为使用其他成熟技术更合适，可以调整，但必须保持上述架构原则。

---

# 34. 推荐目录结构

建议：

```text
src/
├── components/
│   ├── DataPanel/
│   ├── Preview/
│   ├── Inspector/
│   └── Timeline/
│
├── models/
│   ├── ProjectModel.ts
│   ├── DataModel.ts
│   ├── ChartModel.ts
│   ├── StyleModel.ts
│   └── AnimationModel.ts
│
├── charts/
│   ├── ChartRenderer.ts
│   └── bar/
│       ├── BarChart.ts
│       ├── BarLayout.ts
│       └── BarRenderer.ts
│
├── animation/
│   ├── AnimationEngine.ts
│   ├── Easing.ts
│   ├── Stagger.ts
│   └── NumberAnimation.ts
│
├── exporters/
│   └── ae/
│       ├── AEExporter.ts
│       ├── JSXGenerator.ts
│       ├── CompositionBuilder.ts
│       ├── ShapeBuilder.ts
│       ├── TextBuilder.ts
│       └── KeyframeBuilder.ts
│
├── importers/
│   ├── CSVImporter.ts
│   └── JSONImporter.ts
│
└── utils/
```

AI 可以根据实际项目调整目录，但不要把所有逻辑放到单个组件中。

---

# 35. 扩展图表类型的设计要求

未来需要支持：

```text
Bar
Line
Pie
Scatter
Area
Stacked Bar
```

因此 Chart Renderer 必须使用统一接口。

例如：

```text
ChartRenderer
├── render()
├── calculateLayout()
├── getElements()
└── getAnimationTargets()
```

第一阶段只实现：

```text
BarChartRenderer
```

其他 Renderer 只保留接口和 TODO。

---

# 36. 统一元素模型

所有图表最终都应该产生类似：

```text
ChartElement
├── id
├── type
├── geometry
├── style
└── animation
```

例如：

```json
{
  "id": "bar-001",
  "type": "bar",
  "geometry": {
    "x": 100,
    "y": 300,
    "width": 80,
    "height": 420
  },
  "style": {
    "fill": "#4C8DFF"
  }
}
```

这样 AE Renderer 可以直接消费这些元素。

---

# 37. 导出数据结构

在真正生成 JSX 前，建议先生成一个完整的中间 JSON：

```json
{
  "version": "0.1",
  "composition": {
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "duration": 5
  },
  "chart": {
    "type": "bar",
    "orientation": "vertical"
  },
  "elements": [
    {
      "id": "bar-001",
      "type": "bar",
      "geometry": {},
      "style": {},
      "animations": []
    }
  ]
}
```

这个 JSON 是整个系统最重要的中间层。

---

# 38. 版本控制

所有项目数据必须包含：

```text
version
```

例如：

```json
{
  "version": "0.1"
}
```

以后可以：

```text
0.1
0.2
1.0
```

避免未来修改数据结构导致旧项目无法打开。

---

# 39. 错误处理

必须考虑：

### 数据错误

例如：

```text
value = abc
```

提示：

> 数值字段包含无法解析的数据。

### 空数据

提示：

> 当前没有可用于生成图表的数据。

### AE 导出失败

不能让网页崩溃。

需要显示：

```text
Export failed
```

并提供错误信息。

---

# 40. 性能要求

MVP 目标：

- 50 个柱子以内流畅预览
- 数据修改后快速刷新
- 动画播放稳定
- 不因为拖动时间轴导致明显卡顿

不需要第一阶段追求：

- 数千柱子
- 超大型数据集
- WebGL

---

# 41. 响应式要求

第一阶段主要面向桌面端。

优先支持：

```text
1920 × 1080
1440 × 900
1366 × 768
```

不需要优先适配手机。

---

# 42. AI 开发原则

AI 编程工具在实现过程中必须遵守：

### 原则 1

不要为了快速完成 MVP 而把所有逻辑写在一个 React Component 中。

### 原则 2

数据模型、图表模型、动画模型必须独立。

### 原则 3

预览 Renderer 和 AE Exporter 必须分离。

### 原则 4

不要把 AE 导出逻辑写进 UI。

### 原则 5

不要把柱状图逻辑设计成无法扩展其他图表。

### 原则 6

第一阶段不要提前实现大量未使用的复杂功能。

### 原则 7

优先跑通完整链路，而不是追求 UI 花哨。

---

# 43. 第一阶段开发顺序

严格按照以下顺序实现。

## Step 1

建立 Project Model。

---

## Step 2

实现 CSV / JSON 数据导入。

---

## Step 3

实现数据表编辑。

---

## Step 4

实现柱状图数据计算。

---

## Step 5

使用 SVG 实现柱状图预览。

---

## Step 6

实现样式面板。

---

## Step 7

实现 Animation Model。

---

## Step 8

实现柱子生长动画。

---

## Step 9

实现 Stagger。

---

## Step 10

实现 Timeline。

---

## Step 11

建立 AE Export JSON。

---

## Step 12

建立 JSX Generator。

---

## Step 13

实现 AE Composition 创建。

---

## Step 14

实现柱子 Shape Layer 创建。

---

## Step 15

实现独立 Precomp。

---

## Step 16

实现 AE Keyframe。

---

## Step 17

实现 Text Layer。

---

## Step 18

完成完整导出流程。

---

# 44. MVP 验收标准

必须使用以下数据进行测试：

```text
分类,数值
中国,18.7
美国,28.7
日本,4.2
德国,4.7
英国,3.7
```

用户执行：

```text
Import CSV
↓
选择柱状图
↓
修改颜色
↓
修改柱宽
↓
修改间距
↓
打开数值标签
↓
设置 Growth Animation
↓
设置 Duration = 1s
↓
设置 Stagger = 0.15s
↓
点击 Play
```

浏览器中应该可以看到：

```text
柱子依次从底部向上生长
```

---

# 45. AE 验收标准

点击：

```text
Export AE
```

应该生成一个可在 After Effects 中打开的工程。

工程至少包含：

```text
Main Composition
Bar 01
Bar 02
Bar 03
Bar 04
Bar 05
Labels
```

每根柱子必须：

- 独立存在
- 可以单独修改
- 有自己的动画
- 动画开始时间符合 Stagger
- 动画持续时间正确

例如：

```text
Bar 01
0.00s → 1.00s

Bar 02
0.15s → 1.15s

Bar 03
0.30s → 1.30s

Bar 04
0.45s → 1.45s

Bar 05
0.60s → 1.60s
```

---

# 46. 第一阶段成功标准

不要以：

> “网页能生成柱状图”

作为 MVP 成功标准。

真正的成功标准是：

> **同一份数据和同一份项目配置，可以在浏览器中预览，并被转换成结构清晰、元素独立、动画使用真实 AE 关键帧的 After Effects 工程。**

也就是：

```text
             同一份 Project Model
                     │
          ┌──────────┴──────────┐
          ↓                     ↓
     SVG Preview            AE Export
          ↓                     ↓
       浏览器动画             AEP
                              ↓
                         AE 可继续编辑
```

---

# 47. 后续版本规划

## V0.1

只做：

**柱状图 + 基础动画 + AE 导出**

---

## V0.2

增加：

- 折线图
- 更多动画
- 更丰富的文本动画
- Style Preset
- Undo / Redo

---

## V0.3

增加：

- 饼图
- 散点图
- 堆叠柱状图
- 多系列数据

---

## V0.4

增加：

- 时间序列
- 数据变化动画
- 动态排序
- Bar Chart Race

---

## V1.0

目标：

> **成为面向视频创作者的数据可视化 AE 动画工具。**

可以进一步增加：

- AE 插件
- AE 内直接导入数据
- 项目模板
- Style Preset
- 动画 Preset
- 更完善的 AE 控制器
- 批量生成
- 多图表组合

---

# 48. 当前开发任务的最重要原则

**现在不要实现“完整的数据可视化软件”。**

当前唯一核心任务：

> **把“柱状图”作为第一种图表，把整个从数据到 AE 的完整链路跑通。**

完整链路：

```text
CSV
 ↓
Data Model
 ↓
Bar Chart Model
 ↓
SVG Preview
 ↓
Style
 ↓
Animation Model
 ↓
Animation Preview
 ↓
Export Model
 ↓
JSX
 ↓
After Effects
 ↓
Composition
 ↓
Independent Precomps
 ↓
Keyframes
```

当这一条链路稳定后，再把：

```text
Line
Pie
Scatter
Area
Stacked Bar
```

逐个接入同一套架构。

**不要为了提前支持其他图表而增加不必要的 UI 和功能。**

当前阶段的任务不是做“大而全”，而是验证：

> **DataMotion 的核心技术路线是否成立。**