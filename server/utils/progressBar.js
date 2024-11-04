import cliProgress from 'cli-progress';
import colors from 'ansi-colors';

export function createProgressBar(options) {
  const bar = new cliProgress.SingleBar({
    format: options.format,
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
    totalFiles: options.total
  });

  // 包装更新方法
  const originalUpdate = bar.update.bind(bar);
  bar.update = (current, payload = {}) => {
    originalUpdate(current, {
      processedFiles: current,
      totalFiles: options.total,
      ...payload
    });
  };

  return bar;
} 
