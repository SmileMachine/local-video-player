<template>
  <button v-if="showMobileOpenButton" class="mobile-open-button" @click="handleToggleClick" title="打开列表">
    <i class="fas fa-chevron-right"></i>
  </button>
  <div class="playlist" :class="playlistClasses" :style="playlistStyle">
    <!-- Toggle Button -->
    <button v-if="showPanelToggleButton" class="toggle-button" :class="{ 'outside': isCollapsed }" @click="handleToggleClick">
      <i v-if="isCollapsed" class="fas fa-chevron-right"></i>
      <i v-else class="fas fa-chevron-left"></i>
    </button>
    <!-- Playlist Content -->
    <div v-if="isContentVisible" class="playlist-content">
      <!-- Appbar - 固定顶部 -->
      <div class="appbar">
        <button class="settings-button" @click="$emit('open-settings')" title="设置">
          <i class="fas fa-cog"></i>
        </button>
        <ThemePicker />
        <button class="help-button" @click="$emit('open-shortcuts')" title="快捷键">
          <i class="fas fa-question"></i>
        </button>
        <div class="sort-controls">
          <select class="sort-select" :value="sortBy" @change="$emit('change-sort-by', $event.target.value)" title="排序依据">
            <option value="name">名称</option>
            <option value="duration">时长</option>
            <option value="size">大小</option>
            <option value="mtime">修改时间</option>
          </select>
          <button class="sort-order-button" @click="$emit('toggle-sort-order')" :title="sortOrder === 'asc' ? '升序' : '降序'">
            {{ sortOrder === 'asc' ? '↑' : '↓' }}
          </button>
        </div>
      </div>
      <!-- Directory Tree Scroll - 滚动区域 -->
      <div class="directory-tree-scroll">
        <!-- Directory Tree - 内容 -->
        <div class="directory-tree">
          <DirectoryItem v-for="item in videos" :key="item.id || item.name" :path="[item.name]" :item="item" :currentId="currentId"
            :currentPath="currentPath" :is-mobile-layout="isMobileLayout"
            @select-video="handleSelectVideo" @show-detail="showMobileDetail" />
        </div>
      </div>
    </div>
  </div>
  <Teleport to="body">
    <ItemTooltip
      v-if="mobileDetailItem && isMobileLayout"
      :item="mobileDetailItem"
      :style="mobileDetailStyle"
      variant="sheet"
      @close="closeMobileDetail"
    />
  </Teleport>
  <div v-if="showMobileScrim" class="mobile-sidebar-scrim" @click="handleToggleClick"></div>
  <!-- Resizer -->
  <div v-if="showResizer" class="resizer" @mousedown="startResize" @dblclick="resetWidth"></div>
</template>

<script>
import DirectoryItem from './DirectoryItem.vue'
import ItemTooltip from './ItemTooltip.vue'
import ThemePicker from './ThemePicker.vue'
import { useSidebar } from '../composables/useSidebar'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
export default {
  components: { DirectoryItem, ItemTooltip, ThemePicker },
  props: {
    videos: Array,
    currentId: String,
    currentPath: Array,
    sortBy: {
      type: String,
      default: 'name'
    },
    sortOrder: {
      type: String,
      default: 'asc'
    },
    isMobileLayout: {
      type: Boolean,
      default: false
    },
    isMobilePortrait: {
      type: Boolean,
      default: false
    },
    isMobileLandscape: {
      type: Boolean,
      default: false
    },
    isMobileFullscreenSidebar: {
      type: Boolean,
      default: false
    }
  },
  emits: ['select-video', 'toggle', 'resize-start', 'reset-width', 'open-settings', 'open-shortcuts', 'change-sort-by', 'toggle-sort-order'],
  setup(props, { emit }) {
    const {
      sidebarWidth,
      isCollapsed,
      startResize,
      resetWidth,
      handleToggleClick
    } = useSidebar()
    const mobileDetailItem = ref(null)
    const mobileDetailStyle = ref({})

    const mobileSidebarWidth = computed(() => {
      if (props.isMobileFullscreenSidebar) {
        return '100dvw'
      }

      if (props.isMobileLayout) {
        return 'min(360px, 82vw)'
      }

      return ''
    })

    const playlistWidth = computed(() => {
      if (props.isMobileLayout) {
        return mobileSidebarWidth.value
      }

      if (isCollapsed.value) {
        return '0px'
      }

      return `${sidebarWidth.value}px`
    })

    const playlistStyle = computed(() => ({
      width: playlistWidth.value,
      '--mobile-sidebar-width': mobileSidebarWidth.value || playlistWidth.value,
      '--mobile-sidebar-safe-left': props.isMobileLayout ? 'env(safe-area-inset-left)' : '0px'
    }))

    const playlistClasses = computed(() => ({
      'is-collapsed': isCollapsed.value,
      'is-mobile': props.isMobileLayout,
      'is-mobile-portrait': props.isMobilePortrait,
      'is-mobile-landscape': props.isMobileLandscape,
      'is-mobile-fullscreen': props.isMobileFullscreenSidebar
    }))

    const isContentVisible = computed(() => !isCollapsed.value)
    const showResizer = computed(() => !props.isMobileLayout && !isCollapsed.value)
    const showMobileScrim = computed(() => props.isMobileLayout && !props.isMobileFullscreenSidebar && !isCollapsed.value)
    const showMobileOpenButton = computed(() => props.isMobileLayout && isCollapsed.value)
    const showPanelToggleButton = computed(() => !props.isMobileLayout || !isCollapsed.value)

    const handleSelectVideo = (video) => {
      closeMobileDetail()
      emit('select-video', video)

      if (props.isMobileLayout) {
        isCollapsed.value = true
      }
    }

    const updateMobileDetailStyle = () => {
      const sidebar = document.querySelector('.playlist.is-mobile')
      const rect = sidebar?.getBoundingClientRect()
      if (!rect) {
        mobileDetailStyle.value = {}
        return
      }

      const left = rect.left + 12
      const width = Math.max(260, rect.width - 24)
      const maxHeight = Math.max(220, rect.height * 0.58)

      mobileDetailStyle.value = {
        left: `${left}px`,
        bottom: `${Math.max(12, window.innerHeight - rect.bottom + 12)}px`,
        width: `${width}px`,
        maxHeight: `${maxHeight}px`
      }
    }

    const showMobileDetail = async ({ item }) => {
      if (!props.isMobileLayout) {
        return
      }

      mobileDetailItem.value = item
      await nextTick()
      updateMobileDetailStyle()
    }

    const closeMobileDetail = () => {
      mobileDetailItem.value = null
    }

    const handleShortcut = (event) => {
      if (event.key === 'Enter' && event.shiftKey) {
        handleToggleClick(event)
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', handleShortcut)
      window.addEventListener('resize', updateMobileDetailStyle)
      window.addEventListener('orientationchange', updateMobileDetailStyle)
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', handleShortcut)
      window.removeEventListener('resize', updateMobileDetailStyle)
      window.removeEventListener('orientationchange', updateMobileDetailStyle)
    })

    return {
      sidebarWidth,
      isCollapsed,
      playlistWidth,
      playlistStyle,
      playlistClasses,
      isContentVisible,
      showResizer,
      showMobileScrim,
      showMobileOpenButton,
      showPanelToggleButton,
      mobileDetailItem,
      mobileDetailStyle,
      startResize,
      resetWidth,
      handleToggleClick,
      handleSelectVideo,
      showMobileDetail,
      closeMobileDetail,
    }
  }
}
</script>

<style>
/* 添加分隔条样式 */
.resizer {
  width: 5px;
  height: 100%;
  background-color: var(--color-surface-hover, #2d2d2d);
  cursor: col-resize;
  transition: background-color 0.2s;
  position: relative;
  z-index: 10;
}

.resizer:hover,
.resizer:active {
  background-color: var(--color-accent, #2196f3);
}

/* 拖动时禁止选择文本 */
body.resizing {
  user-select: none;
  cursor: col-resize;
}

/* 拖动时的遮罩层 */
body.resizing::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  /* 确保遮罩层不会影响鼠标事件 */
  pointer-events: none;
}

/* toggle */
.toggle-button {
  position: absolute;
  top: 12px;
  right: 10px;
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.1));
  border: none;
  outline: none;
  color: var(--color-text-muted, rgba(255, 255, 255, 0.7));
  cursor: pointer;
  font-size: 16px;
  z-index: 20;
  padding: 0;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  transition: all 0.6s ease-in-out, background 0s;
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-button:focus {
  outline: none;
  box-shadow: none;
}

.toggle-button:hover {
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.2));
  color: var(--color-text, white);
}

.toggle-button.outside {
  opacity: 0;
  padding: 20px;
  right: -75px;
  width: 60px;
  height: 60px;
  font-size: 20px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.15);
  transition:
    width 0.4s ease-out,
    height 0.4s ease-out,
    right 0.4s ease-out,
    opacity 0.8s ease-in-out 0.4s;
}

/* 当鼠标靠近时显示按钮 */
.toggle-button.outside:hover {
  opacity: 1;
  transform: translateX(0);
  transition: opacity 0s;
}

/* Appbar buttons */
.settings-button,
.help-button,
.sort-order-button {
  width: 36px;
  height: 36px;
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.1));
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

.settings-button:focus,
.help-button:focus,
.sort-order-button:focus {
  outline: none;
  box-shadow: none;
}

.settings-button:hover,
.help-button:hover,
.sort-order-button:hover {
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.15));
  border-color: var(--color-border, rgba(255, 255, 255, 0.3));
  color: var(--color-text, white);
}

.sort-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  /* margin right is for the floating toggle button */
  margin-right: 36px;
}

.sort-select {
  height: 36px;
  border-radius: 6px;
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.2));
  background: var(--color-surface-hover, rgba(255, 255, 255, 0.1));
  color: var(--color-text, #fff);
  padding: 0 10px;
  font-size: 0.85rem;
  cursor: pointer;
}

.sort-select:focus {
  outline: none;
  border-color: var(--color-accent, #2196f3);
}

.sort-select option {
  background: var(--color-background, #242424);
  color: var(--color-text, #fff);
}

/* Appbar - 浮在 content 上方 */
.appbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: color-mix(in srgb, var(--color-background, #242424) 70%, transparent);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Directory Tree Scroll - 滚动区域 */
.directory-tree-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Directory Tree - 内容区域 */
.directory-tree {
  padding: 16px;
  padding-top: 70px; /* 为 appbar 留出空间 */
}

/* 播放列表样式 */
.playlist {
  position: relative;
  height: 100%;
  background-color: var(--color-background, #242424);
  flex-shrink: 0;
  margin: 0;
  transition: width 0.3s ease-out;
  overflow: visible;
  color: var(--color-text, #e0e0e0);
}

.playlist.is-mobile {
  position: fixed;
  top: 0;
  left: calc(-1 * var(--mobile-sidebar-safe-left));
  bottom: 0;
  z-index: 40;
  width: calc(var(--mobile-sidebar-width) + var(--mobile-sidebar-safe-left));
  height: 100dvh;
  max-width: none;
  margin: 0;
  padding: 0 0 0 var(--mobile-sidebar-safe-left);
  border-radius: 0;
  box-shadow: 18px 0 48px rgba(0, 0, 0, 0.34);
  overflow: hidden;
  transition: transform 0.24s ease, box-shadow 0.24s ease;
  transform: translateX(0);
}

.playlist.is-mobile.is-collapsed {
  box-shadow: none;
  pointer-events: none;
  transform: translateX(calc(-1 * (var(--mobile-sidebar-width) + var(--mobile-sidebar-safe-left))));
}

.playlist.is-mobile .toggle-button,
.playlist.is-mobile .playlist-content {
  pointer-events: auto;
}

.playlist.is-mobile .toggle-button {
  top: calc(12px + env(safe-area-inset-top));
  width: 36px;
  height: 36px;
  font-size: 16px;
}

.playlist.is-mobile .toggle-button.outside {
  display: none;
}

.playlist.is-mobile-portrait {
  border-right: none;
}

.playlist.is-mobile-landscape {
  background: color-mix(in srgb, var(--color-background, #242424) 92%, transparent);
  border-right: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
}

.playlist.is-mobile .appbar {
  padding-top: calc(12px + env(safe-area-inset-top));
}

.playlist.is-mobile .directory-tree {
  padding: 14px;
  padding-top: calc(72px + env(safe-area-inset-top));
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
}

.mobile-sidebar-scrim {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(0, 0, 0, 0.34);
}

.mobile-open-button {
  position: fixed;
  top: calc(12px + env(safe-area-inset-top));
  left: calc(12px + env(safe-area-inset-left));
  z-index: 45;
  width: 48px;
  height: 48px;
  padding: 0;
  border: none;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-background, #242424) 78%, transparent);
  color: var(--color-text, #fff);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Playlist content */
.playlist-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative; /* 创建层叠上下文 */
}

/* 自定义滚动条样式 */
.directory-tree-scroll::-webkit-scrollbar {
  width: 8px;
}

.directory-tree-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.directory-tree-scroll::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar, rgba(61, 61, 61, 0.8));
  border-radius: 4px;
}

.directory-tree-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--color-scrollbar-hover, rgba(77, 77, 77, 0.9));
}
</style>
