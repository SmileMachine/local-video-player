# Video Player

[![wakatime](https://wakatime.com/badge/user/a70e5791-db6f-4368-aacc-0332a969bb3e/project/a99f84bc-1c1e-4629-aa5a-b06273fa67d9.svg)](https://wakatime.com/badge/user/a70e5791-db6f-4368-aacc-0332a969bb3e/project/a99f84bc-1c1e-4629-aa5a-b06273fa67d9)

这个项目是一个简单的视频播放器，使用 Vue 3，Vite 和 Express 构建。

可以在配置中填写本地的视频文件夹地址，启动服务后即可在浏览器中访问。

## 开始

1. 配置环境变量 `.env`

   | 变量            | 默认值        | 描述                                                                                          |
   | --------------- | ------------- | --------------------------------------------------------------------------------------------- |
   | `PORT`          | `3000`        | 服务端口                                                                                      |
   | `HOST`          | `localhost`   | 想要绑定的地址                                                                                |
   | `NODE_ENV`      | `development` | 环境。可以是 `development` 或 `production`                                                    |
   | `GET_VID_INFO`  | `false`       | 是否获取视频信息(时长和编码格式)。如果视频文件很多，则可能需要很长时间。需要 `ffmpeg` 支持。   |
   | `PLAYER_TYPE`   | `Plyr`        | 播放器类型。可以是 `DPlayer` 或 `Plyr`                                                        |
   | `USE_CACHE`     | `false`       | 是否使用上次扫描结果。如果为 true，视频信息将被缓存到 `cache/scan-cache.json`。               |

2. 创建配置文件 `config.json`（可参考 `config.example.json`）

   ```json
   {
     "cacheName": "video-info",
     "usePathIds": true,
     "getDuration": true,
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

   **配置选项说明：**
   - `cacheName`: 缓存文件名称
   - `usePathIds`: 使用 UUID 替代文件路径
   - `getDuration`: 获取视频时长（需要 `ffmpeg`，视频库较大时可能需要较长时间）
   - `videoPaths`: 要扫描的视频路径数组

   启动服务后也可以在网页界面中修改配置。

3. 安装依赖，构建前端，启动服务

   ```bash
   npm install
   npm run build
   npm run start
   # 或
   npm run start:cache # 使用缓存跳过扫描
   ```

4. 开发，使用 Vite 提供前端服务，Express 提供后端服务，均有热重载。

   ```bash
   npm install
   npm run dev
   # 或
   npm run dev:cache # 使用缓存跳过扫描
   ```

## 快捷键

| 快捷键 | 功能 |
| -------------- | ------------- |
| `空格` | 播放/暂停 |
| `F` | 切换全屏 |
| `M` | 静音/取消静音 |
| `←` / `→` | 快退/快进 5 秒 |
| `↑` / `↓` | 音量增加/减少 |
| `PageUp` / `PageDown` | 上一个/下一个视频 |
| `Shift` + `Enter` | 切换侧边栏 |
| `H` | 显示/隐藏快捷键指南 |
| `Esc` | 关闭快捷键指南 |
