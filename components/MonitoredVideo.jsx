// components/MonitoredVideo.jsx
// expo-av <Video> with load/stall detection and full telemetry.
//
// Failure handling (calls onFailed(reason) — the parent sends the team home):
//   • not loaded within LOAD_TIMEOUT_MS            → retry once, then 'load_timeout'
//   • player error (onError)                        → retry once, then 'load_error'
//   • playing but no progress for STALL_TIMEOUT_MS  → 'stall'
// The old inline player only started its stall timer once position > 0, so a
// video stuck on the spinner at 0:00 never recovered and blocked Submit.
import { Video } from 'expo-av';
import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { getVideoSource } from '../lib/videoCache';
import { getContext, logError, logEvent, logInfo, logWarning, Severity } from '../lib/monitoring';

const SLOW_LOAD_MS = 10000;
const LOAD_TIMEOUT_MS = 25000;
const STALL_TIMEOUT_MS = 15000;
const BUFFER_LOG_MIN_MS = 2000;
const MAX_ATTEMPTS = 2;

// Quick HEAD request so a load error log says *why* (403? 404? DNS? timeout?).
const probe = async (uri) => {
  if (!uri.startsWith('http')) return { probe_status: 'local_file' };
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(uri, { method: 'HEAD', signal: controller.signal });
    return {
      probe_status: res.status,
      probe_ms: Date.now() - started,
      content_length: Number(res.headers.get('content-length')) || null,
      content_type: res.headers.get('content-type'),
    };
  } catch (e) {
    return { probe_status: e?.name === 'AbortError' ? 'timeout' : 'network_error', probe_ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
};

const fileOf = (uri) => decodeURIComponent(uri.split('/o/')[1]?.split('?')[0] ?? uri.split('/').pop() ?? '');

const MonitoredVideo = forwardRef(function MonitoredVideo(
  { videoId, remoteUri, onFailed, onWatched, onPlaybackStatusUpdate, ...videoProps },
  ref,
) {
  const [attempt, setAttempt] = useState(1);
  // Timers call these later — always use the latest props, not a stale closure.
  const callbacks = useRef({});
  callbacks.current = { onFailed, onWatched };
  // Source is decided once per attempt; never swapped mid-playback.
  const [source, setSource] = useState(() => getVideoSource(remoteUri));

  const s = useRef(null);
  if (!s.current) {
    s.current = {
      mountedAt: Date.now(),
      attemptStartedAt: Date.now(),
      readyAt: null,
      durationMs: null,
      playStartedAt: null,
      lastPos: 0,
      lastProgressAt: Date.now(),
      lastStatus: null,
      bufferingSince: null,
      bufferingMs: 0,
      bufferingCount: 0,
      maxPos: 0,
      watched: false,
      failed: false,
      slowLogged: false,
    };
  }

  const base = () => ({
    video_id: videoId,
    file: fileOf(source.uri),
    source: source.fromCache ? 'cache' : 'stream',
    attempt,
  });

  const fail = (reason, extra = {}, message) => {
    const st = s.current;
    if (st.failed) return;
    st.failed = true;
    logError('video_failed_exit', {
      ...base(), reason, ...extra,
      position_ms: st.lastPos,
      waited_ms: Date.now() - st.mountedAt,
    }, message ?? `Video ${videoId} failed (${reason}) — team sent to home screen`);
    callbacks.current.onFailed?.(reason);
  };

  const retry = (reason, extra) => {
    const st = s.current;
    if (attempt >= MAX_ATTEMPTS) { fail(reason, extra); return; }
    logWarning('video_retry', { ...base(), reason }, `Retrying ${videoId} after ${reason}`);
    st.attemptStartedAt = Date.now();
    st.lastProgressAt = Date.now();
    st.readyAt = null;
    st.slowLogged = false;
    // A cached file that fails may be corrupt — stream the retry instead.
    if (source.fromCache) setSource({ uri: remoteUri, fromCache: false });
    setAttempt((a) => a + 1);
  };

  // ── Load start + watchdog ────────────────────────────────────────────────
  useEffect(() => {
    const st = s.current;
    logInfo('video_load_start', base(), `Loading ${videoId}`);
    const watchdog = setInterval(() => {
      if (st.failed) return;
      const now = Date.now();

      if (!st.readyAt) {
        const waited = now - st.attemptStartedAt;
        if (!st.slowLogged && waited > SLOW_LOAD_MS) {
          st.slowLogged = true;
          logWarning('video_slow_load', { ...base(), waited_ms: waited }, `${videoId} not ready after ${Math.round(waited / 1000)}s`);
        }
        if (waited > LOAD_TIMEOUT_MS) {
          logError('video_stall', { ...base(), phase: 'initial_load', stall_ms: waited, position_ms: 0 },
            `${videoId} never finished loading (${Math.round(waited / 1000)}s)`);
          retry('load_timeout', { phase: 'initial_load' });
        }
        return;
      }

      const ls = st.lastStatus;
      const intent = st.playStartedAt || videoProps.shouldPlay || ls?.shouldPlay;
      const wantsToPlay = intent && ls && !ls.didJustFinish && (ls.isPlaying || ls.isBuffering);
      if (wantsToPlay && now - st.lastProgressAt > STALL_TIMEOUT_MS) {
        logError('video_stall', {
          ...base(), phase: 'playback',
          stall_ms: now - st.lastProgressAt,
          position_ms: st.lastPos,
          playable_ms: ls.playableDurationMillis ?? null,
          duration_ms: st.durationMs,
        }, `${videoId} stuck at ${Math.round(st.lastPos / 1000)}s for ${Math.round((now - st.lastProgressAt) / 1000)}s`);
        fail('stall', { phase: 'playback' });
      }
    }, 1000);
    return () => clearInterval(watchdog);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // ── Unmount summary ──────────────────────────────────────────────────────
  useEffect(() => () => {
    const st = s.current;
    if (st.failed) return;
    if (!st.readyAt) {
      logWarning('video_abandoned', { ...base(), waited_ms: Date.now() - st.mountedAt },
        `Left ${videoId} while it was still loading`);
    } else if (!st.watched) {
      logInfo('video_exit', {
        ...base(),
        max_position_ms: st.maxPos,
        duration_ms: st.durationMs,
        pct_watched: st.durationMs ? Math.round((st.maxPos / st.durationMs) * 100) : null,
        buffering_ms: st.bufferingMs,
        buffering_count: st.bufferingCount,
      }, `Left ${videoId} before the end`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoad = (status) => {
    const st = s.current;
    const now = Date.now();
    st.readyAt = now;
    st.lastProgressAt = now;
    st.durationMs = status?.durationMillis ?? null;
    logEvent('video_ready', {
      ...base(),
      time_to_ready_ms: now - st.attemptStartedAt,
      duration_ms: st.durationMs,
    }, {
      severity: now - st.attemptStartedAt > SLOW_LOAD_MS ? Severity.WARNING : Severity.INFO,
      message: `${videoId} ready in ${((now - st.attemptStartedAt) / 1000).toFixed(1)}s`,
    });
  };

  const handleStatus = (status) => {
    onPlaybackStatusUpdate?.(status);
    const st = s.current;
    if (!status.isLoaded) return;
    const now = Date.now();
    st.lastStatus = status;
    if (!st.durationMs && status.durationMillis) st.durationMs = status.durationMillis;

    const pos = status.positionMillis ?? 0;
    if (pos !== st.lastPos) { st.lastPos = pos; st.lastProgressAt = now; }
    if (pos > st.maxPos) st.maxPos = pos;
    if (!status.isPlaying && !status.isBuffering) st.lastProgressAt = now; // paused by user

    if (status.isPlaying && !st.playStartedAt) {
      st.playStartedAt = now;
      logInfo('video_play_start', {
        ...base(), startup_ms: st.readyAt ? now - st.readyAt : null,
      }, `${videoId} started playing`);
    }

    // Buffering episodes after playback has started
    if ((st.playStartedAt || status.shouldPlay) && status.isBuffering && !status.isPlaying) {
      if (!st.bufferingSince) st.bufferingSince = now;
    } else if (st.bufferingSince) {
      const dur = now - st.bufferingSince;
      st.bufferingSince = null;
      st.bufferingMs += dur;
      st.bufferingCount += 1;
      if (dur >= BUFFER_LOG_MIN_MS) {
        logWarning('video_buffering', {
          ...base(), buffering_ms: dur, position_ms: pos,
          playable_ms: status.playableDurationMillis ?? null,
        }, `${videoId} buffered for ${(dur / 1000).toFixed(1)}s at ${Math.round(pos / 1000)}s`);
      }
    }

    const pct = st.durationMs ? pos / st.durationMs : 0;
    if (!st.watched && (pct >= 0.9 || status.didJustFinish)) {
      st.watched = true;
      logInfo('video_completed', {
        ...base(),
        duration_ms: st.durationMs,
        watch_ms: st.playStartedAt ? now - st.playStartedAt : null,
        buffering_ms: st.bufferingMs,
        buffering_count: st.bufferingCount,
        total_ms: now - st.mountedAt,
      }, `${videoId} watched to the end`);
      callbacks.current.onWatched?.();
    }
  };

  const handleError = async (error) => {
    const st = s.current;
    if (st.failed) return;
    const details = await probe(source.uri);
    logError('video_load_error', {
      ...base(),
      error_message: String(error).slice(0, 300),
      network: getContext().network,
      ...details,
    }, `${videoId} failed to load: ${String(error).slice(0, 120)}`);
    retry('load_error', { error_message: String(error).slice(0, 300) });
  };

  return (
    <Video
      key={attempt}
      ref={ref}
      source={{ uri: source.uri }}
      onLoad={handleLoad}
      onError={handleError}
      onPlaybackStatusUpdate={handleStatus}
      {...videoProps}
    />
  );
});

export default MonitoredVideo;
