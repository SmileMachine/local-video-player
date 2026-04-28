import fs from "fs";
import path from "path";
import zlib from "zlib";

const DANMAKU_FILE_SUFFIX = ".dplayer.json";
const DANMAKU_XML_SUFFIX = ".danmaku.xml";
const DANMAKU_CACHE_DIR = "cache/danmaku";
const BILIBILI_VIEW_API = "https://api.bilibili.com/x/web-interface/view";
const BILIBILI_DANMAKU_API = "https://api.bilibili.com/x/v1/dm/list.so";
const BILIBILI_USER_AGENT = "Mozilla/5.0";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeDanmakuType = (value) => {
  const type = Number(value);
  return [0, 1, 2].includes(type) ? type : 0;
};

const normalizeDanmakuColor = (value) => {
  const color = Number(value);
  if (!Number.isFinite(color)) {
    return 16777215;
  }
  return Math.max(0, Math.min(16777215, Math.round(color)));
};

const normalizeDanmakuRow = (row) => {
  if (!Array.isArray(row) || row.length < 5) {
    return null;
  }

  const time = Number(row[0]);
  if (!Number.isFinite(time) || time < 0) {
    return null;
  }

  return [
    time,
    normalizeDanmakuType(row[1]),
    normalizeDanmakuColor(row[2]),
    String(row[3] ?? "local"),
    escapeHtml(decodeXmlEntity(row[4])),
  ];
};

const normalizeDPlayerDanmaku = (value) => {
  const rows = Array.isArray(value?.data) ? value.data : [];
  return {
    code: 0,
    data: rows
      .map(normalizeDanmakuRow)
      .filter(Boolean)
      .sort((a, b) => a[0] - b[0]),
  };
};

const decodeXmlEntity = (value) =>
  String(value ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");

const mapBilibiliDanmakuType = (mode) => {
  if (mode === 5) {
    return 1;
  }
  if (mode === 4) {
    return 2;
  }
  return 0;
};

export const convertBilibiliXmlToDPlayer = (xml) => {
  const data = [];
  const unsupported = {};
  const pattern = /<d\s+p="([^"]+)">([\s\S]*?)<\/d>/g;
  let match;
  let total = 0;

  while ((match = pattern.exec(xml))) {
    total += 1;
    const fields = match[1].split(",");
    const time = Number(fields[0]);
    const mode = Number(fields[1]);
    const color = Number(fields[3]);

    if (!Number.isFinite(time) || time < 0) {
      continue;
    }

    if ([6, 7, 8].includes(mode)) {
      unsupported[mode] = (unsupported[mode] || 0) + 1;
      continue;
    }

    data.push([
      time,
      mapBilibiliDanmakuType(mode),
      normalizeDanmakuColor(color),
      fields[6] || "bilibili",
      decodeXmlEntity(match[2]),
    ]);
  }

  return {
    danmaku: normalizeDPlayerDanmaku({ code: 0, data }),
    stats: {
      total,
      converted: data.length,
      unsupported,
    },
  };
};

export const decodeDanmakuResponse = (buffer) => {
  const text = buffer.toString("utf8");
  if (text.trimStart().startsWith("<?xml") || text.includes("<i>")) {
    return text;
  }

  const decompressors = [
    zlib.inflateRawSync,
    zlib.inflateSync,
    zlib.gunzipSync,
    zlib.brotliDecompressSync,
  ];

  for (const decompress of decompressors) {
    try {
      const decoded = decompress(buffer).toString("utf8");
      if (decoded.trimStart().startsWith("<?xml") || decoded.includes("<i>")) {
        return decoded;
      }
    } catch {
      // Try the next compression format.
    }
  }

  throw new Error("Unable to decode bilibili danmaku response");
};

const writeJsonFile = async (filePath, value) => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.promises.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.promises.rename(tempPath, filePath);
};

const writeTextFile = async (filePath, value) => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.promises.writeFile(tempPath, value, "utf8");
  await fs.promises.rename(tempPath, filePath);
};

const ensureSuccessfulFetch = async (response, message) => {
  if (response.ok) {
    return;
  }

  throw new Error(`${message}: ${response.status} ${response.statusText}`);
};

const normalizeBvid = (value) => {
  const bvid = String(value || "").trim();
  if (!/^BV[0-9A-Za-z]{8,20}$/.test(bvid)) {
    const error = new Error("Invalid BVID");
    error.statusCode = 400;
    throw error;
  }
  return bvid;
};

const fetchBilibiliView = async (bvid) => {
  const url = new URL(BILIBILI_VIEW_API);
  url.searchParams.set("bvid", bvid);
  const response = await fetch(url, {
    headers: {
      "User-Agent": BILIBILI_USER_AGENT,
      Referer: `https://www.bilibili.com/video/${bvid}`,
    },
  });
  await ensureSuccessfulFetch(response, "Failed to fetch bilibili video info");
  const payload = await response.json();
  if (payload.code !== 0) {
    throw new Error(payload.message || "Bilibili rejected the video info request");
  }
  return payload.data;
};

const resolveBilibiliCid = (view, page) => {
  const pages = Array.isArray(view?.pages) ? view.pages : [];
  const selectedPage = pages.find((item) => Number(item.page) === page) || pages[0];
  if (!selectedPage?.cid) {
    throw new Error("Bilibili video page has no cid");
  }

  return {
    cid: selectedPage.cid,
    page: selectedPage.page,
    part: selectedPage.part || "",
    title: view?.title || "",
  };
};

const fetchBilibiliDanmakuXml = async ({ bvid, cid }) => {
  const url = new URL(BILIBILI_DANMAKU_API);
  url.searchParams.set("oid", cid);
  const response = await fetch(url, {
    headers: {
      "User-Agent": BILIBILI_USER_AGENT,
      Referer: `https://www.bilibili.com/video/${bvid}`,
      "Accept-Encoding": "identity",
    },
  });
  await ensureSuccessfulFetch(response, "Failed to fetch bilibili danmaku");
  return decodeDanmakuResponse(Buffer.from(await response.arrayBuffer()));
};

const buildSafeCacheStem = (videoId) =>
  String(videoId || "")
    .trim()
    .replace(/[^0-9A-Za-z._-]/g, "_");

const getCachedDanmakuPath = (videoId, { cacheDir = DANMAKU_CACHE_DIR } = {}) => {
  const stem = buildSafeCacheStem(videoId);
  return stem ? path.join(path.resolve(cacheDir), `${stem}${DANMAKU_FILE_SUFFIX}`) : "";
};

const getCachedDanmakuXmlPath = (videoId, { cacheDir = DANMAKU_CACHE_DIR } = {}) => {
  const stem = buildSafeCacheStem(videoId);
  return stem ? path.join(path.resolve(cacheDir), `${stem}${DANMAKU_XML_SUFFIX}`) : "";
};

const findCachedDanmakuFile = async (videoId, options = {}) => {
  const filePath = getCachedDanmakuPath(videoId, options);
  if (!filePath) {
    return null;
  }

  try {
    const stat = await fs.promises.stat(filePath);
    return stat.isFile() ? filePath : null;
  } catch {
    return null;
  }
};

const findSidecarDanmakuFile = async (videoPath) => {
  const parsedVideoPath = path.parse(videoPath);
  const exactFileName = `${parsedVideoPath.name}${DANMAKU_FILE_SUFFIX}`;
  const dirEntries = await fs.promises.readdir(parsedVideoPath.dir, { withFileTypes: true });
  const candidateNames = dirEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => (
      fileName === exactFileName ||
      (fileName.startsWith(`${parsedVideoPath.name}.`) && fileName.endsWith(DANMAKU_FILE_SUFFIX))
    ))
    .sort((a, b) => {
      if (a === exactFileName) {
        return -1;
      }
      if (b === exactFileName) {
        return 1;
      }
      return a.localeCompare(b, "zh-Hans-CN", {
        numeric: true,
        sensitivity: "base",
      });
    });

  if (!candidateNames.length) {
    return null;
  }

  return path.join(parsedVideoPath.dir, candidateNames[0]);
};

const findDanmakuFile = async (videoPath, options = {}) => {
  const cachedFilePath = await findCachedDanmakuFile(options.videoId, options);
  if (cachedFilePath) {
    return cachedFilePath;
  }

  return findSidecarDanmakuFile(videoPath);
};

export const getDanmakuStatus = async (videoPath, options = {}) => {
  const filePath = await findDanmakuFile(videoPath, options);
  return {
    exists: Boolean(filePath),
    fileName: filePath ? path.basename(filePath) : "",
  };
};

export const getDPlayerDanmaku = async (videoPath, options = {}) => {
  const filePath = await findDanmakuFile(videoPath, options);
  if (!filePath) {
    return {
      code: 0,
      data: [],
    };
  }

  const parsed = JSON.parse(await fs.promises.readFile(filePath, "utf8"));
  return normalizeDPlayerDanmaku(parsed);
};

export const importBilibiliDanmaku = async (videoPath, { bvid, page = 1, videoId, cacheDir } = {}) => {
  const normalizedBvid = normalizeBvid(bvid);
  const parsedVideoPath = path.parse(videoPath);
  const resolvedPage = Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const view = await fetchBilibiliView(normalizedBvid);
  const source = resolveBilibiliCid(view, resolvedPage);
  const xml = await fetchBilibiliDanmakuXml({
    bvid: normalizedBvid,
    cid: source.cid,
  });
  const { danmaku, stats } = convertBilibiliXmlToDPlayer(xml);
  const xmlFilePath = videoId
    ? getCachedDanmakuXmlPath(videoId, { cacheDir })
    : path.join(parsedVideoPath.dir, `${parsedVideoPath.name}${DANMAKU_XML_SUFFIX}`);
  const dplayerFilePath = videoId
    ? getCachedDanmakuPath(videoId, { cacheDir })
    : path.join(parsedVideoPath.dir, `${parsedVideoPath.name}${DANMAKU_FILE_SUFFIX}`);

  await Promise.all([
    writeTextFile(xmlFilePath, xml),
    writeJsonFile(dplayerFilePath, danmaku),
  ]);

  return {
    bvid: normalizedBvid,
    cid: source.cid,
    page: source.page,
    part: source.part,
    title: source.title,
    files: {
      xml: path.basename(xmlFilePath),
      dplayer: path.basename(dplayerFilePath),
    },
    stats,
  };
};
