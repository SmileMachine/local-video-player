<template>
  <div class="app-container">
    <Sidebar
      :videos="sortedVideos"
      :current-id="currentVideoId"
      :current-path="currentPath"
      :sort-by="sortBy"
      :sort-order="sortOrder"
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
import { ref, onMounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import VideoPlayer from './components/VideoPlayer.vue'
import ShortcutsGuideModal from './components/ShortcutsGuideModal.vue'
import SettingsModal from './components/SettingsModal.vue'
import { useVideoLibrary } from './composables/useVideoLibrary'
import { useTheme } from './composables/useTheme'

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

    const showSettingsModal = ref(false)
    const playerType = import.meta.env.VITE_PLAYER_TYPE || "Plyr"

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
}

.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  margin: 0;
  padding: 0;
  position: fixed;
  /* Fixed position */
  top: 0;
  left: 0;
}
</style>
