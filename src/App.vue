<template>
  <div class="app-container">
    <Sidebar :videos="videos" :current-id="currentVideoId" :current-path="currentPath" @select-video="selectVideo" />
    <VideoPlayer player-type="DPlayer" />
    <!-- <VideoPlayer player-type="Plyr" /> -->
  </div>
</template>

<script>
import Sidebar from './components/Sidebar.vue'
import VideoPlayer from './components/VideoPlayer.vue'
import { useVideoLibrary } from './composables/useVideoLibrary'

export default {
  name: 'App',
  components: {
    Sidebar,
    VideoPlayer
  },
  setup() {
    const {
      videos,
      currentVideoId,
      currentPath,
      selectVideo,
    } = useVideoLibrary()

    return {
      // video library
      videos,
      currentVideoId,
      currentPath,
      selectVideo,
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
