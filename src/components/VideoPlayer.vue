<template>
  <div class="video-player">
    <video id="video-player" ref="playerRef" playsinline>
      <source type="video/mp4" />
    </video>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch, toRaw} from 'vue'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { useVideoLibrary } from '../composables/useVideoLibrary'

export default {
  name: 'VideoPlayer',
  setup() {
    let player = null
    const playerRef = ref(null)
    const firstPlay = ref(true)

    const MAX_HISTORY_ITEMS = 100
    const HISTORY_KEY = 'video-time-history'

    const currentVideoUrl = ref(null)

    const { currentVideoInfo } = useVideoLibrary()

    // Get the saved playback time
    const loadVideoTime = (videoUrl) => {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}')
      return history[videoUrl]?.time || 0
    }

    // Save the playback time
    const saveVideoTime = (videoUrl, currentTime) => {
      let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}')

      // If the number of records exceeds the maximum, delete the earliest accessed record
      const keys = Object.keys(history)
      if (keys.length >= MAX_HISTORY_ITEMS && !history[videoUrl]) {
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
      history[videoUrl] = {
        time: currentTime,
        accessedAt: Date.now()
      }

      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    }

    onMounted(() => {
      player = new Plyr('#video-player', {
        controls: [
          'play',
          'progress',
          'current-time',
          'duration',
          'captions',
          'settings',
          'mute',
          'volume',
          'fullscreen',
        ],
        settings: [
          'captions',
          'speed'
        ],
        captions: {
          active: true,
          language: 'zh',
          update: false
        },
        keyboard: { global: true },
        seekTime: 5,
        listeners: {
          dblclick: false
        },
      })

      player.source = {
        type: 'video',
      }

      // Save the playback position when the video is playing
      player.on('timeupdate', () => {
        // If is playing
        if (player.playing && currentVideoInfo.value.videoUrl) {
          saveVideoTime(currentVideoInfo.value.videoUrl, player.currentTime)
        }
      })
      // Reset the playback time when the video is ended
      player.on('ended', () => {
        saveVideoTime(currentVideoInfo.value.videoUrl, 0)
      })
    })

    const playVideo = () => {
      if (firstPlay.value) {
        firstPlay.value = false
        console.log('First Play:', currentVideoInfo.value.videoUrl)
      } else {
        console.log('Trying to play:', currentVideoInfo.value.videoUrl)
        player.play().catch(error => {
          console.log('Failed to play:', error)
        })
      }
    }

    const handleReady = () => {
      // Set the saved playback position
      const savedTime = loadVideoTime(currentVideoInfo.value.videoUrl)
      const timeElapsed = ref(0)
      const MAX_ATTEMPTS = 500
      const checkInterval = setInterval(() => {
        // So fucking weird. Have to set the currentTime
        // over and over again until it's equal to the savedTime
        if (timeElapsed.value > MAX_ATTEMPTS) {
          clearInterval(checkInterval)
          console.log('Max attempts reached. Giving up.')
          console.log(`timeElapsed: ${timeElapsed.value} ms, player.currentTime: ${player.currentTime}`)
          playVideo()
        } else if (savedTime != player.currentTime) {
          player.currentTime = savedTime
        } else {
          // Finally, we're done
          clearInterval(checkInterval)
          console.log(`timeElapsed: ${timeElapsed.value} ms`)
          playVideo()
        }
        timeElapsed.value += 1
      }, 1)
    }

    // Watch for changes in the current video
    watch(() => currentVideoInfo.value, () => {
      console.log('currentVideoInfo:', toRaw(currentVideoInfo.value))
      if (player && currentVideoInfo.value.videoUrl) {
        player.once('ready', handleReady)
        player.source = {
          type: 'video',
          sources: [{
            src: currentVideoInfo.value.videoUrl,
            type: 'video/mp4'
          }],
          tracks: currentVideoInfo.value.captionExists ? [{
            kind: 'captions',
            label: '中文',
            srclang: 'zh',
            src: currentVideoInfo.value.captionUrl,
            default: true
          }] : []
        }
      }
    })

    onUnmounted(() => {
      if (player) {
        player.destroy()
      }
    })

    return {
      playerRef,
      currentVideoUrl,
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
  /* Prevent flex child items from overflowing */
  height: 100vh;
  background-color: #000;
  margin: 0;
}

.video-player .plyr {
  width: 100%;
  height: 100%;
}

.video-player video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
