<template>
  <div class="app-container">
    <!-- Playlist -->
    <div class="playlist" :style="{ width: isSidebarCollapsed ? '0px' : sidebarWidth + 'px' }">
      <!-- Toggle Button -->
      <button class="toggle-button" :class="{ 'outside': isSidebarCollapsed }" @click="handleToggleClick">
        <span v-if="isSidebarCollapsed"> > </span>
        <span v-else> < </span>
      </button>
      <!-- Playlist Content -->
      <div class="playlist-content" :style="{ padding: isSidebarCollapsed ? '0px' : '20px' }">
        <!-- Directory Tree -->
        <div class="directory-tree">
          <DirectoryItem v-for="item in videos" :key="item.id" :item="item" :currentPath="currentVideoPath"
            @select-video="selectVideo" />
        </div>
      </div>
    </div>
    <!-- Resizer -->
    <div v-if="!isSidebarCollapsed" class="resizer" @mousedown="startResize" @dblclick="resetWidth"></div>
    <!-- Video Player -->
    <div class="video-player">
      <video id="video-player" ref="playerRef" :src="currentVideoUrl" playsinline>
        <source :src="currentVideoUrl" type="video/mp4" />
      </video>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import Plyr from 'plyr'
import DirectoryItem from './components/DirectoryItem.vue'

export default {
  name: 'App',
  components: {
    DirectoryItem
  },
  setup() {
    const playerRef = ref(null)
    let player = null

    const videos = ref([])
    const currentVideoPath = ref('')

    // Calculate current video URL
    const currentVideoUrl = computed(() => {
      if (!currentVideoPath.value) return ''
      return `/video?id=${encodeURIComponent(currentVideoPath.value)}`
    })

    // Fetch videos from server
    const fetchVideos = async () => {
      try {
        const response = await fetch('/api/videos')
        if (!response.ok) throw new Error('Failed to fetch videos')
        videos.value = await response.json()
      } catch (error) {
        console.error('Error fetching videos:', error)
        videos.value = []
      }
    }

    onMounted(async () => {
      await fetchVideos()
      player = new Plyr('#video-player', {
        controls: [
          'play',
          'progress',
          'current-time',
          'duration',
          'mute',
          'volume',
          'fullscreen'
        ],
        keyboard: { global: true },
        seekTime: 5
      })
    })

    const selectVideo = (path) => {
      currentVideoPath.value = path
      if (player) {
        setTimeout(() => player.play(), 100)
      }
    }

    const DEFAULT_WIDTH = 250
    const MIN_WIDTH = 150
    const MAX_WIDTH = 600

    const sidebarWidth = ref(parseInt(localStorage.getItem('sidebarWidth')) || DEFAULT_WIDTH)
    let isResizing = false

    const startResize = (e) => {
      isResizing = true
      document.addEventListener('mousemove', handleResize)
      document.addEventListener('mouseup', stopResize)
      document.body.classList.add('resizing')
    }

    const handleResize = (e) => {
      if (!isResizing) return

      const newWidth = e.clientX
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        sidebarWidth.value = newWidth
        localStorage.setItem('sidebarWidth', newWidth)
      }
    }

    const stopResize = () => {
      isResizing = false
      document.removeEventListener('mousemove', handleResize)
      document.removeEventListener('mouseup', stopResize)
      document.body.classList.remove('resizing')
    }

    const resetWidth = () => {
      sidebarWidth.value = DEFAULT_WIDTH
    }

    onUnmounted(() => {
      document.removeEventListener('mousemove', handleResize)
      document.removeEventListener('mouseup', stopResize)
    })

    const isSidebarCollapsed = ref(false)

    const toggleSidebar = () => {
      isSidebarCollapsed.value = !isSidebarCollapsed.value
    }

    const handleToggleClick = (event) => {
      toggleSidebar();
      // 移除按钮焦点
      event.target.blur();
    }

    return {
      videos,
      currentVideoUrl,
      currentVideoPath,
      selectVideo,
      playerRef,
      sidebarWidth,
      startResize,
      resetWidth,
      isSidebarCollapsed,
      toggleSidebar,
      handleToggleClick
    }
  }
}
</script>

<style>
@import 'plyr/dist/plyr.css';

/* 重置所有默认样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* 确保 html 和 body 也没有边距 */
html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 应用容器样式 */
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  margin: 0;
  padding: 0;
  position: fixed;
  /* 确保容器固定位置 */
  top: 0;
  left: 0;
}

/* 播放列表样式 */
.playlist {
  position: relative;
  height: 100%;
  background-color: #1e1e1e;
  flex-shrink: 0;
  margin: 0;
  transition: width 0.3s;
  overflow: visible;
  color: #e0e0e0;
}

.playlist ul {
  list-style-type: none;
  padding: 0;
}

.playlist li {
  cursor: pointer;
  padding: 10px;
  margin-bottom: 5px;
  background-color: #e0e0e0;
}

.playlist li:hover {
  background-color: #d0d0d0;
}

/* 视频播放器容器样式 */
.video-player {
  flex: 1;
  min-width: 0;
  /* 防止flex子项溢出 */
  height: 100vh;
  background-color: #000;
  margin: 0;
}

.video-player .plyr {
  width: 100%;
  height: 100%;
}

.video-player video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.directory-tree {
  padding: 0;
  margin: 0;
}

.playlist h2 {
  margin-bottom: 15px;
  color: #ffffff;
  font-size: 1.2em;
  font-weight: 500;
}

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
  transition: all 0.3s;
  backdrop-filter: blur(2px);
}

.toggle-button:focus {
  outline: none;
  box-shadow: none;
}

.toggle-button:hover {
  background: rgba(255, 255, 255, 0.2);
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

.toggle-button.outside:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* 当鼠标靠近时显示按钮 */
.playlist:hover .toggle-button.outside {
  opacity: 1;
  transform: translateX(0);
}

/* 创建一个感应区域 */
.playlist::after {
  content: '';
  position: absolute;
  top: 0;
  right: -80px;
  width: 80px;
  height: 100%;
  pointer-events: auto;
}

/* 添加内容容器来控制滚动 */
.playlist-content {
  height: 100%;
  overflow-y: auto;
}
</style>
