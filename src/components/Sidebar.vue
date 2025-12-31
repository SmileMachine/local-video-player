<template>
  <div class="playlist" :style="{ width: isCollapsed ? '0px' : sidebarWidth + 'px' }">
    <!-- Toggle Button -->
    <button class="toggle-button" :class="{ 'outside': isCollapsed }" @click="handleToggleClick">
      <i v-if="isCollapsed" class="fas fa-chevron-right"></i>
      <i v-else class="fas fa-chevron-left"></i>
    </button>
    <!-- Playlist Content -->
    <div v-if="!isCollapsed" class="playlist-content">
      <!-- Appbar - 固定顶部 -->
      <div class="appbar">
        <button class="settings-button" @click="$emit('open-settings')" title="设置">
          <i class="fas fa-cog"></i>
        </button>
        <button class="help-button" @click="$emit('open-shortcuts')" title="快捷键">
          <i class="fas fa-question"></i>
        </button>
      </div>
      <!-- Directory Tree Scroll - 滚动区域 -->
      <div class="directory-tree-scroll">
        <!-- Directory Tree - 内容 -->
        <div class="directory-tree">
          <DirectoryItem v-for="item in videos" :path="[item.name]" :item="item" :currentId="currentId"
            :currentPath="currentPath" @select-video="$emit('select-video', $event)" />
        </div>
      </div>
    </div>
  </div>
  <!-- Resizer -->
  <div v-if="!isCollapsed" class="resizer" @mousedown="startResize" @dblclick="resetWidth"></div>
</template>

<script>
import DirectoryItem from './DirectoryItem.vue'
import { useSidebar } from '../composables/useSidebar'
import { onMounted } from 'vue'
export default {
  components: { DirectoryItem },
  props: {
    videos: Array,
    currentId: String,
    currentPath: Array,
  },
  emits: ['select-video', 'toggle', 'resize-start', 'reset-width', 'open-settings', 'open-shortcuts'],
  setup() {
    const {
      sidebarWidth,
      isCollapsed,
      startResize,
      resetWidth,
      handleToggleClick
    } = useSidebar()

    onMounted(() => {
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.shiftKey) {
          handleToggleClick(event)
        }
      })
    })

    return {
      sidebarWidth,
      isCollapsed,
      startResize,
      resetWidth,
      handleToggleClick,
    }
  }
}
</script>

<style>
/* 添加分隔条样式 */
.resizer {
  width: 5px;
  height: 100%;
  background-color: #2d2d2d;
  cursor: col-resize;
  transition: background-color 0.2s;
  position: relative;
  z-index: 10;
}

.resizer:hover,
.resizer:active {
  background-color: #2196f3;
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
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  outline: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 16px;
  z-index: 20;
  padding: 0;
  width: 36px;
  height: 36px;
  border-radius: 4px;
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
  background: rgba(255, 255, 255, 0.2);
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
.help-button {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
  color: rgba(255, 255, 255, 0.7);
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
.help-button:focus {
  outline: none;
  box-shadow: none;
}

.settings-button:hover,
.help-button:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  color: white;
}

/* Appbar - 浮在 content 上方 */
.appbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: rgba(30, 30, 30, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
  background-color: #1e1e1e;
  flex-shrink: 0;
  margin: 0;
  transition: width 0.3s ease-out;
  overflow: visible;
  color: #e0e0e0;
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
  background: rgba(61, 61, 61, 0.8);
  border-radius: 4px;
}

.directory-tree-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(77, 77, 77, 0.9);
}
</style>
