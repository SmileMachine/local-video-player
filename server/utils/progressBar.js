import cliProgress from 'cli-progress';
import colors from 'ansi-colors';

export function createProgressBar(options) {
  const bar = new cliProgress.SingleBar({
    format: options.noTotalFormat 
      ? options.format  // 使用自定义格式
      : `${options.format}`, // 默认格式包含总数和百分比
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    clearOnComplete: true,
    stopOnComplete: true,
    ...options
  });

  bar.start(options.total, 0, {
    filename: 'Starting...',
    processedFiles: 0,
    totalFiles: options.total,
    countedFiles: 0,
    countedDirs: 0,
    currentPath: ''
  });

  // 包装更新方法
  const originalUpdate = bar.update.bind(bar);
  bar.updatep = (current, payload = {}) => {
    originalUpdate(current, {
      processedFiles: current,
      totalFiles: options.total,
      ...payload
    });
  };

  return bar;
} 
