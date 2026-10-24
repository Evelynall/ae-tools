// ============================================================
// run-csv-tests.mjs — CSV 导入体检自测
// 与 run-tests.mjs 一致：esbuild 打包到内存 + data URL 执行，不写盘
// ============================================================

import { build } from 'esbuild'

const result = await build({
  entryPoints: ['scripts/csv-health-entry.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'error',
})

const code = result.outputFiles[0].text
const dataUrl = 'data:text/javascript;base64,' + Buffer.from(code, 'utf-8').toString('base64')

await import(dataUrl)
