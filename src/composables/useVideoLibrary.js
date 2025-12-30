import { ref, computed, onMounted, watch } from "vue";

let instance = null;

export function useVideoLibrary() {
  if (instance) {
    return instance;
  }
  const videos = ref([]);
  const currentVideoId = ref("");
  const currentPath = ref(
    localStorage.getItem("currentPath")
      ? JSON.parse(localStorage.getItem("currentPath"))
      : []
  );
  const flatVideoList = ref([]);
  const showShortcutsModal = ref(false);

  const currentVideoUrl = computed(() => {
    if (!currentVideoId.value) return "";
    // console.log(currentVideoId.value);
    return `/video?id=${encodeURIComponent(currentVideoId.value)}`;
  });

  const currentCaptionUrl = computed(() => {
    if (!currentVideoId.value) return "";
    return `/caption?id=${encodeURIComponent(currentVideoId.value)}`;
  });

  const currentVideoInfo = ref({ captionExists: false });
  watch(
    () => currentVideoId.value,
    async (newId) => {
      if (newId) {
        try {
          const response = await fetch(
            `/caption/status?id=${encodeURIComponent(newId)}`
          );
          const data = await response.json();

          currentVideoInfo.value = {
            captionExists: data.exists,
            videoUrl: currentVideoUrl.value,
            captionUrl: data.exists ? currentCaptionUrl.value : "",
            path: currentPath.value,
          }
        } catch (error) {
          console.error("Error fetching caption status:", error);
          currentVideoInfo.value = {
            captionExists: false,
            videoUrl: currentVideoUrl.value,
            captionUrl: "",
            path: currentPath.value,
          };
        }
      }
    }
  );

  onMounted(() => {
    fetchVideos();
    addEventListener("keydown", handleKeydown);
  });

  // Fetch videos from server
  const fetchVideos = async () => {
    try {
      const response = await fetch("/api/videos");
      if (!response.ok) throw new Error("Failed to fetch videos");
      videos.value = await response.json();
      const currentVideo = findVideoByPath(videos.value, currentPath.value);
      currentVideoId.value = currentVideo?.id || "";
      // 生成扁平化列表
      flatVideoList.value = flattenVideos(videos.value);
    } catch (error) {
      console.error("Error fetching videos:", error);
      videos.value = [];
      flatVideoList.value = [];
    }
  };

  const findVideoByPath = (items, path) => {
    let current = items;

    // 遍历路径的每一层
    for (let i = 0; i < path.length; i++) {
      const segment = path[i];
      const found = current.find((item) => item.name === segment);

      if (!found) return null;

      if (found.type === "directory") {
        current = found.children;
      } else {
        return found;
      }
    }

    return null;
  };

  const selectVideo = ({ id, path }) => {
    currentVideoId.value = id;
    currentPath.value = path;
    localStorage.setItem("currentPath", JSON.stringify(path));
  };

  // 扁平化处理函数
  const flattenVideos = (items, parentPath = "") => {
    const result = [];
    items.forEach((item) => {
      const path = parentPath ? [...parentPath, item.name] : [item.name];
      if (item.type === "directory") {
        result.push(...flattenVideos(item.children, path));
      } else {
        result.push({
          ...item,
          path: path,
        });
      }
    });
    return result;
  };

  // 获取当前视频在列表中的索引
  const getCurrentIndex = () => {
    return flatVideoList.value.findIndex(
      (item) => item.id === currentVideoId.value
    );
  };

  // 播放指定索引的视频
  const playVideoByIndex = (index) => {
    if (index >= 0 && index < flatVideoList.value.length) {
      selectVideo(flatVideoList.value[index]);
      // console.log(flatVideoList.value[index].path);
    }
  };

  // 键盘事件处理
  const handleKeydown = (e) => {
    const currentIndex = getCurrentIndex();
    // console.log(e.key);
    // console.log(currentIndex);

    // F key - Toggle fullscreen
    if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      const player = window.__videoPlayer;
      if (player && player.toggleFullscreen) {
        player.toggleFullscreen();
      }
    }
    // M key - Toggle mute
    else if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      const player = window.__videoPlayer;
      if (player && player.toggleMute) {
        player.toggleMute();
      }
    }
    // H key - Show/hide shortcuts guide
    else if (e.key === "h" || e.key === "H") {
      e.preventDefault();
      showShortcutsModal.value = !showShortcutsModal.value;
    }
    // PageDown - Next video
    else if (e.key === "PageDown") {
      e.preventDefault();
      playVideoByIndex(currentIndex + 1);
    }
    // PageUp - Previous video
    else if (e.key === "PageUp") {
      e.preventDefault();
      playVideoByIndex(currentIndex - 1);
    }
  };

  instance = {
    videos,
    currentVideoId,
    // currentVideoUrl,
    // currentVideoInfo,
    // currentCaptionUrl,
    currentVideoInfo,
    currentPath,
    flatVideoList,
    selectVideo,
    handleKeydown,
    showShortcutsModal,
  };
  return instance;
}
