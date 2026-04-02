<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { atlasStore } from '../stores/atlasStore'
import { openExportDialog, openImportAtlasDialog, openReverseDialog } from '../atlasDialogsState'
import { themeMode, type ThemeMode } from '../stores/uiPrefs'
import { persistLocale } from '../i18n'
import { APP_VERSION } from '../version'

const { t, locale } = useI18n()

const helpFormatsOpen = ref(false)
const helpGlossaryOpen = ref(false)
const aboutOpen = ref(false)

function setLocale(lang: 'zh' | 'en') {
  locale.value = lang
  persistLocale(lang)
}

function setTheme(mode: ThemeMode) {
  themeMode.value = mode
}

function onNew() {
  const hasWork =
    atlasStore.state.images.length > 0 || atlasStore.state.packSheets.length > 0
  if (hasWork && !confirm(t('menu.newConfirm'))) return
  atlasStore.newProject()
}

watchEffect((onCleanup) => {
  if (!aboutOpen.value) return
  const onEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') aboutOpen.value = false
  }
  window.addEventListener('keydown', onEsc)
  onCleanup(() => window.removeEventListener('keydown', onEsc))
})
</script>

<template>
  <div class="menu-bar">
    <div class="menu-root">
      <span class="menu-label">{{ t('menu.file') }}</span>
      <div class="menu-drop">
        <button type="button" class="menu-item" @click="onNew">{{ t('menu.new') }}</button>
        <button type="button" class="menu-item" @click="openImportAtlasDialog()">
          {{ t('menu.importAtlas') }}
        </button>
        <button type="button" class="menu-item" @click="openExportDialog()">{{ t('menu.exportAtlas') }}</button>
        <button type="button" class="menu-item" @click="openReverseDialog()">{{ t('menu.reverse') }}</button>
        <div class="menu-sep" />
        <button type="button" class="menu-item" disabled>{{ t('menu.exit') }}</button>
      </div>
    </div>
    <div class="menu-root">
      <span class="menu-label">{{ t('menu.languageMenu') }}</span>
      <div class="menu-drop">
        <button type="button" class="menu-item menu-check-row" @click="setLocale('zh')">
          <span class="menu-check" :class="{ on: locale === 'zh' }" aria-hidden="true">✓</span>
          {{ t('menu.langZh') }}
        </button>
        <button type="button" class="menu-item menu-check-row" @click="setLocale('en')">
          <span class="menu-check" :class="{ on: locale === 'en' }" aria-hidden="true">✓</span>
          {{ t('menu.langEn') }}
        </button>
      </div>
    </div>
    <div class="menu-root">
      <span class="menu-label">{{ t('menu.themeMenu') }}</span>
      <div class="menu-drop">
        <button type="button" class="menu-item menu-check-row" @click="setTheme('light')">
          <span class="menu-check" :class="{ on: themeMode === 'light' }" aria-hidden="true">✓</span>
          {{ t('menu.themeLight') }}
        </button>
        <button type="button" class="menu-item menu-check-row" @click="setTheme('dark')">
          <span class="menu-check" :class="{ on: themeMode === 'dark' }" aria-hidden="true">✓</span>
          {{ t('menu.themeDark') }}
        </button>
        <button type="button" class="menu-item menu-check-row" @click="setTheme('system')">
          <span class="menu-check" :class="{ on: themeMode === 'system' }" aria-hidden="true">✓</span>
          {{ t('menu.themeSystem') }}
        </button>
      </div>
    </div>
    <div class="menu-root">
      <span class="menu-label">{{ t('menu.settings') }}</span>
      <div class="menu-drop">
        <span class="menu-item menu-placeholder" role="presentation">{{ t('menu.settingsEmpty') }}</span>
      </div>
    </div>
    <div class="menu-root">
      <span class="menu-label">{{ t('menu.help') }}</span>
      <div class="menu-drop">
        <button type="button" class="menu-item" @click="helpFormatsOpen = true">{{ t('menu.formats') }}</button>
        <button type="button" class="menu-item" @click="helpGlossaryOpen = true">{{ t('menu.glossary') }}</button>
        <button type="button" class="menu-item" @click="aboutOpen = true">{{ t('menu.about') }}</button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="helpFormatsOpen"
        class="help-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-formats-title"
        @click.self="helpFormatsOpen = false"
      >
        <div class="help-dialog">
          <div id="help-formats-title" class="help-dlg-title">{{ t('help.formatsTitle') }}</div>
          <div class="help-dlg-body">
            <section>
              <h4>{{ t('help.fNoCustomFormatTitle') }}</h4>
              <p>{{ t('help.fNoCustomFormatBody') }}</p>
            </section>
            <section>
              <h4>{{ t('help.fImportTitle') }}</h4>
              <p>{{ t('help.fImportBody') }}</p>
            </section>
            <section>
              <h4>{{ t('help.fExportTitle') }}</h4>
              <p>{{ t('help.fExportP1') }}</p>
              <p>{{ t('help.fExportP2') }}</p>
            </section>
            <section>
              <h4>{{ t('help.fReverseTitle') }}</h4>
              <p>{{ t('help.fReverseBody') }}</p>
            </section>
            <table class="help-table" :aria-label="t('help.formatsTitle')">
              <thead>
                <tr>
                  <th>{{ t('help.tableScene') }}</th>
                  <th>{{ t('help.tableApp') }}</th>
                  <th>{{ t('help.tableEquiv') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{{ t('help.trImport') }}</td>
                  <td>{{ t('help.trImportFmt') }}</td>
                  <td>{{ t('help.trImportNote') }}</td>
                </tr>
                <tr>
                  <td>{{ t('help.trExportImg') }}</td>
                  <td>{{ t('help.trExportImgFmt') }}</td>
                  <td>{{ t('help.trExportImgNote') }}</td>
                </tr>
                <tr>
                  <td>{{ t('help.trExportJson') }}</td>
                  <td>{{ t('help.trExportJsonFmt') }}</td>
                  <td>{{ t('help.trExportJsonNote') }}</td>
                </tr>
                <tr>
                  <td>{{ t('help.trRev') }}</td>
                  <td>{{ t('help.trRevFmt') }}</td>
                  <td>{{ t('help.trRevNote') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="help-dlg-actions">
            <button type="button" class="win-btn primary" @click="helpFormatsOpen = false">
              {{ t('help.close') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="helpGlossaryOpen"
        class="help-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-glossary-title"
        @click.self="helpGlossaryOpen = false"
      >
        <div class="help-dialog help-dialog-wide">
          <div id="help-glossary-title" class="help-dlg-title">{{ t('help.glossaryTitle') }}</div>
          <div class="help-dlg-body help-glossary-body">
            <p class="glossary-lead">{{ t('help.gLead') }}</p>
            <dl class="glossary-dl">
              <dt>{{ t('help.gAtlas') }}</dt>
              <dd>{{ t('help.gAtlasBody') }}</dd>
              <dt>{{ t('help.gPixel') }}</dt>
              <dd>{{ t('help.gPixelBody') }}</dd>
              <dt>{{ t('help.gDiscrete') }}</dt>
              <dd>{{ t('help.gDiscreteBody') }}</dd>
              <dt>{{ t('help.gPack') }}</dt>
              <dd>{{ t('help.gPackBody') }}</dd>
              <dt>{{ t('help.gPacked') }}</dt>
              <dd>{{ t('help.gPackedBody') }}</dd>
              <dt>{{ t('help.gUnpack') }}</dt>
              <dd>{{ t('help.gUnpackBody') }}</dd>
            </dl>
            <p class="glossary-flow">{{ t('help.gFlow') }}</p>
          </div>
          <div class="help-dlg-actions">
            <button type="button" class="win-btn primary" @click="helpGlossaryOpen = false">
              {{ t('help.close') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="aboutOpen"
        class="help-overlay about-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-caption"
        @click.self="aboutOpen = false"
      >
        <div class="about-dialog" role="document">
          <div id="about-caption" class="about-caption">{{ t('about.caption') }}</div>
          <div class="about-client">
            <div class="about-icon" aria-hidden="true">▣</div>
            <div class="about-text">
              <div class="about-product">{{ t('app.title') }}</div>
              <div class="about-version">{{ t('about.versionLine', { v: APP_VERSION }) }}</div>
              <p class="about-desc">{{ t('about.description') }}</p>
              <div class="about-legal">{{ t('about.copyright') }}</div>
            </div>
          </div>
          <div class="about-actions">
            <button type="button" class="win-btn primary about-btn-ok" @click="aboutOpen = false">
              {{ t('about.ok') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.menu-bar {
  display: flex;
  align-items: stretch;
  height: 24px;
  background: var(--win-bg);
  border-bottom: 1px solid var(--win-border);
  padding: 0 4px;
  user-select: none;
}
.menu-root {
  position: relative;
  display: flex;
  align-items: center;
}
.menu-label {
  padding: 2px 8px;
  font-size: 12px;
  cursor: default;
  color: var(--win-text);
}
.menu-root:hover .menu-label {
  background: var(--win-menu-hover);
  border: 1px solid #6ab5e7;
  border-radius: 2px;
  padding: 1px 7px;
}
.menu-drop {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 180px;
  background: var(--win-menu-bg);
  border: 1px solid var(--win-border-dark);
  box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 200;
  padding: 2px 0;
  color: var(--win-text);
}
.menu-root:hover .menu-drop {
  display: block;
}
.menu-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 4px 24px 4px 12px;
  border: none;
  background: transparent;
  font: inherit;
  cursor: pointer;
  color: inherit;
}
.menu-item:hover:not(:disabled) {
  background: var(--win-menu-hover);
}
.menu-item:disabled,
.menu-item.disabled {
  color: var(--win-text-dim);
  cursor: default;
}
.menu-sep {
  height: 1px;
  background: var(--win-border);
  margin: 4px 0;
}

.menu-placeholder {
  cursor: default;
  color: var(--win-text-dim);
  pointer-events: none;
  font-style: italic;
}
.menu-check-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 8px;
}
.menu-check {
  display: inline-block;
  width: 12px;
  color: transparent;
  font-size: 11px;
}
.menu-check.on {
  color: var(--win-accent);
  font-weight: 700;
}

.help-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.help-dialog.help-dialog-wide {
  max-width: 560px;
}
.help-dialog {
  max-width: 520px;
  max-height: min(90vh, 640px);
  overflow: auto;
  background: var(--win-dialog-bg);
  border: 1px solid var(--win-border-dark);
  box-shadow: 4px 4px 16px rgba(0, 0, 0, 0.25);
  padding: 12px 14px 10px;
  color: var(--win-text);
}
.help-dlg-title {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--win-border);
}
.help-dlg-body {
  font-size: 12px;
  line-height: 1.45;
  color: var(--win-text);
}
.help-dlg-body section {
  margin-bottom: 12px;
}
.help-dlg-body h4 {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
}
.help-dlg-body p {
  margin: 0 0 6px;
}
.help-dlg-body code {
  font-size: 11px;
  background: var(--win-code-bg);
  padding: 0 4px;
  border: 1px solid var(--win-border);
}
.help-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  margin-top: 4px;
}
.help-table th,
.help-table td {
  border: 1px solid var(--win-border);
  padding: 5px 8px;
  text-align: left;
  vertical-align: top;
}
.help-table th {
  background: var(--win-panel);
  font-weight: 600;
}
.help-dlg-actions {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--win-border);
  text-align: right;
}
button.win-btn.primary {
  border-color: #005a9e;
  background: linear-gradient(180deg, #42a5f5 0%, #0078d4 100%);
  color: #fff;
  font-weight: 600;
}
button.win-btn.primary:hover {
  background: linear-gradient(180deg, #5cb0f6 0%, #1084e0 100%);
}

.glossary-lead {
  margin: 0 0 10px;
  color: var(--win-text-muted);
}
.glossary-dl {
  margin: 0;
}
.glossary-dl dt {
  font-weight: 700;
  margin-top: 10px;
  color: var(--win-text);
}
.glossary-dl dt:first-child {
  margin-top: 0;
}
.glossary-dl dd {
  margin: 4px 0 0;
  padding-left: 0;
}
.glossary-flow {
  margin: 12px 0 0;
  padding: 8px 10px;
  background: var(--win-code-bg);
  border: 1px solid var(--win-border);
  font-size: 11px;
  line-height: 1.45;
}

/* 标准关于对话框（类 Windows：标题条 + 图标区 + 正文 + 确定） */
.about-backdrop {
  z-index: 3100;
}
.about-dialog {
  width: 420px;
  max-width: min(96vw, 480px);
  background: var(--win-dialog-bg);
  border: 1px solid var(--win-border-dark);
  box-shadow: 4px 4px 16px rgba(0, 0, 0, 0.3);
  color: var(--win-text);
  overflow: hidden;
}
.about-caption {
  padding: 6px 10px 7px;
  font-size: 12px;
  font-weight: 700;
  background: linear-gradient(180deg, var(--win-inset-bg-soft) 0%, var(--win-panel) 100%);
  border-bottom: 1px solid var(--win-border);
  color: var(--win-title);
  user-select: none;
}
.about-client {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 16px 14px 14px;
}
.about-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  line-height: 1;
  color: var(--win-accent);
}
.about-text {
  min-width: 0;
  flex: 1;
}
.about-product {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 6px;
  line-height: 1.25;
}
.about-version {
  font-size: 12px;
  color: var(--win-text-muted);
  margin-bottom: 10px;
}
.about-desc {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--win-text);
}
.about-legal {
  font-size: 11px;
  line-height: 1.35;
  color: var(--win-text-muted);
}
.about-actions {
  padding: 10px 12px 12px;
  border-top: 1px solid var(--win-border);
  background: var(--win-panel);
  text-align: right;
}
.about-btn-ok {
  min-width: 88px;
  height: 24px;
  padding: 0 16px;
  font-size: 12px;
}
</style>
