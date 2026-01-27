export type MouseButton = 'left' | 'right' | 'middle';

export interface MouseState {
  x: number;
  y: number;
  buttons: {
    left: boolean;
    right: boolean;
    middle: boolean;
  };
  heldSince: {
    left: number | null;
    right: number | null;
    middle: number | null;
  };
}

export interface OBSConnectionConfig {
  address: string;
  password?: string;
}

export interface OBSEventMap {
  'connected': void;
  'disconnected': void;
  'error': Error;
  'sceneChanged': { sceneName: string };
  'sceneListChanged': { scenes: string[] };
  'streamStarted': void;
  'streamStopped': void;
  'recordingStarted': void;
  'recordingStopped': void;
  'mouseMove': { x: number; y: number };
  'mouseDown': { button: MouseButton; x: number; y: number };
  'mouseUp': { button: MouseButton; x: number; y: number };
  'mouseHold': { button: MouseButton; x: number; y: number; duration: number };
}

export type OBSEventName = keyof OBSEventMap;
