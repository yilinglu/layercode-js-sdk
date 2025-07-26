# Fix: Handle unrecognized WebSocket message types gracefully

## Problem

The SDK currently logs ALL unrecognized WebSocket message types as errors using `console.error`. This causes several issues:

1. **Console pollution** - Legitimate telemetry messages (like `speech_send_tracking`) appear as errors
2. **Next.js error overlay** - In development mode, these false errors trigger the red error overlay  
3. **Developer confusion** - Valid messages from new Layercode features are treated as errors

## Solution

This PR changes the SDK to handle unrecognized message types gracefully:

- Empty/malformed messages (no `type` property) → logged with `console.debug`
- Valid messages with unrecognized types → logged with `console.debug` and informative message
- No longer uses `console.error` for non-error conditions

## Changes

```diff
default:
-  console.error('Unknown message type received:', message);
+  // Handle unrecognized message types gracefully
+  if (!message.type) {
+    // Empty or malformed message without a type
+    console.debug('Received message without type:', message);
+  } else {
+    // Valid message with unrecognized type - not an error, just unhandled
+    console.debug(`Received unhandled message type '${message.type}'`, message);
+  }
  break;
```

## Test Plan

Added comprehensive unit tests in `src/index.test.ts` that verify:

1. Known message types (`turn.start`, `response.text`, etc.) are handled without errors
2. Unrecognized message types (like `speech_send_tracking`) use `console.debug` instead of `console.error`
3. Empty messages are handled gracefully
4. Actual parsing errors still use `console.error`

To run tests:
```bash
npm test
```

## Impact

- Cleaner console output in development
- No more false error overlays in Next.js
- SDK gracefully handles new message types as Layercode adds features
- Developers can still see unhandled messages in debug mode

## Related Issue

Fixes #[ISSUE_NUMBER] (to be created)