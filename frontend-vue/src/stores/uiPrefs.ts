import { ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'texture-atlas-ui'

function readStored(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 'light'
    const o = JSON.parse(raw) as { theme?: ThemeMode }
    if (o.theme === 'light' || o.theme === 'dark' || o.theme === 'system') return o.theme
  } catch {
    /* ignore */
  }
  return 'light'
}

function writeStored(theme: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme }))
  } catch {
    /* ignore */
  }
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

export const themeMode = ref<ThemeMode>(readStored())

export function applyThemeFromMode(mode: ThemeMode) {
  const resolved = resolveTheme(mode)
  document.documentElement.setAttribute('data-theme', resolved)
}

export function initTheme() {
  applyThemeFromMode(themeMode.value)

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themeMode.value === 'system') applyThemeFromMode('system')
  })

  watch(themeMode, (m) => {
    writeStored(m)
    applyThemeFromMode(m)
  })
}
