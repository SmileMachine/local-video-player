<template>
  <div class="directory-item" :class="{ 'is-directory': isDirectory }">
    <div class="item-header" @click="isDirectory ? toggleExpand() : handleSelect()"
      :class="{ 'active': !isDirectory && item.id === currentPath }" @mouseenter.stop="showTooltip"
      @mouseleave.stop="hideTooltip">
      <span class="icon">{{ isDirectory ? (isExpanded ? '📂' : '📁') : '🎬' }}</span>
      <span class="name">{{ item.name }}</span>
      <span v-if="!isDirectory" class="duration">{{ formatDuration(item.duration) }}</span>
    </div>

    <div v-if="isDirectory && isExpanded" class="children">
      <DirectoryItem v-for="child in item.children" :key="child.path" :item="child" :currentPath="currentPath"
        @select-video="$emit('select-video', $event)" />
    </div>

    <!-- 悬浮提示 -->
    <div v-if="showingTooltip" class="tooltip show" :style="tooltipStyle">
      <div class="tooltip-title">{{ item.name }}</div>
      <div class="tooltip-content">
        <template v-if="isDirectory">
          <div><span class="label">文件数</span>{{ item.videoCount }}</div>
          <div><span class="label">总时长</span>{{ formatDuration(item.duration) }}</div>
          <div><span class="label">总大小</span>{{ formatSize(item.size) }}</div>
          <div><span class="label">修改时间</span>{{ formatDate(item.mtime) }}</div>
        </template>
        <template v-else>
          <div><span class="label">时长</span>{{ formatDuration(item.duration) }}</div>
          <div><span class="label">大小</span>{{ formatSize(item.size) }}</div>
          <div><span class="label">修改时间</span>{{ formatDate(item.mtime) }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import moment from 'moment'

export default {
  name: 'DirectoryItem',
  props: {
    item: {
      type: Object,
      required: true
    },
    currentPath: {
      type: String,
      required: true
    }
  },
  emits: ['select-video'],
  setup(props, { emit }) {
    const isExpanded = ref(false)
    const showingTooltip = ref(false)
    const tooltipStyle = ref({})

    const isDirectory = computed(() => props.item.type === 'directory')

    const showTooltip = (event) => {
      const rect = event.currentTarget.getBoundingClientRect()
      tooltipStyle.value = {
        left: `${rect.right + 10}px`,
        top: `${rect.top}px`
      }
      showingTooltip.value = true
    }

    const hideTooltip = () => {
      showingTooltip.value = false
    }

    const formatDuration = (seconds) => {
      if (!seconds) return '0:00'
      return moment.utc(seconds * 1000).format(seconds >= 3600 ? 'HH:mm:ss' : 'm:ss')
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

    const toggleExpand = () => {
      isExpanded.value = !isExpanded.value
    }

    const handleSelect = () => {
      emit('select-video', props.item.id)
    }

    return {
      isExpanded,
      isDirectory,
      showingTooltip,
      tooltipStyle,
      showTooltip,
      hideTooltip,
      formatDuration,
      formatSize,
      formatDate,
      toggleExpand,
      handleSelect
    }
  }
}
</script>

<style scoped>
.directory-item {
  margin-left: 0;
}

.item-header {
  display: flex;
  align-items: center;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  margin: 2px 0;
}

.item-header:hover {
  background-color: #e0e0e028;
}

.item-header.active {
  background-color: #d0d0d03a;
}

.icon {
  margin-right: 8px;
}

.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.duration {
  margin-left: 8px;
  color: #666;
  font-size: 0.9em;
}

.children {
  margin-left: 10px;
}

.is-directory>.item-header {
  font-weight: 500;
}

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

.label {
  display: inline-block;
  width: 5em;  /* 或者使用 8ch */
  text-align: right;
  padding-right: 1em;
}
</style>
