const CENTER_DANMAKU_BASE_DURATION = 4;
const CENTER_DANMAKU_FULLSCREEN_DURATION = 6;
const RIGHT_DANMAKU_BASE_DURATION = 5;
const RIGHT_DANMAKU_FULLSCREEN_DURATION = 8;
const DEFAULT_BACKFILL_MAX_COUNT = 120;
const DEFAULT_DANMAKU_GAP = 10;

export const normalizeDanmakuType = (value) => {
  if (value === "top" || Number(value) === 1) {
    return 1;
  }
  if (value === "bottom" || Number(value) === 2) {
    return 2;
  }
  return 0;
};

export const getDanmakuDuration = (type, { speedRate = 1, fullscreen = false } = {}) => {
  const normalizedSpeed = Number(speedRate);
  const safeSpeed = Number.isFinite(normalizedSpeed) && normalizedSpeed > 0 ? normalizedSpeed : 1;
  const normalizedType = normalizeDanmakuType(type);
  const baseDuration = normalizedType === 0
    ? (fullscreen ? RIGHT_DANMAKU_FULLSCREEN_DURATION : RIGHT_DANMAKU_BASE_DURATION)
    : (fullscreen ? CENTER_DANMAKU_FULLSCREEN_DURATION : CENTER_DANMAKU_BASE_DURATION);

  return baseDuration / safeSpeed;
};

const cloneDanmaku = (danmaku) => ({
  ...danmaku,
  time: Number(danmaku.time),
  type: normalizeDanmakuType(danmaku.type),
});

export const collectVisibleDanmakuBeforeTime = (
  danmakuList,
  currentTime,
  { speedRate = 1, fullscreen = false, maxCount = DEFAULT_BACKFILL_MAX_COUNT } = {}
) => {
  const time = Number(currentTime);
  if (!Array.isArray(danmakuList) || !Number.isFinite(time)) {
    return [];
  }

  const maxDuration = Math.max(
    getDanmakuDuration(0, { speedRate, fullscreen }),
    getDanmakuDuration(1, { speedRate, fullscreen })
  );
  const result = [];

  for (let index = danmakuList.length - 1; index >= 0; index -= 1) {
    const danmaku = danmakuList[index];
    const danmakuTime = Number(danmaku?.time);
    if (!Number.isFinite(danmakuTime)) {
      continue;
    }

    const elapsed = time - danmakuTime;
    if (elapsed <= 0) {
      continue;
    }
    if (elapsed >= maxDuration) {
      break;
    }

    const duration = getDanmakuDuration(danmaku.type, { speedRate, fullscreen });
    if (elapsed >= duration) {
      continue;
    }

    result.push({
      danmaku: cloneDanmaku(danmaku),
      elapsed,
      duration,
    });
  }

  return result.reverse().slice(-maxCount);
};

const createRows = (count) =>
  Array.from({ length: Math.max(1, count) }, () => []);

const isSeparated = (a, b, gap) =>
  a.right + gap <= b.left || b.right + gap <= a.left;

const getRollingPosition = ({ containerWidth, width, elapsed, duration }) => {
  const progress = Math.max(0, Math.min(1, elapsed / duration));
  const left = containerWidth - (containerWidth + width) * progress;
  return {
    left,
    right: left + width,
  };
};

export const assignDanmakuBackfillLanes = (
  items,
  {
    containerWidth,
    rowCount,
    measureText,
    gap = DEFAULT_DANMAKU_GAP,
  } = {}
) => {
  const width = Number(containerWidth);
  const rows = Math.max(1, Math.floor(Number(rowCount) || 1));
  if (!Array.isArray(items) || !Number.isFinite(width) || width <= 0) {
    return [];
  }

  const rightRows = createRows(rows);
  const centerRows = {
    top: createRows(rows),
    bottom: createRows(rows),
  };
  const result = [];

  for (const item of items) {
    const danmaku = item?.danmaku;
    const type = normalizeDanmakuType(danmaku?.type);
    const duration = Number(item?.duration);
    const elapsed = Number(item?.elapsed);
    if (!danmaku || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(elapsed)) {
      continue;
    }

    if (type === 0) {
      const measuredWidth = Math.max(1, Math.ceil(Number(measureText?.(danmaku.text)) || 0) + 1);
      const position = getRollingPosition({
        containerWidth: width,
        width: measuredWidth,
        elapsed,
        duration,
      });
      const lane = rightRows.findIndex((row) =>
        row.every((existing) => isSeparated(existing, position, gap))
      );
      if (lane < 0) {
        continue;
      }

      rightRows[lane].push(position);
      result.push({
        ...item,
        lane,
        width: measuredWidth,
        position,
      });
      continue;
    }

    const typeName = type === 1 ? "top" : "bottom";
    const lane = centerRows[typeName].findIndex((row) => row.length === 0);
    if (lane < 0) {
      continue;
    }

    centerRows[typeName][lane].push({ left: 0, right: width });
    result.push({
      ...item,
      lane,
      width,
      position: { left: 0, right: width },
    });
  }

  return result;
};
