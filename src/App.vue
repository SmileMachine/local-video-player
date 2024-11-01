<template>
  <div class="app-container">
    <div class="playlist">
      <h2>播放列表</h2>
      <ul>
        <li 
          v-for="(video, index) in videos" 
          :key="index" 
          @click="selectVideo(index)"
          :class="{ active: currentVideoIndex === index }"
        >
          {{ video.name }}
        </li>
      </ul>
    </div>
    <div class="video-player">
      <video id="video-player" ref="playerRef" :src="currentVideoUrl" playsinline>
        <source :src="currentVideoUrl" type="video/mp4" />
      </video>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

export default {
  name: 'App',
  setup() {
    const playerRef = ref(null)
    let player = null
    
    const videos = ref([])
    const currentVideoIndex = ref(0)
    
    // 计算当前视频的URL
    const currentVideoUrl = computed(() => {
      if (!videos.value.length) return ''
      const video = videos.value[currentVideoIndex.value]
      return `/video?path=${encodeURIComponent(video.src)}`
    })

    // 从服务器获取视频列表
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
      // 获取视频列表
      await fetchVideos()

      // 初始化播放器
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

    const selectVideo = (index) => {
      currentVideoIndex.value = index
      // 可选：选择新视频后自动播放
      if (player) {
        setTimeout(() => player.play(), 100)
      }
    }

    return {
      videos,
      currentVideoUrl,
      currentVideoIndex,
      selectVideo,
      playerRef
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
  width: 250px;
  height: 100%;
  padding: 20px;
  background-color: #f0f0f0;
  overflow-y: auto;
  flex-shrink: 0;
  margin: 0;
  /* 确保没有外边距 */
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
  height: 100vh;
  background-color: #000;
  margin: 0;
  /* 确保没有外边距 */
}

/* 视频播放器样式 */
.video-player .plyr {
  width: 100%;
  height: 100%;
}

.video-player video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
