# Video Player

[![wakatime](https://wakatime.com/badge/user/a70e5791-db6f-4368-aacc-0332a969bb3e/project/a99f84bc-1c1e-4629-aa5a-b06273fa67d9.svg)](https://wakatime.com/badge/user/a70e5791-db6f-4368-aacc-0332a969bb3e/project/a99f84bc-1c1e-4629-aa5a-b06273fa67d9)

[中文文档](./README.zh-CN.md)

A simple video player built with Vue 3, Vite and Express.

You can specify the path to your local video folder in the configuration, and access it through the browser after starting the service.

## Getting Started

1. Configure environment variables in `.env`

   | Variable     | Default       | Description                                                                    |
   | ------------ | ------------- | ------------------------------------------------------------------------------ |
   | `PORT`       | `3000`        | Server port                                                                    |
   | `HOST`       | `localhost`   | Address to bind to                                                             |
   | `NODE_ENV`   | `development` | Environment. Can be either `development` or `production`                       |
   | `GET_VID_INFO` | `false`      | Whether to fetch video information using ffmpeg (duration, codec, resolution, etc.). May take a long time if there are many videos. Requires `ffmpeg`. |
   | `PLAYER_TYPE` | `Plyr`        | Player type. Can be either `DPlayer` or `Plyr`                                |
   | `USE_CACHE`  | `false`       | Whether to use last scan results. If true, video infos will be cached in `cache/scan-cache.json`. |

2. Create configuration file `config.json` (refer to `config.example.json`)

   ```json
   {
     "cacheName": "video-info",
     "usePathIds": true,
     "getVideoInfo": true,
     "videoPaths": [
       {
         "name": "Videos",
         "path": "~/Movies"
       },
       {
         "name": "Downloads",
         "path": "~/Downloads"
       }
     ]
   }
   ```

   **Configuration options:**
   - `cacheName`: Name of the cache file
   - `usePathIds`: Use UUID instead of file paths
   - `getVideoInfo`: Fetch video information using ffmpeg, including duration, codec, resolution, frame rate, etc. (requires `ffmpeg`, may take time for large libraries)
   - `videoPaths`: Array of video paths to scan

   You can also modify the configuration through the web UI after starting the server.

3. Install dependencies, build frontend, and start server

   ```bash
   npm install
   npm run build
   npm run start
   # or
   npm run start:cache # use cache to skip scanning
   ```

4. Development mode, using Vite for frontend and Express for backend, both with hot reload

   ```bash
   npm install
   npm run dev
   # or
   npm run dev:cache # use cache to skip scanning
   ```

## Keyboard Shortcuts

| Shortcut | Action |
| ---------- | ------------- |
| `Space` | Play/Pause |
| `F` | Toggle fullscreen |
| `M` | Mute/Unmute |
| `←` / `→` | Seek backward/forward 5 seconds |
| `↑` / `↓` | Volume up/down |
| `PageUp` / `PageDown` | Previous/Next video |
| `Shift` + `Enter` | Toggle sidebar |
| `H` | Show/hide shortcuts guide |
| `Esc` | Close shortcuts guide |

## Codec Compatibility

When enabled in settings, the player detects and displays video/audio codec information.

### Supported Codecs

**Video Codecs:**
- ✅ H.264 (AVC) - Widely supported
- ✅ VP8/VP9 - Chrome/Firefox
- ✅ AV1 - Modern browsers
- ⚠️ H.265/HEVC - Safari only (not supported in Chrome/Firefox)

**Audio Codecs:**
- ✅ AAC - Widely supported
- ✅ MP3 - Widely supported
- ✅ Opus/Vorbis - Chrome/Firefox
- ✅ FLAC - Modern browsers
- ⚠️ DTS/AC3/E-AC3 - Not supported (requires transcoding)

### Container Format Support

- ✅ MP4 - Best compatibility
- ✅ WebM - Chrome/Firefox
- ⚠️ MKV - Limited browser support
- ⚠️ AVI - Not supported (requires transcoding)

**Note**: Videos with unsupported codecs may need transcoding using FFmpeg. The player provides FFmpeg command suggestions when hovering over videos with incompatible codecs.
