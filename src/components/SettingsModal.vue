<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>服务端设置</h2>
          <button class="close-button" @click="close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body">
          <div v-if="loading" class="loading">加载中...</div>
          <div v-else-if="error" class="error">{{ error }}</div>
          <div v-else class="settings-form">
            <!-- Video Paths Section -->
            <div class="setting-section">
              <h3>视频路径</h3>
              <div class="video-paths">
                <div v-for="(videoPath, index) in localConfig.videoPaths" :key="index" class="path-item">
                  <input
                    v-model="videoPath.name"
                    type="text"
                    placeholder="名称"
                    class="input-name"
                  />
                  <input
                    v-model="videoPath.path"
                    type="text"
                    placeholder="路径 (~/Movies)"
                    class="input-path"
                  />
                  <button class="btn-remove" @click="removePath(index)" :disabled="localConfig.videoPaths.length <= 1">
                    &times;
                  </button>
                </div>
                <button class="btn-add" @click="addPath">
                  + 添加路径
                </button>
              </div>
            </div>

            <!-- Options Section -->
            <div class="setting-section">
              <h3>选项</h3>
              <label class="checkbox-label">
                <input type="checkbox" v-model="localConfig.usePathIds" />
                <span>使用 UUID 替代文件路径</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="localConfig.getVideoInfo" />
                <span>获取视频信息（时长、编码等）</span>
                <small style="display: block; margin-left: 30px; color: #888; margin-top: 4px;">
                  使用 ffmpeg 获取视频详细信息，可能较耗时
                </small>
              </label>
              <div class="input-group">
                <label>缓存名称:</label>
                <input
                  v-model="localConfig.cacheName"
                  type="text"
                  class="input-text"
                  placeholder="video-info"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="close">取消</button>
          <button class="btn-primary" @click="save" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { ref, reactive, watch } from 'vue'

export default {
  name: 'SettingsModal',
  props: {
    show: {
      type: Boolean,
      required: true
    }
  },
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const loading = ref(false)
    const saving = ref(false)
    const error = ref('')
    const localConfig = reactive({
      cacheName: 'video-info',
      usePathIds: true,
      getVideoInfo: true,
      videoPaths: []
    })

    // Load config when modal opens
    watch(() => props.show, async (newValue) => {
      if (newValue) {
        await loadConfig()
      }
    })

    const loadConfig = async () => {
      loading.value = true
      error.value = ''
      try {
        const response = await fetch('/api/config')
        if (!response.ok) throw new Error('加载配置失败')
        const config = await response.json()

        // Update local config
        Object.assign(localConfig, {
          cacheName: config.cacheName || 'video-info',
          usePathIds: config.usePathIds !== undefined ? config.usePathIds : true,
          getVideoInfo: config.getVideoInfo !== undefined ? config.getVideoInfo : true,
          videoPaths: config.videoPaths || []
        })
      } catch (err) {
        error.value = err.message
      } finally {
        loading.value = false
      }
    }

    const addPath = () => {
      localConfig.videoPaths.push({
        name: '',
        path: ''
      })
    }

    const removePath = (index) => {
      if (localConfig.videoPaths.length > 1) {
        localConfig.videoPaths.splice(index, 1)
      }
    }

    const save = async () => {
      // Validate before sending
      for (let i = 0; i < localConfig.videoPaths.length; i++) {
        const vp = localConfig.videoPaths[i]
        if (!vp.name || !vp.path || vp.name.trim() === '' || vp.path.trim() === '') {
          error.value = `请填写第 ${i + 1} 个视频路径的名称和路径`
          return
        }
      }

      saving.value = true
      error.value = ''
      try {
        console.log('Saving config:', JSON.stringify(localConfig, null, 2))
        const response = await fetch('/api/config', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(localConfig)
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Server error:', errorData)
          throw new Error(errorData.error || '保存配置失败')
        }

        console.log('Config saved successfully')
        emit('saved')
        close()
      } catch (err) {
        console.error('Save error:', err)
        error.value = err.message
      } finally {
        saving.value = false
      }
    }

    const close = () => {
      emit('close')
    }

    const handleOverlayClick = () => {
      close()
    }

    return {
      loading,
      saving,
      error,
      localConfig,
      addPath,
      removePath,
      save,
      close,
      handleOverlayClick
    }
  },
  mounted() {
    document.addEventListener('keydown', this.handleEscape)
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscape)
  },
  methods: {
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
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  border: 1px solid #3d3d3d;
  display: flex;
  flex-direction: column;
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
  font-size: 20px;
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
  outline: none;
}

.close-button:hover {
  background-color: #3d3d3d;
  color: #e0e0e0;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.loading,
.error {
  text-align: center;
  padding: 40px;
  color: #b0b0b0;
}

.error {
  color: #ff6b6b;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.setting-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #e0e0e0;
}

.video-paths {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.path-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.input-name,
.input-path,
.input-text {
  background-color: #1e1e1e;
  border: 1px solid #3d3d3d;
  border-radius: 6px;
  padding: 8px 12px;
  color: #e0e0e0;
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.input-name:focus,
.input-path:focus,
.input-text:focus {
  outline: none;
  border-color: #2196f3;
}

.input-name {
  width: 120px;
  flex-shrink: 0;
}

.input-path {
  flex: 1;
}

.input-text {
  width: 200px;
}

.btn-remove {
  background: none;
  border: none;
  color: #ff6b6b;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.btn-remove:hover:not(:disabled) {
  background-color: rgba(255, 107, 107, 0.1);
}

.btn-remove:disabled {
  color: #4d4d4d;
  cursor: not-allowed;
}

.btn-add {
  background-color: #2d2d2d;
  border: 1px dashed #4d4d4d;
  color: #e0e0e0;
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.btn-add:hover {
  background-color: #3d3d3d;
  border-color: #5d5d5d;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  cursor: pointer;
  color: #b0b0b0;
  font-size: 14px;
  text-align: left;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  flex-shrink: 0;
}

.checkbox-label span {
  text-align: left;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.input-group label {
  color: #b0b0b0;
  font-size: 14px;
  text-align: left;
  flex-shrink: 0;
}

.input-group .input-text {
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #3d3d3d;
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background-color: #2196f3;
  border: none;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1976d2;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #2d2d2d;
  border: 1px solid #3d3d3d;
  color: #e0e0e0;
}

.btn-secondary:hover {
  background-color: #3d3d3d;
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
