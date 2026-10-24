// ============================================================
// gen-examples.mjs — 用 esbuild 打包并生成示例导出产物
// bundle 走 data URL 执行（避开沙箱写盘限制）；示例文件写 examples/
// ============================================================

import { build } from 'esbuild'

const result = await build({
  entryPoints: ['scripts/gen-examples-entry.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'error',
})

const code = result.outputFiles[0].text
const dataUrl = 'data:text/javascript;base64,' + Buffer.from(code, 'utf-8').toString('base64')

await import(dataUrl)
