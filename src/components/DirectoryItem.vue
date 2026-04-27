<template>
  <div class="directory-item" :class="{ 'is-directory': isDirectory }">
    <div class="item-header" ref="itemRef" :class="{ 'active': !isDirectory && item.id === currentId }"
      @mouseenter.stop="showTooltip" @mouseleave.stop="hideTooltip"
      @pointerdown="startDetailPress" @pointerup="cancelDetailPress" @pointercancel="cancelDetailPress" @pointerleave="cancelDetailPress"
      @click="handleHeaderClick">
      <span class="icon" @click.stop="isDirectory ? randomSelect() : handleSelect()">{{ isDirectory ? (isExpanded ? '📂' :
        '📁') : '🎬' }}</span>
      <span class="name">{{ item.name }}</span>
      <span class="duration">{{ formatDuration(item?.info?.duration) }}</span>
      <span v-if="!isDirectory" class="progress-ring" :title="`观看进度 ${watchProgress}%`">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle class="progress-ring-track" cx="10" cy="10" r="7" />
          <circle class="progress-ring-value" cx="10" cy="10" r="7" :style="{ strokeDashoffset: progressStrokeOffset }" />
        </svg>
      </span>
    </div>

    <Transition name="expand">
      <div v-if="isDirectory && isExpanded" class="children">
        <DirectoryItem v-for="child in item.children" :key="child.id || child.name" :path="path.concat(child.name)" :item="child"
          :currentId="currentId" :currentPath="currentPath" :is-mobile-layout="isMobileLayout"
          @select-video="$emit('select-video', $event)" @show-detail="$emit('show-detail', $event)" />
      </div>
    </Transition>

    <Teleport to="body">
      <ItemTooltip v-if="showingTooltip" :item="item" :style="tooltipStyle" />
    </Teleport>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import moment from 'moment'
import ItemTooltip from './ItemTooltip.vue'

const HISTORY_KEY = 'video-time-history'
const PROGRESS_RING_RADIUS = 7
const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RING_RADIUS

export default {
  name: 'DirectoryItem',
  components: { ItemTooltip },
  props: {
    path: {
      type: Array,
      required: true
    },
    item: {
      type: Object,
      required: true
    },
    currentId: {
      type: String,
      required: true
    },
    currentPath: {
      type: Array,
      required: true
    },
    isMobileLayout: {
      type: Boolean,
      default: false
    }
  },
  emits: ['select-video', 'show-detail'],
  setup(props, { emit }) {
    const isExpanded = ref(false)
    const showingTooltip = ref(false)
    const tooltipStyle = ref({})
    const itemRef = ref(null)
    const watchedSeconds = ref(0)
    const longPressTimer = ref(null)
    const suppressNextClick = ref(false)

    const isDirectory = computed(() => props.item.type === 'directory')
    const historyKey = computed(() => Array.isArray(props.path) ? props.path.join(',') : String(props.path || ''))
    const watchProgress = computed(() => {
      if (isDirectory.value) {
        return 0
      }
      const totalDuration = Number(props.item?.info?.duration || 0)
      if (totalDuration <= 0) {
        return 0
      }
      const percent = Math.round((watchedSeconds.value / totalDuration) * 100)
      return Math.min(100, Math.max(0, percent))
    })
    const progressStrokeOffset = computed(() => {
      return `${PROGRESS_RING_CIRCUMFERENCE * (1 - watchProgress.value / 100)}px`
    })

    const refreshVideoProgress = () => {
      if (isDirectory.value) {
        watchedSeconds.value = 0
        return
      }

      try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}')
        watchedSeconds.value = Number(history[historyKey.value]?.time || 0)
      } catch {
        watchedSeconds.value = 0
      }
    }

    const handleProgressUpdated = (event) => {
      const detail = event?.detail || {}
      if (detail.key !== historyKey.value) {
        return
      }
      watchedSeconds.value = Number(detail.time || 0)
    }

    const showTooltip = (event) => {
      if (props.isMobileLayout) {
        return
      }

      const rect = event.currentTarget.getBoundingClientRect()
      const tooltipWidth = props.item?.info ? 390 : 220
      const spaceRight = window.innerWidth - rect.right
      const left = spaceRight >= tooltipWidth + 16
        ? rect.right + 10
        : Math.max(10, rect.left - tooltipWidth - 10)
      tooltipStyle.value = {
        left: `${left}px`,
        top: `${Math.max(10, Math.min(rect.top, window.innerHeight - 180))}px`
      }
      showingTooltip.value = true
    }

    const hideTooltip = () => {
      showingTooltip.value = false
    }


    const toggleExpand = () => {
      isExpanded.value = !isExpanded.value
    }

    const handleSelect = () => {
      emit('select-video', { ...props.item, path: props.path })
    }

    const handleHeaderClick = (event) => {
      if (suppressNextClick.value) {
        event.preventDefault()
        suppressNextClick.value = false
        return
      }

      if (isDirectory.value) {
        toggleExpand()
      } else {
        handleSelect()
      }
    }

    const startDetailPress = (event) => {
      if (!props.isMobileLayout || event.pointerType === 'mouse') {
        return
      }

      cancelDetailPress()
      longPressTimer.value = window.setTimeout(() => {
        suppressNextClick.value = true
        hideTooltip()
        emit('show-detail', { item: props.item, path: props.path })
      }, 420)
    }

    const cancelDetailPress = () => {
      if (longPressTimer.value) {
        window.clearTimeout(longPressTimer.value)
        longPressTimer.value = null
      }
    }

    // Used to randomly select a video in the directory
    const traverse = (item, path, select) => {
      if (item.type === 'file') {
        return { ...item, path: path }
      }
      for (const child of item.children) {
        if (child.type === 'file') {
          if (select === 0) {
            return { id: child.id, path: path.concat(child.name) }
          }
          select -= 1
        } else if (child.type === 'directory') {
          if (select < child.videoCount) {
            const result = traverse(child, path.concat(child.name), select)
            if (result) {
              return result
            }
          } else {
            select -= child.videoCount
          }
        }
      }
    }

    const randomSelect = () => {
      const path = props.path; // array
      const select = Math.floor(Math.random() * props.item.videoCount);
      const result = traverse(props.item, path, select)
      if (result) {
        emit('select-video', result)
      }
    }


    const formatDuration = (seconds) => {
      if (!seconds) return '0:00'
      const hours = Math.floor(seconds / 3600)
      return moment.utc(seconds * 1000).format(hours > 0 ? `${hours}:mm:ss` : 'mm:ss')
    }

    // Expand the directory when the currentPath changes
    watch(() => props.currentPath, () => {
      if (isDirectory.value && props.currentPath && props.path.length <= props.currentPath.length) {
        if (props.currentPath.slice(0, props.path.length).join('/') === props.path.join('/')) {
          isExpanded.value = true
        }
      }
    }, { immediate: true })

    // Scroll to the current item when the currentId changes
    watch(() => props.currentId, (newId) => {
      if (!props.isDirectory && newId === props.item.id && itemRef.value) {
        itemRef.value.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }
    }, { immediate: true })
    watch(historyKey, refreshVideoProgress, { immediate: true })

    onMounted(() => {
      window.addEventListener('video-progress-updated', handleProgressUpdated)
    })

    onUnmounted(() => {
      cancelDetailPress()
      window.removeEventListener('video-progress-updated', handleProgressUpdated)
    })

    return {
      isExpanded,
      isDirectory,
      showingTooltip,
      tooltipStyle,
      showTooltip,
      hideTooltip,
      toggleExpand,
      handleSelect,
      handleHeaderClick,
      startDetailPress,
      cancelDetailPress,
      randomSelect,
      formatDuration,
      itemRef,
      watchProgress,
      progressStrokeOffset
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
  background-color: var(--color-surface-hover, #e0e0e028);
}

.item-header.active {
  background-color: var(--color-primary, #646cff);
  background-color: color-mix(in srgb, var(--color-primary, #646cff) 25%, transparent);
}

.icon {
  margin-right: 8px;
  font-family: var(--emoji-font, 'Noto Color Emoji');
}

.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.duration {
  margin-left: 8px;
  color: var(--color-text-muted, #666);
  font-size: 0.9em;
}

.progress-ring {
  width: 16px;
  height: 16px;
  margin-left: 8px;
  flex-shrink: 0;
  color: var(--color-primary, #646cff);
}

.progress-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-ring-track,
.progress-ring-value {
  fill: none;
  stroke-width: 2;
}

.progress-ring-track {
  stroke: color-mix(in srgb, var(--color-text-muted, #666) 35%, transparent);
}

.progress-ring-value {
  stroke: currentColor;
  stroke-linecap: round;
  stroke-dasharray: 43.9823;
  transition: stroke-dashoffset 0.25s ease;
}

.children {
  margin-left: 10px;
}

.is-directory>.item-header {
  font-weight: 500;
}

/* Animation when expand or collapse */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.4s ease;
  max-height: 1000px;
  /* Set a large enough value */
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0.5;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 1000px;
  opacity: 1;
}

/* Ensure the child container has a transition effect */
.children {
  overflow: hidden;
}

:global(.playlist.is-mobile) .item-header {
  min-height: 44px;
  padding: 10px 12px;
  border-radius: 8px;
}

:global(.playlist.is-mobile) .icon {
  margin-right: 10px;
}

:global(.playlist.is-mobile) .children {
  margin-left: 12px;
}

:global(.playlist.is-mobile) .progress-ring {
  width: 18px;
  height: 18px;
}
</style>
