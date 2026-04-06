# PWA Mobile UX Overhaul — Local-Agent

## Instructions for Claude CLI

Before making ANY changes, first explore and map the PWA source code in this project. Find:
- The service worker file(s) (look for `sw.js`, `service-worker.js`, or similar)
- The push notification registration and `notificationclick` handler
- The WebSocket client code that communicates with the Local-Agent backend
- The terminal/REPL UI components (the view that renders terminal output)
- The button bar components (Yes, No, Enter, Esc, Tab, arrow keys, Launch, Ctrl+C, Ctrl+D, Clear, Restart)
- The tab system (Chat, Terminal, Claude, Luna tabs)
- The session sidebar (session list, +New, search, voice ID section)
- Any CSS/styling related to mobile responsiveness

Read each file you find before proposing changes. Understand the existing patterns — reuse them. Do not rewrite from scratch.

---

## Architecture Context

This is a PWA for Local-Agent, a local AI assistant powered by Ollama. The backend exposes an HTTP API with WebSocket support for real-time terminal I/O and approval workflows. The PWA is accessed on mobile (iOS Safari) via Tailscale. It has:
- **4 tabs**: Chat (Luna conversational UI), Terminal (shell), Claude (Claude Code CLI), Luna (Luna agent home)
- **A button bar** at the bottom: Yes, No, Enter, Esc, Tab, arrow keys (up/down/left), plus a second row with Launch, Ctrl+C, Ctrl+D, Clear, Restart
- **A session sidebar** (hamburger menu) with session history, search, voice ID, and logout
- **Push notifications** for prompts that need user approval
- **A floating "+" FAB button** in the bottom-right corner

---

## Issue 1: Push Notification Routing (Critical)

### Current behavior
When a push notification arrives (e.g., Claude asking for approval to run a command), tapping it opens a **new PWA instance** or loads a blank/home page. The user is NOT brought to the terminal session where the prompt is waiting. The original prompt context is lost — Claude or Luna has to rebuild memory from scratch, creating a useless loop.

### Expected behavior
Tapping a notification MUST:
1. Focus the existing PWA window/tab if one is already open (do NOT open a new instance)
2. Navigate to the correct tab (e.g., Claude tab) and the specific session that triggered the notification
3. Scroll to the prompt that needs attention so the user can immediately respond
4. If no existing window is open, open one and navigate directly to the correct session

### Technical guidance
In the service worker `notificationclick` handler:
```javascript
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { sessionId, tab } = event.notification.data;
  const targetUrl = `/?tab=${tab}&session=${sessionId}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus().then((c) => c.navigate(targetUrl));
        }
      }
      // No existing window — open new one at the right URL
      return clients.openWindow(targetUrl);
    })
  );
});
```

The notification payload sent from the backend MUST include:
- `sessionId` — which session triggered the notification
- `tab` — which tab the session belongs to (e.g., "claude", "terminal")
- `promptContext` — brief description of what needs approval

The frontend, on load, must check URL parameters and:
- Switch to the correct tab
- Load/resume the correct session
- Scroll to the latest output

### Done criteria
- [ ] Tapping a notification when PWA is open focuses the existing window and navigates to the correct session
- [ ] Tapping a notification when PWA is closed opens it directly at the correct session
- [ ] The prompt that triggered the notification is visible on screen after navigation
- [ ] No new duplicate instances are created

---

## Issue 2: Yes Button Opens Keyboard Instead of Sending Approval (Critical)

### Current behavior
When Claude prompts "Would you like to continue?" or similar approval prompts, tapping the **Yes** button in the button bar opens the phone's on-screen keyboard and requires the user to manually type a number (e.g., "1" for yes) to proceed. This defeats the entire purpose of having a quick-tap button — especially on mobile where the goal is one-tap approval, even from a lock screen notification.

### Expected behavior
Tapping "Yes" should:
1. Immediately send the correct approval input (e.g., `"y"`, `"yes"`, or the appropriate numbered option) directly through the WebSocket to the terminal — NO keyboard, NO text field focus
2. The button should use `event.preventDefault()` to block any focus shift to an input element
3. The terminal should reflect the input as if the user typed it

Additionally, push notifications should include **action buttons** so the user can approve/deny directly from the notification (including from the lock screen):
```javascript
self.registration.showNotification('Claude needs approval', {
  body: 'Run: npm install express',
  icon: '/icon-192.png',
  data: { sessionId, tab: 'claude' },
  actions: [
    { action: 'approve', title: 'Approve' },
    { action: 'deny', title: 'Deny' }
  ]
});
```

In the service worker, handle the action:
```javascript
self.addEventListener('notificationclick', (event) => {
  const { action } = event;
  const { sessionId } = event.notification.data;

  if (action === 'approve') {
    // Send approval directly to backend via fetch
    event.waitUntil(
      fetch(`/api/sessions/${sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: 'approve' })
      })
    );
  } else if (action === 'deny') {
    event.waitUntil(
      fetch(`/api/sessions/${sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: 'deny' })
      })
    );
  }
  // ... also handle default click (no action) with window focus logic from Issue 1
});
```

The backend needs an endpoint (or adapt the existing WebSocket message protocol) to accept approval/denial responses by session ID.

### Done criteria
- [ ] Tapping "Yes" sends approval instantly via WebSocket — keyboard never appears
- [ ] Tapping "No" sends denial instantly via WebSocket — keyboard never appears
- [ ] Push notifications show "Approve" and "Deny" action buttons
- [ ] Tapping "Approve" on the notification (even from lock screen) sends approval to the correct session without opening the app
- [ ] The terminal reflects the approval/denial as if the user typed the response

---

## Issue 3: Terminal Scrolling and Navigation (High)

### Current behavior
When the terminal accumulates a lot of output, scrolling on mobile is extremely difficult:
- There is no auto-scroll — new output appears below the visible area and the user must manually scroll down
- There is no way to quickly jump to the bottom (where the latest output/prompt is) or the top
- Touch scrolling feels sluggish and imprecise — it's easy to lose your place
- The terminal content area may not have proper `-webkit-overflow-scrolling: touch` or `overscroll-behavior` set

### Expected behavior
1. **Auto-scroll to bottom** on new terminal output (when user is already near the bottom). If the user has scrolled up to read history, do NOT auto-scroll — show a "Jump to bottom" indicator instead.
2. **Floating "scroll to bottom" button** — appears when the user has scrolled up, disappears when at the bottom. Positioned above the button bar so it doesn't overlap.
3. **Scroll to top** — either a button or double-tap on the tab bar header.
4. **Smooth momentum scrolling** on the terminal output container.

### Technical guidance
```css
.terminal-output {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;  /* smooth momentum on iOS */
  overscroll-behavior-y: contain;     /* prevent pull-to-refresh interference */
  scroll-behavior: smooth;
}
```

For auto-scroll logic:
```javascript
const isNearBottom = (el) => el.scrollHeight - el.scrollTop - el.clientHeight < 100;

// On new output:
if (isNearBottom(terminalEl)) {
  terminalEl.scrollTo({ top: terminalEl.scrollHeight, behavior: 'smooth' });
} else {
  showJumpToBottomButton();
}
```

The "Jump to bottom" floating button:
- Fixed position, above the button bar (e.g., `bottom: 120px; right: 20px`)
- Semi-transparent, small, with a down-arrow icon
- On tap: `terminalEl.scrollTo({ top: terminalEl.scrollHeight, behavior: 'smooth' })`

### Done criteria
- [ ] Terminal auto-scrolls to bottom when new output arrives (if user is near bottom)
- [ ] A "jump to bottom" button appears when user has scrolled up
- [ ] Tapping the button smoothly scrolls to the latest output
- [ ] Touch scrolling has momentum and feels native on iOS
- [ ] Pull-to-refresh does not interfere with terminal scrolling

---

## Issue 4: Cramped Mobile Layout (Medium)

### Current behavior
The UI is very cramped on phone screens. The tab bar, terminal output, and button bar are all squeezed together. Tap targets are small and easy to mis-tap. The overall layout feels like it was designed for desktop and not adapted for mobile.

### Expected behavior
1. **Larger touch targets** — all buttons in the button bar should be at minimum 44x44px (Apple's recommended minimum). Currently they look smaller than that.
2. **Better vertical spacing** — add breathing room between the tab bar, content area, and button bar. The terminal content area should take up the maximum available space.
3. **Collapsible button bar** — the two rows of buttons (Yes/No/Enter/Esc/Tab/arrows and Launch/Ctrl+C/Ctrl+D/Clear/Restart) take up a lot of vertical space. Consider:
   - Making the second row (Launch, Ctrl+C, etc.) collapsible/toggle, shown only when needed
   - Or using a swipe gesture to switch between button rows
4. **Full-height terminal** — use `100dvh` (dynamic viewport height) to account for iOS Safari's address bar. The terminal should fill the screen between the tab bar and button bar.
5. **Responsive font sizing** — terminal text should be readable without zooming but not waste space

### Technical guidance
```css
/* Use dynamic viewport height for iOS Safari */
.app-container {
  height: 100dvh;
  display: flex;
  flex-direction: column;
}

.tab-bar { flex-shrink: 0; }
.terminal-content { flex: 1; min-height: 0; overflow-y: auto; }
.button-bar { flex-shrink: 0; }

/* Minimum touch targets */
.button-bar button {
  min-width: 44px;
  min-height: 44px;
  padding: 8px 12px;
}
```

### Done criteria
- [ ] All buttons meet 44x44px minimum touch target
- [ ] Terminal content uses maximum available vertical space
- [ ] No content is hidden behind the iOS Safari address bar
- [ ] Button bar rows can be collapsed to give more terminal space
- [ ] Layout feels spacious and navigable on a phone screen

---

## Issue 5: Silent Errors (Medium)

### Current behavior
Errors happen silently — WebSocket disconnections, failed API calls, notification permission issues, and other problems produce no visible feedback. The user has no idea something went wrong until they notice the terminal isn't responding.

### Expected behavior
1. **Toast/snackbar notifications** for errors — brief, non-blocking messages that appear at the top or bottom of the screen for ~5 seconds, then auto-dismiss. E.g.: "WebSocket disconnected — reconnecting...", "Failed to send input", "Notification permission denied"
2. **Connection status indicator** — a small dot or icon in the header (near the existing green dot) that shows:
   - Green: connected
   - Yellow: reconnecting
   - Red: disconnected
   - Tapping it shows connection details
3. **Error log** — accessible from settings or a debug panel, listing recent errors with timestamps. Not visible by default, but available for troubleshooting.

### Technical guidance
For toasts, implement a lightweight notification queue:
```javascript
function showToast(message, type = 'error', duration = 5000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}
```

Hook this into:
- WebSocket `onclose` / `onerror` events
- Fetch error catches
- Notification API permission denial
- Any try/catch blocks that currently swallow errors

### Done criteria
- [ ] WebSocket disconnection shows a visible toast message
- [ ] WebSocket reconnection shows a success toast
- [ ] Failed API calls show error toasts
- [ ] A connection status indicator is visible in the header at all times
- [ ] An error log is accessible for debugging

---

## Implementation Order

Address these in this order:
1. **Issue 2 (Yes button)** — Highest user frustration, relatively contained fix
2. **Issue 1 (Notification routing)** — Critical for the remote-approval workflow
3. **Issue 3 (Scrolling)** — Major usability improvement, CSS + small JS changes
4. **Issue 5 (Silent errors)** — Helps debug everything else
5. **Issue 4 (Layout)** — Polish pass after the functional issues are resolved

Work through each issue completely before moving to the next. Commit after each issue is resolved so progress is saved incrementally.
