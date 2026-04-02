import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // Electron file:// 加载 dist 时需相对资源路径
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
