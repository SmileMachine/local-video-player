<template>
  <div class="video-player">
    <div ref="playerMountRef" class="player-mount"></div>
    <div
      v-if="captionMenuVisible"
      class="caption-menu"
      :style="captionMenuStyle"
      @click.stop
    >
      <div v-if="supportedCaptionTracks.length" class="caption-field">
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
    <div
      v-if="danmakuMenuVisible"
      class="caption-menu"
      :style="danmakuMenuStyle"
      @click.stop
    >
      <div class="caption-field danmaku-toggle-field">
        <span class="caption-field-heading">弹幕开关</span>
        <button
          class="danmaku-switch"
          type="button"
          role="switch"
          :aria-checked="danmakuEnabled"
          :class="{ 'danmaku-switch-on': danmakuEnabled }"
          @click="setDanmakuEnabled(!danmakuEnabled)"
        >
          <span class="danmaku-switch-thumb" aria-hidden="true"></span>
        </button>
      </div>
      <div class="caption-field">
        <label class="caption-field-heading" for="danmaku-speed-input">
          <span>弹幕速度</span>
          <span class="danmaku-speed-value">{{ danmakuSpeedText }}</span>
        </label>
        <input
          id="danmaku-speed-input"
          class="danmaku-speed-slider"
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          :value="danmakuSpeed"
          @input="setDanmakuSpeed($event.target.value)"
        />
      </div>
      <div class="caption-field">
        <span class="caption-field-heading">弹幕阴影</span>
        <div class="danmaku-segmented-control" role="group" aria-label="弹幕阴影">
          <button
            v-for="option in danmakuShadowOptions"
            :key="option.value"
            class="danmaku-segmented-button"
            type="button"
            :class="{ 'danmaku-segmented-button-active': danmakuShadow === option.value }"
            @click="setDanmakuShadow(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
      <div class="caption-field">
        <span class="caption-field-heading">弹幕字重</span>
        <div class="danmaku-segmented-control" role="group" aria-label="弹幕字重">
          <button
            v-for="option in danmakuWeightOptions"
            :key="option.value"
            class="danmaku-segmented-button"
            type="button"
            :class="{ 'danmaku-segmented-button-active': danmakuWeight === option.value }"
            @click="setDanmakuWeight(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
      <form class="caption-field" @submit.prevent="submitDanmakuImport">
        <label class="caption-field-heading" for="danmaku-bvid-input">B站弹幕</label>
        <div v-if="currentVideoInfo.danmakuExists" class="danmaku-import-current">
          当前：{{ currentVideoInfo.danmakuFileName || '已加载本地弹幕' }}
        </div>
        <div class="danmaku-import-row">
          <input
            id="danmaku-bvid-input"
            v-model.trim="danmakuBvid"
            class="danmaku-import-input"
            type="text"
            placeholder="BV号"
            :disabled="danmakuImporting"
          />
          <button
            class="danmaku-import-button"
            type="submit"
            :disabled="danmakuImporting || !danmakuBvid"
          >
            {{ danmakuImporting ? '导入中' : '导入' }}
          </button>
        </div>
        <div
          v-if="danmakuImportMessage"
          class="danmaku-import-status"
          :class="{ 'danmaku-import-status-error': danmakuImportError }"
        >
          {{ danmakuImportMessage }}
        </div>
      </form>
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
    let activeDanmakuSignature = ''
    const playerMountRef = ref(null)
    const updateCount = ref(10)
    const showCaptionMenu = ref(false)
    const captionMenuStyle = ref({ right: '16px', bottom: '64px' })
    const showDanmakuMenu = ref(false)
    const danmakuMenuStyle = ref({ right: '16px', bottom: '64px' })
    const danmakuBvid = ref('')
    const danmakuImporting = ref(false)
    const danmakuImportMessage = ref('')
    const danmakuImportError = ref(false)

    const MAX_HISTORY_ITEMS = 100
    const HISTORY_KEY = 'video-time-history'
    const DANMAKU_SPEED_KEY = 'video-danmaku-speed'
    const DANMAKU_ENABLED_KEY = 'video-danmaku-enabled'
    const DANMAKU_SHADOW_KEY = 'video-danmaku-shadow'
    const DANMAKU_WEIGHT_KEY = 'video-danmaku-weight'
    const DANMAKU_SHADOW_VALUES = new Set(['off', 'soft', 'strong'])
    const DANMAKU_WEIGHT_VALUES = new Set(['normal', 'medium', 'bold'])
    const danmakuShadowOptions = [
      { value: 'off', label: '关闭' },
      { value: 'soft', label: '柔和' },
      { value: 'strong', label: '强' }
    ]
    const danmakuWeightOptions = [
      { value: 'normal', label: '常规' },
      { value: 'medium', label: '中等' },
      { value: 'bold', label: '加粗' }
    ]
    const MIN_DANMAKU_SPEED = 0.1
    const MAX_DANMAKU_SPEED = 1
    const buildHistoryKey = (vidKey) => Array.isArray(vidKey) ? vidKey.join(',') : String(vidKey || '')
    const normalizeDanmakuSpeed = (value) => {
      const speed = Number(value)
      if (!Number.isFinite(speed)) {
        return 1
      }
      return Math.max(MIN_DANMAKU_SPEED, Math.min(MAX_DANMAKU_SPEED, Math.round(speed * 10) / 10))
    }
    const readDanmakuSpeed = () => normalizeDanmakuSpeed(localStorage.getItem(DANMAKU_SPEED_KEY))
    const readDanmakuEnabled = () => localStorage.getItem(DANMAKU_ENABLED_KEY) !== 'false'
    const normalizeDanmakuShadow = (value) => DANMAKU_SHADOW_VALUES.has(value) ? value : 'soft'
    const readDanmakuShadow = () => normalizeDanmakuShadow(localStorage.getItem(DANMAKU_SHADOW_KEY))
    const normalizeDanmakuWeight = (value) => DANMAKU_WEIGHT_VALUES.has(value) ? value : 'medium'
    const readDanmakuWeight = () => normalizeDanmakuWeight(localStorage.getItem(DANMAKU_WEIGHT_KEY))
    const danmakuSpeed = ref(readDanmakuSpeed())
    const danmakuEnabled = ref(readDanmakuEnabled())
    const danmakuShadow = ref(readDanmakuShadow())
    const danmakuWeight = ref(readDanmakuWeight())

    const {
      currentVideoInfo,
      captionSelection,
      supportedCaptionTracks,
      setCaptionEnabled,
      setCaptionPrimaryTrack,
      setCaptionSecondaryTrack,
      setCaptionCombined,
      importDanmaku
    } = useVideoLibrary()
    const canImportDanmaku = computed(() => props.playerType === 'DPlayer' && Boolean(currentVideoInfo.value.id))
    const captionMenuVisible = computed(() =>
      showCaptionMenu.value && Boolean(supportedCaptionTracks.value.length)
    )
    const danmakuMenuVisible = computed(() =>
      showDanmakuMenu.value && canImportDanmaku.value
    )
    const danmakuSpeedText = computed(() => `${danmakuSpeed.value.toFixed(1)}x`)
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

    const danmakuTriggerSelector = [
      '.dplayer-comment',
      '.dplayer-comment-icon'
    ].join(', ')

    const positionMenu = (trigger, targetStyleRef) => {
      const playerRect = playerMountRef.value?.getBoundingClientRect()
      const triggerRect = trigger?.getBoundingClientRect?.()
      if (!playerRect || !triggerRect) {
        targetStyleRef.value = { right: '16px', bottom: '64px' }
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

      targetStyleRef.value = {
        left: `${left}px`,
        bottom: `${bottom}px`
      }
    }

    const openCaptionMenu = (trigger) => {
      if (!supportedCaptionTracks.value.length) {
        return
      }

      positionMenu(trigger, captionMenuStyle)
      showDanmakuMenu.value = false
      showCaptionMenu.value = true
    }

    const openDanmakuMenu = (trigger) => {
      if (!canImportDanmaku.value) {
        return
      }

      positionMenu(trigger, danmakuMenuStyle)
      showCaptionMenu.value = false
      showDanmakuMenu.value = true
    }

    const toggleCaptionMenu = (trigger) => {
      if (showCaptionMenu.value) {
        showCaptionMenu.value = false
        return
      }
      openCaptionMenu(trigger)
    }

    const toggleDanmakuMenu = (trigger) => {
      if (showDanmakuMenu.value) {
        showDanmakuMenu.value = false
        return
      }
      openDanmakuMenu(trigger)
    }

    const handleMenuTriggerEvent = (event) => {
      const danmakuTrigger = event.target?.closest?.(danmakuTriggerSelector)
      if (danmakuTrigger && playerMountRef.value?.contains(danmakuTrigger)) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        toggleDanmakuMenu(danmakuTrigger)
        return
      }

      const captionTrigger = event.target?.closest?.(captionTriggerSelector)
      if (!captionTrigger || !playerMountRef.value?.contains(captionTrigger)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()
      toggleCaptionMenu(captionTrigger)
    }

    const handleMenuTriggerKeydown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      const danmakuTrigger = event.target?.closest?.(danmakuTriggerSelector)
      if (danmakuTrigger && playerMountRef.value?.contains(danmakuTrigger)) {
        handleMenuTriggerEvent(event)
        return
      }

      const captionTrigger = event.target?.closest?.(captionTriggerSelector)
      if (captionTrigger && playerMountRef.value?.contains(captionTrigger)) {
        handleMenuTriggerEvent(event)
      }
    }

    const isEditableShortcutTarget = (target) => {
      if (!target) {
        return false
      }

      const tagName = String(target.tagName || '').toLowerCase()
      return (
        ['input', 'textarea', 'select'].includes(tagName) ||
        target.isContentEditable ||
        Boolean(target.closest?.("[contenteditable='true']"))
      )
    }

    const handleDanmakuShortcut = (event) => {
      if ((event.key !== 'd' && event.key !== 'D') || isEditableShortcutTarget(event.target)) {
        return
      }
      if (!canImportDanmaku.value) {
        return
      }

      event.preventDefault()
      setDanmakuEnabled(!danmakuEnabled.value)
    }

    const closeMediaMenus = () => {
      showCaptionMenu.value = false
      showDanmakuMenu.value = false
    }

    const clearDanmakuImportStatus = () => {
      danmakuImportMessage.value = ''
      danmakuImportError.value = false
    }

    const resetDanmakuImportForm = () => {
      danmakuBvid.value = ''
      clearDanmakuImportStatus()
    }

    const closeMediaMenusAndFocus = () => {
      closeMediaMenus()
      setTimeout(focusVideo, 0)
    }

    const setDanmakuSpeed = (value) => {
      const nextSpeed = normalizeDanmakuSpeed(value)
      danmakuSpeed.value = nextSpeed
      localStorage.setItem(DANMAKU_SPEED_KEY, String(nextSpeed))
      player?.setDanmakuSpeed?.(nextSpeed)
    }

    const setDanmakuEnabled = (value) => {
      const nextEnabled = Boolean(value)
      danmakuEnabled.value = nextEnabled
      localStorage.setItem(DANMAKU_ENABLED_KEY, String(nextEnabled))
      player?.setDanmakuVisible?.(nextEnabled)
    }

    const applyDanmakuStyle = () => {
      const mount = playerMountRef.value
      if (!mount) {
        return
      }

      mount.classList.remove(
        'danmaku-shadow-off',
        'danmaku-shadow-soft',
        'danmaku-shadow-strong'
      )
      mount.classList.remove(
        'danmaku-weight-normal',
        'danmaku-weight-medium',
        'danmaku-weight-bold'
      )
      mount.classList.add(`danmaku-shadow-${danmakuShadow.value}`)
      mount.classList.add(`danmaku-weight-${danmakuWeight.value}`)
    }

    const setDanmakuShadow = (value) => {
      const nextShadow = normalizeDanmakuShadow(value)
      danmakuShadow.value = nextShadow
      localStorage.setItem(DANMAKU_SHADOW_KEY, nextShadow)
      applyDanmakuStyle()
    }

    const setDanmakuWeight = (value) => {
      const nextWeight = normalizeDanmakuWeight(value)
      danmakuWeight.value = nextWeight
      localStorage.setItem(DANMAKU_WEIGHT_KEY, nextWeight)
      applyDanmakuStyle()
    }

    const submitDanmakuImport = async () => {
      if (!danmakuBvid.value || danmakuImporting.value) {
        return
      }

      danmakuImporting.value = true
      danmakuImportError.value = false
      danmakuImportMessage.value = '正在导入弹幕'
      try {
        const result = await importDanmaku(danmakuBvid.value)
        danmakuImportMessage.value = `已导入 ${result.stats?.converted ?? 0} 条弹幕`
      } catch (error) {
        danmakuImportError.value = true
        danmakuImportMessage.value = error.message || '弹幕导入失败'
      } finally {
        danmakuImporting.value = false
      }
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
      activeDanmakuSignature = ''

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

      const danmakuSignature = `${videoInfo.id || ''}:${videoInfo.danmakuVersion || 0}`
      const isNewVideo = videoInfo.videoUrl !== activeVideoUrl
      if (isNewVideo) {
        cleanupExternalAudio()
        activeVideoUrl = videoInfo.videoUrl
        activeExternalAudioUrl = ''
        activeCaptionUrl = videoInfo.captionUrl || ''
        activeDanmakuSignature = danmakuSignature
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
      if (danmakuSignature !== activeDanmakuSignature) {
        activeDanmakuSignature = danmakuSignature
        targetPlayer.setDanmaku?.(videoInfo)
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
      nextPlayer.setDanmakuSpeed?.(danmakuSpeed.value)
      nextPlayer.setDanmakuVisible?.(danmakuEnabled.value)
      applyDanmakuStyle()

      // Expose player instance for keyboard shortcuts
      window.__videoPlayer = player

      if (currentVideoInfo.value.videoUrl) {
        applyVideoInfo(currentVideoInfo.value, token, player)
      }
    }

    onMounted(async () => {
      await initPlayer()
      window.addEventListener('click', closeMediaMenusAndFocus)
      window.addEventListener('keydown', handleDanmakuShortcut)
      playerMountRef.value?.addEventListener('click', handleMenuTriggerEvent, true)
      playerMountRef.value?.addEventListener('keydown', handleMenuTriggerKeydown, true)
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

    watch(() => danmakuShadow.value, () => {
      applyDanmakuStyle()
    })

    watch(() => danmakuWeight.value, () => {
      applyDanmakuStyle()
    })

    watch(() => currentVideoInfo.value.videoUrl, () => {
      closeMediaMenus()
      resetDanmakuImportForm()
    })

    onUnmounted(() => {
      window.removeEventListener('click', closeMediaMenusAndFocus)
      window.removeEventListener('keydown', handleDanmakuShortcut)
      playerMountRef.value?.removeEventListener('click', handleMenuTriggerEvent, true)
      playerMountRef.value?.removeEventListener('keydown', handleMenuTriggerKeydown, true)
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
      canImportDanmaku,
      captionMenuVisible,
      danmakuMenuVisible,
      showCaptionMenu,
      captionMenuStyle,
      showDanmakuMenu,
      danmakuMenuStyle,
      danmakuBvid,
      danmakuSpeed,
      danmakuSpeedText,
      danmakuEnabled,
      danmakuShadowOptions,
      danmakuWeightOptions,
      danmakuShadow,
      danmakuWeight,
      danmakuImporting,
      danmakuImportMessage,
      danmakuImportError,
      formatCaptionTrackLabel,
      setDanmakuSpeed,
      setDanmakuEnabled,
      setDanmakuShadow,
      setDanmakuWeight,
      submitDanmakuImport,
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

.player-mount.danmaku-shadow-off .dplayer-danmaku-item {
  text-shadow: none;
}

.player-mount.danmaku-shadow-soft .dplayer-danmaku-item {
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.7),
    1px 0 2px rgba(0, 0, 0, 0.7);
}

.player-mount.danmaku-shadow-strong .dplayer-danmaku-item {
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.98),
    1px 0 2px rgba(0, 0, 0, 0.94),
    0 -1px 2px rgba(0, 0, 0, 0.88),
    -1px 0 2px rgba(0, 0, 0, 0.88);
}

.player-mount.danmaku-weight-normal .dplayer-danmaku-item {
  font-weight: 400;
}

.player-mount.danmaku-weight-medium .dplayer-danmaku-item {
  font-weight: 600;
}

.player-mount.danmaku-weight-bold .dplayer-danmaku-item {
  font-weight: 700;
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

.danmaku-import-current {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.danmaku-speed-value {
  margin-left: auto;
  color: rgba(255, 255, 255, 0.68);
  font-variant-numeric: tabular-nums;
}

.danmaku-speed-slider {
  width: 100%;
  accent-color: #ffffff;
}

.danmaku-toggle-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.danmaku-switch {
  position: relative;
  width: 38px;
  height: 22px;
  border: 0;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.28);
  cursor: pointer;
  transition: background-color 160ms ease;
  appearance: none;
  outline: none;
}

.danmaku-switch:focus,
.danmaku-switch:focus-visible,
.danmaku-switch:active {
  border: 0;
  outline: none;
}

.danmaku-switch-on {
  background-color: #34c759;
}

.danmaku-switch-thumb {
  position: absolute;
  left: 2px;
  top: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.36);
  transition: transform 160ms ease;
}

.danmaku-switch-on .danmaku-switch-thumb {
  transform: translateX(16px);
}

.danmaku-segmented-control {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 3px;
  border-radius: 7px;
  background-color: rgba(255, 255, 255, 0.1);
}

.danmaku-segmented-button {
  min-width: 0;
  min-height: 30px;
  border: 0;
  border-radius: 5px;
  background-color: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  outline: none;
}

.danmaku-segmented-button:hover {
  color: rgba(255, 255, 255, 0.92);
  background-color: rgba(255, 255, 255, 0.08);
}

.danmaku-segmented-button:focus,
.danmaku-segmented-button:focus-visible,
.danmaku-segmented-button:active {
  border: 0;
  outline: none;
}

.danmaku-segmented-button-active {
  background-color: rgba(255, 255, 255, 0.9);
  color: rgba(0, 0, 0, 0.88);
}

.danmaku-segmented-button-active:hover {
  background-color: #ffffff;
  color: rgba(0, 0, 0, 0.92);
}

.danmaku-import-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
}

.danmaku-import-input {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  background-color: rgba(20, 20, 20, 0.96);
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  padding: 6px 8px;
  box-sizing: border-box;
}

.danmaku-import-button {
  min-height: 34px;
  border: 0;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.9);
  color: rgba(0, 0, 0, 0.9);
  font-size: 13px;
  padding: 0 10px;
  cursor: pointer;
}

.danmaku-import-button:disabled,
.danmaku-import-input:disabled {
  opacity: 0.55;
  cursor: default;
}

.danmaku-import-status {
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
  line-height: 1.4;
}

.danmaku-import-status-error {
  color: #ffb4a8;
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
