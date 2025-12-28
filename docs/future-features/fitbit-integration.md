# Fitbit integration

Client-side Fitbit sync using OAuth 2.0 with PKCE. No server required.

<!-- toc -->
<!-- tocstop -->

## Overview

Import resting heart rate, sleep duration, and steps from Fitbit into daily
journal entries. Authentication uses OAuth 2.0 Authorization Code Flow with
PKCE, which allows client-side apps to authenticate without a server or client
secret.

## Prerequisites

Register an app at https://dev.fitbit.com:

| Setting | Value |
| ------- | ----- |
| Application Type | Client |
| Callback URL | `https://your-domain/fitbit-callback.html` |
| OAuth 2.0 Scopes | Heart Rate, Sleep, Activity |

The client_id from registration is safe to expose in JavaScript since PKCE
eliminates the need for a client secret.

## Data mapping

| Fitbit API | Endpoint | Target Field |
| ---------- | -------- | ------------ |
| Resting HR | `/1/user/-/activities/heart/date/{date}/1d.json` | `daily.restingHR` |
| Sleep | `/1.2/user/-/sleep/date/{date}.json` | `daily.sleep` (minutes → hours) |
| Steps | `/1/user/-/activities/date/{date}.json` | `daily.steps` |

## Architecture

### OAuth flow

1. User clicks "Connect Fitbit"
2. App generates PKCE code_verifier (32 random bytes) and code_challenge
   (SHA-256 hash)
3. App stores code_verifier and state token in sessionStorage
4. Browser redirects to Fitbit authorization page
5. User authorizes → Fitbit redirects to `/fitbit-callback.html` with auth code
6. Callback page stores code in localStorage and redirects to main app
7. Main app exchanges code for tokens using stored code_verifier
8. Tokens stored in IndexedDB `integrations` table

### Token management

- Access tokens expire after 8 hours
- Refresh tokens are long-lived
- App checks expiry before API calls and refreshes proactively
- Failed refresh prompts user to re-authenticate

### Rate limiting

Fitbit allows 150 API requests per hour per user. With 3 endpoints per day:

| Days | Requests | Safe with 400ms delay |
| ---- | -------- | --------------------- |
| 7 | 21 | ~8 seconds |
| 14 | 42 | ~17 seconds |
| 30 | 90 | ~36 seconds |

## Files

### New files

| File | Purpose |
| ---- | ------- |
| `js/fitbit.js` | OAuth flow, API calls, UI logic |
| `fitbit-callback.html` | OAuth redirect handler |

### Modified files

| File | Changes |
| ---- | ------- |
| `js/db.js` | Add `integrations` object store, token CRUD functions |
| `index.html` | Add "Connected services" section in Profile tab |
| `styles.css` | Integration card and status badge styles |
| `js/app.js` | Import fitbit module, init on startup |
| `js/state.js` | Add `fitbitConnected` property |
| `sw.js` | Add `js/fitbit.js` to cache |

## Module API

### js/fitbit.js

```javascript
// OAuth
export function initiateOAuth()              // Start auth, redirect to Fitbit
export async function handleCallback()       // Process OAuth redirect
export async function refreshAccessToken()   // Refresh expired token
export async function disconnect()           // Revoke and clear tokens

// Sync
export async function syncDateRange(start, end)  // Bulk sync days

// UI
export function initFitbitUI()               // Set up event listeners
export async function renderConnectionStatus()   // Update UI state
```

### js/db.js additions

```javascript
export async function getFitbitTokens()      // Get stored tokens
export async function saveFitbitTokens(t)    // Store tokens
export async function deleteFitbitTokens()   // Clear tokens
```

## UI design

Location: Profile tab, before "Data" section.

**Disconnected state:**
- Fitbit label with "Not connected" badge
- Description: "Import resting heart rate, sleep, and steps."
- "Connect Fitbit" button (accent)

**Connected state:**
- Fitbit label with "Connected" badge (green)
- Last sync timestamp
- "Sync now" button
- "Disconnect" button (danger)

**Syncing state:**
- "Syncing..." badge with progress
- Buttons disabled

## Sync behavior

- **First sync:** Last 7 days
- **Subsequent syncs:** Days since last sync (max 30)
- **Merge strategy:** Overwrite fields if Fitbit has data, skip if null
- **Missing data:** Log which days had no data, report to user

## Security considerations

| Concern | Mitigation |
| ------- | ---------- |
| Client secret exposure | PKCE eliminates need for secret |
| CSRF attacks | State parameter validated on callback |
| Token theft via XSS | Stored in IndexedDB (harder than localStorage) |
| Stale tokens | Disconnect revokes on Fitbit's side |

## References

- [Fitbit Authorization](https://dev.fitbit.com/build/reference/web-api/developer-guide/authorization/)
- [Fitbit Application Design](https://dev.fitbit.com/build/reference/web-api/developer-guide/application-design/)
- [RFC 7636 - PKCE](https://tools.ietf.org/html/rfc7636)
