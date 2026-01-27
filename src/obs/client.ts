import OBSWebSocket from 'obs-websocket-js';
import type { OBSConnectionConfig, OBSEventMap, OBSEventName, MouseButton, MouseState } from './types.js';

type EventCallback<T> = (data: T) => void;

export class OBSClient {
  private obs: OBSWebSocket;
  private config: OBSConnectionConfig | null = null;
  private reconnectInterval: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000;
  private listeners: Map<OBSEventName, Set<EventCallback<unknown>>> = new Map();
  private _isConnected = false;

  private mouseState: MouseState = {
    x: 0,
    y: 0,
    buttons: { left: false, right: false, middle: false },
    heldSince: { left: null, right: null, middle: null }
  };
  private holdCheckInterval: number | null = null;
  private holdThreshold = 500; // ms before considered a "hold"

  constructor() {
    this.obs = new OBSWebSocket();
    this.setupEventHandlers();
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  private setupEventHandlers(): void {
    this.obs.on('ConnectionOpened', () => {
      this._isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected', undefined as void);
      this.startHoldCheck();
    });

    this.obs.on('ConnectionClosed', () => {
      this._isConnected = false;
      this.emit('disconnected', undefined as void);
      this.stopHoldCheck();
      this.attemptReconnect();
    });

    this.obs.on('ConnectionError', (err) => {
      this.emit('error', err as Error);
    });

    // Scene events
    this.obs.on('CurrentProgramSceneChanged', (data) => {
      this.emit('sceneChanged', { sceneName: data.sceneName });
    });

    this.obs.on('SceneListChanged', (data) => {
      this.emit('sceneListChanged', { scenes: data.scenes.map(s => s.sceneName) });
    });

    // Stream events
    this.obs.on('StreamStateChanged', (data) => {
      if (data.outputActive) {
        this.emit('streamStarted', undefined as void);
      } else {
        this.emit('streamStopped', undefined as void);
      }
    });

    // Recording events
    this.obs.on('RecordStateChanged', (data) => {
      if (data.outputActive) {
        this.emit('recordingStarted', undefined as void);
      } else {
        this.emit('recordingStopped', undefined as void);
      }
    });
  }

  async connect(config: OBSConnectionConfig): Promise<void> {
    this.config = config;
    this.reconnectAttempts = 0;

    try {
      await this.obs.connect(config.address, config.password);
    } catch (err) {
      this.emit('error', err as Error);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.config = null;
    this.stopReconnect();
    this.stopHoldCheck();
    await this.obs.disconnect();
  }

  private attemptReconnect(): void {
    if (!this.config || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.stopReconnect();
    this.reconnectInterval = window.setTimeout(async () => {
      this.reconnectAttempts++;
      try {
        await this.obs.connect(this.config!.address, this.config!.password);
      } catch {
        this.attemptReconnect();
      }
    }, this.reconnectDelay);
  }

  private stopReconnect(): void {
    if (this.reconnectInterval !== null) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  // Mouse event handling - called from external mouse tracking
  updateMousePosition(x: number, y: number): void {
    this.mouseState.x = x;
    this.mouseState.y = y;
    this.emit('mouseMove', { x, y });
  }

  setMouseButton(button: MouseButton, pressed: boolean): void {
    const wasPressed = this.mouseState.buttons[button];
    this.mouseState.buttons[button] = pressed;

    if (pressed && !wasPressed) {
      this.mouseState.heldSince[button] = Date.now();
      this.emit('mouseDown', { button, x: this.mouseState.x, y: this.mouseState.y });
    } else if (!pressed && wasPressed) {
      this.mouseState.heldSince[button] = null;
      this.emit('mouseUp', { button, x: this.mouseState.x, y: this.mouseState.y });
    }
  }

  private startHoldCheck(): void {
    this.holdCheckInterval = window.setInterval(() => {
      const now = Date.now();
      const buttons: MouseButton[] = ['left', 'right', 'middle'];

      for (const button of buttons) {
        const heldSince = this.mouseState.heldSince[button];
        if (heldSince !== null) {
          const duration = now - heldSince;
          if (duration >= this.holdThreshold) {
            this.emit('mouseHold', {
              button,
              x: this.mouseState.x,
              y: this.mouseState.y,
              duration
            });
          }
        }
      }
    }, 100);
  }

  private stopHoldCheck(): void {
    if (this.holdCheckInterval !== null) {
      clearInterval(this.holdCheckInterval);
      this.holdCheckInterval = null;
    }
  }

  // Event emitter
  on<K extends OBSEventName>(event: K, callback: EventCallback<OBSEventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
  }

  off<K extends OBSEventName>(event: K, callback: EventCallback<OBSEventMap[K]>): void {
    this.listeners.get(event)?.delete(callback as EventCallback<unknown>);
  }

  private emit<K extends OBSEventName>(event: K, data: OBSEventMap[K]): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  // OBS API methods
  async getSceneList(): Promise<string[]> {
    const response = await this.obs.call('GetSceneList');
    return response.scenes.map(s => s.sceneName as string);
  }

  async getCurrentScene(): Promise<string> {
    const response = await this.obs.call('GetCurrentProgramScene');
    return response.currentProgramSceneName;
  }

  async setCurrentScene(sceneName: string): Promise<void> {
    await this.obs.call('SetCurrentProgramScene', { sceneName });
  }

  async getStreamStatus(): Promise<{ active: boolean; timecode: string }> {
    const response = await this.obs.call('GetStreamStatus');
    return {
      active: response.outputActive,
      timecode: response.outputTimecode
    };
  }

  async getRecordStatus(): Promise<{ active: boolean; timecode: string }> {
    const response = await this.obs.call('GetRecordStatus');
    return {
      active: response.outputActive,
      timecode: response.outputTimecode
    };
  }
}
