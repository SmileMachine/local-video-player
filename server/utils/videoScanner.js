import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { exec } from 'child_process'
import chalk from 'chalk'

const execAsync = promisify(exec)

export class VideoScanner {
  constructor() {
    this.supportedExtensions = ['.mp4', '.webm', '.mkv', '.avi', '.mov']
  }

  async getVideoDuration(filePath) {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v quiet -print_format json -show_format "${filePath}"`
      )
      const data = JSON.parse(stdout)
      return parseFloat(data.format.duration)
    } catch (error) {
      console.error(chalk.yellow(`Warning: Could not get duration for ${filePath}`))
      return null
    }
  }

  isVideoFile(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    return this.supportedExtensions.includes(ext)
  }

  async scanPath(currentPath) {
    try {
      const stats = fs.statSync(currentPath)
      const name = path.basename(currentPath)
      const baseInfo = {
        name,
        type: stats.isDirectory() ? 'directory' : 'file',
        path: currentPath,
        mtime: stats.mtime
      }

      if (stats.isDirectory()) {
        // skip hidden files
        if (name.startsWith('.')) {
          return null
        }

        const items = fs.readdirSync(currentPath)
        const children = []
        
        for (const item of items) {
          const itemPath = path.join(currentPath, item)
          const child = await this.scanPath(itemPath)
          if (child) {
            children.push(child)
          }
        }

        // 只返回包含视频的目录
        if (children.length > 0) {
          return {
            ...baseInfo,
            children: children.sort((a, b) => b.mtime - a.mtime)
          }
        }
      } else if (this.isVideoFile(currentPath)) {
        const duration = await this.getVideoDuration(currentPath)
        return {
          ...baseInfo,
          size: stats.size,
          duration
        }
      }

      return null
    } catch (error) {
      console.error(chalk.red(`Error scanning ${currentPath}:`), error)
      return null
    }
  }
} 
