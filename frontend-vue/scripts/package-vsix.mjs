/**
 * 将 vscode-extension 打为 .vsix，输出到 frontend-vue/vsix/<name>-<version>.vsix（与 vscode-extension/package.json 一致）。
 * 注意：不能放在 dist/ —— Vite 构建会清空 dist，会删掉 .vsix。
 * 由 npm run package:vsix、build.py、install.py 共用。
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const extDir = path.join(root, 'vscode-extension')
const pkgPath = path.join(extDir, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const outDir = path.join(root, 'vsix')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, `${pkg.name}-${pkg.version}.vsix`)
const outAbs = path.resolve(outFile)

// Windows 上对 npx.cmd 使用 execFileSync 可能 EINVAL；单行 + shell 在 win/Unix 均可用
const cmd = [
  'npx',
  '--yes',
  '@vscode/vsce@latest',
  'package',
  '--allow-missing-repository',
  '--out',
  JSON.stringify(outAbs),
].join(' ')

try {
  execSync(cmd, {
    cwd: extDir,
    stdio: 'inherit',
    shell: true,
    windowsHide: true,
  })
} catch (e) {
  const code =
    e && typeof e === 'object' && 'status' in e && typeof e.status === 'number'
      ? e.status
      : 1
  process.exit(code)
}
console.log(`package-vsix: ${outAbs}`)
