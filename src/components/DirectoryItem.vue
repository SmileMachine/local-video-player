<template>
  <div class="directory-item" :class="{ 'is-directory': isDirectory }">
    <div class="item-header" ref="itemRef" :class="{ 'active': !isDirectory && item.id === currentId }"
      @mouseenter.stop="showTooltip" @mouseleave.stop="hideTooltip"
      @click="isDirectory ? toggleExpand() : handleSelect()">
      <span class="icon" @click.stop="isDirectory ? randomSelect() : handleSelect()">{{ isDirectory ? (isExpanded ? '📂' :
        '📁') : '🎬' }}</span>
      <span class="name">{{ item.name }}</span>
      <span class="duration">{{ formatDuration(item.info.duration) }}</span>
    </div>

    <Transition name="expand">
      <div v-if="isDirectory && isExpanded" class="children">
        <DirectoryItem v-for="child in item.children" :path="path.concat(child.name)" :item="child"
          :currentId="currentId" :currentPath="currentPath" @select-video="$emit('select-video', $event)" />
      </div>
    </Transition>

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

    const traverse = (item, path, select) => {
      if (item.type === 'file') {
        return { id: item.id, path: path }
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
      randomSelect,
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
</style>
