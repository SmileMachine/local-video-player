<template>
  <div class="video-player">
    <video v-if="playerType === 'Plyr'" id="video-player" ref="playerRef" playsinline>
      <source type="video/mp4" />
    </video>
    <div v-else id="video-player" ref="playerRef">
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch, toRaw } from 'vue'
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
    const playerRef = ref(null)
    const firstPlay = ref(true)

    const MAX_HISTORY_ITEMS = 100
    const HISTORY_KEY = 'video-time-history'

    const { currentVideoInfo } = useVideoLibrary()

    // Get the saved playback time
    const loadVideoTime = (videoUrl) => {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}')
      return history[videoUrl]?.time || 0
    }

    // Save the playback time
    const saveVideoTime = (vid_key, currentTime) => {
      let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}')

      // If the number of records exceeds the maximum, delete the earliest accessed record
      const keys = Object.keys(history)
      if (keys.length >= MAX_HISTORY_ITEMS && !history[vid_key]) {
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
      history[vid_key] = {
        time: currentTime,
        accessedAt: Date.now()
      }

      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    }

    onMounted(async () => {
      player = await createPlayer(props.playerType, {
        container: document.getElementById('video-player'),
        // Save the playback position when the video is playing
        onTimeUpdate: () => {
          // console.log('onTimeUpdate')
          // If is playing
          if (player.isPlaying() && currentVideoInfo.value.path) {
            saveVideoTime(currentVideoInfo.value.path, player.getCurrentTime())
            console.log(currentVideoInfo.value.path)
          }
        },
        onEnded: () => {
          saveVideoTime(currentVideoInfo.value.path, 0)
        }
      })
    })

    const handleReady = () => {
      // Set the saved playback position
      const savedTime = loadVideoTime(currentVideoInfo.value.path)
      const timeElapsed = ref(0)
      const MAX_ATTEMPTS = 500
      const checkInterval = setInterval(() => {
        // So fucking weird. Have to set the currentTime
        // over and over again until it's equal to the savedTime
        if (timeElapsed.value > MAX_ATTEMPTS) {
          clearInterval(checkInterval)
          console.log('Max attempts reached. Giving up.')
          console.log(`timeElapsed: ${timeElapsed.value} ms, player.currentTime: ${player.getCurrentTime()}`)
          // playVideo()
          player.play()
        } else if (savedTime != player.getCurrentTime()) {
          player.setCurrentTime(savedTime)
        } else {
          // Finally, we're done
          clearInterval(checkInterval)
          console.log(`timeElapsed: ${timeElapsed.value} ms`)
          // console.log(`player.currentTime: ${player.getCurrentTime()}`)
          // playVideo()
          player.play()
        }
        timeElapsed.value += 1
      }, 1)
    }

    // Watch for changes in the current video
    watch(() => currentVideoInfo.value, () => {
      console.log('currentVideoInfo:', toRaw(currentVideoInfo.value))
      if (player && currentVideoInfo.value.videoUrl) {
        player.once('canplay', handleReady)
        player.setSource(currentVideoInfo.value)
      }
    })

    onUnmounted(() => {
      if (player) {
        player.destroy()
      }
    })

    return {
      playerRef,
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
  height: 100vh;
  background-color: #000;
  margin: 0;
  display: flex;
}

.video-player .dplayer,
.video-player .plyr {
  width: 100%;
  height: 100%;
}
.dplayer-subtitle {
  text-shadow: 1px 1px 10px rgb(0, 0, 0) !important;
}
</style>
