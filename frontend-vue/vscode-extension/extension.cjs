'use strict'

const fs = require('fs')
const path = require('path')
const vscode = require('vscode')

/** 与 run_web.py / 本地预览一致；仅「在终端启动开发服务器」时使用 */
const DEFAULT_PREVIEW_PORT = 4174

/** @type {vscode.WebviewPanel | undefined} */
let editorPanel

/** @type {vscode.WebviewView | undefined} */
let sidebarView

/** @type {vscode.Uri | undefined} */
let extensionUri

function getPreviewPort() {
  const n = Number(
    vscode.workspace.getConfiguration('textureAtlas').get('previewPort'),
  )
  return Number.isFinite(n) && n > 0 && n < 65536 ? n : DEFAULT_PREVIEW_PORT
}

function previewOrigin() {
  return `http://127.0.0.1:${getPreviewPort()}`
}

/**
 * 从扩展内 dist/ 加载 Vite 构建产物，将相对路径转为 webview 可加载的 URI（安装后即可用，不依赖 localhost）。
 * @param {vscode.Webview} webview
 * @param {vscode.Uri} extUri
 */
function buildBundledWebviewHtml(webview, extUri) {
  const distFs = path.join(extUri.fsPath, 'dist')
  const indexPath = path.join(distFs, 'index.html')
  const distUri = vscode.Uri.joinPath(extUri, 'dist')

  if (!fs.existsSync(indexPath)) {
    const csp = ["default-src 'none'", "style-src 'unsafe-inline'", "font-src data:"].join(
      '; ',
    )
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <style>
    body { margin: 0; padding: 20px; font-family: var(--vscode-font-family); font-size: 13px;
      color: var(--vscode-foreground); background: var(--vscode-editor-background); line-height: 1.5; }
    code, pre { font-family: var(--vscode-editor-font-family, monospace); }
  </style>
</head>
<body>
  <p><strong>TextureAtlas</strong>：扩展内未找到内置界面（<code>dist/index.html</code>）。</p>
  <p>请使用包含前端构建产物的安装包重新安装，或在仓库内执行 <code>npm run build</code> 后运行 <code>node scripts/sync-dist-to-extension.mjs</code> 再打 VSIX。</p>
</body>
</html>`
  }

  let html = fs.readFileSync(indexPath, 'utf8')

  const toWebviewUrl = (rel) => {
    const clean = rel.replace(/^\.\//, '')
    const fileUri = vscode.Uri.joinPath(distUri, ...clean.split('/'))
    return webview.asWebviewUri(fileUri).toString()
  }

  html = html.replace(/href="\.\/([^"]+)"/g, (_, p) => `href="${toWebviewUrl(p)}"`)
  html = html.replace(/src="\.\/([^"]+)"/g, (_, p) => `src="${toWebviewUrl(p)}"`)
  html = html.replace(/href='\.\/([^']+)'/g, (_, p) => `href='${toWebviewUrl(p)}'`)
  html = html.replace(/src='\.\/([^']+)'/g, (_, p) => `src='${toWebviewUrl(p)}'`)
  // Vite 会给 script/link 加 crossorigin，会按 CORS 取样式/脚本；Webview 本地资源往往无 ACAO，导致 CSS/JS 加载失败 → 白屏。
  html = html.replace(/\s+crossorigin(?:=["'][^"']*["'])?/gi, '')

  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    // Vue 3 等会在运行时走 new Function()（等价于 eval），无此项则报 EvalError 且界面无法挂载
    `script-src ${webview.cspSource} 'unsafe-eval'`,
    // 列表/画布中本地导入图常用 createObjectURL → blob:，无 blob: 则 img 无法显示
    `img-src ${webview.cspSource} data: https: blob:`,
    `font-src ${webview.cspSource} data:`,
    `connect-src ${webview.cspSource} ws: wss:`,
  ].join('; ')
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, '&quot;')}">`
  const distRootUrl = webview.asWebviewUri(distUri).toString()
  const baseHref = distRootUrl.endsWith('/') ? distRootUrl : `${distRootUrl}/`
  const baseEsc = baseHref.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  const baseTag = `<base href="${baseEsc}">`

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => `${m}\n  ${cspMeta}\n  ${baseTag}`)
  } else {
    html = `<!DOCTYPE html><html><head>${cspMeta}\n${baseTag}</head><body>${html}</body></html>`
  }

  // 供前端区分 VS Code Webview：去掉仿窗口外框，避免与编辑器面板边缘形成「双边框」
  if (/<body[^>]*\bclass\s*=/i.test(html)) {
    html = html.replace(
      /(<body[^>]*\bclass\s*=\s*")([^"]*)(")/i,
      '$1$2 ta-vscode-webview$3',
    )
  } else {
    html = html.replace(/<body/i, '<body class="ta-vscode-webview"')
  }

  return html
}

function refreshAll() {
  if (!extensionUri) return
  if (editorPanel) {
    editorPanel.webview.html = buildBundledWebviewHtml(editorPanel.webview, extensionUri)
  }
  if (sidebarView) {
    sidebarView.webview.html = buildBundledWebviewHtml(sidebarView.webview, extensionUri)
  }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function resolveFrontendVueDir(context) {
  const pathsFile = path.join(context.extensionPath, 'install-paths.json')
  if (fs.existsSync(pathsFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(pathsFile, 'utf8'))
      const p = raw.frontendVue
      if (typeof p === 'string' && fs.existsSync(path.join(p, 'run_web.py'))) {
        return p
      }
    } catch {
      /* fall through */
    }
  }
  const folders = vscode.workspace.workspaceFolders
  if (folders && folders.length > 0) {
    for (const f of folders) {
      const root = f.uri.fsPath
      if (fs.existsSync(path.join(root, 'run_web.py'))) {
        return root
      }
      const nested = path.join(root, 'frontend-vue')
      if (fs.existsSync(path.join(nested, 'run_web.py'))) {
        return nested
      }
    }
  }
  return undefined
}

/**
 * 可选：在终端启动本地 Vite 预览（热更新 / 浏览器调试）；主界面不依赖此项。
 * @param {vscode.ExtensionContext} context
 */
function startPreviewInTerminal(context) {
  const dir = resolveFrontendVueDir(context)
  if (!dir) {
    void vscode.window.showErrorMessage(
      '未找到 frontend-vue（无 install-paths.json 且工作区不含 run_web.py）。开发时可在克隆的仓库内执行: python install.py',
    )
    return
  }
  const term = vscode.window.createTerminal({
    cwd: dir,
    name: 'TextureAtlas dev preview',
  })
  const cmd = process.platform === 'win32' ? 'python run_web.py' : 'python3 run_web.py'
  term.sendText(cmd, true)
  term.show()
  void vscode.window.showInformationMessage(
    `已在终端启动本地预览（${dir}，端口见 run_web.py）。侧栏/编辑器中的界面为扩展内置构建，不依赖该服务。`,
  )
}

function openOrRevealEditorPanel() {
  if (!extensionUri) return undefined
  if (editorPanel) {
    editorPanel.reveal(vscode.ViewColumn.One, true)
    editorPanel.webview.html = buildBundledWebviewHtml(editorPanel.webview, extensionUri)
    return editorPanel
  }
  const distRoot = vscode.Uri.joinPath(extensionUri, 'dist')
  const panel = vscode.window.createWebviewPanel(
    'textureAtlasEditorPanel',
    'TextureAtlas',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [distRoot],
    },
  )
  editorPanel = panel
  panel.onDidDispose(() => {
    editorPanel = undefined
  })
  panel.webview.html = buildBundledWebviewHtml(panel.webview, extensionUri)
  return panel
}

class TextureAtlasWebviewViewProvider {
  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this._context = context
  }

  /**
   * @param {vscode.WebviewView} webviewView
   */
  resolveWebviewView(webviewView) {
    sidebarView = webviewView
    const distRoot = vscode.Uri.joinPath(this._context.extensionUri, 'dist')
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [distRoot],
    }
    webviewView.onDidDispose(() => {
      if (sidebarView === webviewView) {
        sidebarView = undefined
      }
    })
    webviewView.webview.html = buildBundledWebviewHtml(
      webviewView.webview,
      this._context.extensionUri,
    )
  }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  extensionUri = context.extensionUri
  const provider = new TextureAtlasWebviewViewProvider(context)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('textureAtlas.webview', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  )

  // 右侧：priority 越小越靠屏幕右缘；用 0 以尽量排在状态栏最末（最右）
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0)
  status.name = 'TextureAtlas'
  status.text = '$(layout) TextureAtlas'
  status.tooltip =
    '打开 TextureAtlas（界面内置在扩展中，无需本地预览服务）。可选命令：在终端启动开发服务器（热更新）'
  status.color = '#FFCC00'
  status.command = 'textureAtlas.openBuiltIn'
  status.show()
  context.subscriptions.push(status)

  context.subscriptions.push(
    vscode.commands.registerCommand('textureAtlas.openBuiltIn', () => {
      openOrRevealEditorPanel()
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('textureAtlas.openPreview', () => {
      openOrRevealEditorPanel()
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('textureAtlas.startPreview', () => {
      startPreviewInTerminal(context)
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('textureAtlas.refreshWebview', () => {
      refreshAll()
      void vscode.window.showInformationMessage('TextureAtlas 已刷新')
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('textureAtlas.showInActivityBar', () => {
      void vscode.commands.executeCommand('workbench.view.extension.textureAtlasActivity')
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('textureAtlas.showMcpInfo', () => {
      const extDir = context.extensionPath
      const pathsFile = path.join(extDir, 'install-paths.json')
      let msg =
        '尚未运行 install.py 时无 install-paths.json。请在仓库 frontend-vue 下执行: python install.py'
      if (fs.existsSync(pathsFile)) {
        try {
          const raw = JSON.parse(fs.readFileSync(pathsFile, 'utf8'))
          msg = [
            `仓库根: ${raw.repoRoot}`,
            `frontend-vue: ${raw.frontendVue ?? ''}`,
            `MCP server: ${raw.mcpServer}`,
            `run_web.py: ${raw.runWeb ?? ''}`,
            '',
            '侧栏/编辑器 UI 来自扩展内 dist/（内置），不依赖本地 http 预览。',
            `可选本地开发预览端口（run_web.py）：${previewOrigin()}；设置项 textureAtlas.previewPort（默认 ${DEFAULT_PREVIEW_PORT}）。`,
            'Cursor：MCP 名称在 .cursor/mcp.json 中为 TextureAtlas（与 install.py 合并写入）。',
          ].join('\n')
        } catch {
          msg = 'install-paths.json 解析失败'
        }
      }
      void vscode.window.showInformationMessage(msg, { modal: true })
    }),
  )
}

function deactivate() {}

module.exports = { activate, deactivate }
