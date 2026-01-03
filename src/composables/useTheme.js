import { ref, watch, onMounted } from 'vue'

// 预设主题
const themes = {
  midnight: {
    name: '午夜深蓝',
    emoji: '🌙',
    colors: {
      primary: '#6366f1',
      primaryHover: '#818cf8',
      background: '#0f172a',
      surface: '#1e293b',
      surfaceHover: '#334155',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
      border: 'rgba(148, 163, 184, 0.1)',
      accent: '#38bdf8',
      scrollbar: 'rgba(100, 116, 139, 0.5)',
      scrollbarHover: 'rgba(100, 116, 139, 0.8)',
    },
    emojiFont: 'Noto Color Emoji'
  },
  forest: {
    name: '森林绿意',
    emoji: '🌲',
    colors: {
      primary: '#22c55e',
      primaryHover: '#4ade80',
      background: '#14201a',
      surface: '#1a2e23',
      surfaceHover: '#234332',
      text: '#ecfdf5',
      textMuted: '#86efac',
      border: 'rgba(134, 239, 172, 0.1)',
      accent: '#a3e635',
      scrollbar: 'rgba(74, 222, 128, 0.3)',
      scrollbarHover: 'rgba(74, 222, 128, 0.6)',
    },
    emojiFont: 'Apple Color Emoji'
  },
  sunset: {
    name: '日落橙红',
    emoji: '🌅',
    colors: {
      primary: '#f97316',
      primaryHover: '#fb923c',
      background: '#1c1412',
      surface: '#2d1f1a',
      surfaceHover: '#3d2a22',
      text: '#fff7ed',
      textMuted: '#fdba74',
      border: 'rgba(253, 186, 116, 0.1)',
      accent: '#fbbf24',
      scrollbar: 'rgba(251, 146, 60, 0.3)',
      scrollbarHover: 'rgba(251, 146, 60, 0.6)',
    },
    emojiFont: 'Segoe UI Emoji'
  },
  lavender: {
    name: '薰衣草紫',
    emoji: '💜',
    colors: {
      primary: '#a855f7',
      primaryHover: '#c084fc',
      background: '#1a1625',
      surface: '#2a2438',
      surfaceHover: '#3d3452',
      text: '#faf5ff',
      textMuted: '#d8b4fe',
      border: 'rgba(216, 180, 254, 0.1)',
      accent: '#f0abfc',
      scrollbar: 'rgba(192, 132, 252, 0.3)',
      scrollbarHover: 'rgba(192, 132, 252, 0.6)',
    },
    emojiFont: 'Noto Color Emoji'
  },
  ocean: {
    name: '深海蓝调',
    emoji: '🌊',
    colors: {
      primary: '#0ea5e9',
      primaryHover: '#38bdf8',
      background: '#0c1929',
      surface: '#132f4c',
      surfaceHover: '#1a4066',
      text: '#e0f2fe',
      textMuted: '#7dd3fc',
      border: 'rgba(125, 211, 252, 0.1)',
      accent: '#22d3ee',
      scrollbar: 'rgba(56, 189, 248, 0.3)',
      scrollbarHover: 'rgba(56, 189, 248, 0.6)',
    },
    emojiFont: 'Apple Color Emoji'
  },
  rose: {
    name: '玫瑰粉红',
    emoji: '🌸',
    colors: {
      primary: '#ec4899',
      primaryHover: '#f472b6',
      background: '#1f1318',
      surface: '#2d1d25',
      surfaceHover: '#3d2833',
      text: '#fdf2f8',
      textMuted: '#f9a8d4',
      border: 'rgba(249, 168, 212, 0.1)',
      accent: '#fb7185',
      scrollbar: 'rgba(244, 114, 182, 0.3)',
      scrollbarHover: 'rgba(244, 114, 182, 0.6)',
    },
    emojiFont: 'Segoe UI Emoji'
  },
  classic: {
    name: '经典深灰',
    emoji: '🎬',
    colors: {
      primary: '#646cff',
      primaryHover: '#747bff',
      background: '#242424',
      surface: '#1e1e1e',
      surfaceHover: '#2d2d2d',
      text: 'rgba(255, 255, 255, 0.87)',
      textMuted: 'rgba(255, 255, 255, 0.6)',
      border: 'rgba(255, 255, 255, 0.08)',
      accent: '#2196f3',
      scrollbar: 'rgba(61, 61, 61, 0.8)',
      scrollbarHover: 'rgba(77, 77, 77, 0.9)',
    },
    emojiFont: 'Noto Color Emoji'
  },
  cyber: {
    name: '赛博朋克',
    emoji: '🤖',
    colors: {
      primary: '#00ff88',
      primaryHover: '#33ff9f',
      background: '#0a0a0f',
      surface: '#12121a',
      surfaceHover: '#1a1a25',
      text: '#e0ffe0',
      textMuted: '#00cc6a',
      border: 'rgba(0, 255, 136, 0.15)',
      accent: '#ff00ff',
      scrollbar: 'rgba(0, 255, 136, 0.3)',
      scrollbarHover: 'rgba(0, 255, 136, 0.6)',
    },
    emojiFont: 'Segoe UI Emoji'
  }
}

// Emoji 字体选项
const emojiFonts = [
  { id: 'system', name: '系统字体', value: 'Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol', note: '自动适配' },
  { id: 'noto', name: 'Noto Color Emoji', value: 'Noto Color Emoji', note: '跨平台' },
  { id: 'twemoji', name: 'Twemoji Mozilla', value: 'Twemoji Mozilla', note: 'Twitter风格' },
]

const STORAGE_KEY = 'video-player-theme'

// 全局状态
const currentThemeId = ref('classic')
const currentEmojiFont = ref('Noto Color Emoji')

export function useTheme() {
  // 应用主题到 CSS 变量
  const applyTheme = (themeId, emojiFont = null) => {
    const theme = themes[themeId]
    if (!theme) return

    const root = document.documentElement
    const colors = theme.colors

    root.style.setProperty('--color-primary', colors.primary)
    root.style.setProperty('--color-primary-hover', colors.primaryHover)
    root.style.setProperty('--color-background', colors.background)
    root.style.setProperty('--color-surface', colors.surface)
    root.style.setProperty('--color-surface-hover', colors.surfaceHover)
    root.style.setProperty('--color-text', colors.text)
    root.style.setProperty('--color-text-muted', colors.textMuted)
    root.style.setProperty('--color-border', colors.border)
    root.style.setProperty('--color-accent', colors.accent)
    root.style.setProperty('--color-scrollbar', colors.scrollbar)
    root.style.setProperty('--color-scrollbar-hover', colors.scrollbarHover)

    // 设置 emoji 字体
    const font = emojiFont || theme.emojiFont
    root.style.setProperty('--emoji-font', font)
  }

  // 设置主题
  const setTheme = (themeId) => {
    if (!themes[themeId]) return
    currentThemeId.value = themeId
    applyTheme(themeId, currentEmojiFont.value)
    saveToStorage()
  }

  // 设置 emoji 字体
  const setEmojiFont = (font) => {
    currentEmojiFont.value = font
    document.documentElement.style.setProperty('--emoji-font', font)
    saveToStorage()
  }

  // 保存到 localStorage
  const saveToStorage = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      themeId: currentThemeId.value,
      emojiFont: currentEmojiFont.value
    }))
  }

  // 从 localStorage 加载
  const loadFromStorage = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const { themeId, emojiFont } = JSON.parse(saved)
        if (themes[themeId]) {
          currentThemeId.value = themeId
        }
        if (emojiFont) {
          currentEmojiFont.value = emojiFont
        }
      }
    } catch (e) {
      console.warn('Failed to load theme from storage:', e)
    }
  }

  // 初始化
  const initTheme = () => {
    loadFromStorage()
    applyTheme(currentThemeId.value, currentEmojiFont.value)
  }

  return {
    themes,
    emojiFonts,
    currentThemeId,
    currentEmojiFont,
    setTheme,
    setEmojiFont,
    initTheme,
    applyTheme
  }
}
