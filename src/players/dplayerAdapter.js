import DPlayer from "dplayer";

export default class DPlayerAdapter {
  constructor(options) {
    this.externalAudio = null;
    this.player = new DPlayer({
      container: options.container,
      screenshot: true,
      video: { url: "" },
      subtitle: { url: "", fontSize: "25px", bottom: "7%" },
      volume: 1,
    });

    this.player.on("timeupdate", () => {
      options.onTimeUpdate?.(this.player.video.currentTime);
    });

    this.player.on("ended", () => {
      options.onEnded?.();
    });
  }

  setSource(videoInfo) {
    this.setCaption(videoInfo);
    this.player.switchVideo({
      url: videoInfo.videoUrl,
    });
  }

  setCaption(videoInfo) {
    const url = videoInfo.captionExists ? videoInfo.captionUrl : "";
    this.player.template.subtrack.src = url;

    if (url) {
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
