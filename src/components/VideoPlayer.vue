<template>
  <div class="video-player">
    <div ref="playerMountRef" class="player-mount"></div>
  </div>
</template>

<script>
import { nextTick, ref, onMounted, onUnmounted, watch, toRaw } from 'vue'
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
    const playerMountRef = ref(null)
    const updateCount = ref(10)

    const MAX_HISTORY_ITEMS = 100
    const HISTORY_KEY = 'video-time-history'
    const buildHistoryKey = (vidKey) => Array.isArray(vidKey) ? vidKey.join(',') : String(vidKey || '')

    const { currentVideoInfo } = useVideoLibrary()

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
      if (player) {
        player.destroy()
      }
      player = null
      window.__videoPlayer = null

      if (playerMountRef.value) {
        playerMountRef.value.replaceChildren()
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
        source.type = 'video/mp4'
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
            console.log(currentVideoInfo.value.path)
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
        player.once('canplay', () => handleReady(token, player))
        player.setSource(currentVideoInfo.value)
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
      console.log('currentVideoInfo:', toRaw(currentVideoInfo.value))
      if (player && currentVideoInfo.value.videoUrl) {
        const token = playerToken
        const currentPlayer = player
        player.once('canplay', () => handleReady(token, currentPlayer))
        player.setSource(currentVideoInfo.value)
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
</style>
