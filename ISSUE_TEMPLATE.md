# Issue: SDK logs unrecognized message types as errors instead of debug/info

## Description

The Layercode JS SDK currently logs ALL unrecognized WebSocket message types as errors using `console.error`. This causes issues in development environments:

1. **Console pollution** - Legitimate telemetry messages appear as errors
2. **Next.js error overlay** - In Next.js dev mode, these trigger the red error overlay
3. **Developer confusion** - Valid messages like `speech_send_tracking` appear as errors

## Current Behavior

When the SDK receives a WebSocket message with an unrecognized type, it logs:
```javascript
console.error('Unknown message type received:', message);
```

This happens for:
- Empty messages `{}` (truly problematic)
- Valid messages with new types like `{type: 'speech_send_tracking', ...}` (not errors)

## Expected Behavior

The SDK should handle unrecognized message types gracefully:
- Empty/malformed messages → `console.debug` or `console.warn`
- Valid messages with unrecognized types → `console.debug` with informative message
- Should NOT use `console.error` for non-error conditions

## Steps to Reproduce

1. Connect to a Layercode pipeline that sends `speech_send_tracking` messages
2. Open browser console
3. Observe red error messages: "Unknown message type received: {type: 'speech_send_tracking', ...}"

## Impact

- Developers see false error messages
- Next.js applications show error overlay in development
- Makes debugging actual issues more difficult

## Proposed Solution

Replace the error logging with appropriate debug logging:

```javascript
default:
  // Handle unrecognized message types gracefully
  if (!message.type) {
    // Empty or malformed message without a type
    console.debug('Received message without type:', message);
  } else {
    // Valid message with unrecognized type - not an error, just unhandled
    console.debug(`Received unhandled message type '${message.type}'`, message);
  }
  break;
```

## Test Case

```javascript
describe('WebSocket message handling', () => {
  it('should not log errors for unrecognized message types', () => {
    const consoleSpy = jest.spyOn(console, 'error');
    const debugSpy = jest.spyOn(console, 'debug');
    
    // Test with valid unrecognized message
    client._handleWebSocketMessage({
      data: JSON.stringify({
        type: 'speech_send_tracking',
        timestamp: 123456,
        text: 'Hello world'
      })
    });
    
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(
      "Received unhandled message type 'speech_send_tracking'",
      expect.any(Object)
    );
  });
  
  it('should handle empty messages gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error');
    const debugSpy = jest.spyOn(console, 'debug');
    
    // Test with empty message
    client._handleWebSocketMessage({
      data: JSON.stringify({})
    });
    
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(
      'Received message without type:',
      expect.any(Object)
    );
  });
});
```

## Additional Context

Currently, the SDK only handles these message types:
- `turn.start`
- `response.audio`
- `response.text`
- `response.data`

As Layercode adds new features (like `speech_send_tracking` for telemetry), the SDK should gracefully handle these without treating them as errors.