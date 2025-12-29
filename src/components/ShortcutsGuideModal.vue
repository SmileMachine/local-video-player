<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>快捷键指南</h2>
          <button class="close-button" @click="close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="shortcut-list">
            <div class="shortcut-item">
              <kbd>F</kbd>
              <span>切换全屏</span>
            </div>
            <div class="shortcut-item">
              <kbd>M</kbd>
              <span>静音/取消静音</span>
            </div>
            <div class="shortcut-item">
              <kbd>H</kbd>
              <span>显示/隐藏快捷键指南</span>
            </div>
            <div class="shortcut-item">
              <kbd>Space</kbd>
              <span>播放/暂停</span>
            </div>
            <div class="shortcut-item">
              <kbd>&larr;</kbd> / <kbd>&rarr;</kbd>
              <span>快退/快进 5 秒</span>
            </div>
            <div class="shortcut-item">
              <kbd>&uarr;</kbd> / <kbd>&darr;</kbd>
              <span>音量增加/减少</span>
            </div>
            <div class="shortcut-item">
              <kbd>PageDown</kbd>
              <span>播放下一个视频</span>
            </div>
            <div class="shortcut-item">
              <kbd>PageUp</kbd>
              <span>播放上一个视频</span>
            </div>
            <div class="shortcut-item">
              <kbd>Shift</kbd> + <kbd>Enter</kbd>
              <span>切换侧边栏</span>
            </div>
            <div class="shortcut-item">
              <kbd>Esc</kbd>
              <span>关闭快捷键指南</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
export default {
  name: 'ShortcutsGuideModal',
  props: {
    show: {
      type: Boolean,
      required: true
    }
  },
  emits: ['close'],
  mounted() {
    document.addEventListener('keydown', this.handleEscape)
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscape)
  },
  methods: {
    close() {
      this.$emit('close')
    },
    handleOverlayClick() {
      this.close()
    },
    handleEscape(e) {
      if (e.key === 'Escape' && this.show) {
        this.close()
      }
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background-color: #242424;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  border: 1px solid #3d3d3d;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #3d3d3d;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #e0e0e0;
}

.close-button {
  background: none;
  border: none;
  color: #a0a0a0;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-button:hover {
  background-color: #3d3d3d;
  color: #e0e0e0;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  max-height: calc(80vh - 80px);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #b0b0b0;
  font-size: 14px;
}

.shortcut-item kbd {
  background-color: #1e1e1e;
  border: 1px solid #3d3d3d;
  border-radius: 6px;
  padding: 6px 12px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  color: #e0e0e0;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  min-width: 40px;
  text-align: center;
}

.shortcut-item span {
  color: #e0e0e0;
}

/* Modal transition animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
  opacity: 0;
}
</style>
