# The Big Race — Monitoring

Every event goes through `logEvent()` in [`lib/monitoring.js`](../lib/monitoring.js) and is sent to:

| Where | What you get | Open it |
|---|---|---|
| **Cloud Logging** (log `app-events`) | Every event as structured JSON with severity. Near real time. | [Logs Explorer](https://console.cloud.google.com/logs/query;query=logName%3D%22projects%2Ftriptailor-71050%2Flogs%2Fapp-events%22?project=triptailor-71050) |
| **Cloud Monitoring dashboard** | "The Big Race — App Health": charts built from the logs, plus live error and video panels. | [Dashboards](https://console.cloud.google.com/monitoring/dashboards?project=triptailor-71050) |
| **Google Analytics 4** | Every event, for funnels and retention. Exported to BigQuery. | Firebase console → Analytics |
| **Crashlytics** | Crashes, plus ERROR/CRITICAL events as non-fatals. Earlier events are attached as breadcrumbs. | Firebase console → Crashlytics |

The app writes to Cloud Logging directly. There is no Cloud Function. The signed-in user's Firebase ID token is exchanged (via Workload Identity Federation) for a short-lived token that can only *write logs*. Events are queued on the device while offline or signed out and sent later. Logging never throws or blocks the UI.

**Privacy:** events carry the game code and the Firebase uid. They never include names, emails or phone numbers. The one piece of user-typed text that gets logged is wrong answers, trimmed to 50 characters. Cloud Logging keeps logs for 30 days by default.

## Context on every event (`jsonPayload.ctx`)

`session_id, uid, game_code, race_type, language, mission, network (wifi/cellular/none), cellular_gen, app_version, build, platform, os_version, device`

## Severity

- 🔴 **CRITICAL**: a customer lost something (progress, result, upload) or couldn't get in.
- 🟠 **ERROR**: a feature failed (video, permission, DB read).
- 🟡 **WARNING**: friction (slow video, repeated wrong answers, offline more than 2 min).
- 🔵 **INFO**: normal flow, the baseline for every report.

## Events

### 🎬 Video
| Event | Sev | Meaning / key params |
|---|---|---|
| `video_load_start` | INFO | Player mounted. `video_id, file, source (cache/stream), attempt` |
| `video_ready` | INFO/WARN | Loaded. **`time_to_ready_ms`**, `duration_ms`. WARNING if slower than 10s |
| `video_slow_load` | WARN | Still not ready after 10s |
| `video_play_start` | INFO | Playback started. `startup_ms` |
| `video_buffering` | WARN | Paused 2s or more to buffer. `buffering_ms, position_ms, playable_ms` |
| `video_stall` | ERROR | `phase=initial_load`: not loaded in 25s. `phase=playback`: no progress for 15s |
| `video_load_error` | ERROR | Player error. `error_message`, plus a HEAD probe: `probe_status, probe_ms, content_length` |
| `video_retry` | WARN | Automatic retry (one per video; a cached file is retried by streaming) |
| `video_failed_exit` | ERROR | Gave up. The team was **sent to the home screen** with the "try again later / contact support" message, and progress was saved. `reason: load_timeout / load_error / stall` |
| `video_abandoned` | WARN | User left while the video was still loading |
| `video_exit` | INFO | Left before the end. `pct_watched` |
| `video_completed` | INFO | Reached 90%. `watch_ms, buffering_ms, buffering_count` |
| `video_skipped` | INFO | Skip on the welcome/final video. `position_ms` |
| `video_submit_blocked` | WARN | Submit pressed before the video was watched |
| `video_prefetch_done` / `_failed` | INFO/WARN | Background download of the next mission's video |
| `support_contact_tapped` | INFO | Tapped "Email support" after a video failure |

### 💾 Progress & results
`progress_save_failed` 🔴 · `progress_load_failed` 🟠 · `progress_clear_failed` 🟡 · `progress_restored` 🔵 · `progress_discarded` 🔵 (`reason: user_dismissed / expired / different_user`) · `results_save_failed` 🔴

### 📤 Uploads & permissions
`upload_failed` 🔴 (`kind, bytes, error_code, upload_ms`; the team continues, but the submission is lost) · `upload_succeeded` 🔵 · `permission_denied` 🟠 (`permission, purpose`) · `submit_failed` 🟠

### 🔑 Codes & auth
`code_invalid` 🟡 (`reason: not_found / expired / email_mismatch / full`, `attempted_code`) · `code_validate_error` 🔴 · `code_list_empty` 🟠 · `code_activated` 🔵 (`tier, role, lookup_ms`) · `code_flag_check_failed` 🟠 · `code_expired_cleared` 🔵 · `login` / `sign_up` 🔵 · `sign_in_failed` / `sign_up_failed` / `password_reset_failed` 🟡 (`error_code`, e.g. `auth/network-request-failed`)

### 🏁 Race flow
`race_type_selected` · `race_start` · `mission_start` · `mission_complete` (`duration_s, wrong_attempts, clue_used, times_backgrounded`) · `race_complete` (`total_s`) · `race_exit` · `answer_wrong` (`answer, attempt`) · `answer_repeated_wrong` 🟡 · `clue_opened` · `race_backgrounded` (WARNING after 3 times on one mission) · `race_foregrounded` (`away_ms`) · `remote_answers_fetch_failed` 🟡

### 🌐 Language
`language_changed` (`from, to, rtl_flip_pending`) · `language_reset` 🟡 · `language_save_failed` 🟡 · `language_load_failed` 🟡 · `rtl_mismatch` 🟡

### 💥 App health
`app_launched` · `js_crash` 🔴 · `js_error` 🟠 · `render_error` 🔴 · `unhandled_rejection` 🟠 · `network_offline` · `network_restored` (WARNING if offline longer than 2 min) · `db_read_failed` 🟠 (`source: leaderboard / profile / sign_in_first_login / …`) · `leaderboard_loaded` (`load_ms`) · `profile_upload_failed` 🟠 · `account_delete_failed` 🟠

## Useful Logs Explorer queries

Paste these into Logs Explorer. All of them start with `logName="projects/triptailor-71050/logs/app-events"`.

```
-- Everything that went wrong
logName="projects/triptailor-71050/logs/app-events" AND severity>=ERROR

-- Every video problem
logName="projects/triptailor-71050/logs/app-events" AND jsonPayload.event=~"^video_(load_error|stall|failed_exit|slow_load|buffering|abandoned|retry)$"

-- One team's whole session, in order
logName="projects/triptailor-71050/logs/app-events" AND jsonPayload.ctx.game_code="4821"

-- Wrong answers for mission 4 (find spellings to accept)
logName="projects/triptailor-71050/logs/app-events" AND jsonPayload.event="answer_wrong" AND jsonPayload.params.mission_number=4

-- Slow videos on cellular
logName="projects/triptailor-71050/logs/app-events" AND jsonPayload.event="video_ready" AND jsonPayload.ctx.network="cellular" AND jsonPayload.params.time_to_ready_ms>5000
```

## One-time setup

1. `gcloud auth login`, then `gcp/setup.sh`. This creates the federation pool, metrics and dashboard, and uploads the videos.
2. Firebase console → Project settings → **Integrations → BigQuery** → link **Google Analytics** and **Crashlytics**. Daily export is free.
3. Firebase console → Project settings → Integrations → make sure **Google Analytics** is enabled. Then download a fresh `GoogleService-Info.plist`; the current one is from before Analytics was on and has bundle ID `com.OrWinik.triptailor`, while the app uses `com.OrWinik.TripTailor`.
4. Build with EAS. The native Firebase modules need a new build; an OTA update isn't enough.

## Videos

The originals were 1080p at about 19 Mbps (100–320 MB each), and the English/Serbian files had their index (`moov`) at the end. On roaming data they buffered forever. `scripts/encode-videos.sh` makes 720p / ~1.8 Mbps / faststart versions, about 10× smaller. The app streams `race_v2_<lang>_<key>.mp4` and pre-downloads the next mission's video in the background.

To add or replace a video, edit `scripts/videos-manifest.json`, then run `scripts/encode-videos.sh <lang> <key>` and `gcp/setup.sh`.
