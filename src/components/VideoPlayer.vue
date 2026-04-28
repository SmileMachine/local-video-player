<template>
  <div class="video-player">
    <div ref="playerMountRef" class="player-mount"></div>
    <div
      v-if="supportedCaptionTracks.length && showCaptionMenu"
      class="caption-menu"
      :style="captionMenuStyle"
      @click.stop
    >
      <div class="caption-field">
        <label class="caption-field-heading">
          <input
            type="checkbox"
            :checked="captionSelection.enabled"
            @change="setCaptionEnabled($event.target.checked)"
          />
          <span>字幕</span>
        </label>
        <select
          :value="captionSelection.primaryTrackId"
          :disabled="!captionSelection.enabled"
          @change="setCaptionPrimaryTrack($event.target.value)"
        >
          <option
            v-for="track in supportedCaptionTracks"
            :key="track.id"
            :value="track.id"
          >
            {{ formatCaptionTrackLabel(track) }}
          </option>
        </select>
      </div>
      <div v-if="supportedCaptionTracks.length > 1" class="caption-field">
        <label class="caption-field-heading">
          <input
            type="checkbox"
            :checked="captionSelection.combined"
            :disabled="!captionSelection.enabled || supportedCaptionTracks.length < 2"
            @change="setCaptionCombined($event.target.checked)"
          />
          <span>第二字幕</span>
        </label>
        <select
          :value="captionSelection.secondaryTrackId"
          :disabled="!captionSelection.enabled || !captionSelection.combined"
          @change="setCaptionSecondaryTrack($event.target.value)"
        >
          <option
            v-for="track in secondaryCaptionTracks"
            :key="track.id"
            :value="track.id"
          >
            {{ formatCaptionTrackLabel(track) }}
          </option>
        </select>
      </div>
    </div>
    <div v-if="audioPreparingVisible" class="audio-preparing">
      <span class="audio-preparing-spinner" aria-hidden="true"></span>
      <span>{{ audioPreparingMessage }}</span>
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
    let activeCaptionUrl = ''
    const playerMountRef = ref(null)
    const updateCount = ref(10)
    const showCaptionMenu = ref(false)
    const captionMenuStyle = ref({ right: '16px', bottom: '64px' })

    const MAX_HISTORY_ITEMS = 100
    const HISTORY_KEY = 'video-time-history'
    const buildHistoryKey = (vidKey) => Array.isArray(vidKey) ? vidKey.join(',') : String(vidKey || '')

    const {
      currentVideoInfo,
      captionSelection,
      supportedCaptionTracks,
      setCaptionEnabled,
      setCaptionPrimaryTrack,
      setCaptionSecondaryTrack,
      setCaptionCombined
    } = useVideoLibrary()
    const audioPreparingProgressText = computed(() => {
      if (!currentVideoInfo.value.externalAudioPreparing) {
        return ''
      }
      const progress = Number(currentVideoInfo.value.externalAudioProgress)
      if (!Number.isFinite(progress)) {
        return ''
      }
      return `${Math.max(0, Math.min(100, Math.round(progress)))}%`
    })
    const audioPreparingVisible = computed(() =>
      Boolean(currentVideoInfo.value.externalAudioChecking || currentVideoInfo.value.externalAudioPreparing)
    )
    const audioPreparingMessage = computed(() =>
      currentVideoInfo.value.externalAudioChecking ? '正在检查兼容音频' : '正在准备兼容音频'
    )
    const secondaryCaptionTracks = computed(() =>
      supportedCaptionTracks.value.filter((track) => track.id !== captionSelection.value.primaryTrackId)
    )
    const formatCaptionTrackLabel = (track) => {
      const parts = [track.label || track.language || track.id]
      const detail = track.language && track.language !== 'und'
        ? track.language
        : track.codec || track.format || ''
      if (detail && !parts.includes(detail)) {
        parts.push(detail)
      }
      return parts.join(' · ')
    }

    const captionTriggerSelector = [
      '[data-plyr="captions"]',
      '.dplayer-subtitle-btn',
      '.dplayer-subtitle-icon',
      '.dplayer-subtitles-icon'
    ].join(', ')

    const openCaptionMenu = (trigger) => {
      if (!supportedCaptionTracks.value.length) {
        return
      }

      const playerRect = playerMountRef.value?.getBoundingClientRect()
      const triggerRect = trigger?.getBoundingClientRect?.()
      if (!playerRect || !triggerRect) {
        captionMenuStyle.value = { right: '16px', bottom: '64px' }
        showCaptionMenu.value = true
        return
      }

      const menuWidth = 240
      const margin = 8
      const centerX = triggerRect.left - playerRect.left + triggerRect.width / 2
      const left = Math.max(
        margin,
        Math.min(centerX - menuWidth / 2, playerRect.width - menuWidth - margin)
      )
      const bottom = Math.max(margin, playerRect.bottom - triggerRect.top + margin)

      captionMenuStyle.value = {
        left: `${left}px`,
        bottom: `${bottom}px`
      }
      showCaptionMenu.value = true
    }

    const handleCaptionTriggerEvent = (event) => {
      const trigger = event.target?.closest?.(captionTriggerSelector)
      if (!trigger || !playerMountRef.value?.contains(trigger)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()
      if (showCaptionMenu.value) {
        showCaptionMenu.value = false
        return
      }
      openCaptionMenu(trigger)
    }

    const handleCaptionTriggerKeydown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }
      handleCaptionTriggerEvent(event)
    }

    // Get the saved playback time
    const loadVideoTime = (videoId, fallbackPath) => {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}')
      return history[buildHistoryKey(videoId)]?.time || history[buildHistoryKey(fallbackPath)]?.time || 0
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
      activeCaptionUrl = ''

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

      if (videoInfo.externalAudioChecking || videoInfo.externalAudioPreparing || videoInfo.externalAudioUrl) {
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
        activeCaptionUrl = videoInfo.captionUrl || ''
        targetPlayer.once('canplay', () => handleReady(token, targetPlayer))
        targetPlayer.setSource(videoInfo)
        updateExternalAudioPreparingState(videoInfo, targetPlayer)
        if (videoInfo.externalAudioUrl) {
          setupExternalAudio(videoInfo, token, targetPlayer)
        }
        return
      }

      updateExternalAudioPreparingState(videoInfo, targetPlayer)
      if ((videoInfo.captionUrl || '') !== activeCaptionUrl) {
        activeCaptionUrl = videoInfo.captionUrl || ''
        targetPlayer.setCaption?.(videoInfo)
      }
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
          if (nextPlayer.isPlaying() && currentVideoInfo.value.id && updateCount.value <= 0) {
            updateCount.value = 10
            saveVideoTime(currentVideoInfo.value.id, nextPlayer.getCurrentTime())
          }
        },
        onEnded: () => {
          if (token !== playerToken || player !== nextPlayer) {
            return
          }

          saveVideoTime(currentVideoInfo.value.id, 0)
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
      showCaptionMenu.value = false
      setTimeout(focusVideo, 0)
    }

    onMounted(async () => {
      await initPlayer()
      window.addEventListener('click', handleWindowClick)
      playerMountRef.value?.addEventListener('click', handleCaptionTriggerEvent, true)
      playerMountRef.value?.addEventListener('keydown', handleCaptionTriggerKeydown, true)
    })

    const handleReady = (token, readyPlayer) => {
      if (token !== playerToken || player !== readyPlayer) {
        return
      }

      // Set the saved playback position
      const savedTime = loadVideoTime(currentVideoInfo.value.id, currentVideoInfo.value.path)
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

    watch(() => currentVideoInfo.value.videoUrl, () => {
      showCaptionMenu.value = false
    })

    onUnmounted(() => {
      window.removeEventListener('click', handleWindowClick)
      playerMountRef.value?.removeEventListener('click', handleCaptionTriggerEvent, true)
      playerMountRef.value?.removeEventListener('keydown', handleCaptionTriggerKeydown, true)
      destroyPlayer()
    })

    return {
      playerMountRef,
      currentVideoInfo,
      audioPreparingVisible,
      audioPreparingMessage,
      audioPreparingProgressText,
      captionSelection,
      supportedCaptionTracks,
      secondaryCaptionTracks,
      showCaptionMenu,
      captionMenuStyle,
      formatCaptionTrackLabel,
      setCaptionEnabled,
      setCaptionPrimaryTrack,
      setCaptionSecondaryTrack,
      setCaptionCombined,
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

.video-player .dplayer-subtitles {
  display: none !important;
}

.caption-menu {
  position: absolute;
  width: 240px;
  max-width: calc(100% - 16px);
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  background-color: rgba(0, 0, 0, 0.82);
  color: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.38);
}

.caption-field-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
}

.caption-field-heading input {
  width: 16px;
  height: 16px;
  accent-color: #ffffff;
}

.caption-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.68);
}

.caption-field select {
  width: 100%;
  min-height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  background-color: rgba(20, 20, 20, 0.96);
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  padding: 6px 8px;
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
