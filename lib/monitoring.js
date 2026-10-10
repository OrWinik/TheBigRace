// lib/monitoring.js
// ─── One place every event goes through ───────────────────────────────────────
// logEvent(name, params, { severity, message }) fans out to:
//   1. Google Analytics 4      (every event — reports, funnels, BigQuery export)
//   2. Crashlytics             (every event as a breadcrumb; ERROR/CRITICAL as a non-fatal)
//   3. GCP Cloud Logging       (every event, structured JSON, log name "app-events")
//
// Cloud Logging is written directly from the device — no Cloud Function. The
// user's Firebase ID token is exchanged for a short-lived GCP access token via
// Workload Identity Federation (pool "app-logging", see gcp/setup.sh), which
// only has roles/logging.logWriter.
//
// Rules: fire-and-forget (never throws, never awaited by UI code), queued in
// AsyncStorage while offline / signed out and flushed when possible, and no
// PII — game code + Firebase uid only, never names, emails or phone numbers.
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { AppState, Platform } from 'react-native';

const GCP_PROJECT_ID = 'triptailor-71050';
const GCP_PROJECT_NUMBER = '138789959645';
const WIF_AUDIENCE = `//iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/app-logging/providers/firebase`;
const LOG_NAME = `projects/${GCP_PROJECT_ID}/logs/app-events`;

const QUEUE_KEY = 'monitoring_queue_v1';
const MAX_QUEUE = 500;
const BATCH_SIZE = 100;
const FLUSH_DELAY_MS = 10000;

export const Severity = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL',
};

// ─── Native Firebase (not available on web) ──────────────────────────────────
let rnfb = null;
if (Platform.OS !== 'web') {
  try {
    const analytics = require('@react-native-firebase/analytics');
    const crashlytics = require('@react-native-firebase/crashlytics');
    rnfb = {
      analytics: analytics.getAnalytics(),
      crashlytics: crashlytics.getCrashlytics(),
      logEvent: analytics.logEvent,
      setAnalyticsUserId: analytics.setUserId,
      crashLog: crashlytics.log,
      recordError: crashlytics.recordError,
      setAttributes: crashlytics.setAttributes,
      setCrashUserId: crashlytics.setUserId,
    };
  } catch (e) {
    // Native module missing (e.g. Expo Go / old dev client) — GA4 + Crashlytics off.
    if (__DEV__) console.warn('[monitoring] native Firebase unavailable:', e?.message);
  }
}

// ─── Context attached to every event ─────────────────────────────────────────
const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const ctx = {
  session_id: sessionId,
  uid: null,
  game_code: null,
  race_type: null,
  language: null,
  mission: null,
  network: 'unknown',
  cellular_gen: null,
  app_version: Application.nativeApplicationVersion ?? null,
  build: Application.nativeBuildVersion ?? null,
  platform: Platform.OS,
  os_version: String(Platform.Version ?? ''),
  device: Device.modelName ?? null,
};

// Only these context fields go to GA4 (it already tracks version/device/OS
// itself, and GA4 allows max 25 params per event).
const GA_CTX_FIELDS = ['session_id', 'game_code', 'race_type', 'language', 'mission', 'network'];

export function setContext(patch) {
  try {
    Object.assign(ctx, patch);
    if (rnfb) {
      const attrs = {};
      for (const [k, v] of Object.entries(patch)) attrs[k] = v == null ? '' : String(v);
      rnfb.setAttributes(rnfb.crashlytics, attrs).catch(() => {});
    }
  } catch {}
}

export function getContext() {
  return { ...ctx };
}

// Called from the auth listener with the Firebase JS SDK user (or null).
// We keep the user object to mint ID tokens — never call getAuth() here, it
// could initialise Auth before app/index.jsx sets up AsyncStorage persistence.
let currentUser = null;

export function setUser(user) {
  if ((user?.uid ?? null) !== (currentUser?.uid ?? null)) gcpToken = null;
  currentUser = user ?? null;
  const uid = user?.uid ?? null;
  setContext({ uid });
  try {
    if (rnfb) {
      rnfb.setAnalyticsUserId(rnfb.analytics, uid ?? null).catch(() => {});
      rnfb.setCrashUserId(rnfb.crashlytics, uid ?? '').catch(() => {});
    }
  } catch {}
  if (uid) scheduleFlush(0); // events queued before sign-in can go out now
}

// ─── GA4 param sanitising ────────────────────────────────────────────────────
const toGaParams = (params) => {
  const out = {};
  const add = (k, v) => {
    if (v === undefined || v === null || Object.keys(out).length >= 25) return;
    const key = k.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
    if (typeof v === 'number') out[key] = Number.isFinite(v) ? v : String(v);
    else if (typeof v === 'boolean') out[key] = v ? 1 : 0;
    else out[key] = String(v).slice(0, 100);
  };
  for (const f of GA_CTX_FIELDS) add(f, ctx[f]);
  for (const [k, v] of Object.entries(params)) add(k, v);
  return out;
};

// ─── Public API ──────────────────────────────────────────────────────────────
export function logEvent(name, params = {}, { severity = Severity.INFO, message } = {}) {
  try {
    const timestamp = new Date().toISOString();
    const msg = message ?? name;

    if (__DEV__) console.log(`[monitoring] ${severity} ${name}`, params);

    if (rnfb) {
      rnfb.logEvent(rnfb.analytics, name, { ...toGaParams(params), severity }).catch(() => {});
      rnfb.crashLog(rnfb.crashlytics, `[${severity}] ${name} ${safeJson(params)}`);
      if (severity === Severity.ERROR || severity === Severity.CRITICAL) {
        const err = params.error instanceof Error ? params.error : new Error(`${name}: ${msg}`);
        rnfb.recordError(rnfb.crashlytics, err, name);
      }
    }

    enqueue({
      insertId: `${sessionId}-${++seq}`,
      timestamp,
      severity,
      labels: { event: name, platform: ctx.platform, app_version: String(ctx.app_version ?? '') },
      jsonPayload: { event: name, message: msg, ctx: { ...ctx }, params: serializable(params) },
    });

    scheduleFlush(severity === Severity.ERROR || severity === Severity.CRITICAL ? 0 : FLUSH_DELAY_MS);
  } catch {}
}

export const logInfo = (name, params, message) => logEvent(name, params, { severity: Severity.INFO, message });
export const logWarning = (name, params, message) => logEvent(name, params, { severity: Severity.WARNING, message });
export const logError = (name, params, message) => logEvent(name, params, { severity: Severity.ERROR, message });
export const logCritical = (name, params, message) => logEvent(name, params, { severity: Severity.CRITICAL, message });

// Turns any caught value into loggable fields.
export function errorFields(e) {
  if (!e) return {};
  return {
    error_code: e.code ?? null,
    error_message: String(e.message ?? e).slice(0, 300),
    error: e instanceof Error ? e : undefined,
  };
}

// ─── Queue + Cloud Logging transport ─────────────────────────────────────────
let seq = 0;
let queue = [];
let queueLoaded = false;
let flushTimer = null;
let flushing = false;
let gcpToken = null; // { token, expiresAt }

const safeJson = (v) => {
  try { return JSON.stringify(serializable(v)).slice(0, 500); } catch { return ''; }
};

const serializable = (params) => {
  const out = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined) continue;
    if (v instanceof Error) continue; // already expanded by errorFields()
    out[k] = typeof v === 'string' ? v.slice(0, 1000) : v;
  }
  return out;
};

const loadQueue = async () => {
  if (queueLoaded) return;
  queueLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const saved = raw ? JSON.parse(raw) : [];
    queue = [...saved, ...queue].slice(-MAX_QUEUE);
  } catch {}
};

const persistQueue = () => {
  AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue)).catch(() => {});
};

const enqueue = (entry) => {
  queue.push(entry);
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  persistQueue();
};

function scheduleFlush(delay) {
  if (flushTimer) {
    if (delay > 0) return;
    clearTimeout(flushTimer);
  }
  flushTimer = setTimeout(() => { flushTimer = null; flush(); }, delay);
}

const getGcpToken = async () => {
  if (gcpToken && gcpToken.expiresAt > Date.now() + 60000) return gcpToken.token;
  if (!currentUser) return null;
  const idToken = await currentUser.getIdToken();
  const res = await fetch('https://sts.googleapis.com/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      audience: WIF_AUDIENCE,
      // Federated tokens only accept cloud-platform; IAM limits it to logWriter.
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      subjectToken: idToken,
      subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
    }),
  });
  if (!res.ok) throw new Error(`sts ${res.status}`);
  const json = await res.json();
  gcpToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return gcpToken.token;
};

export async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    await loadQueue();
    if (!queue.length || ctx.network === 'none') return;
    let token;
    try { token = await getGcpToken(); } catch { return; }
    if (!token) return; // not signed in yet — keep queued

    while (queue.length) {
      const batch = queue.slice(0, BATCH_SIZE);
      const res = await fetch('https://logging.googleapis.com/v2/entries:write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          logName: LOG_NAME,
          resource: { type: 'global', labels: { project_id: GCP_PROJECT_ID } },
          partialSuccess: true,
          entries: batch,
        }),
      });
      if (res.status === 401) { gcpToken = null; return; }
      // 5xx / 429: retry later. Other 4xx: the batch itself is bad — drop it so
      // it can't block the queue forever.
      if (!res.ok && (res.status >= 500 || res.status === 429)) return;
      queue = queue.slice(batch.length);
      persistQueue();
    }
  } catch {
    // network error — stays queued
  } finally {
    flushing = false;
  }
}

// ─── Network tracking ────────────────────────────────────────────────────────
let offlineSince = null;

NetInfo.addEventListener((state) => {
  try {
    const type = state.isConnected === false ? 'none' : (state.type ?? 'unknown');
    const prev = ctx.network;
    setContext({ network: type, cellular_gen: state.details?.cellularGeneration ?? null });
    if (type === 'none' && prev !== 'none') {
      offlineSince = Date.now();
      logInfo('network_offline', {}, 'Device went offline');
    } else if (type !== 'none' && prev === 'none' && offlineSince) {
      const offlineMs = Date.now() - offlineSince;
      offlineSince = null;
      logEvent('network_restored', { offline_ms: offlineMs }, {
        severity: offlineMs > 120000 ? Severity.WARNING : Severity.INFO,
        message: `Back online after ${Math.round(offlineMs / 1000)}s`,
      });
      scheduleFlush(0);
    }
  } catch {}
});

AppState.addEventListener('change', (s) => {
  if (s === 'background') flush();
});

// ─── Global error handlers ───────────────────────────────────────────────────
let handlersInstalled = false;

export function installGlobalHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;
  try {
    const prev = global.ErrorUtils?.getGlobalHandler?.();
    global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
      try {
        logEvent(isFatal ? 'js_crash' : 'js_error', {
          ...errorFields(error),
          fatal: !!isFatal,
          stack: String(error?.stack ?? '').slice(0, 1500),
        }, {
          severity: isFatal ? Severity.CRITICAL : Severity.ERROR,
          message: `${isFatal ? 'Fatal' : 'Non-fatal'} JS error: ${error?.message}`,
        });
      } catch {}
      prev?.(error, isFatal); // Crashlytics' own handler records the fatal crash
    });
  } catch {}

  try {
    global.HermesInternal?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (id, error) => {
        logError('unhandled_rejection', {
          ...errorFields(error),
          stack: String(error?.stack ?? '').slice(0, 1500),
        }, `Unhandled promise rejection: ${error?.message ?? error}`);
        if (__DEV__) console.warn('Unhandled promise rejection', error);
      },
    });
  } catch {}

  logInfo('app_launched', {}, 'App launched');
  loadQueue().then(() => scheduleFlush(0));
}
