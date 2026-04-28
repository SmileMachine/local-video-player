import Plyr from "plyr";

const EMPTY_CAPTION_URL = "data:text/vtt;charset=utf-8,WEBVTT%0A%0A";

export default class PlyrAdapter {
  constructor(options) {
    this.externalAudio = null;
    this.player = new Plyr(options.container, {
      controls: [
        "play",
        "progress",
        "current-time",
        "duration",
        "captions",
        "settings",
        "mute",
        "volume",
        "fullscreen",
      ],
      settings: ["speed"],
      captions: { active: true, language: "zh", update: true },
      keyboard: { global: true },
      seekTime: 5,
      listeners: { dblclick: false },
    });

    this.player.on("timeupdate", () => {
      options.onTimeUpdate?.(this.player.currentTime);
    });

    this.player.on("ended", () => {
      options.onEnded?.();
    });
  }

  setSource(videoInfo) {
    const captionTrack = this.createCaptionTrack(videoInfo);
    this.player.source = {
      type: "video",
      sources: [
        {
          src: videoInfo.videoUrl,
          type: videoInfo.contentType || "application/octet-stream",
        },
      ],
      tracks: captionTrack ? [captionTrack] : [],
    };
    window.setTimeout(() => {
      this.player.toggleCaptions(Boolean(videoInfo.captionExists));
    }, 0);
  }

  createCaptionTrack(videoInfo) {
    const hasCaptionTracks = (videoInfo.captionTracks || []).some((track) => track.supported);
    if (!videoInfo.captionExists && !hasCaptionTracks) {
      return null;
    }

    return {
      kind: "captions",
      label: videoInfo.captionLabel || "字幕",
      srclang: "zh",
      src: videoInfo.captionExists ? videoInfo.captionUrl : EMPTY_CAPTION_URL,
      default: Boolean(videoInfo.captionExists),
    };
  }

  setCaption(videoInfo) {
    const media = this.player.media;
    if (!media) {
      return;
    }

    media.querySelectorAll("track[kind='captions'], track[kind='subtitles']").forEach((track) => {
      track.remove();
    });

    const captionTrack = this.createCaptionTrack(videoInfo);
    if (!captionTrack) {
      this.player.toggleCaptions(false);
      return;
    }

    const track = document.createElement("track");
    track.kind = captionTrack.kind;
    track.label = captionTrack.label;
    track.srclang = captionTrack.srclang;
    track.src = captionTrack.src;
    track.default = captionTrack.default;
    media.appendChild(track);

    if (!videoInfo.captionExists) {
      this.player.toggleCaptions(false);
      return;
    }

    const activateCaptionTrack = () => {
      this.player.currentTrack = Math.max(0, media.textTracks.length - 1);
      this.player.toggleCaptions(true);
    };

    track.addEventListener("load", activateCaptionTrack, { once: true });
    window.setTimeout(activateCaptionTrack, 0);
  }

  play() {
    return this.player.play();
  }

  pause() {
    this.player.pause();
  }

  focus() {
    if (this.player.elements.container) {
      this.player.elements.container.focus()
    }
  }

  getCurrentTime() {
    return this.player.currentTime;
  }

  setCurrentTime(time) {
    this.player.currentTime = time;
  }

  isPlaying() {
    return this.player.playing;
  }

  destroy() {
    this.player.destroy();
  }

  once(event, callback) {
    this.player.once(event, callback);
  }

  toggleFullscreen() {
    if (this.player.fullscreen.active) {
      this.player.fullscreen.exit();
    } else {
      this.player.fullscreen.enter();
    }
  }

  toggleMute() {
    if (this.externalAudio) {
      this.externalAudio.muted = !this.externalAudio.muted;
    }
  }

  getMediaElement() {
    return this.player.media;
  }

  setExternalAudio(audio) {
    this.externalAudio = audio;
  }
}
