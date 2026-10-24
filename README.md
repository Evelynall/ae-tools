# ae-tools

自己做着用的 After Effects 辅助工具集合。

| 工具 | 说明 | 形态 |
|------|------|------|
| **DataMotion** | 数据图表动画与 AE 工程生成工具，导出 AE 可直接运行的 JSX | 网页应用（React + TS + Vite） |
| **快速矩形** | AE 停靠面板，一个图层的矩形尺寸 / 圆角 / 填充 / 描边全部在一屏内拖 | ExtendScript 面板（`.jsx`） |

在线使用 DataMotion：**https://www.evelynal.top/ae-tools/**
（`https://evelynall.github.io/ae-tools/` 会跳转到这里）

---

## DataMotion

在浏览器里导入 CSV / JSON 数据，配好柱状图、折线图、饼图与入场动画，一键导出 **AE 可执行的 JSX 脚本**（或工程 JSON），在 After Effects 里运行即生成带动画的图表图层。

源码在 `AE快速图表工具/`。

```bash
cd AE快速图表工具
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # 产物在 dist/
```

Windows 上也可以直接双击 `AE快速图表工具/start.bat`，会自动找 Node 并起开发服务器。

功能概览：

- 数据导入：CSV（含健康检查与告警）/ JSON / 内置模板
- 图表类型：柱状、折线、饼图，支持颜色渐变
- 动画：缓动曲线、错峰入场（stagger）、时间轴预览
- 导出：AE JSX 生成器 + 数值表达式，导出即可在 AE 里跑

推送到 `main` 后 GitHub Actions 会自动构建并部署到 Pages（见 `.github/workflows/deploy-pages.yml`）。

## 快速矩形（QuickRect）

AE 原生改矩形尺寸要展开三层、X/Y 分两次输；这个面板把矩形的宽 / 高 / 偏移 / 圆角，以及填充、描边的颜色与透明度，全部收进**效果控件面板**一屏内操作，滑块直接拖。

源码：`panel/QuickRectPanel.jsx`（自包含，不依赖外部文件）。

### 安装

把 `panel/QuickRectPanel.jsx` 复制到：

```
C:\Program Files\Adobe\Adobe After Effects <版本>\Support Files\Scripts\ScriptUI Panels\
```

重启 AE，在「窗口」菜单底部点「快速矩形」。

不想常驻：AE 里「文件 → 脚本 → 运行脚本文件」直接选这个 `.jsx`，会以浮动面板打开（仅当次会话有效）。

### 限制

- 渐变填充 / 描边的颜色无法绑定效果控件（AE 限制），需在时间轴里点「编辑渐变」调整；纯色可以实时调。
- 生成后不要在效果面板里重命名控件，否则表达式会断。
- 文件必须保持 **UTF-8 with BOM** 编码，否则中文乱码。

实现细节、踩坑记录与版本规划见 [`PLAN.md`](PLAN.md)。

---

## 说明

仓库不上传 `node_modules`、构建产物、本地旧版本快照与助手工作目录，规则见 `.gitignore`。
