<template>
  <div class="tooltip show" :style="style">
    <div class="tooltip-title">{{ item.name }}</div>
    <div class="tooltip-content">
      <template v-if="isDirectory">
        <div><span class="label">文件数</span>{{ item.videoCount }}</div>
        <div><span class="label">总时长</span>{{ formatDuration(item.info.duration) }}</div>
        <div><span class="label">总大小</span>{{ formatSize(item.size) }}</div>
        <div><span class="label">修改时间</span>{{ formatDate(item.mtime) }}</div>
      </template>
      <template v-else>
        <div class="two-column-layout">
          <div class="info-column">
            <div class="codec-section">
              <span class="label">视频</span>
              <span class="codec-badge" :class="getVideoCodecClass(item.info.video.codec)">
                {{ item.info.video.codec }}
              </span>
              <i v-if="!isVideoCodecSupported(item.info.video.codec)"
                class="fa-solid fa-circle-exclamation codec-warning"
                :title="getVideoCodecWarning(item.info.video.codec)"></i>
            </div>
            <div><span class="label">时长</span>{{ formatDuration(item.info.duration) }}</div>
            <div><span class="label">大小</span>{{ formatSize(item.size) }}</div>
            <div><span class="label">修改时间</span>{{ formatDate(item.mtime) }}</div>
          </div>

          <div class="info-column">
            <div class="codec-section" v-if="item.info.audio">
              <span class="label">音频</span>
              <span class="codec-badge" :class="getAudioCodecClass(item.info.audio.codec)">
                {{ item.info.audio.codec }}
              </span>
              <i v-if="!isAudioCodecSupported(item.info.audio.codec)"
                class="fa-solid fa-circle-exclamation codec-warning"
                :title="getAudioCodecWarning(item.info.audio.codec)"></i>
            </div>
            <div v-if="item.info.video?.width">
              <span class="label">分辨率</span>{{ item.info.video.width }}×{{ item.info.video.height }}
            </div>
            <div v-if="item.info.video?.fps">
              <span class="label">帧率</span>{{ formatFps(item.info.video.fps) }}
            </div>

            <div v-if="item.info.audio?.channels">
              <span class="label">声道</span>{{ item.info.audio.channels }} 声道
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import moment from 'moment'
import { computed } from 'vue';

export default {
  name: 'ItemTooltip',
  props: {
    item: {
      type: Object,
      required: true
    },
    style: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const isDirectory = computed(() => props.item.type === 'directory')

    const formatDuration = (seconds) => {
      if (!seconds) return '0:00'
      const hours = Math.floor(seconds / 3600)
      return moment.utc(seconds * 1000).format(hours > 0 ? `${hours}:mm:ss` : 'mm:ss')
    }

    const formatSize = (bytes) => {
      if (!bytes) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB', 'TB']
      let size = bytes
      let unitIndex = 0
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex++
      }
      return `${size.toFixed(2)} ${units[unitIndex]}`
    }

    const formatDate = (dateString) => {
      return moment(dateString).format('YYYY-MM-DD HH:mm:ss')
    }

    const formatFps = (fps) => {
      if (!fps) return 'N/A'
      // Round to 2 decimal places if needed
      return Number.isInteger(fps) ? `${fps} fps` : `${fps.toFixed(2)} fps`
    }

    // 浏览器支持的编码列表
    const isVideoCodecSupported = (codec) => {
      const supported = ['h264', 'avc1', 'vp8', 'vp9', 'av01']
      // macOS/iOS Safari 和 Edge 支持 HEVC
      const userAgent = navigator.userAgent.toLowerCase()
      const isMac = userAgent.includes('mac os x')
      const isIOS = /iphone|ipad|ipod/.test(userAgent)
      if ((isMac || isIOS) && ['hevc', 'h265', 'hvc1'].includes(codec?.toLowerCase())) {
        return true
      }
      return supported.includes(codec?.toLowerCase())
    }

    const isAudioCodecSupported = (codec) => {
      const supported = ['aac', 'mp3', 'opus', 'vorbis', 'flac']
      // EAC3/AC3 在某些系统上可能部分支持，标记为不确定
      return supported.includes(codec?.toLowerCase())
    }

    const getVideoCodecClass = (codec) => {
      if (!codec) return ''
      return isVideoCodecSupported(codec) ? 'codec-supported' : 'codec-unsupported'
    }

    const getAudioCodecClass = (codec) => {
      if (!codec) return ''
      return isAudioCodecSupported(codec) ? 'codec-supported' : 'codec-unsupported'
    }

    const getVideoCodecWarning = (codec) => {
      const userAgent = navigator.userAgent.toLowerCase()
      const isMac = userAgent.includes('mac os x')
      const isIOS = /iphone|ipad|ipod/.test(userAgent)

      const warnings = {
        'hevc': isMac || isIOS ? '' : 'H.265/HEVC - 仅 Safari/macOS/iOS 支持',
        'h265': isMac || isIOS ? '' : 'H.265/HEVC - 仅 Safari/macOS/iOS 支持',
        'mpeg4': 'MPEG-4 Part 2 - 支持有限'
      }
      return warnings[codec?.toLowerCase()] || '该编码可能在部分浏览器中不支持'
    }

    const getAudioCodecWarning = (codec) => {
      const warnings = {
        'dts': 'DTS - 浏览器不支持',
        'ac3': 'AC3 - 可能需要系统解码器支持',
        'eac3': 'E-AC3 - 可能需要系统解码器支持，取决于容器格式'
      }
      return warnings[codec?.toLowerCase()] || '该音频编码可能在部分浏览器中不支持'
    }

    return {
      isDirectory,
      formatDuration,
      formatSize,
      formatDate,
      formatFps,
      isVideoCodecSupported,
      isAudioCodecSupported,
      getVideoCodecClass,
      getAudioCodecClass,
      getVideoCodecWarning,
      getAudioCodecWarning
    }
  }
}
</script>

<style scoped>
.tooltip {
  position: fixed;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px;
  border-radius: 4px;
  font-size: 14px;
  z-index: 1000;
  pointer-events: none;
  min-width: 200px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transform: translateX(-10px);
  transition: all 0.2s ease-in-out;
}

.tooltip.show {
  opacity: 1;
  transform: translateX(0);
}

.tooltip::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 10px;
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 6px solid rgba(0, 0, 0, 0.8);
}

.tooltip-title {
  font-weight: bold;
  margin-bottom: 5px;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tooltip-content {
  font-size: 12px;
  line-height: 1.4;
  text-align: left;
}

.tooltip-content>div {
  margin: 2px 0;
}

.two-column-layout {
  display: grid;
  grid-template-columns: auto auto;
  gap: 20px;
}

.info-column {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-column > div {
  margin: 2px 0;
}

.label {
  display: inline-block;
  width: 5em;
  text-align: right;
  padding-right: 1em;
}

.codec-section {
  display: flex;
  align-items: center;
  gap: 6px;
}

.codec-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
}

.codec-supported {
  background-color: rgba(76, 175, 80, 0.2);
  color: #81c784;
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.codec-unsupported {
  background-color: rgba(255, 152, 0, 0.2);
  color: #ffb74d;
  border: 1px solid rgba(255, 152, 0, 0.3);
}

.codec-warning {
  color: #ffb74d;
  font-size: 12px;
  cursor: help;
}
</style>
