import Plyr from "plyr";

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
      settings: ["captions", "speed"],
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
    this.player.source = {
      type: "video",
      sources: [
        {
          src: videoInfo.videoUrl,
          type: videoInfo.contentType || "application/octet-stream",
        },
      ],
      tracks: videoInfo.captionExists
        ? [this.createCaptionTrack(videoInfo)]
        : [],
    };
  }

  createCaptionTrack(videoInfo) {
    return {
      kind: "captions",
      label: videoInfo.captionLabel || "字幕",
      srclang: "zh",
      src: videoInfo.captionUrl,
      default: true,
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

    if (!videoInfo.captionExists || !videoInfo.captionUrl) {
      this.player.toggleCaptions(false);
      return;
    }

    const track = document.createElement("track");
    track.kind = "captions";
    track.label = videoInfo.captionLabel || "字幕";
    track.srclang = "zh";
    track.src = videoInfo.captionUrl;
    track.default = true;
    media.appendChild(track);

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
