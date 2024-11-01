import express from 'express'
import { ref } from '../utils/reactive.js'
import { useConfig } from '../utils/config.js'
import { logger } from '../utils/logger.js'

const router = express.Router()
const config = useConfig()

// // 创建响应式引用
// const videoList = ref(config.getVideos())

// // 监听配置更新
// config.onUpdate((newVideos) => {
//   videoList.value = newVideos
// })

// // 使用响应式值
// videoList.subscribe((newVideos, oldVideos) => {
//   logger.info(newVideos, "videos.json")
// })

router.get('/videos', (req, res) => {
  res.json(config.getVideos())
})

export default router
