# Video Player

[![wakatime](https://wakatime.com/badge/user/a70e5791-db6f-4368-aacc-0332a969bb3e/project/a99f84bc-1c1e-4629-aa5a-b06273fa67d9.svg)](https://wakatime.com/badge/user/a70e5791-db6f-4368-aacc-0332a969bb3e/project/a99f84bc-1c1e-4629-aa5a-b06273fa67d9)

[中文文档](./README.zh-CN.md)

A simple video player built with Vue 3, Vite and Express.

You can specify the path to your local video folder in the configuration, and access it through the browser after starting the service.

## Getting Started

1. Configure environment variables in `.env`

   | Variable   | Default       | Description                                                                    |
   | ---------- | ------------- | ------------------------------------------------------------------------------ |
   | `PORT`     | `3000`        | Server port                                                                    |
   | `HOST`     | `localhost`   | Address to bind to                                                             |
   | `NODE_ENV` | `development` | Environment. Can be either `development` or `production`                       |
   | `DURATION` | `true`        | Whether to fetch video duration. May take a long time if there are many videos. `ffmpeg` is needed. |

2. Install dependencies, build frontend, and start server

   ```bash
   npm install
   npm run build
   npm run start
   ```

3. Development mode, using Vite for frontend and Express for backend, both with hot reload

   ```bash
   npm install
   npm run dev
   ```
