import { writeFileSync, mkdirSync } from 'fs'
import { createDefaultProject } from '../src/models/ProjectModel'
import { buildExportProject } from '../src/exporters/ExportModelBuilder'
import { generateJSX } from '../src/exporters/ae/JSXGenerator'

export async function run() {
  const project = createDefaultProject()
  const exportProject = buildExportProject(project)
  const jsx = generateJSX(exportProject)
  const json = JSON.stringify(exportProject, null, 2)

  mkdirSync('examples', { recursive: true })
  writeFileSync('examples/DataMotion_验收示例.jsx', jsx, 'utf-8')
  writeFileSync('examples/DataMotion_验收示例.export.json', json, 'utf-8')

  console.log('示例已生成:')
  console.log('  examples/DataMotion_验收示例.jsx  (' + jsx.length + ' 字符)')
  console.log('  examples/DataMotion_验收示例.export.json  (' + json.length + ' 字符)')
}

await run()
