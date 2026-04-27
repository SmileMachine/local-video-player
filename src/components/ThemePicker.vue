<template>
  <div class="theme-picker-wrapper">
    <!-- 调色盘按钮 -->
    <button ref="buttonRef" class="theme-button" @click="togglePanel" title="主题风格">
      <i class="fas fa-palette"></i>
    </button>

    <!-- 主题选择面板 -->
    <Teleport to="body">
      <Transition name="theme-panel">
        <div
          v-if="showPanel"
          class="theme-panel"
          :class="{ 'theme-panel-mobile': isMobilePanel }"
          :style="themePanelStyle"
          @click.stop
        >
          <div class="panel-header">
            <span class="panel-title">🎨 主题风格</span>
            <button class="panel-close" @click="showPanel = false">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <!-- 主题网格 -->
          <div class="theme-grid">
            <button
              v-for="(theme, id) in themes"
              :key="id"
              class="theme-card"
              :class="{ active: currentThemeId === id }"
              @click="selectTheme(id)"
            >
              <div class="theme-preview" :style="getPreviewStyle(theme)">
                <span class="theme-emoji">{{ theme.emoji }}</span>
              </div>
              <span class="theme-name">{{ theme.name }}</span>
              <div v-if="currentThemeId === id" class="active-indicator">
                <i class="fas fa-check"></i>
              </div>
            </button>
          </div>

          <!-- Emoji 字体选择 -->
          <div class="emoji-section">
            <span class="section-title">✨ Emoji 字体</span>
            <div class="emoji-options">
              <button
                v-for="font in emojiFonts"
                :key="font.id"
                class="emoji-option"
                :class="{ active: currentEmojiFont === font.value }"
                @click="selectEmojiFont(font.value)"
              >
                <span class="emoji-preview" :style="{ fontFamily: font.value }">😊</span>
                <span class="emoji-name">{{ font.name }}</span>
                <span class="emoji-note">{{ font.note }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- 点击外部关闭 -->
      <div v-if="showPanel" class="backdrop" @click="showPanel = false"></div>
    </Teleport>
  </div>
</template>

<script>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useTheme } from '../composables/useTheme'

const PANEL_WIDTH = 320
const PANEL_GAP = 12

export default {
  name: 'ThemePicker',
  setup() {
    const showPanel = ref(false)
    const buttonRef = ref(null)
    const isMobilePanel = ref(false)
    const themePanelStyle = ref({})
    const {
      themes,
      emojiFonts,
      currentThemeId,
      currentEmojiFont,
      setTheme,
      setEmojiFont
    } = useTheme()

    const updatePanelPosition = () => {
      const button = buttonRef.value
      if (!button) return

      isMobilePanel.value = Boolean(document.querySelector('.app-container.layout-mobile'))

      if (isMobilePanel.value) {
        const sidebar = button.closest('.playlist')
        const sidebarRect = sidebar?.getBoundingClientRect()
        const buttonRect = button.getBoundingClientRect()
        const bounds = sidebarRect || {
          left: 0,
          right: window.innerWidth,
          top: 0,
          bottom: window.innerHeight
        }
        const left = Math.max(PANEL_GAP, bounds.left + PANEL_GAP)
        const right = Math.min(window.innerWidth - PANEL_GAP, bounds.right - PANEL_GAP)
        let top = buttonRect.bottom + PANEL_GAP
        let maxHeight = bounds.bottom - top - PANEL_GAP

        if (maxHeight < 260) {
          top = bounds.top + PANEL_GAP
          maxHeight = bounds.bottom - top - PANEL_GAP
        }

        themePanelStyle.value = {
          left: `${left}px`,
          top: `${top}px`,
          width: `${Math.max(260, right - left)}px`,
          maxHeight: `${Math.max(220, maxHeight)}px`
        }
        return
      }

      const rect = button.getBoundingClientRect()
      const availableRight = window.innerWidth - PANEL_WIDTH - PANEL_GAP
      const left = Math.min(Math.max(rect.left, PANEL_GAP), Math.max(PANEL_GAP, availableRight))
      let top = rect.bottom + PANEL_GAP
      let maxHeight = window.innerHeight - top - PANEL_GAP

      if (maxHeight < 260) {
        top = PANEL_GAP
        maxHeight = window.innerHeight - PANEL_GAP * 2
      }

      themePanelStyle.value = {
        left: `${left}px`,
        top: `${top}px`,
        maxHeight: `${Math.max(220, maxHeight)}px`
      }
    }

    const togglePanel = async () => {
      showPanel.value = !showPanel.value
      if (showPanel.value) {
        await nextTick()
        updatePanelPosition()
      }
    }

    const selectTheme = (id) => {
      setTheme(id)
    }

    const selectEmojiFont = (font) => {
      setEmojiFont(font)
    }

    const getPreviewStyle = (theme) => ({
      background: `linear-gradient(135deg, ${theme.colors.surface} 0%, ${theme.colors.background} 100%)`,
      borderColor: theme.colors.primary
    })

    onMounted(() => {
      window.addEventListener('resize', updatePanelPosition)
      window.addEventListener('orientationchange', updatePanelPosition)
    })

    onUnmounted(() => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('orientationchange', updatePanelPosition)
    })

    return {
      showPanel,
      buttonRef,
      isMobilePanel,
      themePanelStyle,
      themes,
      emojiFonts,
      currentThemeId,
      currentEmojiFont,
      togglePanel,
      selectTheme,
      selectEmojiFont,
      getPreviewStyle
    }
  }
}
</script>

<style scoped>
.theme-picker-wrapper {
  position: relative;
}

.theme-button {
  width: 36px;
  height: 36px;
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.1));
  border: none;
  outline: none;
  color: var(--color-text-muted, rgba(255, 255, 255, 0.7));
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-button:hover {
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.15));
  border-color: var(--color-border, rgba(255, 255, 255, 0.3));
  color: var(--color-text, white);
}

.theme-button:focus {
  outline: none;
  box-shadow: none;
}

.theme-button:focus-visible {
  outline: 2px solid var(--color-primary, #646cff);
  outline-offset: 2px;
}

/* 面板样式 */
.theme-panel {
  position: fixed;
  width: 320px;
  background: var(--color-background, #242424);
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  z-index: 2000;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.theme-panel::-webkit-scrollbar {
  display: none;
}

.theme-panel-mobile {
  max-width: calc(100vw - 24px);
}

.theme-panel-mobile .theme-grid {
  grid-template-columns: repeat(auto-fit, minmax(66px, 1fr));
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text, #fff);
}

.panel-close {
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: var(--color-text-muted, rgba(255, 255, 255, 0.5));
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.panel-close:hover {
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.1));
  color: var(--color-text, #fff);
}

.panel-close:focus {
  outline: none;
}

.panel-close:focus-visible {
  outline: 2px solid var(--color-primary, #646cff);
  outline-offset: 2px;
}

/* 主题网格 */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 16px;
}

.theme-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  background: transparent;
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-card:hover {
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.05));
}

.theme-card.active {
  border-color: var(--color-primary, #646cff);
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.05));
}

.theme-card:focus {
  outline: none;
}

.theme-card:focus-visible {
  outline: 2px solid var(--color-primary, #646cff);
  outline-offset: 2px;
}

.theme-preview {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: 2px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.theme-card:hover .theme-preview {
  transform: scale(1.05);
}

.theme-emoji {
  font-size: 22px;
  font-family: var(--emoji-font, 'Noto Color Emoji');
}

.theme-name {
  font-size: 10px;
  color: var(--color-text-muted, rgba(255, 255, 255, 0.6));
  text-align: center;
  line-height: 1.2;
}

.active-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  background: var(--color-primary, #646cff);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: white;
}

/* Emoji 字体部分 */
.emoji-section {
  padding: 16px;
  border-top: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
}

.section-title {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text, #fff);
  margin-bottom: 12px;
}

.emoji-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.emoji-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.emoji-option:hover {
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.05));
}

.emoji-option.active {
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.08));
  border-color: var(--color-primary, #646cff);
}

.emoji-option:focus {
  outline: none;
}

.emoji-option:focus-visible {
  outline: 2px solid var(--color-primary, #646cff);
  outline-offset: 2px;
}

.emoji-preview {
  font-size: 20px;
}

.emoji-name {
  font-size: 12px;
  color: var(--color-text-muted, rgba(255, 255, 255, 0.7));
  flex: 1;
}

.emoji-note {
  font-size: 10px;
  color: var(--color-text-muted, rgba(255, 255, 255, 0.4));
  opacity: 0.7;
}

/* 背景遮罩 */
.backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1999;
}

/* 动画 */
.theme-panel-enter-active,
.theme-panel-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.theme-panel-enter-from,
.theme-panel-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

@media (max-width: 560px) {
  .theme-grid {
    grid-template-columns: repeat(auto-fit, minmax(66px, 1fr));
  }
}
</style>
