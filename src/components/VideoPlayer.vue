<template>
  <div class="video-player">
    <div ref="playerMountRef" class="player-mount"></div>
    <div v-if="currentVideoInfo.externalAudioPreparing" class="audio-preparing">
      <span class="audio-preparing-spinner" aria-hidden="true"></span>
      <span>正在准备兼容音频</span>
      <span v-if="audioPreparingProgressText" class="audio-preparing-progress">
        {{ audioPreparingProgressText }}
      </span>
    </div>
  </div>
</template>

<script>
import { computed, nextTick, ref, onMounted, onUnmounted, watch } from 'vue'
import { createPlayer } from '../players/playerFactory'
import { useVideoLibrary } from '../composables/useVideoLibrary'

export default {
  name: 'VideoPlayer',
  props: {
    playerType: {
      type: String,
      default: 'DPlayer',
      validator: (value) => ['DPlayer', 'Plyr'].includes(value)
    }
  },
  setup(props) {
    let player = null
    let playerToken = 0
    let externalAudio = null
    let externalAudioCleanup = []
    let externalAudioVideoElement = null
    let activeVideoUrl = ''
    let activeExternalAudioUrl = ''
    const playerMountRef = ref(null)
    const updateCount = ref(10)

    const MAX_HISTORY_ITEMS = 100
    const HISTORY_KEY = 'video-time-history'
    const buildHistoryKey = (vidKey) => Array.isArray(vidKey) ? vidKey.join(',') : String(vidKey || '')

    const { currentVideoInfo } = useVideoLibrary()
    const audioPreparingProgressText = computed(() => {
      const progress = Number(currentVideoInfo.value.externalAudioProgress)
      if (!Number.isFinite(progress)) {
        return ''
      }
      return `${Math.max(0, Math.min(100, Math.round(progress)))}%`
    })

    // Get the saved playback time
    const loadVideoTime = (videoUrl) => {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}')
      return history[buildHistoryKey(videoUrl)]?.time || 0
    }

    // Save the playback time
    const saveVideoTime = (vid_key, currentTime) => {
      let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}')
      const historyKey = buildHistoryKey(vid_key)

      // If the number of records exceeds the maximum, delete the earliest accessed record
      const keys = Object.keys(history)
      if (keys.length >= MAX_HISTORY_ITEMS && !history[historyKey]) {
        // Remove the earliest accessed record
        const earliest = keys.reduce((earliest, key) => {
          if (!earliest || history[key].accessedAt < history[earliest].accessedAt) {
            return key
          }
          return earliest
        }, null)

        if (earliest) {
          delete history[earliest]
        }
      }

      // Update the playback time and the access time
      history[historyKey] = {
        time: currentTime,
        accessedAt: Date.now()
      }

      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
      window.dispatchEvent(new CustomEvent('video-progress-updated', {
        detail: {
          key: historyKey,
          time: currentTime
        }
      }))
    }

    const focusVideo = () => {
      if (player) {
        player.focus()
      }
    }

    const destroyPlayer = () => {
      playerToken += 1
      cleanupExternalAudio()
      if (player) {
        player.destroy()
      }
      player = null
      window.__videoPlayer = null
      activeVideoUrl = ''
      activeExternalAudioUrl = ''

      if (playerMountRef.value) {
        playerMountRef.value.replaceChildren()
      }
    }

    const cleanupExternalAudio = () => {
      externalAudioCleanup.forEach((cleanup) => cleanup())
      externalAudioCleanup = []

      if (externalAudio) {
        externalAudio.pause()
        externalAudio.removeAttribute('src')
        externalAudio.load()
      }

      if (externalAudioVideoElement) {
        externalAudioVideoElement.muted = false
      }

      if (player?.setExternalAudio) {
        player.setExternalAudio(null)
      }

      externalAudio = null
      externalAudioVideoElement = null
      activeExternalAudioUrl = ''
    }

    const addExternalAudioListener = (element, eventName, handler) => {
      element.addEventListener(eventName, handler)
      externalAudioCleanup.push(() => element.removeEventListener(eventName, handler))
    }

    const setupExternalAudio = (videoInfo, token, targetPlayer) => {
      cleanupExternalAudio()

      if (!videoInfo.externalAudioUrl || token !== playerToken || player !== targetPlayer) {
        activeExternalAudioUrl = ''
        return
      }

      const videoElement = targetPlayer.getMediaElement?.()
      if (!videoElement) {
        return
      }

      const audio = new Audio(videoInfo.externalAudioUrl)
      audio.preload = 'auto'
      audio.volume = videoElement.volume
      audio.playbackRate = videoElement.playbackRate || 1

      externalAudio = audio
      externalAudioVideoElement = videoElement
      videoElement.muted = true
      targetPlayer.setExternalAudio?.(audio)
      activeExternalAudioUrl = videoInfo.externalAudioUrl
      let audioReady = audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
      let resumeAfterAudioReady = false
      let pendingAudioTime = null
      const VIDEO_SYNC_THRESHOLD = 0.35

      const syncVideoTime = (force = false) => {
        if (!externalAudio || token !== playerToken || player !== targetPlayer) {
          return
        }

        const drift = audio.currentTime - videoElement.currentTime
        if (force || Math.abs(drift) > VIDEO_SYNC_THRESHOLD) {
          videoElement.currentTime = audio.currentTime
        }
      }

      const playAudio = () => {
        if (!externalAudio || token !== playerToken || player !== targetPlayer) {
          return
        }

        if (!audioReady) {
          resumeAfterAudioReady = true
          pendingAudioTime = videoElement.currentTime
          videoElement.pause()
          audio.load()
          return
        }

        if (Math.abs(audio.currentTime - videoElement.currentTime) > VIDEO_SYNC_THRESHOLD) {
          audio.currentTime = videoElement.currentTime
        }
        audio.playbackRate = videoElement.playbackRate || 1
        audio.play().catch((error) => {
          console.warn('Unable to play compatible audio:', error)
        })
      }

      const pauseAudio = () => {
        if (!videoElement.ended && videoElement.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
          return
        }
        audio.pause()
      }

      const handleSeeked = () => {
        pendingAudioTime = videoElement.currentTime
        audio.currentTime = videoElement.currentTime
        if (!videoElement.paused) {
          playAudio()
        }
      }

      const handleRateChange = () => {
        audio.playbackRate = videoElement.playbackRate || 1
      }

      const handleVolumeChange = () => {
        audio.volume = videoElement.volume
        videoElement.muted = true
      }

      const handleAudioCanPlay = () => {
        audioReady = true
        if (pendingAudioTime !== null) {
          const nextTime = pendingAudioTime
          pendingAudioTime = null
          if (Math.abs(audio.currentTime - nextTime) > 0.05) {
            audio.currentTime = nextTime
            return
          }
        }
        if (resumeAfterAudioReady) {
          resumeAfterAudioReady = false
          videoElement.play().catch((error) => {
            console.warn('Unable to resume video with compatible audio:', error)
          })
        }
      }

      const handleAudioSeeked = () => {
        if (resumeAfterAudioReady) {
          resumeAfterAudioReady = false
          videoElement.play().catch((error) => {
            console.warn('Unable to resume video with compatible audio:', error)
          })
        }
      }

      const handleAudioError = () => {
        resumeAfterAudioReady = false
        console.warn('Compatible audio failed to load')
      }

      const syncTimer = window.setInterval(() => {
        if (!videoElement.paused && !videoElement.seeking && !audio.paused) {
          syncVideoTime()
        }
      }, 1500)

      externalAudioCleanup.push(() => window.clearInterval(syncTimer))
      addExternalAudioListener(videoElement, 'play', playAudio)
      addExternalAudioListener(videoElement, 'playing', playAudio)
      addExternalAudioListener(videoElement, 'pause', pauseAudio)
      addExternalAudioListener(videoElement, 'ended', pauseAudio)
      addExternalAudioListener(videoElement, 'seeking', pauseAudio)
      addExternalAudioListener(videoElement, 'seeked', handleSeeked)
      addExternalAudioListener(videoElement, 'ratechange', handleRateChange)
      addExternalAudioListener(videoElement, 'volumechange', handleVolumeChange)
      addExternalAudioListener(audio, 'canplay', handleAudioCanPlay)
      addExternalAudioListener(audio, 'seeked', handleAudioSeeked)
      addExternalAudioListener(audio, 'error', handleAudioError)
      if (!videoElement.paused) {
        playAudio()
      }
    }

    const updateExternalAudioPreparingState = (videoInfo, targetPlayer) => {
      const videoElement = targetPlayer.getMediaElement?.()
      if (!videoElement) {
        return
      }

      if (videoInfo.externalAudioPreparing || videoInfo.externalAudioUrl) {
        videoElement.muted = true
      }
    }

    const applyVideoInfo = (videoInfo, token, targetPlayer) => {
      if (!videoInfo.videoUrl) {
        return
      }

      const isNewVideo = videoInfo.videoUrl !== activeVideoUrl
      if (isNewVideo) {
        cleanupExternalAudio()
        activeVideoUrl = videoInfo.videoUrl
        activeExternalAudioUrl = ''
        targetPlayer.once('canplay', () => handleReady(token, targetPlayer))
        targetPlayer.setSource(videoInfo)
        updateExternalAudioPreparingState(videoInfo, targetPlayer)
        if (videoInfo.externalAudioUrl) {
          setupExternalAudio(videoInfo, token, targetPlayer)
        }
        return
      }

      updateExternalAudioPreparingState(videoInfo, targetPlayer)
      if (videoInfo.externalAudioUrl !== activeExternalAudioUrl) {
        if (videoInfo.externalAudioUrl) {
          setupExternalAudio(videoInfo, token, targetPlayer)
        } else {
          cleanupExternalAudio()
        }
      }
    }

    const createPlayerElement = () => {
      const mount = playerMountRef.value
      if (!mount) {
        return null
      }

      mount.replaceChildren()

      if (props.playerType === 'Plyr') {
        const video = document.createElement('video')
        const source = document.createElement('source')
        video.setAttribute('playsinline', '')
        video.appendChild(source)
        mount.appendChild(video)
        return video
      }

      const container = document.createElement('div')
      mount.appendChild(container)
      return container
    }

    const initPlayer = async () => {
      destroyPlayer()
      const token = playerToken
      updateCount.value = 10
      await nextTick()

      const container = createPlayerElement()
      if (!container || token !== playerToken) {
        return
      }

      const nextPlayer = await createPlayer(props.playerType, {
        container,
        // Save the playback position when the video is playing
        onTimeUpdate: () => {
          if (token !== playerToken || player !== nextPlayer) {
            return
          }

          // console.log('onTimeUpdate')
          // If is playing
          updateCount.value -= 1
          if (nextPlayer.isPlaying() && currentVideoInfo.value.path && updateCount.value <= 0) {
            updateCount.value = 10
            saveVideoTime(currentVideoInfo.value.path, nextPlayer.getCurrentTime())
          }
        },
        onEnded: () => {
          if (token !== playerToken || player !== nextPlayer) {
            return
          }

          saveVideoTime(currentVideoInfo.value.path, 0)
        }
      })

      if (token !== playerToken) {
        nextPlayer.destroy()
        return
      }

      player = nextPlayer

      // Expose player instance for keyboard shortcuts
      window.__videoPlayer = player

      if (currentVideoInfo.value.videoUrl) {
        applyVideoInfo(currentVideoInfo.value, token, player)
      }
    }

    const handleWindowClick = () => {
      setTimeout(focusVideo, 0)
    }

    onMounted(async () => {
      await initPlayer()
      window.addEventListener('click', handleWindowClick)
    })

    const handleReady = (token, readyPlayer) => {
      if (token !== playerToken || player !== readyPlayer) {
        return
      }

      // Set the saved playback position
      const savedTime = loadVideoTime(currentVideoInfo.value.path)
      const timeElapsed = ref(0)
      const eps = 1e-3
      const MAX_ATTEMPTS = 500
      const checkInterval = setInterval(() => {
        if (token !== playerToken || player !== readyPlayer) {
          clearInterval(checkInterval)
          return
        }

        // So fucking weird. Have to set the currentTime
        // over and over again until it's equal to the savedTime
        if (timeElapsed.value > MAX_ATTEMPTS) {
          clearInterval(checkInterval)
          console.log('Max attempts reached. Giving up.')
          console.log(`timeElapsed: ${timeElapsed.value} ms, player.currentTime: ${readyPlayer.getCurrentTime()}`)
          // playVideo()
          readyPlayer.play()
        } else if (Math.abs(savedTime - readyPlayer.getCurrentTime()) > eps) {
          readyPlayer.setCurrentTime(savedTime)
        } else {
          // Finally, we're done
          clearInterval(checkInterval)
          console.log(`timeElapsed: ${timeElapsed.value} ms`)
          // console.log(`player.currentTime: ${player.getCurrentTime()}`)
          // playVideo()
          readyPlayer.play()
        }
        timeElapsed.value += 1
      }, 1)
    }

    // Watch for changes in the current video
    watch(() => currentVideoInfo.value, () => {
      if (player && currentVideoInfo.value.videoUrl) {
        const token = playerToken
        const currentPlayer = player
        applyVideoInfo(currentVideoInfo.value, token, currentPlayer)
      }
    })

    watch(() => props.playerType, async () => {
      await initPlayer()
    })

    onUnmounted(() => {
      window.removeEventListener('click', handleWindowClick)
      destroyPlayer()
    })

    return {
      playerMountRef,
      currentVideoInfo,
      audioPreparingProgressText,
    }
  }
}
</script>

<style>
@import 'plyr/dist/plyr.css';

/* Video player container style */
.video-player {
  flex: 1;
  min-width: 0;
  width: 100%;
  height: 100dvh;
  background-color: #000;
  margin: 0;
  display: flex;
  position: relative;
}

.layout-mobile .video-player {
  width: 100vw;
  height: 100dvh;
}

.video-player .dplayer,
.video-player .plyr,
.player-mount {
  width: 100%;
  height: 100%;
}

.player-mount > video,
.player-mount > div {
  width: 100%;
  height: 100%;
}

.dplayer-subtitle {
  text-shadow: 1px 1px 10px rgb(0, 0, 0) !important;
}

.audio-preparing {
  position: absolute;
  right: 16px;
  top: 16px;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background-color: rgba(0, 0, 0, 0.72);
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  line-height: 1.4;
  pointer-events: none;
}

.audio-preparing-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.28);
  border-top-color: rgba(255, 255, 255, 0.92);
  border-radius: 50%;
  animation: audio-preparing-spin 0.8s linear infinite;
  flex: 0 0 auto;
}

.audio-preparing-progress {
  color: rgba(255, 255, 255, 0.72);
  font-variant-numeric: tabular-nums;
}

@keyframes audio-preparing-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
