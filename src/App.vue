<template>
  <div class="app-container" :class="layoutClasses">
    <Sidebar
      :videos="sortedVideos"
      :current-id="currentVideoId"
      :current-path="currentPath"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      :is-mobile-layout="isMobileLayout"
      :is-mobile-portrait="isMobilePortrait"
      :is-mobile-landscape="isMobileLandscape"
      :is-mobile-fullscreen-sidebar="isMobileFullscreenSidebar"
      @select-video="selectVideo"
      @change-sort-by="setSortBy"
      @toggle-sort-order="toggleSortOrder"
      @open-settings="showSettingsModal = true"
      @open-shortcuts="showShortcutsModal = true"
    />
    <VideoPlayer :player-type="playerType" />
    <ShortcutsGuideModal :show="showShortcutsModal" @close="showShortcutsModal = false" />
    <SettingsModal
      :show="showSettingsModal"
      @close="showSettingsModal = false"
      @saved="handleConfigSaved"
      @reloaded="handleVideosReloaded"
    />
  </div>
</template>

<script>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import VideoPlayer from './components/VideoPlayer.vue'
import ShortcutsGuideModal from './components/ShortcutsGuideModal.vue'
import SettingsModal from './components/SettingsModal.vue'
import { useVideoLibrary } from './composables/useVideoLibrary'
import { useTheme } from './composables/useTheme'
import { useLayoutPreference } from './composables/useLayoutPreference'

export default {
  name: 'App',
  components: {
    Sidebar,
    VideoPlayer,
    ShortcutsGuideModal,
    SettingsModal
  },
  setup() {
    const {
      videos,
      sortedVideos,
      currentVideoId,
      currentPath,
      sortBy,
      sortOrder,
      setSortBy,
      toggleSortOrder,
      fetchVideos,
      selectVideo,
      showShortcutsModal,
    } = useVideoLibrary()

    const { initTheme } = useTheme()
    const { layoutPreference } = useLayoutPreference()

    const showSettingsModal = ref(false)
    const playerType = import.meta.env.VITE_PLAYER_TYPE || "Plyr"
    const isNarrowViewport = ref(false)
    const isCompactPortraitViewport = ref(false)
    const isPortraitViewport = ref(false)

    const refreshViewportState = () => {
      isNarrowViewport.value = window.matchMedia('(max-width: 900px)').matches
      isCompactPortraitViewport.value = window.matchMedia('(max-width: 560px) and (orientation: portrait)').matches
      isPortraitViewport.value = window.matchMedia('(orientation: portrait)').matches
    }

    const isMobileLayout = computed(() => {
      if (layoutPreference.value === 'desktop') {
        return false
      }

      if (layoutPreference.value === 'mobile') {
        return true
      }

      return isNarrowViewport.value
    })

    const isMobilePortrait = computed(() => isMobileLayout.value && isPortraitViewport.value)
    const isMobileLandscape = computed(() => isMobileLayout.value && !isPortraitViewport.value)
    const isMobileFullscreenSidebar = computed(() => isMobileLayout.value && isCompactPortraitViewport.value)
    const layoutClasses = computed(() => ({
      'layout-mobile': isMobileLayout.value,
      'layout-desktop': !isMobileLayout.value,
      'layout-mobile-portrait': isMobilePortrait.value,
      'layout-mobile-landscape': isMobileLandscape.value,
      'layout-mobile-fullscreen-sidebar': isMobileFullscreenSidebar.value,
      [`layout-preference-${layoutPreference.value}`]: true
    }))

    const handleConfigSaved = () => {
      // Reload the page to apply new configuration
      window.location.reload()
    }

    const handleVideosReloaded = async () => {
      await fetchVideos()
    }

    // 初始化主题
    onMounted(() => {
      initTheme()
      refreshViewportState()
      window.addEventListener('resize', refreshViewportState)
      window.addEventListener('orientationchange', refreshViewportState)
    })

    onUnmounted(() => {
      window.removeEventListener('resize', refreshViewportState)
      window.removeEventListener('orientationchange', refreshViewportState)
    })

    return {
      // video library
      playerType,
      videos,
      sortedVideos,
      currentVideoId,
      currentPath,
      sortBy,
      sortOrder,
      setSortBy,
      toggleSortOrder,
      selectVideo,
      showShortcutsModal,
      showSettingsModal,
      isMobileLayout,
      isMobilePortrait,
      isMobileLandscape,
      isMobileFullscreenSidebar,
      layoutClasses,
      handleConfigSaved,
      handleVideosReloaded
    }
  }
}
</script>

<style>
/* 0-margin */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* 0-margin */
html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}

.app-container {
  display: flex;
  height: 100dvh;
  width: 100vw;
  margin: 0;
  padding: 0;
  background-color: var(--color-background, #242424);
  position: fixed;
  /* Fixed position */
  top: 0;
  left: 0;
}

.app-container.layout-mobile {
  display: block;
}
</style>
