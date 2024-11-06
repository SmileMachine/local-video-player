import Plyr from "plyr";

export default class PlyrAdapter {
  constructor(options) {
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
      captions: { active: true, language: "zh", update: false },
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
          type: "video/mp4",
        },
      ],
      tracks: videoInfo.captionExists
        ? [
            {
              kind: "captions",
              label: "中文",
              srclang: "zh",
              src: videoInfo.captionUrl,
              default: true,
            },
          ]
        : [],
    };
  }

  play() {
    return this.player.play();
  }

  pause() {
    this.player.pause();
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
}
