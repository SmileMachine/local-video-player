<template>
  <div class="directory-item" :class="{ 'is-directory': isDirectory }">
    <div class="item-header" @click="isDirectory ? toggleExpand() : handleSelect()" ref="itemRef"
      :class="{ 'active': !isDirectory && item.id === currentId }" @mouseenter.stop="showTooltip"
      @mouseleave.stop="hideTooltip">
      <span class="icon">{{ isDirectory ? (isExpanded ? '📂' : '📁') : '🎬' }}</span>
      <span class="name">{{ item.name }}</span>
      <span class="duration">{{ formatDuration(item.duration) }}</span>
    </div>

    <div v-if="isDirectory && isExpanded" class="children">
      <DirectoryItem v-for="child in item.children" :path="path.concat(child.name)" :item="child" :currentId="currentId"
        :currentPath="currentPath" @select-video="$emit('select-video', $event)" />
    </div>

    <ItemTooltip v-if="showingTooltip" :item="item" :style="tooltipStyle" />
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import moment from 'moment'
import ItemTooltip from './ItemTooltip.vue'

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
    }
  },
  emits: ['select-video'],
  setup(props, { emit }) {
    const isExpanded = ref(false)
    const showingTooltip = ref(false)
    const tooltipStyle = ref({})
    const itemRef = ref(null)

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


    const toggleExpand = () => {
      isExpanded.value = !isExpanded.value
    }

    const handleSelect = () => {
      emit('select-video', { id: props.item.id, path: props.path })
    }


    const formatDuration = (seconds) => {
      if (!seconds) return '0:00'
      return moment.utc(seconds * 1000).format(seconds >= 3600 ? 'HH:mm:ss' : 'm:ss')
    }

    watch(() => props.currentPath, () => {
      if (isDirectory.value && props.currentPath && props.path.length <= props.currentPath.length) {
        if (props.currentPath.slice(0, props.path.length).join('/') === props.path.join('/')) {
          isExpanded.value = true
        }
      }
    }, { immediate: true })

    watch(() => props.currentId, (newId) => {
      if (!props.isDirectory && newId === props.item.id && itemRef.value) {
        itemRef.value.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }
    }, { immediate: true })

    return {
      isExpanded,
      isDirectory,
      showingTooltip,
      tooltipStyle,
      showTooltip,
      hideTooltip,
      toggleExpand,
      handleSelect,
      formatDuration,
      itemRef
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
</style>
