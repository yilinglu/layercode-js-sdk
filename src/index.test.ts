import LayercodeClient from './index';

// Mock WebSocket
class MockWebSocket {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  readyState = WebSocket.OPEN;
  
  send = jest.fn();
  close = jest.fn();
  
  // Simulate receiving a message
  receiveMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }
}

// @ts-ignore - Mock global WebSocket
global.WebSocket = MockWebSocket;

// Mock dependencies
jest.mock('./wavtools/index.js', () => ({
  WavRecorder: jest.fn().mockImplementation(() => ({
    begin: jest.fn().mockResolvedValue(undefined),
    record: jest.fn().mockResolvedValue(undefined),
    getStream: jest.fn().mockReturnValue(null),
    quit: jest.fn(),
  })),
  WavStreamPlayer: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    add16BitPCM: jest.fn(),
    clearInterruptedTracks: jest.fn(),
  })),
}));

jest.mock('@ricky0123/vad-web', () => ({
  MicVAD: {
    new: jest.fn().mockResolvedValue({
      start: jest.fn(),
      pause: jest.fn(),
      destroy: jest.fn(),
    }),
  },
}));

// Mock fetch for session authorization
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({
    client_session_key: 'test-key',
    session_id: 'test-session',
    config: {
      transcription: {
        trigger: 'automatic',
        can_interrupt: true,
        automatic: true,
      },
    },
  }),
});

describe('LayercodeClient WebSocket message handling', () => {
  let client: LayercodeClient;
  let mockWs: MockWebSocket;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Spy on console methods
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // Create client instance
    client = new LayercodeClient({
      pipelineId: 'test-pipeline',
      authorizeSessionEndpoint: '/api/authorize',
    });

    // Connect to establish WebSocket
    await client.connect();
    
    // Get the mock WebSocket instance
    mockWs = (client as any).ws as MockWebSocket;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('Known message types', () => {
    it('should handle turn.start messages without errors', () => {
      mockWs.receiveMessage({
        type: 'turn.start',
        role: 'assistant',
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('received ws msg:', expect.any(Object));
      expect(consoleLogSpy).toHaveBeenCalledWith('received turn.start from server');
    });

    it('should handle response.text messages without errors', () => {
      mockWs.receiveMessage({
        type: 'response.text',
        turn_id: 'turn-123',
        content: 'Hello, world!',
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('received ws msg:', expect.any(Object));
    });

    it('should handle response.data messages without errors', () => {
      mockWs.receiveMessage({
        type: 'response.data',
        data: { custom: 'data' },
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('received response.data', expect.any(Object));
    });
  });

  describe('Unrecognized message types', () => {
    it('should NOT log errors for valid unrecognized message types', () => {
      // Test with a telemetry message
      mockWs.receiveMessage({
        type: 'speech_send_tracking',
        timestamp: 1234567890,
        text: 'Hello, world!',
        turnId: 'turn-123',
      });

      // Should NOT use console.error
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      
      // Should use console.debug instead
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        "Received unhandled message type 'speech_send_tracking'",
        expect.objectContaining({
          type: 'speech_send_tracking',
          timestamp: 1234567890,
          text: 'Hello, world!',
          turnId: 'turn-123',
        })
      );
    });

    it('should handle empty messages gracefully', () => {
      // Test with empty message
      mockWs.receiveMessage({});

      // Should NOT use console.error
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      
      // Should use console.debug for empty messages
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        'Received message without type:',
        expect.objectContaining({})
      );
    });

    it('should handle messages with null type gracefully', () => {
      // Test with null type
      mockWs.receiveMessage({
        type: null,
        data: 'some data',
      });

      // Should NOT use console.error
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      
      // Should use console.debug
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        'Received message without type:',
        expect.objectContaining({
          type: null,
          data: 'some data',
        })
      );
    });

    it('should handle multiple unrecognized message types', () => {
      // Test various unrecognized types
      const unrecognizedTypes = [
        { type: 'metrics.update', value: 123 },
        { type: 'connection.ping', timestamp: Date.now() },
        { type: 'debug.info', details: 'test' },
      ];

      unrecognizedTypes.forEach((message) => {
        mockWs.receiveMessage(message);
      });

      // Should NOT use console.error for any of them
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      
      // Should use console.debug for each
      expect(consoleDebugSpy).toHaveBeenCalledTimes(3);
      unrecognizedTypes.forEach((message) => {
        expect(consoleDebugSpy).toHaveBeenCalledWith(
          `Received unhandled message type '${message.type}'`,
          expect.objectContaining(message)
        );
      });
    });
  });

  describe('Error handling', () => {
    it('should still log actual errors when message parsing fails', () => {
      // Simulate invalid JSON
      if (mockWs.onmessage) {
        mockWs.onmessage(new MessageEvent('message', { data: 'invalid json' }));
      }

      // Should log parsing error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error processing WebSocket message:',
        expect.any(Error)
      );
    });
  });
});