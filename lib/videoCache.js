// lib/videoCache.js
// Downloads upcoming mission videos to the device while the team is walking,
// so they play instantly from disk instead of streaming over roaming data.
// Players call getVideoSource() once on mount — a cached file is used if it
// is complete, otherwise the remote URL is streamed as before.
import * as FileSystem from 'expo-file-system/legacy';
import { errorFields, logInfo, logWarning } from './monitoring';

const DIR = `${FileSystem.cacheDirectory}race_videos/`;

const ready = new Map();      // remoteUri -> local file uri
const inFlight = new Map();   // remoteUri -> Promise

const fileNameFor = (remoteUri) => {
  const path = decodeURIComponent(remoteUri.split('/o/')[1]?.split('?')[0] ?? '');
  return path.replace(/[^a-zA-Z0-9._-]/g, '_');
};

let dirReady = null;
const ensureDir = () => {
  if (!dirReady) {
    dirReady = (async () => {
      const info = await FileSystem.getInfoAsync(DIR);
      if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
      // Re-index files that survived from a previous app run.
      const names = await FileSystem.readDirectoryAsync(DIR);
      return new Set(names.filter((n) => !n.endsWith('.part')));
    })().catch(() => new Set());
  }
  return dirReady;
};

export function getVideoSource(remoteUri) {
  const local = ready.get(remoteUri);
  return local ? { uri: local, fromCache: true } : { uri: remoteUri, fromCache: false };
}

export async function prefetchVideo(remoteUri, videoId) {
  if (!remoteUri || ready.has(remoteUri)) return;
  if (inFlight.has(remoteUri)) return inFlight.get(remoteUri);

  const job = (async () => {
    const name = fileNameFor(remoteUri);
    const target = DIR + name;
    const existing = await ensureDir();
    if (existing.has(name)) {
      ready.set(remoteUri, target);
      return;
    }
    const started = Date.now();
    try {
      const part = `${target}.part`;
      const res = await FileSystem.downloadAsync(remoteUri, part);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      await FileSystem.moveAsync({ from: part, to: target });
      existing.add(name);
      ready.set(remoteUri, target);
      const info = await FileSystem.getInfoAsync(target);
      logInfo('video_prefetch_done', {
        video_id: videoId, file: name, bytes: info.size ?? null, download_ms: Date.now() - started,
      }, `Pre-downloaded ${videoId}`);
    } catch (e) {
      logWarning('video_prefetch_failed', {
        video_id: videoId, file: name, download_ms: Date.now() - started, ...errorFields(e),
      }, `Pre-download of ${videoId} failed — will stream instead`);
    }
  })().finally(() => inFlight.delete(remoteUri));

  inFlight.set(remoteUri, job);
  return job;
}

// Index existing files early so the very first player can use them.
export async function warmVideoCache(remoteUris) {
  const existing = await ensureDir();
  for (const uri of remoteUris) {
    const name = fileNameFor(uri);
    if (existing.has(name)) ready.set(uri, DIR + name);
  }
}
