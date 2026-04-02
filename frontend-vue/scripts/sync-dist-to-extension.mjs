/**
 * 将 Vite 构建产物 dist/ 复制到 vscode-extension/dist/，供扩展内置 Webview 使用（安装后即可运行，不依赖 localhost）。
 * 由 package-vsix、install.py（复制扩展前）调用。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const src = path.join(root, 'dist')
const dst = path.join(root, 'vscode-extension', 'dist')

if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error(
    'sync-dist-to-extension: 未找到 dist/index.html。请先执行: npm run build 或 npm run test',
  )
  process.exit(1)
}

fs.rmSync(dst, { recursive: true, force: true })
fs.cpSync(src, dst, { recursive: true })
console.log(`sync-dist-to-extension: ${src} -> ${dst}`)
