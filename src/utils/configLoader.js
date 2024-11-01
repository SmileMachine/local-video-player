import { ref, watch } from 'vue'
import fs from 'fs'
import path from 'path'

export const useConfigLoader = () => {
  const videos = ref([])

  const loadConfig = async () => {
    try {
      const configPath = path.resolve('@/config.json')
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      videos.value = config.videos
    } catch (error) {
      console.error('Error loading config:', error)
      videos.value = []
    }
  }

  const watchConfig = () => {
    const configPath = path.resolve('./src/config.json')
    watch(configPath, (eventType, filename) => {
      if (filename) {
        loadConfig()
      }
    })
  }

  return {
    videos,
    loadConfig,
    watchConfig
  }
} 
