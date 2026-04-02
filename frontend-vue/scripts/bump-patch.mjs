/**
 * 将根目录 package.json 的 semver 第三段（patch）+1，并写入 vscode-extension/package.json 的 version（与根目录保持一致）。
 * 仅在 npm run build 前执行。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const pkgPath = path.join(root, 'package.json')
const extPkgPath = path.join(root, 'vscode-extension', 'package.json')

const raw = fs.readFileSync(pkgPath, 'utf8')
const pkg = JSON.parse(raw)

const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(pkg.version ?? '').trim())
if (!m) {
  console.error(`bump-patch: 无法解析 version: ${pkg.version}`)
  process.exit(1)
}

const patch = Number(m[3]) + 1
pkg.version = `${m[1]}.${m[2]}.${patch}`

fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
console.log(`bump-patch: version -> ${pkg.version}`)

const extRaw = fs.readFileSync(extPkgPath, 'utf8')
const extPkg = JSON.parse(extRaw)
extPkg.version = pkg.version
fs.writeFileSync(extPkgPath, `${JSON.stringify(extPkg, null, 2)}\n`, 'utf8')
console.log(`bump-patch: vscode-extension/package.json version -> ${pkg.version}`)
