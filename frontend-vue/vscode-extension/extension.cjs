'use strict'

const fs = require('fs')
const http = require('http')
const path = require('path')
const vscode = require('vscode')

/** 与 run_web.py / vite preview 默认一致 */
const PREVIEW_ORIGIN = 'http://127.0.0.1:4173'

/** @type {vscode.WebviewPanel | undefined} */
let editorPanel

/** @type {vscode.WebviewView | undefined} */
let sidebarView

/**
 * 探测本地 Vite preview 是否已启动（避免空白 iframe）
 * @returns {Promise<boolean>}
 */
function probePreview() {
  return new Promise((resolve) => {
    const req = http.get(
      `${PREVIEW_ORIGIN}/`,
      { timeout: 1200 },
      (res) => {
        res.resume()
        resolve(res.statusCode === 200 || res.statusCode === 304 || res.statusCode === 301 || res.statusCode === 302)
      },
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

/**
 * @param {boolean} online
 */
function buildWebviewHtml(online) {
  if (!online) {
    const csp = ["default-src 'none'", "style-src 'unsafe-inline'", "font-src data:"].join('; ')
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <style>
    body {
      margin: 0; padding: 20px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      line-height: 1.5;
    }
    code, pre { font-family: var(--vscode-editor-font-family, monospace); }
    pre { background: var(--vscode-textCodeBlock-background); padding: 10px; border-radius: 4px; }
  </style>
</head>
<body>
  <p><strong>TextureAtlas</strong>：未检测到本地预览（${PREVIEW_ORIGIN}）。</p>
  <p>请在仓库 <code>frontend-vue</code> 目录执行：</p>
  <pre>python run_web.py</pre>
  <p>或 <code>npm run preview</code>，然后点击下方「刷新」或命令面板执行 <strong>TextureAtlas: Refresh</strong>。</p>
</body>
</html>`
  }
  const csp = [
    "default-src 'none'",
    'frame-src http://127.0.0.1:4173 http://localhost:4173',
    "style-src 'unsafe-inline'",
  ].join('; ')
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: var(--vscode-editor-background, #1e1e1e); }
    iframe { display: block; width: 100%; height: 100vh; border: none; }
  </style>
</head>
<body>
  <iframe src="${PREVIEW_ORIGIN}" title="TextureAtlas" allow="clipboard-read; clipboard-write"></iframe>
</body>
</html>`
}

async function applyHtmlToWebview(webview) {
  const online = await probePreview()
  webview.html = buildWebviewHtml(online)
}

async function refreshAll() {
  const online = await probePreview()
  const html = buildWebviewHtml(online)
  if (editorPanel) {
    editorPanel.webview.html = html
  }
  if (sidebarView) {
    sidebarView.webview.html = html
  }
  if (!online) {
    void vscode.window.showWarningMessage(
      'TextureAtlas：未检测到 127.0.0.1:4173，请先在前端目录运行 python run_web.py',
    )
  }
}

function openOrRevealEditorPanel() {
  if (editorPanel) {
    editorPanel.reveal(vscode.ViewColumn.One, true)
    void applyHtmlToWebview(editorPanel.webview)
    return editorPanel
  }
  const panel = vscode.window.createWebviewPanel(
    'textureAtlasEditorPanel',
    'TextureAtlas',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  )
  editorPanel = panel
  panel.onDidDispose(() => {
    editorPanel = undefined
  })
  void applyHtmlToWebview(panel.webview)
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
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    }
    webviewView.onDidDispose(() => {
      if (sidebarView === webviewView) {
        sidebarView = undefined
      }
    })
    void applyHtmlToWebview(webviewView.webview)
  }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const provider = new TextureAtlasWebviewViewProvider(context)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('textureAtlas.webview', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  )

  // 右侧状态栏：与常见「工具型」扩展一致，图标 + 短名称（类似 Cursor 底部 MCP 条目的可读性）
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10000)
  status.name = 'TextureAtlas'
  status.text = '$(grid) TextureAtlas'
  status.tooltip = '在编辑器内打开 TextureAtlas（内置 Webview，非外部浏览器）。需先运行：frontend-vue 下 python run_web.py'
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
    vscode.commands.registerCommand('textureAtlas.refreshWebview', () => {
      void refreshAll()
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
        '尚未运行 install.py 时无 install-paths.json。请在 frontend-vue 执行: python install.py'
      if (fs.existsSync(pathsFile)) {
        try {
          const raw = JSON.parse(fs.readFileSync(pathsFile, 'utf8'))
          msg = [
            `仓库根: ${raw.repoRoot}`,
            `MCP server: ${raw.mcpServer}`,
            `run_web.py: ${raw.runWeb ?? ''}`,
            '',
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
