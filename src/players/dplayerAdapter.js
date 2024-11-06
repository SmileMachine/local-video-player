import DPlayer from "dplayer";

export default class DPlayerAdapter {
  constructor(options) {
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
    this.player.template.subtrack.src = videoInfo.captionUrl;
    this.player.switchVideo({
      url: videoInfo.videoUrl,
    });
  }

  play() {
    return this.player.play();
  }

  pause() {
    this.player.pause();
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
    this.player.on(event, callback);
  }
}
