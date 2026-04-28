import DPlayer from "dplayer";
import {
  assignDanmakuBackfillLanes,
  collectVisibleDanmakuBeforeTime,
  normalizeDanmakuType,
} from "./danmakuBackfill.js";

const EMPTY_CAPTION_URL = "data:text/vtt;charset=utf-8,WEBVTT%0A%0A";
const DANMAKU_API = "/danmaku/";
const MIN_BACKFILL_REMAINING_SECONDS = 0.05;
const DEFAULT_DANMAKU_ROW_HEIGHT = 30;

const numberToColor = (value) => {
  const color = Number(value);
  const safeColor = Number.isFinite(color) ? Math.max(0, Math.min(16777215, Math.round(color))) : 16777215;
  return `#${(`00000${safeColor.toString(16)}`).slice(-6)}`;
};

const danmakuTypeName = (type) => {
  const normalizedType = normalizeDanmakuType(type);
  if (normalizedType === 1) {
    return "top";
  }
  if (normalizedType === 2) {
    return "bottom";
  }
  return "right";
};

export default class DPlayerAdapter {
  constructor(options) {
    this.externalAudio = null;
    this.danmakuSpeedRate = 1;
    this.danmakuBackfillFrame = null;
    this.player = new DPlayer({
      container: options.container,
      screenshot: true,
      video: { url: "" },
      subtitle: { url: "", fontSize: "25px", bottom: "7%" },
      danmaku: {
        id: "",
        api: DANMAKU_API,
        maximum: 3000,
        user: "local",
        bottom: "15%",
        speedRate: this.danmakuSpeedRate,
      },
      volume: 1,
    });

    this.player.on("timeupdate", () => {
      options.onTimeUpdate?.(this.player.video.currentTime);
    });

    this.player.on("ended", () => {
      options.onEnded?.();
    });

    this.player.on("seeked", () => {
      this.scheduleDanmakuBackfill();
    });
  }

  setSource(videoInfo) {
    this.setCaption(videoInfo);
    this.player.switchVideo(
      {
        url: videoInfo.videoUrl,
      },
      this.createDanmakuOptions(videoInfo)
    );
    this.setDanmakuSpeed(this.danmakuSpeedRate);
  }

  createDanmakuOptions(videoInfo) {
    return {
      id: videoInfo.id || "",
      api: DANMAKU_API,
      maximum: 3000,
      user: "local",
      speedRate: this.danmakuSpeedRate,
    };
  }

  setDanmakuSpeed(speedRate) {
    const nextSpeedRate = Number(speedRate);
    if (!Number.isFinite(nextSpeedRate) || nextSpeedRate <= 0) {
      return;
    }

    this.danmakuSpeedRate = nextSpeedRate;
    this.player.danmaku?.speed?.(nextSpeedRate);
  }

  setDanmakuVisible(visible) {
    const danmaku = this.player.danmaku;
    if (!danmaku) {
      return;
    }

    if (visible) {
      danmaku.show();
      this.scheduleDanmakuBackfill();
    } else {
      danmaku.hide();
    }
  }

  scheduleDanmakuBackfill() {
    const schedule = globalThis.requestAnimationFrame || globalThis.setTimeout;
    const cancel = globalThis.cancelAnimationFrame || globalThis.clearTimeout;

    if (this.danmakuBackfillFrame) {
      cancel(this.danmakuBackfillFrame);
    }

    this.danmakuBackfillFrame = schedule(() => {
      this.danmakuBackfillFrame = null;
      this.backfillDanmakuAfterSeek();
    });
  }

  backfillDanmakuAfterSeek() {
    const danmaku = this.player.danmaku;
    const container = danmaku?.container;
    const currentTime = Number(this.player.video?.currentTime);
    if (!danmaku?.showing || !container || !Number.isFinite(currentTime)) {
      return;
    }

    const items = collectVisibleDanmakuBeforeTime(danmaku.dan, currentTime, {
      speedRate: this.danmakuSpeedRate,
      fullscreen: Boolean(this.player.fullScreen?.isFullScreen?.()),
    });
    const rowHeight = Number(danmaku.options?.height) || DEFAULT_DANMAKU_ROW_HEIGHT;
    const rowCount = Math.max(1, Math.floor(container.offsetHeight / rowHeight));
    const assignedItems = assignDanmakuBackfillLanes(items, {
      containerWidth: container.offsetWidth,
      rowCount,
      measureText: (text) => this.measureDanmakuText(text),
    });
    const fragment = document.createDocumentFragment();

    for (const item of assignedItems) {
      fragment.appendChild(this.createDanmakuBackfillNode(danmaku, item, {
        containerWidth: container.offsetWidth,
        rowHeight,
      }));
    }

    container.appendChild(fragment);
  }

  measureDanmakuText(text) {
    try {
      const measuredWidth = this.player.danmaku?._measure?.(text);
      if (Number.isFinite(measuredWidth) && measuredWidth > 0) {
        return measuredWidth;
      }
    } catch {
      // Fall through to a conservative text-length estimate.
    }

    return String(text ?? "").length * 22;
  }

  createDanmakuBackfillNode(danmaku, item, { containerWidth, rowHeight }) {
    const type = danmakuTypeName(item.danmaku.type);
    const node = document.createElement("div");
    node.classList.add("dplayer-danmaku-item", `dplayer-danmaku-${type}`, "dplayer-danmaku-move");
    node.innerHTML = item.danmaku.border
      ? `<span style="border:${item.danmaku.border}">${item.danmaku.text}</span>`
      : item.danmaku.text;
    node.style.opacity = danmaku._opacity;
    node.style.color = numberToColor(item.danmaku.color);
    node.style.animationDuration = `${item.duration}s`;

    if (type === "right") {
      node.style.width = `${item.width}px`;
      node.style.top = `${rowHeight * item.lane}px`;
      node.style.transform = `translateX(-${containerWidth}px)`;
    } else if (type === "top") {
      node.style.top = `${rowHeight * item.lane}px`;
    } else {
      node.style.bottom = `${rowHeight * item.lane}px`;
    }

    const elapsed = Math.min(
      item.elapsed,
      Math.max(0, item.duration - MIN_BACKFILL_REMAINING_SECONDS)
    );
    node.style.animationDelay = `-${elapsed}s`;
    node.style.webkitAnimationDelay = `-${elapsed}s`;
    this.trackDanmakuBackfillNode(danmaku, node, type, item.lane);
    return node;
  }

  trackDanmakuBackfillNode(danmaku, node, type, lane) {
    danmaku.danTunnel[type] ||= {};
    danmaku.danTunnel[type][`${lane}`] ||= [];
    danmaku.danTunnel[type][`${lane}`].push(node);

    node.addEventListener("animationend", () => {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }

      const row = danmaku.danTunnel[type]?.[`${lane}`];
      if (!row) {
        return;
      }
      const index = row.indexOf(node);
      if (index >= 0) {
        row.splice(index, 1);
      }
    });
  }

  setDanmaku(videoInfo) {
    if (!this.player.danmaku) {
      return;
    }

    const originalCallback = this.player.danmaku.options.callback;
    this.player.danmaku.options.callback = () => {
      originalCallback?.();
      this.player.danmaku?.seek();
      this.player.danmaku.options.callback = originalCallback;
    };
    this.player.danmaku.reload(this.createDanmakuOptions(videoInfo));
  }

  setCaption(videoInfo) {
    const hasCaptionTracks = (videoInfo.captionTracks || []).some((track) => track.supported);
    const url = videoInfo.captionExists ? videoInfo.captionUrl : hasCaptionTracks ? EMPTY_CAPTION_URL : "";
    this.player.template.subtrack.src = url;

    if (videoInfo.captionExists) {
      this.player.template.subtrack.setAttribute("default", "");
      this.player.subtitle?.show?.();
    } else {
      this.player.template.subtrack.removeAttribute("default");
      this.player.subtitle?.hide?.();
    }
  }

  play() {
    return this.player.play();
  }

  pause() {
    this.player.pause();
  }

  focus() {
    if (this.player.video) {
      this.player.focus = true;
      this.player.video.focus();
    }
  }

  getCurrentTime() {
    return this.player.video.currentTime;
  }

  setCurrentTime(time) {
    this.player.seek(time);
  }

  isPlaying() {
    return !this.player.video.paused;
  }

  destroy() {
    if (this.danmakuBackfillFrame) {
      const cancel = globalThis.cancelAnimationFrame || globalThis.clearTimeout;
      cancel(this.danmakuBackfillFrame);
      this.danmakuBackfillFrame = null;
    }
    this.player.destroy();
  }

  once(event, callback) {
    const wrappedCallback = (...args) => {
      // execute the callback
      callback(...args);
      // remove the callback from the event array
      const eventCallbacks = this.player.events.events[event];
      if (eventCallbacks) {
        const index = eventCallbacks.indexOf(wrappedCallback);
        if (index !== -1) {
          eventCallbacks.splice(index, 1);
        }
      }
    };

    this.player.on(event, wrappedCallback);
  }

  toggleFullscreen() {
    if (this.player.fullScreen.isFullScreen()) {
      this.player.fullScreen.cancel();
    } else {
      this.player.fullScreen.request();
    }
  }

  toggleMute() {
    if (this.externalAudio) {
      this.externalAudio.muted = !this.externalAudio.muted;
      return;
    }
    this.player.video.muted = !this.player.video.muted;
  }

  getMediaElement() {
    return this.player.video;
  }

  setExternalAudio(audio) {
    this.externalAudio = audio;
  }
}
