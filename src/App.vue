<template>
  <div class="app-container">
    <Sidebar :videos="videos" :current-id="currentVideoId" :current-path="currentPath" @select-video="selectVideo" />
    <VideoPlayer :player-type="playerType" />
    <ShortcutsGuideModal :show="showShortcutsModal" @close="showShortcutsModal = false" />
  </div>
</template>

<script>
import Sidebar from './components/Sidebar.vue'
import VideoPlayer from './components/VideoPlayer.vue'
import ShortcutsGuideModal from './components/ShortcutsGuideModal.vue'
import { useVideoLibrary } from './composables/useVideoLibrary'

export default {
  name: 'App',
  components: {
    Sidebar,
    VideoPlayer,
    ShortcutsGuideModal
  },
  setup() {
    const {
      videos,
      currentVideoId,
      currentPath,
      selectVideo,
      showShortcutsModal,
    } = useVideoLibrary()

    const playerType = import.meta.env.VITE_PLAYER_TYPE || "Plyr"

    return {
      // video library
      playerType,
      videos,
      currentVideoId,
      currentPath,
      selectVideo,
      showShortcutsModal,
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


.directory-tree {
  padding: 0;
  margin: 0;
}
</style>
