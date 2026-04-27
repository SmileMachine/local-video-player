export const parseVttTimestamp = (value) => {
  const parts = String(value || "").trim().split(":");
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const secondsPart = parts.pop();
  const seconds = Number.parseFloat(secondsPart);
  const minutes = Number.parseInt(parts.pop(), 10);
  const hours = parts.length ? Number.parseInt(parts.pop(), 10) : 0;

  if (![seconds, minutes, hours].every(Number.isFinite)) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
};

export const formatVttTimestamp = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const totalMillis = Math.round(safeSeconds * 1000);
  const hours = Math.floor(totalMillis / 3_600_000);
  const minutes = Math.floor((totalMillis % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((totalMillis % 60_000) / 1000);
  const millis = totalMillis % 1000;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    `${String(wholeSeconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`,
  ].join(":");
};

export const parseVttCues = (content) => {
  const normalized = String(content || "").replace(/\r\n/g, "\n");
  const blocks = normalized.split(/\n{2,}/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trimEnd()).filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) {
      continue;
    }

    const [rawStart, rawEnd] = lines[timingIndex].split("-->");
    const start = parseVttTimestamp(rawStart);
    const end = parseVttTimestamp(String(rawEnd || "").trim().split(/\s+/)[0]);
    if (start === null || end === null || end <= start) {
      continue;
    }

    const text = lines.slice(timingIndex + 1).join("\n").trim();
    if (!text) {
      continue;
    }

    cues.push({ start, end, text });
  }

  return cues.sort((a, b) => a.start - b.start || a.end - b.end);
};

export const renderVtt = (cues) => {
  const body = cues
    .map((cue) => [
      `${formatVttTimestamp(cue.start)} --> ${formatVttTimestamp(cue.end)}`,
      cue.text,
    ].join("\n"))
    .join("\n\n");

  return `WEBVTT\n\n${body}\n`;
};

export const combineVttCues = (primaryCues, secondaryCues) => {
  const boundaries = new Set();
  for (const cue of [...primaryCues, ...secondaryCues]) {
    boundaries.add(cue.start);
    boundaries.add(cue.end);
  }

  const sortedBoundaries = [...boundaries].sort((a, b) => a - b);
  const combined = [];

  for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
    const start = sortedBoundaries[index];
    const end = sortedBoundaries[index + 1];
    const primary = primaryCues.find((cue) => cue.start < end && cue.end > start);
    const secondary = secondaryCues.find((cue) => cue.start < end && cue.end > start);

    if (!primary && !secondary) {
      continue;
    }

    const lines = [];
    if (primary?.text) {
      lines.push(primary.text);
    }
    if (secondary?.text && secondary.text !== primary?.text) {
      lines.push(secondary.text);
    }

    const text = lines.join("\n");
    const previous = combined[combined.length - 1];
    if (previous && previous.text === text && Math.abs(previous.end - start) < 0.001) {
      previous.end = end;
    } else {
      combined.push({ start, end, text });
    }
  }

  return combined;
};

export const combineVtt = (primaryContent, secondaryContent) =>
  renderVtt(combineVttCues(parseVttCues(primaryContent), parseVttCues(secondaryContent)));
