export interface AppConfig {
  obs: {
    address: string;
    password: string;
  };
  overlay: {
    debug: boolean;
    logLevel: 'warn' | 'info' | 'debug';
    background: {
      color: string;
      transparent: boolean;
    };
  };
  eventMappings: EventMapping[];
}

export interface EventMapping {
  id: string;
  obsEvent: string;
  effectType: string;
  effectConfig: Record<string, unknown>;
  enabled: boolean;
}

const CONFIG_KEY = 'obs-overlay-config';

const DEFAULT_CONFIG: AppConfig = {
  obs: {
    address: 'ws://localhost:4455',
    password: ''
  },
  overlay: {
    debug: false,
    logLevel: 'warn',
    background: {
      color: '#16213e',
      transparent: true
    }
  },
  eventMappings: []
};

export function loadConfig(): AppConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch (err) {
    console.warn('Failed to load config from localStorage:', err);
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: AppConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Failed to save config to localStorage:', err);
  }
}

export function resetConfig(): AppConfig {
  localStorage.removeItem(CONFIG_KEY);
  return DEFAULT_CONFIG;
}
