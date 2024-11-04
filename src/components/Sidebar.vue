<template>
  <div class="playlist" :style="{ width: isCollapsed ? '0px' : sidebarWidth + 'px' }">
    <!-- Toggle Button -->
    <button class="toggle-button" :class="{ 'outside': isCollapsed }" @click="handleToggleClick">
      <span v-if="isCollapsed"> > </span>
      <span v-else>
        < </span>
    </button>
    <!-- Playlist Content -->
    <div class="playlist-content">
      <!-- Directory Tree -->
      <div class="directory-tree">
        <DirectoryItem v-for="item in videos" :path="[item.name]" :item="item" :currentId="currentId"
          :currentPath="currentPath" @select-video="$emit('select-video', $event)" />
      </div>
    </div>
  </div>
  <!-- Resizer -->
  <div v-if="!isCollapsed" class="resizer" @mousedown="startResize" @dblclick="resetWidth"></div>
</template>

<script>
import DirectoryItem from './DirectoryItem.vue'
import { useSidebar } from '../composables/useSidebar'
import { ref, onMounted, computed, onUnmounted } from 'vue'
export default {
  components: { DirectoryItem },
  props: {
    videos: Array,
    currentId: String,
    currentPath: Array,
  },
  emits: ['select-video', 'toggle', 'resize-start', 'reset-width'],
  setup(props) {
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
  color: white;
  cursor: pointer;
  font-size: 16px;
  z-index: 1;
  padding: 5px 10px;
  border-radius: 4px;
  transition: padding 0.5s ease-in-out, opacity 1s ease-in, transform 1s ease-out;
  backdrop-filter: blur(2px);
}

.toggle-button:focus {
  outline: none;
  box-shadow: none;
}

.toggle-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transition: padding 0.5s ease-in-out, opacity 0.1s ease-out, transform 0.3s ease-out;
}

.toggle-button.outside {
  right: -65px;
  opacity: 0;
  /* 当按钮在外部时，添加一个小小的位移效果 */
  transform: translateX(-10px);
  padding: 20px;
  font-size: 20px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
}


/* 当鼠标靠近时显示按钮 */
.toggle-button.outside:hover {
  opacity: 1;
  transform: translateX(0);
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

/* 添加内容容器来控制滚动 */
.playlist-content {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
}
</style>
