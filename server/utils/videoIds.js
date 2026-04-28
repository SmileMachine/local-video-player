import crypto from "crypto";
import { buildFileFingerprint } from "./fileFingerprint.js";

const hashObject = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const buildVideoIdBase = async (filePath, config) => {
  const fingerprint = await buildFileFingerprint(filePath, config);
  return `f:${hashObject(fingerprint)}`;
};

export const createUniqueVideoId = (idBase, idCounts) => {
  const count = idCounts.get(idBase) || 0;
  idCounts.set(idBase, count + 1);
  return count === 0 ? idBase : `${idBase}:${count + 1}`;
};
