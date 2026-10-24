// ============================================================
// run-tests.mjs — 用 esbuild 打包并执行核心链路自测
// esbuild 输出到内存 + data URL 直接执行，全程不写盘（避开沙箱限制）
// ============================================================

import { build } from 'esbuild'

const result = await build({
  entryPoints: ['test/run.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'error',
})

const code = result.outputFiles[0].text
const dataUrl = 'data:text/javascript;base64,' + Buffer.from(code, 'utf-8').toString('base64')

// 直接执行打包后的测试
await import(dataUrl)
