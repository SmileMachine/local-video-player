import { ref, computed, onMounted, watch } from "vue";
import { needsCompatibleAudio } from "../../shared/audioTranscode.js";
import { getVideoContentType } from "../../shared/mediaTypes.js";

let instance = null;
const SORT_CONFIG_KEY = "video-sort-config";
const DEFAULT_SORT_BY = "name";
const DEFAULT_SORT_ORDER = "asc";
const SORT_FIELDS = ["name", "duration", "size", "mtime"];

export function useVideoLibrary() {
  if (instance) {
    return instance;
  }
  const videos = ref([]);
  const currentVideoId = ref("");
  const currentVideoItem = ref(null);
  const currentPath = ref(
    localStorage.getItem("currentPath")
      ? JSON.parse(localStorage.getItem("currentPath"))
      : []
  );
  const showShortcutsModal = ref(false);
  const sortConfig = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(SORT_CONFIG_KEY) || "{}");
      return {
        by: SORT_FIELDS.includes(parsed.by) ? parsed.by : DEFAULT_SORT_BY,
        order: parsed.order === "desc" ? "desc" : DEFAULT_SORT_ORDER,
      };
    } catch {
      return {
        by: DEFAULT_SORT_BY,
        order: DEFAULT_SORT_ORDER,
      };
    }
  })();
  const sortBy = ref(sortConfig.by);
  const sortOrder = ref(sortConfig.order);

  const currentVideoUrl = computed(() => {
    if (!currentVideoId.value) return "";
    // console.log(currentVideoId.value);
    return `/video?id=${encodeURIComponent(currentVideoId.value)}`;
  });

  const currentCaptionUrl = computed(() => {
    if (!currentVideoId.value) return "";
    return `/caption?id=${encodeURIComponent(currentVideoId.value)}`;
  });

  const currentVideoContentType = computed(() => {
    const fileName = currentPath.value[currentPath.value.length - 1] || "";
    return getVideoContentType(fileName);
  });

  const currentVideoInfo = ref({ captionExists: false });
  const getCaptionStatus = async (videoId) => {
    const response = await fetch(`/caption/status?id=${encodeURIComponent(videoId)}`);
    if (!response.ok) {
      throw new Error("Failed to fetch caption status");
    }
    return response.json();
  };

  const getAudioStatus = async (videoId) => {
    if (!needsCompatibleAudio(currentVideoItem.value?.info?.audio)) {
      return { enabled: false, needed: false, url: "" };
    }

    const response = await fetch(`/audio/status?id=${encodeURIComponent(videoId)}`);
    if (!response.ok) {
      throw new Error("Failed to fetch audio status");
    }
    return response.json();
  };

  watch(
    () => currentVideoId.value,
    async (newId) => {
      if (newId) {
        const [captionResult, audioResult] = await Promise.allSettled([
          getCaptionStatus(newId),
          getAudioStatus(newId),
        ]);

        if (captionResult.status === "rejected") {
          console.error("Error fetching caption status:", captionResult.reason);
        }
        if (audioResult.status === "rejected") {
          console.error("Error fetching audio status:", audioResult.reason);
        }

        const captionStatus = captionResult.status === "fulfilled"
          ? captionResult.value
          : { exists: false };
        const audioStatus = audioResult.status === "fulfilled"
          ? audioResult.value
          : { enabled: false, needed: false, url: "" };

        currentVideoInfo.value = {
          captionExists: captionStatus.exists,
          videoUrl: currentVideoUrl.value,
          contentType: currentVideoContentType.value,
          captionUrl: captionStatus.exists ? currentCaptionUrl.value : "",
          externalAudioUrl: audioStatus.enabled && audioStatus.needed ? audioStatus.url : "",
          externalAudio: audioStatus,
          mediaInfo: currentVideoItem.value?.info || null,
          path: currentPath.value,
        };
      }
    }
  );

  onMounted(() => {
    fetchVideos();
    addEventListener("keydown", handleKeydown);
  });

  const saveSortConfig = () => {
    localStorage.setItem(
      SORT_CONFIG_KEY,
      JSON.stringify({
        by: sortBy.value,
        order: sortOrder.value,
      })
    );
  };

  const setSortBy = (newSortBy) => {
    if (!SORT_FIELDS.includes(newSortBy)) return;
    sortBy.value = newSortBy;
    saveSortConfig();
  };

  const toggleSortOrder = () => {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
    saveSortConfig();
  };

  // Fetch videos from server
  const fetchVideos = async () => {
    try {
      const response = await fetch("/api/videos");
      if (!response.ok) throw new Error("Failed to fetch videos");
      videos.value = await response.json();
      const currentVideo = findVideoByPath(videos.value, currentPath.value);
      currentVideoItem.value = currentVideo || null;
      currentVideoId.value = currentVideo?.id || "";
    } catch (error) {
      console.error("Error fetching videos:", error);
      videos.value = [];
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
    currentVideoItem.value = findVideoByPath(videos.value, path);
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

  const compareText = (a, b) =>
    String(a || "").localeCompare(String(b || ""), "zh-Hans-CN", {
      numeric: true,
      sensitivity: "base",
    });

  const parseMtime = (value) => {
    if (typeof value === "number") return value;
    const timestamp = Date.parse(value || 0);
    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  const getSortValue = (item) => {
    switch (sortBy.value) {
      case "duration":
        return Number(item?.info?.duration || 0);
      case "size":
        return Number(item?.size || 0);
      case "mtime":
        return parseMtime(item?.mtime);
      case "name":
      default:
        return item?.name || "";
    }
  };

  const compareItems = (a, b) => {
    // Keep directory entries before file entries for a predictable tree layout.
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }

    let result = 0;
    const leftValue = getSortValue(a);
    const rightValue = getSortValue(b);

    if (sortBy.value === "name") {
      result = compareText(leftValue, rightValue);
    } else {
      result =
        Number(leftValue) === Number(rightValue)
          ? 0
          : Number(leftValue) > Number(rightValue)
          ? 1
          : -1;
    }

    if (result === 0) {
      result = compareText(a?.name, b?.name);
    }

    return sortOrder.value === "asc" ? result : -result;
  };

  const sortVideoTree = (items) => {
    return [...items]
      .map((item) =>
        item.type === "directory"
          ? {
              ...item,
              children: sortVideoTree(item.children || []),
            }
          : { ...item }
      )
      .sort(compareItems);
  };

  const sortedVideos = computed(() => sortVideoTree(videos.value));
  const flatVideoList = computed(() => flattenVideos(sortedVideos.value));

  // 获取当前视频在列表中的索引
  const getCurrentIndex = () => {
    return flatVideoList.value.findIndex((item) => item.id === currentVideoId.value);
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
    sortedVideos,
    currentVideoId,
    // currentVideoUrl,
    // currentVideoInfo,
    // currentCaptionUrl,
    currentVideoInfo,
    currentPath,
    flatVideoList,
    sortBy,
    sortOrder,
    setSortBy,
    toggleSortOrder,
    fetchVideos,
    selectVideo,
    handleKeydown,
    showShortcutsModal,
  };
  return instance;
}
