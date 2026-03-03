import { OverlayScene, setLogLevel, TAGS, type EffectObjectConfig } from '@blorkfield/overlay-core';
import { TabManager, togglePin } from '@blorkfield/blork-tabs';
import '@blorkfield/blork-tabs/styles.css';
import { OBSClient } from './obs/index.js';
import { loadConfig, saveConfig } from './config.js';
import { TwitchClient } from '@blorkfield/twitch-integration';
import type { NormalizedMessage, TwitchClientSubscriptions } from '@blorkfield/twitch-integration';
import { TwitchSimulator, USER_POOL } from '@blorkfield/twitch-integration/simulation';
import type { ActionType, SimUser } from '@blorkfield/twitch-integration/simulation';

// === Effect Event Types ===
type EffectTriggerConditionType = 'message' | 'text' | 'emote' | 'bits' | 'follow' | 'subscribe' | 'subscriptionGift' | 'cheer' | 'raid' | 'channelPoints' | 'streamOnline' | 'streamOffline' | 'channelUpdate' | 'hypeTrain' | 'adBreak' | 'poll' | 'prediction' | 'shoutout';
type TriggerSourceType = 'message' | 'follow' | 'subscribe' | 'subscriptionGift' | 'cheer' | 'raid' | 'channelPoints' | 'streamOnline' | 'streamOffline' | 'channelUpdate' | 'hypeTrain' | 'adBreak' | 'poll' | 'prediction' | 'shoutout';
interface TriggerEventData {
  sourceType: TriggerSourceType;
  userId?: string;
  text?: string;
  emotes?: string[];
  bits?: number;
  viewers?: number;
  rewardTitle?: string;
}
interface TriggerCondition { type: EffectTriggerConditionType; value: string; }
interface TriggerConfig { conditions: TriggerCondition[]; combinator: 'AND' | 'OR'; fireThreshold: number; }
type EntitySource = 'shape' | 'url' | 'trigger-sender' | 'recent-chatters';
interface EntityDefinition { source: EntitySource; color: string; url: string; windowMinutes: number; radius: number; tags: string[]; }
type DurationType = 'none' | 'time' | 'count';
interface LifecycleConfig { durationType: DurationType; durationValue: number; maxTriggers: number; allowRetrigger: boolean; }
interface EffectDefinition {
  id: string;
  effectType: 'burst' | 'rain' | 'stream' | 'spawn';
  trigger: TriggerConfig | null;
  lifecycle: LifecycleConfig;
  entities: EntityDefinition[];
  originType: 'fixed' | 'mouse';
  originX: number; originY: number;
  burstInterval: number; burstCount: number; burstForce: number;
  rainSpawnRate: number; rainSpawnWidth: number;
  streamDirection: number; streamSpawnRate: number; streamForce: number; streamConeAngle: number;
  spawnCount: number; spawnForce: number;
}
interface ArmedEvent {
  definition: EffectDefinition;
  matchCount: number;
  triggerCount: number;
  isActive: boolean;
  activeEffectId: string | null;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

// Load config
let config = loadConfig();
setLogLevel(config.overlay.logLevel);

// Initialize OBS client
const obsClient = new OBSClient();

// DOM Elements - Scene
const sceneContainer = document.getElementById('scene-container') as HTMLDivElement;
const sceneWrapper = document.getElementById('scene-wrapper') as HTMLDivElement;
const statsEl = document.getElementById('stats') as HTMLDivElement;

// Connection panel elements
const inputOBSAddress = document.getElementById('input-obs-address') as HTMLInputElement;
const inputOBSPassword = document.getElementById('input-obs-password') as HTMLInputElement;
const btnConnect = document.getElementById('btn-connect') as HTMLButtonElement;
const btnDisconnect = document.getElementById('btn-disconnect') as HTMLButtonElement;
const connectionStatus = document.getElementById('connection-status') as HTMLSpanElement;

// Settings panel elements
const checkboxDebug = document.getElementById('checkbox-debug') as HTMLInputElement;
const selectLogLevel = document.getElementById('select-log-level') as HTMLSelectElement;
const btnBgTransparent = document.getElementById('btn-bg-transparent') as HTMLButtonElement;
const btnBgDefault = document.getElementById('btn-bg-default') as HTMLButtonElement;
const inputBgColor = document.getElementById('input-bg-color') as HTMLInputElement;

// Mouse capture offset elements
const inputOffsetX = document.getElementById('input-offset-x') as HTMLInputElement;
const inputOffsetY = document.getElementById('input-offset-y') as HTMLInputElement;
const inputScaleX = document.getElementById('input-scale-x') as HTMLInputElement;
const inputScaleY = document.getElementById('input-scale-y') as HTMLInputElement;

// Entity panel elements
const selectEntityImage = document.getElementById('select-entity-image') as HTMLSelectElement;
const inputEntityTtl = document.getElementById('input-entity-ttl') as HTMLInputElement;
const inputEntityWeight = document.getElementById('input-entity-weight') as HTMLInputElement;
const inputSpawnX = document.getElementById('input-spawn-x') as HTMLInputElement;
const selectXUnit = document.getElementById('select-x-unit') as HTMLSelectElement;
const inputSpawnY = document.getElementById('input-spawn-y') as HTMLInputElement;
const selectYUnit = document.getElementById('select-y-unit') as HTMLSelectElement;
const tagsAvailable = document.getElementById('tags-available') as HTMLSelectElement;
const tagsSelected = document.getElementById('tags-selected') as HTMLSelectElement;
const btnTagAdd = document.getElementById('btn-tag-add') as HTMLButtonElement;
const btnTagRemove = document.getElementById('btn-tag-remove') as HTMLButtonElement;
const btnSpawnEntity = document.getElementById('btn-spawn-entity') as HTMLButtonElement;
const inputTextObstacle = document.getElementById('input-text-obstacle') as HTMLInputElement;
const selectFont = document.getElementById('select-font') as HTMLSelectElement;
const inputLetterSize = document.getElementById('input-letter-size') as HTMLInputElement;
const inputLetterColor = document.getElementById('input-letter-color') as HTMLInputElement;
const btnSpawnText = document.getElementById('btn-spawn-text') as HTMLButtonElement;
const selectActionTag = document.getElementById('select-action-tag') as HTMLSelectElement;
const btnReleaseTag = document.getElementById('btn-release-tag') as HTMLButtonElement;
const btnRemoveTag = document.getElementById('btn-remove-tag') as HTMLButtonElement;
const btnReleaseAll = document.getElementById('btn-release-all') as HTMLButtonElement;
const btnRemoveAll = document.getElementById('btn-remove-all') as HTMLButtonElement;

// Event detection panel elements
const mousePosition = document.getElementById('mouse-position') as HTMLSpanElement;
const mouseLeft = document.getElementById('mouse-left') as HTMLSpanElement;
const mouseRight = document.getElementById('mouse-right') as HTMLSpanElement;
const mouseMiddle = document.getElementById('mouse-middle') as HTMLSpanElement;
const obsScene = document.getElementById('obs-scene') as HTMLSpanElement;
const obsStream = document.getElementById('obs-stream') as HTMLSpanElement;
const obsRecording = document.getElementById('obs-recording') as HTMLSpanElement;
const eventLogContainer = document.getElementById('event-log-container') as HTMLDivElement;
const chatLogContainer = document.getElementById('chat-log-container') as HTMLDivElement;
const lookupIdInput = document.getElementById('lookup-id') as HTMLInputElement;
const btnLookup = document.getElementById('btn-lookup') as HTMLButtonElement;
const lookupResult = document.getElementById('lookup-result') as HTMLDivElement;

// Twitch connection panel elements
const inputTwitchChannelId = document.getElementById('input-twitch-channel-id') as HTMLInputElement;
const inputTwitchUserId = document.getElementById('input-twitch-user-id') as HTMLInputElement;
const inputTwitchClientId = document.getElementById('input-twitch-client-id') as HTMLInputElement;
const inputTwitchAccessToken = document.getElementById('input-twitch-access-token') as HTMLInputElement;
const btnTwitchConnect = document.getElementById('btn-twitch-connect') as HTMLButtonElement;
const btnTwitchDisconnect = document.getElementById('btn-twitch-disconnect') as HTMLButtonElement;
const twitchConnectionStatus = document.getElementById('twitch-connection-status') as HTMLSpanElement;
const subsAvailable = document.getElementById('subs-available') as HTMLSelectElement;
const subsSelected = document.getElementById('subs-selected') as HTMLSelectElement;
const btnSubAdd = document.getElementById('btn-sub-add') as HTMLButtonElement;
const btnSubRemove = document.getElementById('btn-sub-remove') as HTMLButtonElement;

// Twitch mode toggle
const btnTwitchModeReal = document.getElementById('btn-twitch-mode-real') as HTMLButtonElement;
const btnTwitchModeSim = document.getElementById('btn-twitch-mode-sim') as HTMLButtonElement;
const twitchRealContent = document.getElementById('twitch-real-content') as HTMLDivElement;
const twitchSimContent = document.getElementById('twitch-sim-content') as HTMLDivElement;

// Sim — user selector
const simUserSelect = document.getElementById('sim-user-select') as HTMLSelectElement;

// Sim — manual fire inputs
const simChatText = document.getElementById('sim-chat-text') as HTMLInputElement;
const simCheerBits = document.getElementById('sim-cheer-bits') as HTMLInputElement;
const simRaidViewers = document.getElementById('sim-raid-viewers') as HTMLInputElement;

// Sim — manual fire buttons
const btnSimFireChat = document.getElementById('btn-sim-fire-chat') as HTMLButtonElement;
const btnSimFireFollow = document.getElementById('btn-sim-fire-follow') as HTMLButtonElement;
const btnSimFireSubscribe = document.getElementById('btn-sim-fire-subscribe') as HTMLButtonElement;
const btnSimFireGiftSub = document.getElementById('btn-sim-fire-giftsub') as HTMLButtonElement;
const btnSimFireCheer = document.getElementById('btn-sim-fire-cheer') as HTMLButtonElement;
const btnSimFireRaid = document.getElementById('btn-sim-fire-raid') as HTMLButtonElement;

// Sim — scenario
const simScenarioDuration = document.getElementById('sim-scenario-duration') as HTMLInputElement;
const simScenarioRate = document.getElementById('sim-scenario-rate') as HTMLInputElement;
const simScenarioActions = document.getElementById('sim-scenario-actions') as HTMLDivElement;
const btnSimRun = document.getElementById('btn-sim-run') as HTMLButtonElement;
const btnSimStop = document.getElementById('btn-sim-stop') as HTMLButtonElement;

// Panel elements
const connectionPanel = document.getElementById('connection-panel') as HTMLDivElement;
const connectionDragHandle = document.getElementById('connection-drag-handle') as HTMLDivElement;
const connectionCollapseBtn = document.getElementById('connection-collapse') as HTMLButtonElement;
const connectionContent = document.getElementById('connection-content') as HTMLDivElement;

const settingsPanel = document.getElementById('settings-panel') as HTMLDivElement;
const settingsDragHandle = document.getElementById('settings-drag-handle') as HTMLDivElement;
const settingsCollapseBtn = document.getElementById('settings-collapse') as HTMLButtonElement;
const settingsContent = document.getElementById('settings-content') as HTMLDivElement;

const entityPanel = document.getElementById('entity-panel') as HTMLDivElement;
const entityDragHandle = document.getElementById('entity-drag-handle') as HTMLDivElement;
const entityCollapseBtn = document.getElementById('entity-collapse') as HTMLButtonElement;
const entityContent = document.getElementById('entity-content') as HTMLDivElement;

const effectsPanel = document.getElementById('effects-panel') as HTMLDivElement;
const effectsDragHandle = document.getElementById('effects-drag-handle') as HTMLDivElement;
const effectsCollapseBtn = document.getElementById('effects-collapse') as HTMLButtonElement;
const effectsContent = document.getElementById('effects-content') as HTMLDivElement;

// Effects panel elements
const activeEffectsList = document.getElementById('active-effects-list') as HTMLDivElement;
const btnStopAllEffects = document.getElementById('btn-stop-all-effects') as HTMLButtonElement;
const effectTypeSelect = document.getElementById('effect-type-select') as HTMLSelectElement;
const originSection = document.getElementById('origin-section') as HTMLDivElement;
const btnOriginFixed = document.getElementById('btn-origin-fixed') as HTMLButtonElement;
const btnOriginMouse = document.getElementById('btn-origin-mouse') as HTMLButtonElement;
const originFixedRow = document.getElementById('origin-fixed-row') as HTMLDivElement;
const btnAddCondition = document.getElementById('btn-add-condition') as HTMLButtonElement;
const triggerConditionList = document.getElementById('trigger-condition-list') as HTMLDivElement;
const triggerCombinatorRow = document.getElementById('trigger-combinator-row') as HTMLDivElement;
const triggerCombinator = document.getElementById('trigger-combinator') as HTMLSelectElement;
const triggerThresholdRow = document.getElementById('trigger-threshold-row') as HTMLDivElement;
const triggerThreshold = document.getElementById('trigger-threshold') as HTMLInputElement;
const btnAddEntity = document.getElementById('btn-add-entity') as HTMLButtonElement;
const newEffectEntityList = document.getElementById('new-effect-entity-list') as HTMLDivElement;
const lifecycleDurationType = document.getElementById('lifecycle-duration-type') as HTMLSelectElement;
const lifecycleDurationValue = document.getElementById('lifecycle-duration-value') as HTMLInputElement;
const lifecycleMaxTriggers = document.getElementById('lifecycle-max-triggers') as HTMLInputElement;
const lifecycleAllowRetrigger = document.getElementById('lifecycle-allow-retrigger') as HTMLInputElement;
const btnCreateEffect = document.getElementById('btn-create-effect') as HTMLButtonElement;

const inputPanel = document.getElementById('input-panel') as HTMLDivElement;
const inputDragHandle = document.getElementById('input-drag-handle') as HTMLDivElement;
const inputCollapseBtn = document.getElementById('input-collapse') as HTMLButtonElement;
const inputContent = document.getElementById('input-content') as HTMLDivElement;

// Scene state
let scene: OverlayScene | null = null;
let canvas: HTMLCanvasElement | null = null;

// Mouse WebSocket state
let mouseWs: WebSocket | null = null;

// Debug log (initialized later with TabManager)
let debugLog: ReturnType<typeof TabManager.prototype.createDebugLog> | null = null;

// Mouse position (canvas space, updated from WebSocket)
let mouseX = 0;
let mouseY = 0;
let mouseDataReceived = false;

// Effect origin type for new event form
let effectOriginType: 'fixed' | 'mouse' = 'fixed';

// Twitch state
let twitchChat: TwitchClient | null = null;
let twitchSimulator: TwitchSimulator | null = null;
let twitchMode: 'real' | 'sim' = 'real';
let simActiveActions: Set<ActionType> = new Set(['chat', 'follow', 'subscribe', 'resub', 'giftsub', 'cheer', 'raid']);
let chatDebugLog: ReturnType<typeof TabManager.prototype.createDebugLog> | null = null;

const TWITCH_SUBS: Array<{ key: keyof TwitchClientSubscriptions; label: string }> = [
  { key: 'chat',          label: 'Chat' },
  { key: 'follow',        label: 'Follows' },
  { key: 'subscribe',     label: 'Subscriptions' },
  { key: 'cheer',         label: 'Cheers / Bits' },
  { key: 'raid',          label: 'Raids' },
  { key: 'channelPoints', label: 'Channel Points' },
  { key: 'streamStatus',  label: 'Stream Status' },
  { key: 'channelUpdate', label: 'Channel Update' },
  { key: 'hypeTrain',     label: 'Hype Train' },
  { key: 'polls',         label: 'Polls' },
  { key: 'predictions',   label: 'Predictions' },
  { key: 'adBreak',       label: 'Ad Breaks' },
  { key: 'shoutouts',     label: 'Shoutouts' },
];

let selectedTwitchSubs: string[] = [...config.twitch.subscriptions];

function renderSubPicker(): void {
  subsAvailable.innerHTML = '';
  subsSelected.innerHTML = '';
  for (const { key, label } of TWITCH_SUBS) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    if (selectedTwitchSubs.includes(key)) {
      subsSelected.appendChild(opt);
    } else {
      subsAvailable.appendChild(opt);
    }
  }
}

function moveSubsToSelected(): void {
  const toAdd = Array.from(subsAvailable.selectedOptions).map(o => o.value);
  selectedTwitchSubs.push(...toAdd.filter(k => !selectedTwitchSubs.includes(k)));
  renderSubPicker();
}

function moveSubsToAvailable(): void {
  const toRemove = Array.from(subsSelected.selectedOptions).map(o => o.value);
  selectedTwitchSubs = selectedTwitchSubs.filter(k => !toRemove.includes(k));
  renderSubPicker();
}

btnSubAdd.addEventListener('click', moveSubsToSelected);
btnSubRemove.addEventListener('click', moveSubsToAvailable);

function populateSimUserSelect(): void {
  simUserSelect.innerHTML = '<option value="random">Random</option>';
  for (const user of USER_POOL) {
    const opt = document.createElement('option');
    opt.value = user.id;
    opt.textContent = user.displayName;
    simUserSelect.appendChild(opt);
  }
}

function getSimUser(): SimUser | undefined {
  const val = simUserSelect.value;
  if (val === 'random') return undefined;
  return USER_POOL.find(u => u.id === val);
}

// Effect event state
const armedEvents = new Map<string, ArmedEvent>();
const recentChatters: Array<{ userId: string; timestamp: number }> = [];
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  const firstFresh = recentChatters.findIndex(c => c.timestamp >= cutoff);
  if (firstFresh > 0) recentChatters.splice(0, firstFresh);
}, 60_000);

// Log click with entity positions
function logClickWithEntities(source: string, clickX: number, clickY: number, rawX?: number, rawY?: number): void {
  if (!debugLog) return;

  // Log the click coordinates
  const clickData: Record<string, unknown> = { clickX, clickY };
  if (rawX !== undefined && rawY !== undefined) {
    clickData.rawX = rawX;
    clickData.rawY = rawY;
  }
  debugLog.log(`${source}:click`, clickData);

  // Log positions of all grabable entities
  if (scene) {
    const grabables = scene.getObjectsByTag('grabable');
    if (grabables.length > 0) {
      for (const obj of grabables) {
        const dx = Math.round(obj.x - clickX);
        const dy = Math.round(obj.y - clickY);
        const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
        debugLog.log(`  entity`, { id: obj.id.slice(0, 8), x: Math.round(obj.x), y: Math.round(obj.y), dist });
      }
    }
  }
}

// Transform mouse coordinates from screen space to canvas space
function transformMouseCoordinates(
  rawX: number,
  rawY: number
): { x: number; y: number } {
  const { offset, scale } = config.mouseCapture;
  return {
    x: (rawX - offset.x) * scale.x,
    y: (rawY - offset.y) * scale.y
  };
}

function connectMouseWebSocket(): void {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/mouse`;

  mouseWs = new WebSocket(wsUrl);

  mouseWs.onopen = () => {
    console.log('Mouse WebSocket connected');
  };

  mouseWs.onclose = () => {
    console.log('Mouse WebSocket disconnected, retrying in 3s...');
    setTimeout(connectMouseWebSocket, 3000);
  };

  mouseWs.onerror = () => {
    // Will trigger onclose
  };

  mouseWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'mouse' || data.type === 'move') {
        // Mouse position update from OBS script - transform to canvas space
        const { x, y } = transformMouseCoordinates(data.x, data.y);
        mouseX = x;
        mouseY = y;
        mouseDataReceived = true;
        scene?.setFollowTarget('mouse', x, y);
        scene?.setFollowTarget('offset', x, y);
        obsClient.updateMousePosition(x, y);
        mousePosition.textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;

        // Handle button states if included
        if (data.buttons) {
          for (const [button, pressed] of Object.entries(data.buttons)) {
            obsClient.setMouseButton(button as 'left' | 'right' | 'middle', pressed as boolean);
            updateMouseButtonDisplay(button, pressed as boolean);
          }
        }
      } else if (data.type === 'click') {
        // Mouse button event from OBS script
        const button = data.button;
        const pressed = data.pressed;
        const { x, y } = transformMouseCoordinates(data.x, data.y);

        // Update mouse position to click coordinates (critical for grab detection)
        scene?.setFollowTarget('mouse', x, y);

        // For left button down, log click with entity positions and try to grab
        if (button === 'left' && pressed) {
          logClickWithEntities('ws', x, y, data.x, data.y);
          const grabbedId = scene?.startGrab();
          debugLog?.log('ws:grab', { result: grabbedId ?? 'none' });
        } else if (button === 'left' && !pressed) {
          scene?.endGrab();
        }

        obsClient.setMouseButton(button, pressed);
        updateMouseButtonDisplay(button, pressed);
      }
    } catch {
      // Ignore parse errors
    }
  };
}

// Start mouse WebSocket connection
connectMouseWebSocket();

// Tag state
const spawnableTags = [TAGS.FALLING, TAGS.FOLLOW_WINDOW, 'follow-offset', TAGS.GRABABLE];
let selectedSpawnTags: string[] = [];

function getContainerSize(): { width: number; height: number } {
  return {
    width: sceneContainer.clientWidth,
    height: sceneContainer.clientHeight
  };
}

async function createScene(width: number, height: number): Promise<void> {
  if (scene) {
    scene.destroy();
  }
  if (canvas) {
    canvas.remove();
  }

  canvas = document.createElement('canvas');
  canvas.id = 'scene';
  canvas.width = width;
  canvas.height = height;
  sceneWrapper.insertBefore(canvas, sceneWrapper.firstChild);

  // Default to transparent background
  const bgConfig = config.overlay.background.transparent
    ? undefined
    : { color: config.overlay.background.color };

  scene = new OverlayScene(canvas, {
    bounds: { top: 0, bottom: height, left: 0, right: width },
    gravity: 1,
    wrapHorizontal: true,
    debug: config.overlay.debug,
    background: bgConfig,
    floorConfig: {
      segments: 5,
      threshold: 100,
      thickness: 15,
      visibleThickness: 3,
      color: ['#3a4a6a', '#4a5a7a', '#3a4a6a', '#4a5a7a', '#3a4a6a'],
      minIntegrity: 3,
      segmentWidths: [0.1, 0.2, 0.4, 0.2, 0.1]
    },
    despawnBelowFloor: 1.0
  });

  // Track mouse for scene interaction (dragging, grabbing entities, etc.)
  canvas.addEventListener('mousemove', (e) => {
    if (!scene || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    scene.setFollowTarget('mouse', x, y);
  });

  canvas.addEventListener('mousedown', (e) => {
    if (!canvas) return;
    const button = e.button === 0 ? 'left' : e.button === 1 ? 'middle' : 'right';
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    // For left click, log and grab at current mouse position (no offset for direct interaction)
    if (button === 'left') {
      logClickWithEntities('canvas', x, y);
      const grabbedId = scene?.startGrab();
      debugLog?.log('canvas:grab', { result: grabbedId ?? 'none' });
    }

    // Only update scene interaction, not the display (that comes from OBS script)
    obsClient.setMouseButton(button, true);
  });

  canvas.addEventListener('mouseup', (e) => {
    if (!canvas) return;
    const button = e.button === 0 ? 'left' : e.button === 1 ? 'middle' : 'right';

    if (button === 'left') {
      scene?.endGrab();
    }

    obsClient.setMouseButton(button, false);
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Update stats
  scene.onUpdate((data) => {
    const dynamicCount = data.objects.length;
    const totalCount = scene?.getObjectIds().length ?? 0;
    const obsStatus = obsClient.isConnected ? 'OBS: Connected' : 'OBS: Disconnected';
    statsEl.textContent = `Dynamic: ${dynamicCount} | Total: ${totalCount} | ${obsStatus}`;
  });

  scene.start();
  await scene.initializeFonts();
  populateFontDropdown();
  renderTagPicker();

  console.log('Overlay scene started');
}

function updateMouseButtonDisplay(button: string, pressed: boolean): void {
  const text = pressed ? 'Pressed' : 'Released';
  const color = pressed ? '#4ae945' : '#aaa';

  if (button === 'left') {
    mouseLeft.textContent = text;
    mouseLeft.style.color = color;
  } else if (button === 'right') {
    mouseRight.textContent = text;
    mouseRight.style.color = color;
  } else if (button === 'middle') {
    mouseMiddle.textContent = text;
    mouseMiddle.style.color = color;
  }
}

function populateFontDropdown(): void {
  if (!scene) return;
  const fonts = scene.getAvailableFonts();
  selectFont.innerHTML = '';

  if (fonts.length === 0) {
    const option = document.createElement('option');
    option.value = 'handwritten';
    option.textContent = 'handwritten';
    selectFont.appendChild(option);
    return;
  }

  fonts.forEach((font) => {
    const option = document.createElement('option');
    option.value = font.name;
    option.textContent = font.name;
    selectFont.appendChild(option);
  });
}

// Tag picker functions
function renderTagPicker(): void {
  tagsAvailable.innerHTML = '';
  spawnableTags
    .filter(tag => !selectedSpawnTags.includes(tag))
    .forEach(tag => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      tagsAvailable.appendChild(option);
    });

  tagsSelected.innerHTML = '';
  selectedSpawnTags.forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag;
    tagsSelected.appendChild(option);
  });
}

function moveTagsToSelected(): void {
  const selected = Array.from(tagsAvailable.selectedOptions).map(opt => opt.value);
  selectedSpawnTags.push(...selected);
  renderTagPicker();
}

function moveTagsToAvailable(): void {
  const selected = Array.from(tagsSelected.selectedOptions).map(opt => opt.value);
  selectedSpawnTags = selectedSpawnTags.filter(tag => !selected.includes(tag));
  renderTagPicker();
}

btnTagAdd.addEventListener('click', moveTagsToSelected);
btnTagRemove.addEventListener('click', moveTagsToAvailable);

// === Effect System ===

const EFFECT_COLORS = ['#e94560', '#4a90d9', '#4ae945', '#d9904a', '#9a4ad9'];
const effectCounters: Record<string, number> = {};

function nextEffectId(type: string): string {
  effectCounters[type] = (effectCounters[type] ?? 0) + 1;
  return `${type}-${effectCounters[type]}`;
}

function randomEffectColor(): string {
  return EFFECT_COLORS[Math.floor(Math.random() * EFFECT_COLORS.length)];
}

function updateTriggerVisibility(): void {
  const count = triggerConditionList.querySelectorAll('.entity-item').length;
  triggerCombinatorRow.style.display = count >= 2 ? '' : 'none';
  triggerThresholdRow.style.display = count >= 1 ? '' : 'none';
}

function addConditionRow(): void {
  const row = document.createElement('div');
  row.className = 'entity-item';
  const condValuePlaceholders: Partial<Record<EffectTriggerConditionType, string>> = {
    text: 'text to match', emote: 'emote name', bits: 'min bits',
    cheer: 'min bits', raid: 'min viewers', channelPoints: 'reward title (blank = any)',
  };
  const condNoValue = new Set<EffectTriggerConditionType>(['message', 'follow', 'subscribe', 'subscriptionGift', 'streamOnline', 'streamOffline', 'channelUpdate', 'hypeTrain', 'adBreak', 'poll', 'prediction', 'shoutout']);
  row.innerHTML = `
    <div class="entity-row entity-row-header" style="margin-bottom:0">
      <select class="condition-type select-input" style="flex:1;font-size:11px;padding:5px 8px">
        <optgroup label="Chat message">
          <option value="message">Any message</option>
          <option value="text">Contains text</option>
          <option value="emote">Contains emote</option>
          <option value="bits">Bits cheer ≥ (chat)</option>
        </optgroup>
        <optgroup label="Channel events">
          <option value="follow">Follow</option>
          <option value="subscribe">Subscribe / Resub</option>
          <option value="subscriptionGift">Gift sub</option>
          <option value="cheer">Cheer bits ≥</option>
          <option value="raid">Raid viewers ≥</option>
          <option value="channelPoints">Channel points reward</option>
          <option value="hypeTrain">Hype train begins</option>
          <option value="poll">Poll begins</option>
          <option value="prediction">Prediction begins</option>
          <option value="adBreak">Ad break</option>
          <option value="channelUpdate">Channel update</option>
          <option value="shoutout">Shoutout</option>
          <option value="streamOnline">Stream online</option>
          <option value="streamOffline">Stream offline</option>
        </optgroup>
      </select>
      <input class="condition-value" type="text" placeholder="text to match" style="flex:1;min-width:0;font-size:11px;margin-left:4px">
      <button class="remove-btn" style="margin-left:4px">×</button>
    </div>
  `;
  const typeSelect = row.querySelector('.condition-type') as HTMLSelectElement;
  const valueInput = row.querySelector('.condition-value') as HTMLInputElement;
  typeSelect.addEventListener('change', () => {
    const t = typeSelect.value as EffectTriggerConditionType;
    valueInput.style.display = condNoValue.has(t) ? 'none' : '';
    valueInput.placeholder = condValuePlaceholders[t] ?? 'value';
  });
  // Apply initial visibility based on default selected option
  valueInput.style.display = condNoValue.has(typeSelect.value as EffectTriggerConditionType) ? 'none' : '';
  (row.querySelector('.remove-btn') as HTMLButtonElement).addEventListener('click', () => {
    row.remove();
    updateTriggerVisibility();
  });
  triggerConditionList.appendChild(row);
  updateTriggerVisibility();
}

function addEntityRow(): void {
  const row = document.createElement('div');
  row.className = 'entity-item';
  row.innerHTML = `
    <div class="entity-row entity-row-header" style="margin-bottom:6px">
      <select class="entity-source select-input" style="flex:1;font-size:11px;padding:5px 8px">
        <option value="shape">Shape</option>
        <option value="url">Image URL</option>
        <option value="trigger-sender">Trigger sender</option>
        <option value="recent-chatters">Recent chatters</option>
      </select>
      <button class="remove-btn" style="margin-left:4px">×</button>
    </div>
    <div class="entity-row entity-source-config" data-for="shape">
      <label>Color:</label><input type="color" class="entity-color" value="#4a90d9" style="width:50px;height:26px;padding:2px;border:1px solid #3a3a5a;border-radius:4px;background:#1a1a2e;cursor:pointer">
    </div>
    <div class="entity-row entity-source-config" data-for="url" style="display:none">
      <label>URL:</label><input type="text" class="entity-url" placeholder="https://..." style="flex:1;min-width:0;font-size:11px">
    </div>
    <div class="entity-row entity-source-config" data-for="recent-chatters" style="display:none">
      <label style="width:30px">Window (min):</label>
        <input type="number" class="entity-window" value="5" min="1" style="width:50px">
      <label style="font-size:11px;color:#888;flex-shrink:0;margin-left:4px">All</label>
      <label class="toggle-switch" style="flex-shrink:0">
        <input type="checkbox" class="entity-all-chatters">
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="entity-row">
      <label style="width:30px">Radius:</label>
        <input type="number" class="entity-radius" value="20" min="5" max="100" style="width:50px">
    </div>
    <div class="tag-picker" style="margin-top:6px">
      <div class="tag-picker-label">Tags</div>
      <div class="tag-picker-container">
        <div class="tag-picker-column">
          <div class="tag-picker-column-label">Available</div>
          <select multiple class="tag-picker-select entity-tags-available" style="min-height:60px"></select>
        </div>
        <div class="tag-picker-buttons">
          <button class="panel-btn entity-tags-add">&gt;&gt;</button>
          <button class="panel-btn entity-tags-remove">&lt;&lt;</button>
        </div>
        <div class="tag-picker-column">
          <div class="tag-picker-column-label">Selected</div>
          <select multiple class="tag-picker-select entity-tags-selected" style="min-height:60px"></select>
        </div>
      </div>
    </div>
  `;
  const sourceSelect = row.querySelector('.entity-source') as HTMLSelectElement;
  sourceSelect.addEventListener('change', () => {
    row.querySelectorAll<HTMLElement>('.entity-source-config').forEach(el => {
      el.style.display = el.dataset.for === sourceSelect.value ? '' : 'none';
    });
  });
  const allChattersCheck = row.querySelector('.entity-all-chatters') as HTMLInputElement;
  const windowInput = row.querySelector('.entity-window') as HTMLInputElement;
  allChattersCheck.addEventListener('change', () => {
    windowInput.disabled = allChattersCheck.checked;
    windowInput.style.opacity = allChattersCheck.checked ? '0.4' : '';
  });
  const tagsAvailableEl = row.querySelector('.entity-tags-available') as HTMLSelectElement;
  const tagsSelectedEl = row.querySelector('.entity-tags-selected') as HTMLSelectElement;
  // Populate available tags; FALLING selected by default
  for (const tag of spawnableTags) {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = tag;
    if (tag === TAGS.FALLING) tagsSelectedEl.appendChild(opt);
    else tagsAvailableEl.appendChild(opt);
  }
  row.querySelector('.entity-tags-add')!.addEventListener('click', () => {
    Array.from(tagsAvailableEl.selectedOptions).forEach(opt => tagsSelectedEl.appendChild(opt));
  });
  row.querySelector('.entity-tags-remove')!.addEventListener('click', () => {
    Array.from(tagsSelectedEl.selectedOptions).forEach(opt => tagsAvailableEl.appendChild(opt));
  });
  (row.querySelector('.remove-btn') as HTMLButtonElement).addEventListener('click', () => row.remove());
  newEffectEntityList.appendChild(row);
}

function readTriggerConfig(): TriggerConfig | null {
  const rows = Array.from(triggerConditionList.querySelectorAll<HTMLElement>('.entity-item'));
  if (rows.length === 0) return null;
  const conditions: TriggerCondition[] = rows.map(row => ({
    type: (row.querySelector('.condition-type') as HTMLSelectElement).value as EffectTriggerConditionType,
    value: (row.querySelector('.condition-value') as HTMLInputElement).value.trim(),
  }));
  return {
    conditions,
    combinator: triggerCombinator.value as 'AND' | 'OR',
    fireThreshold: parseInt(triggerThreshold.value) || 1,
  };
}

function readEntityDefinitions(): EntityDefinition[] {
  const rows = Array.from(newEffectEntityList.querySelectorAll<HTMLElement>('.entity-item'));
  if (rows.length === 0) {
    return [{ source: 'shape', color: randomEffectColor(), url: '', windowMinutes: 5, radius: 20, tags: [TAGS.FALLING] }];
  }
  return rows.map(row => {
    const source = (row.querySelector('.entity-source') as HTMLSelectElement).value as EntitySource;
    const colorEl = row.querySelector<HTMLInputElement>('.entity-color');
    const urlEl = row.querySelector<HTMLInputElement>('.entity-url');
    const windowEl = row.querySelector<HTMLInputElement>('.entity-window');
    const allEl = row.querySelector<HTMLInputElement>('.entity-all-chatters');
    const radiusEl = row.querySelector<HTMLInputElement>('.entity-radius');
    const tagsSelectedEl = row.querySelector<HTMLSelectElement>('.entity-tags-selected');
    const tags = tagsSelectedEl ? Array.from(tagsSelectedEl.options).map(o => o.value) : [TAGS.FALLING];
    return {
      source,
      color: colorEl?.value ?? '#4a90d9',
      url: urlEl?.value.trim() ?? '',
      windowMinutes: allEl?.checked ? 0 : (parseInt(windowEl?.value ?? '5') || 5),
      radius: parseInt(radiusEl?.value ?? '20') || 20,
      tags,
    };
  });
}

function getInputVal(id: string, fallback: number): number {
  return parseFloat((document.getElementById(id) as HTMLInputElement).value) || fallback;
}

function readEffectDefinition(): EffectDefinition {
  return {
    id: `event-${Date.now()}`,
    effectType: effectTypeSelect.value as 'burst' | 'rain' | 'stream' | 'spawn',
    trigger: readTriggerConfig(),
    lifecycle: {
      durationType: lifecycleDurationType.value as DurationType,
      durationValue: parseFloat(lifecycleDurationValue.value) || 10,
      maxTriggers: parseInt(lifecycleMaxTriggers.value) || 0,
      allowRetrigger: lifecycleAllowRetrigger.checked,
    },
    entities: readEntityDefinitions(),
    originType: effectOriginType,
    originX: getInputVal('origin-x', 50),
    originY: getInputVal('origin-y', 50),
    burstInterval: getInputVal('burst-interval', 2000),
    burstCount: getInputVal('burst-count', 8),
    burstForce: getInputVal('burst-force', 15),
    rainSpawnRate: getInputVal('rain-spawn-rate', 5),
    rainSpawnWidth: getInputVal('rain-spawn-width', 1),
    streamDirection: getInputVal('stream-direction', 90),
    streamSpawnRate: getInputVal('stream-spawn-rate', 10),
    streamForce: getInputVal('stream-force', 15),
    streamConeAngle: getInputVal('stream-cone-angle', 15),
    spawnCount: getInputVal('spawn-count', 5),
    spawnForce: getInputVal('spawn-force', 10),
  };
}

function evaluateTrigger(trigger: TriggerConfig, data: TriggerEventData): boolean {
  const chatTypes = new Set(['message', 'text', 'emote', 'bits']);
  const results = trigger.conditions.map(cond => {
    // Gate: chat conditions only fire from message events; channel conditions only from their own source
    const expectedSource: TriggerSourceType = chatTypes.has(cond.type) ? 'message' : (cond.type as TriggerSourceType);
    if (data.sourceType !== expectedSource) return false;
    switch (cond.type) {
      case 'text':    return (data.text ?? '').toLowerCase().includes(cond.value.toLowerCase());
      case 'emote':   return (data.emotes ?? []).some(e => e === cond.value);
      case 'bits':    return (data.bits ?? 0) >= parseInt(cond.value || '0');
      case 'cheer':   return (data.bits ?? 0) >= parseInt(cond.value || '1');
      case 'raid':    return (data.viewers ?? 0) >= parseInt(cond.value || '1');
      case 'channelPoints': return !cond.value || (data.rewardTitle ?? '').toLowerCase().includes(cond.value.toLowerCase());
      default:        return true; // follow, subscribe, subscriptionGift, streamOnline, streamOffline
    }
  });
  return trigger.combinator === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

function fireTriggerFor(data: TriggerEventData): void {
  for (const armed of armedEvents.values()) {
    if (!armed.definition.trigger) continue;
    if (evaluateTrigger(armed.definition.trigger, data)) {
      armed.matchCount++;
      if (armed.matchCount >= armed.definition.trigger.fireThreshold) {
        armed.matchCount = 0;
        void fireEvent(armed, data.userId ?? null);
      }
      renderActiveEffects();
    }
  }
}

async function circleClipUrl(url: string, diameter: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = diameter;
      canvas.height = diameter;
      const ctx = canvas.getContext('2d')!;
      ctx.beginPath();
      ctx.arc(diameter / 2, diameter / 2, diameter / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, 0, 0, diameter, diameter);
      try { resolve(canvas.toDataURL('image/png')); } catch { resolve(url); }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

async function resolveEntityConfigs(entities: EntityDefinition[], userId: string | null): Promise<EffectObjectConfig[]> {
  const configs: EffectObjectConfig[] = [];
  for (const entity of entities) {
    if (entity.source === 'shape') {
      configs.push({
        objectConfig: { fillStyle: entity.color, tags: entity.tags },
        probability: 1, minScale: 1, maxScale: 1, baseRadius: entity.radius,
      });
    } else if (entity.source === 'url') {
      configs.push({
        objectConfig: { fillStyle: randomEffectColor(), imageUrl: entity.url, tags: entity.tags },
        probability: 1, minScale: 1, maxScale: 1, baseRadius: entity.radius,
      });
    } else if (entity.source === 'trigger-sender') {
      let imageUrl: string | undefined;
      if (twitchChat && userId) {
        try { imageUrl = await twitchChat.getProfilePictureUrl(userId) ?? undefined; } catch { /* fallback */ }
      }
      const clippedUrl = imageUrl ? await circleClipUrl(imageUrl, entity.radius * 2) : undefined;
      configs.push({
        objectConfig: { fillStyle: randomEffectColor(), imageUrl: clippedUrl, tags: entity.tags },
        probability: 1, minScale: 1, maxScale: 1, baseRadius: entity.radius,
      });
    } else if (entity.source === 'recent-chatters') {
      const filtered = entity.windowMinutes === 0
        ? recentChatters
        : recentChatters.filter(c => c.timestamp >= Date.now() - entity.windowMinutes * 60 * 1000);
      const uniqueIds = [...new Set(filtered.map(c => c.userId))];
      if (uniqueIds.length === 0) {
        configs.push({
          objectConfig: { fillStyle: randomEffectColor(), tags: entity.tags },
          probability: 1, minScale: 1, maxScale: 1, baseRadius: entity.radius,
        });
      } else if (twitchChat) {
        try {
          const urlMap = await twitchChat.getProfilePictureUrls(uniqueIds);
          for (const [, url] of urlMap) {
            configs.push({
              objectConfig: { fillStyle: randomEffectColor(), imageUrl: url ? await circleClipUrl(url, entity.radius * 2) : undefined, tags: entity.tags },
              probability: 1, minScale: 1, maxScale: 1, baseRadius: entity.radius,
            });
          }
        } catch {
          configs.push({
            objectConfig: { fillStyle: randomEffectColor(), tags: entity.tags },
            probability: 1, minScale: 1, maxScale: 1, baseRadius: entity.radius,
          });
        }
      } else {
        for (let i = 0; i < uniqueIds.length; i++) {
          configs.push({
            objectConfig: { fillStyle: randomEffectColor(), tags: entity.tags },
            probability: 1, minScale: 1, maxScale: 1, baseRadius: entity.radius,
          });
        }
      }
    }
  }
  return configs.length > 0 ? configs : [{
    objectConfig: { fillStyle: randomEffectColor(), tags: [TAGS.FALLING] },
    probability: 1, minScale: 1, maxScale: 1, baseRadius: 20,
  }];
}

function resolveOriginPx(def: EffectDefinition): { x: number; y: number } {
  if (!canvas) return { x: 0, y: 0 };
  if (def.originType === 'mouse') {
    // Fall back to canvas center if OBS mouse relay hasn't sent data yet
    return mouseDataReceived
      ? { x: mouseX, y: mouseY }
      : { x: canvas.width / 2, y: canvas.height / 2 };
  }
  return {
    x: (def.originX / 100) * canvas.width,
    y: (def.originY / 100) * canvas.height,
  };
}

async function spawnEntitiesAt(objectConfigs: EffectObjectConfig[], count: number, x: number, y: number, force: number, ttl: number | undefined): Promise<void> {
  if (!scene) return;
  const total = objectConfigs.reduce((s, c) => s + c.probability, 0);
  for (let i = 0; i < count; i++) {
    let r = Math.random() * total;
    const cfg = objectConfigs.find(c => { r -= c.probability; return r <= 0; }) ?? objectConfigs[0];
    const scale = cfg.minScale + Math.random() * (cfg.maxScale - cfg.minScale);
    const radius = (cfg.baseRadius ?? 20) * scale;
    const id = await scene.spawnObjectAsync({ ...cfg.objectConfig, x, y, radius, ttl });
    if (force > 0) {
      const angle = Math.random() * Math.PI * 2;
      scene.setVelocity(id, { x: Math.cos(angle) * force, y: Math.sin(angle) * force });
    }
  }
}

function computeStopDelayMs(def: EffectDefinition): number | null {
  if (def.effectType === 'spawn') return null;
  const { durationType, durationValue } = def.lifecycle;
  if (durationType === 'none') return null;
  if (durationType === 'time') return durationValue * 1000;
  if (def.effectType === 'burst') return Math.ceil(durationValue / def.burstCount) * def.burstInterval;
  if (def.effectType === 'rain') return (durationValue / def.rainSpawnRate) * 1000;
  return (durationValue / def.streamSpawnRate) * 1000;
}

function buildSceneEffectConfig(def: EffectDefinition, objectConfigs: EffectObjectConfig[], effectId: string) {
  const origin = resolveOriginPx(def);
  if (def.effectType === 'burst') {
    return { id: effectId, enabled: true, objectConfigs, type: 'burst' as const, origin, burstInterval: def.burstInterval, burstCount: def.burstCount, burstForce: def.burstForce };
  }
  if (def.effectType === 'rain') {
    return { id: effectId, enabled: true, objectConfigs, type: 'rain' as const, spawnRate: def.rainSpawnRate, spawnWidth: def.rainSpawnWidth };
  }
  const dirRad = def.streamDirection * Math.PI / 180;
  return {
    id: effectId, enabled: true, objectConfigs, type: 'stream' as const,
    origin,
    direction: { x: Math.cos(dirRad), y: Math.sin(dirRad) },
    spawnRate: def.streamSpawnRate,
    force: def.streamForce,
    coneAngle: def.streamConeAngle * Math.PI / 180,
  };
}

async function fireEvent(armed: ArmedEvent, userId: string | null): Promise<void> {
  const { definition: def } = armed;
  if (!def.lifecycle.allowRetrigger && armed.isActive) return;
  if (!scene) return;
  const objectConfigs = await resolveEntityConfigs(def.entities, userId);

  if (def.effectType === 'spawn') {
    const { x, y } = resolveOriginPx(def);
    const ttl = def.lifecycle.durationType === 'time' ? def.lifecycle.durationValue * 1000 : undefined;
    await spawnEntitiesAt(objectConfigs, def.spawnCount, x, y, def.spawnForce, ttl);
    armed.triggerCount++;
    if (def.lifecycle.maxTriggers > 0 && armed.triggerCount >= def.lifecycle.maxTriggers) {
      armedEvents.delete(def.id);
    }
    renderActiveEffects();
    return;
  }

  const effectId = nextEffectId(def.effectType);
  scene.setEffect(buildSceneEffectConfig(def, objectConfigs, effectId));
  armed.isActive = true;
  armed.activeEffectId = effectId;
  const delay = computeStopDelayMs(def);
  if (delay !== null) {
    if (armed.stopTimer !== null) clearTimeout(armed.stopTimer);
    armed.stopTimer = setTimeout(() => {
      scene?.removeEffect(effectId);
      armed.isActive = false;
      armed.activeEffectId = null;
      armed.stopTimer = null;
      renderActiveEffects();
    }, delay);
  }
  armed.triggerCount++;
  if (def.lifecycle.maxTriggers > 0 && armed.triggerCount >= def.lifecycle.maxTriggers) {
    armedEvents.delete(def.id);
  }
  renderActiveEffects();
}

function renderActiveEffects(): void {
  const runningIds = scene?.getEffectIds() ?? [];
  const armedList = Array.from(armedEvents.values());
  if (runningIds.length === 0 && armedList.length === 0) {
    activeEffectsList.innerHTML = '<div class="empty-message">No active effects</div>';
    return;
  }
  activeEffectsList.innerHTML = '';
  for (const armed of armedList) {
    const def = armed.definition;
    const typeLabel = def.effectType.charAt(0).toUpperCase() + def.effectType.slice(1);
    const maxLabel = def.lifecycle.maxTriggers > 0 ? `/${def.lifecycle.maxTriggers}` : '';
    const item = document.createElement('div');
    item.className = 'entity-item';
    item.style.marginBottom = '4px';
    item.innerHTML = `
      <div class="entity-row entity-row-header" style="margin-bottom:0">
        <span style="flex:1;font-size:12px">${typeLabel} — armed (${armed.triggerCount}${maxLabel})</span>
        <span style="font-size:10px;color:#555;margin-right:6px">${armed.matchCount} pending</span>
        <button class="remove-btn">Stop</button>
      </div>
    `;
    (item.querySelector('.remove-btn') as HTMLButtonElement).addEventListener('click', () => {
      if (armed.stopTimer !== null) clearTimeout(armed.stopTimer);
      if (armed.activeEffectId) scene?.removeEffect(armed.activeEffectId);
      armedEvents.delete(def.id);
      renderActiveEffects();
    });
    activeEffectsList.appendChild(item);
  }
  for (const id of runningIds) {
    const effect = scene?.getEffect(id);
    if (!effect) continue;
    const typeLabel = effect.type.charAt(0).toUpperCase() + effect.type.slice(1);
    const item = document.createElement('div');
    item.className = 'entity-item';
    item.style.marginBottom = '4px';
    item.innerHTML = `
      <div class="entity-row entity-row-header" style="margin-bottom:0">
        <span style="flex:1;font-size:12px">${typeLabel}</span>
        <span style="font-size:10px;color:#555;margin-right:6px">${id}</span>
        <button class="remove-btn">Stop</button>
      </div>
    `;
    (item.querySelector('.remove-btn') as HTMLButtonElement).addEventListener('click', () => {
      scene?.removeEffect(id);
      renderActiveEffects();
    });
    activeEffectsList.appendChild(item);
  }
}

async function createEffectEvent(): Promise<void> {
  if (!scene) return;
  const def = readEffectDefinition();
  if (def.trigger === null) {
    const objectConfigs = await resolveEntityConfigs(def.entities, null);
    if (def.effectType === 'spawn') {
      const { x, y } = resolveOriginPx(def);
      const ttl = def.lifecycle.durationType === 'time' ? def.lifecycle.durationValue * 1000 : undefined;
      await spawnEntitiesAt(objectConfigs, def.spawnCount, x, y, def.spawnForce, ttl);
    } else {
      const effectId = nextEffectId(def.effectType);
      scene.setEffect(buildSceneEffectConfig(def, objectConfigs, effectId));
      const delay = computeStopDelayMs(def);
      if (delay !== null) {
        setTimeout(() => { scene?.removeEffect(effectId); renderActiveEffects(); }, delay);
      }
    }
  } else {
    armedEvents.set(def.id, { definition: def, matchCount: 0, triggerCount: 0, isActive: false, activeEffectId: null, stopTimer: null });
  }
  renderActiveEffects();
}

function stopAllEffects(): void {
  for (const armed of armedEvents.values()) {
    if (armed.stopTimer !== null) clearTimeout(armed.stopTimer);
    if (armed.activeEffectId) scene?.removeEffect(armed.activeEffectId);
  }
  armedEvents.clear();
  scene?.getEffectIds().forEach(id => scene?.removeEffect(id));
  renderActiveEffects();
}

// Effects event listeners
effectTypeSelect.addEventListener('change', () => {
  const type = effectTypeSelect.value;
  (document.getElementById('params-burst') as HTMLElement).style.display = type === 'burst' ? '' : 'none';
  (document.getElementById('params-rain') as HTMLElement).style.display = type === 'rain' ? '' : 'none';
  (document.getElementById('params-stream') as HTMLElement).style.display = type === 'stream' ? '' : 'none';
  (document.getElementById('params-spawn') as HTMLElement).style.display = type === 'spawn' ? '' : 'none';
  originSection.style.display = type === 'rain' ? 'none' : '';
});
lifecycleDurationType.addEventListener('change', () => {
  lifecycleDurationValue.style.display = lifecycleDurationType.value !== 'none' ? '' : 'none';
});
btnOriginFixed.addEventListener('click', () => {
  effectOriginType = 'fixed';
  btnOriginFixed.style.background = '#3a4a6a'; btnOriginFixed.style.color = '#fff';
  btnOriginMouse.style.background = '#2a2a4a'; btnOriginMouse.style.color = '#888';
  originFixedRow.style.display = '';
});
btnOriginMouse.addEventListener('click', () => {
  effectOriginType = 'mouse';
  btnOriginMouse.style.background = '#3a4a6a'; btnOriginMouse.style.color = '#fff';
  btnOriginFixed.style.background = '#2a2a4a'; btnOriginFixed.style.color = '#888';
  originFixedRow.style.display = 'none';
});

btnAddCondition.addEventListener('click', addConditionRow);
btnAddEntity.addEventListener('click', addEntityRow);
btnCreateEffect.addEventListener('click', () => { void createEffectEvent(); });
btnStopAllEffects.addEventListener('click', stopAllEffects);

// Entity spawning
async function spawnRandomEntity(): Promise<void> {
  if (!scene || !canvas) return;

  const inputX = parseFloat(inputSpawnX.value) || 50;
  const inputY = parseFloat(inputSpawnY.value) || 50;
  const x = selectXUnit.value === 'percent' ? (inputX / 100) * canvas.width : inputX;
  const y = selectYUnit.value === 'percent' ? (inputY / 100) * canvas.height : inputY;

  const colors = ['#e94560', '#4a90d9', '#4ae945', '#d9904a', '#9a4ad9'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const selectedImage = selectEntityImage.value;
  const ttlValue = inputEntityTtl.value ? parseInt(inputEntityTtl.value) : undefined;
  const weightValue = parseInt(inputEntityWeight.value) || 0;
  const tags = [...selectedSpawnTags];

  const config = {
    x,
    y,
    radius: 20 + Math.random() * 15,
    fillStyle: color,
    imageUrl: selectedImage || undefined,
    tags,
    ttl: ttlValue,
    weight: weightValue || undefined
  };

  if (selectedImage) {
    await scene.spawnObjectAsync(config);
  } else {
    scene.spawnObject(config);
  }
}

btnSpawnEntity.addEventListener('click', spawnRandomEntity);

// Text spawning
async function spawnTextObstacle(): Promise<void> {
  if (!scene || !canvas) return;

  const text = inputTextObstacle.value.trim();
  if (!text) return;

  const fontName = selectFont.value;
  const letterSize = parseInt(inputLetterSize.value) || 60;
  const letterColor = inputLetterColor.value.trim() || undefined;
  const fonts = scene.getAvailableFonts();
  const selectedFont = fonts.find(f => f.name === fontName);
  const centerX = canvas.width * 0.5;
  const centerY = canvas.height * 0.3;

  if (selectedFont?.type === 'ttf' && selectedFont.fontUrl) {
    await scene.addTTFTextObstacles({
      text,
      x: centerX,
      y: centerY,
      fontSize: letterSize,
      fontUrl: selectedFont.fontUrl,
      align: 'center',
      fillColor: letterColor || '#6495ED',
      tags: ['text-obstacle']
    });
  } else {
    await scene.addTextObstacles({
      text,
      x: centerX,
      y: centerY,
      letterSize,
      fontName,
      tags: ['text-obstacle'],
      letterColor
    });
  }
}

btnSpawnText.addEventListener('click', spawnTextObstacle);

// Tag actions
function populateActionTagDropdown(): void {
  if (!scene) return;
  const currentValue = selectActionTag.value;
  const tags = scene.getAllTags();
  selectActionTag.innerHTML = '<option value="">-- Select Tag --</option>';
  tags.forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag;
    selectActionTag.appendChild(option);
  });
  if (tags.includes(currentValue)) {
    selectActionTag.value = currentValue;
  }
}

selectActionTag.addEventListener('focus', populateActionTagDropdown);
selectActionTag.addEventListener('click', populateActionTagDropdown);

btnReleaseTag.addEventListener('click', () => {
  const tag = selectActionTag.value;
  if (tag) scene?.releaseObjectsByTag(tag);
});

btnRemoveTag.addEventListener('click', () => {
  const tag = selectActionTag.value;
  if (tag) scene?.removeObjectsByTag(tag);
});

btnReleaseAll.addEventListener('click', () => scene?.releaseAllObjects());
btnRemoveAll.addEventListener('click', () => scene?.removeAll());

// OBS Connection handlers
function updateConnectionUI(connected: boolean): void {
  connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
  connectionStatus.style.color = connected ? '#4ae945' : '#e94560';
  btnConnect.disabled = connected;
  btnDisconnect.disabled = !connected;
  inputOBSAddress.disabled = connected;
  inputOBSPassword.disabled = connected;
}

async function connectToOBS(): Promise<void> {
  const address = inputOBSAddress.value.trim();
  const password = inputOBSPassword.value;

  if (!address) {
    alert('Please enter an OBS WebSocket address');
    return;
  }

  connectionStatus.textContent = 'Connecting...';
  connectionStatus.style.color = '#d9904a';
  btnConnect.disabled = true;

  try {
    await obsClient.connect({ address, password: password || undefined });
    config.obs.address = address;
    config.obs.password = password;
    saveConfig(config);
  } catch (err) {
    console.error('Failed to connect to OBS:', err);
    updateConnectionUI(false);
  }
}

async function disconnectFromOBS(): Promise<void> {
  await obsClient.disconnect();
}

// Twitch Connection handlers
function updateTwitchUI(state: 'connected' | 'disconnected' | 'connecting' | 'auth_error'): void {
  const statusMap = {
    connected: { text: 'Connected', color: '#4ae945' },
    disconnected: { text: 'Disconnected', color: '#e94560' },
    connecting: { text: 'Connecting...', color: '#d9904a' },
    auth_error: { text: 'Auth Error', color: '#e94560' },
  };
  const { text, color } = statusMap[state];
  twitchConnectionStatus.textContent = text;
  twitchConnectionStatus.style.color = color;

  const connected = state === 'connected';
  const connecting = state === 'connecting';
  const busy = connected || connecting;
  btnTwitchConnect.disabled = busy;
  btnTwitchDisconnect.disabled = !connected;
  inputTwitchChannelId.disabled = busy;
  inputTwitchUserId.disabled = busy;
  inputTwitchClientId.disabled = busy;
  inputTwitchAccessToken.disabled = busy;
  subsAvailable.disabled = busy;
  subsSelected.disabled = busy;
  btnSubAdd.disabled = busy;
  btnSubRemove.disabled = busy;

  // Sim fire buttons: only enabled when connected in sim mode
  const simConnected = connected && twitchMode === 'sim';
  btnSimFireChat.disabled      = !simConnected;
  btnSimFireFollow.disabled    = !simConnected;
  btnSimFireSubscribe.disabled = !simConnected;
  btnSimFireGiftSub.disabled   = !simConnected;
  btnSimFireCheer.disabled     = !simConnected;
  btnSimFireRaid.disabled      = !simConnected;
  btnSimRun.disabled  = !simConnected || (twitchSimulator?.running ?? false);
  btnSimStop.disabled = !(twitchSimulator?.running ?? false);

  // Mode pills locked while connected or connecting
  btnTwitchModeReal.disabled = busy;
  btnTwitchModeSim.disabled  = busy;
}

function wireClientEvents(chat: TwitchClient): void {
  chat.on('connected', () => {
    updateTwitchUI('connected');
    chatDebugLog?.log('twitch', { status: 'connected' });
  });

  chat.on('disconnected', (code: number, reason: string) => {
    updateTwitchUI('disconnected');
    chatDebugLog?.log('twitch', { status: 'disconnected', code, reason });
    if (twitchChat === chat) twitchChat = null;
  });

  chat.on('message', (msg: NormalizedMessage) => {
    const data: Record<string, unknown> = { text: msg.text };
    if (msg.emotes.length > 0) data.emotes = msg.emotes.map((e: { name: string }) => e.name);
    if (msg.cheer) data.bits = msg.cheer.bits;
    if (msg.reply) data.reply_to = msg.reply.parentUserDisplayName;
    chatDebugLog?.log(msg.user.displayName, data);

    // Track recent chatters
    recentChatters.push({ userId: msg.user.id, timestamp: Date.now() });

    // Evaluate chat-based armed triggers
    fireTriggerFor({
      sourceType: 'message',
      userId: msg.user.id,
      text: msg.text,
      emotes: msg.emotes.map(e => e.name),
      bits: msg.cheer?.bits,
    });
  });

  chat.on('auth_error', () => {
    updateTwitchUI('auth_error');
    chatDebugLog?.log('twitch', { status: 'auth_error' });
    twitchChat = null;
  });

  chat.on('revoked', (reason: string) => {
    updateTwitchUI('disconnected');
    chatDebugLog?.log('twitch', { status: 'revoked', reason });
    if (twitchChat === chat) twitchChat = null;
  });

  chat.on('error', (err: Error) => {
    chatDebugLog?.log('twitch:error', { message: err.message });
  });

  chat.on('follow', (event) => {
    chatDebugLog?.log(event.user.displayName, { type: 'follow' });
    fireTriggerFor({ sourceType: 'follow', userId: event.user.id });
  });

  chat.on('subscribe', (event) => {
    chatDebugLog?.log(event.user.displayName, { type: 'subscribe', tier: event.tier, gift: event.isGift });
    fireTriggerFor({ sourceType: 'subscribe', userId: event.user.id });
  });

  chat.on('subscriptionMessage', (event) => {
    chatDebugLog?.log(event.user.displayName, { type: 'resub', tier: event.tier, months: event.cumulativeMonths });
    fireTriggerFor({ sourceType: 'subscribe', userId: event.user.id });
  });

  chat.on('subscriptionGift', (event) => {
    chatDebugLog?.log(event.gifter?.displayName ?? 'Anonymous', { type: 'giftSub', tier: event.tier, total: event.total });
    fireTriggerFor({ sourceType: 'subscriptionGift', userId: event.gifter?.id });
  });

  chat.on('cheer', (event) => {
    chatDebugLog?.log(event.user?.displayName ?? 'Anonymous', { type: 'cheer', bits: event.bits });
    fireTriggerFor({ sourceType: 'cheer', userId: event.user?.id, bits: event.bits });
  });

  chat.on('raid', (event) => {
    chatDebugLog?.log(event.fromBroadcaster.displayName, { type: 'raid', viewers: event.viewerCount });
    fireTriggerFor({ sourceType: 'raid', userId: event.fromBroadcaster.id, viewers: event.viewerCount });
  });

  chat.on('channelPoints', (event) => {
    chatDebugLog?.log(event.user.displayName, { type: 'channelPoints', reward: event.reward.title });
    fireTriggerFor({ sourceType: 'channelPoints', userId: event.user.id, rewardTitle: event.reward.title });
  });

  chat.on('streamOnline', () => {
    chatDebugLog?.log('stream', { type: 'online' });
    fireTriggerFor({ sourceType: 'streamOnline' });
  });

  chat.on('streamOffline', () => {
    chatDebugLog?.log('stream', { type: 'offline' });
    fireTriggerFor({ sourceType: 'streamOffline' });
  });

  chat.on('channelUpdate', (event) => {
    chatDebugLog?.log('channel', { type: 'update', title: event.title, category: event.categoryName });
    fireTriggerFor({ sourceType: 'channelUpdate' });
  });

  chat.on('hypeTrain.begin', () => {
    chatDebugLog?.log('channel', { type: 'hypeTrain.begin' });
    fireTriggerFor({ sourceType: 'hypeTrain' });
  });

  chat.on('adBreak', (event) => {
    chatDebugLog?.log('channel', { type: 'adBreak', duration: event.durationSeconds });
    fireTriggerFor({ sourceType: 'adBreak' });
  });

  chat.on('poll.begin', (event) => {
    chatDebugLog?.log('channel', { type: 'poll.begin', title: event.title });
    fireTriggerFor({ sourceType: 'poll' });
  });

  chat.on('prediction.begin', (event) => {
    chatDebugLog?.log('channel', { type: 'prediction.begin', title: event.title });
    fireTriggerFor({ sourceType: 'prediction' });
  });

  chat.on('shoutout.create', (event) => {
    chatDebugLog?.log('channel', { type: 'shoutout.create', to: event.toBroadcaster.displayName });
    fireTriggerFor({ sourceType: 'shoutout' });
  });

  chat.on('shoutout.receive', (event) => {
    chatDebugLog?.log('channel', { type: 'shoutout.receive', from: event.fromBroadcaster.displayName });
    fireTriggerFor({ sourceType: 'shoutout' });
  });
}

async function connectToTwitch(): Promise<void> {
  const channelId = inputTwitchChannelId.value.trim();
  const userId = inputTwitchUserId.value.trim();
  const clientId = inputTwitchClientId.value.trim();
  const accessToken = inputTwitchAccessToken.value.trim();

  if (!channelId || !userId || !clientId || !accessToken) {
    alert('Please fill in all Twitch fields');
    return;
  }

  updateTwitchUI('connecting');

  const subscriptions: TwitchClientSubscriptions = {};
  for (const key of selectedTwitchSubs) {
    (subscriptions as Record<string, boolean>)[key] = true;
  }
  const chat = new TwitchClient({ channelId, userId, clientId, accessToken, subscriptions });
  twitchChat = chat;
  wireClientEvents(chat);

  try {
    await chat.preloadEmotes();
    await chat.connect();

    config.twitch.channelId = channelId;
    config.twitch.userId = userId;
    config.twitch.clientId = clientId;
    config.twitch.subscriptions = [...selectedTwitchSubs];
    saveConfig(config);
  } catch (err) {
    console.error('Failed to connect to Twitch:', err);
    updateTwitchUI('disconnected');
    twitchChat = null;
  }
}

function disconnectFromTwitch(): void {
  if (!twitchChat) return;
  twitchChat.removeAllListeners();
  twitchChat.disconnect();
  twitchChat = null;
  updateTwitchUI('disconnected');
}

async function connectSimulated(): Promise<void> {
  updateTwitchUI('connecting');
  const sim = new TwitchSimulator();
  twitchSimulator = sim;
  twitchChat = sim.client;
  wireClientEvents(sim.client);
  try {
    await sim.connect();
  } catch (err) {
    console.error('Simulator failed to connect:', err);
    updateTwitchUI('disconnected');
    twitchSimulator = null;
    twitchChat = null;
  }
}

function disconnectSimulated(): void {
  if (!twitchSimulator) return;
  twitchSimulator.disconnect();
  twitchSimulator = null;
}

function switchTwitchMode(mode: 'real' | 'sim'): void {
  twitchMode = mode;
  twitchRealContent.style.display = mode === 'real' ? '' : 'none';
  twitchSimContent.style.display  = mode === 'sim'  ? '' : 'none';
  btnTwitchModeReal.style.background = mode === 'real' ? '#3a4a6a' : '#2a2a4a';
  btnTwitchModeReal.style.color      = mode === 'real' ? '#fff'    : '#888';
  btnTwitchModeSim.style.background  = mode === 'sim'  ? '#3a4a6a' : '#2a2a4a';
  btnTwitchModeSim.style.color       = mode === 'sim'  ? '#fff'    : '#888';
}

// OBS event listeners
obsClient.on('connected', async () => {
  updateConnectionUI(true);
  console.log('Connected to OBS');

  try {
    const currentScene = await obsClient.getCurrentScene();
    obsScene.textContent = currentScene;

    const streamStatus = await obsClient.getStreamStatus();
    obsStream.textContent = streamStatus.active ? 'Live' : 'Offline';
    obsStream.style.color = streamStatus.active ? '#4ae945' : '#aaa';

    const recordStatus = await obsClient.getRecordStatus();
    obsRecording.textContent = recordStatus.active ? 'Recording' : 'Stopped';
    obsRecording.style.color = recordStatus.active ? '#e94560' : '#aaa';
  } catch (err) {
    console.error('Failed to get OBS status:', err);
  }
});

obsClient.on('disconnected', () => {
  updateConnectionUI(false);
  obsScene.textContent = '--';
  obsStream.textContent = '--';
  obsStream.style.color = '#aaa';
  obsRecording.textContent = '--';
  obsRecording.style.color = '#aaa';
  console.log('Disconnected from OBS');
});

obsClient.on('error', (err) => {
  console.error('OBS error:', err);
});

obsClient.on('sceneChanged', ({ sceneName }) => {
  obsScene.textContent = sceneName;
  console.log('Scene changed:', sceneName);
});

obsClient.on('streamStarted', () => {
  obsStream.textContent = 'Live';
  obsStream.style.color = '#4ae945';
  console.log('Stream started');
});

obsClient.on('streamStopped', () => {
  obsStream.textContent = 'Offline';
  obsStream.style.color = '#aaa';
  console.log('Stream stopped');
});

obsClient.on('recordingStarted', () => {
  obsRecording.textContent = 'Recording';
  obsRecording.style.color = '#e94560';
  console.log('Recording started');
});

obsClient.on('recordingStopped', () => {
  obsRecording.textContent = 'Stopped';
  obsRecording.style.color = '#aaa';
  console.log('Recording stopped');
});

obsClient.on('mouseDown', ({ button, x, y }) => {
  console.log(`Mouse ${button} down at (${x}, ${y})`);
});

obsClient.on('mouseUp', ({ button, x, y }) => {
  console.log(`Mouse ${button} up at (${x}, ${y})`);
});

// Settings handlers
function updateSettings(): void {
  config.overlay.debug = checkboxDebug.checked;
  config.overlay.logLevel = selectLogLevel.value as 'warn' | 'info' | 'debug';
  setLogLevel(config.overlay.logLevel);
  scene?.setDebug(config.overlay.debug);
  saveConfig(config);
}

async function setTransparentBackground(): Promise<void> {
  config.overlay.background.transparent = true;
  await scene?.setBackground(undefined);
  saveConfig(config);
}

async function setDefaultBackground(): Promise<void> {
  config.overlay.background.transparent = false;
  config.overlay.background.color = '#16213e';
  inputBgColor.value = '#16213e';
  await scene?.setBackground({ color: '#16213e' });
  saveConfig(config);
}

async function applyBackgroundColor(): Promise<void> {
  config.overlay.background.transparent = false;
  config.overlay.background.color = inputBgColor.value;
  await scene?.setBackground({ color: inputBgColor.value });
  saveConfig(config);
}

// Event listeners
btnConnect.addEventListener('click', connectToOBS);
btnDisconnect.addEventListener('click', disconnectFromOBS);
btnTwitchConnect.addEventListener('click', () => {
  if (twitchMode === 'sim') void connectSimulated();
  else void connectToTwitch();
});
btnTwitchDisconnect.addEventListener('click', () => {
  if (twitchMode === 'sim') disconnectSimulated();
  else disconnectFromTwitch();
});

btnTwitchModeReal.addEventListener('click', () => switchTwitchMode('real'));
btnTwitchModeSim.addEventListener('click',  () => switchTwitchMode('sim'));

// Sim manual fire buttons
btnSimFireChat.addEventListener('click', () => {
  const text = simChatText.value.trim() || undefined;
  twitchSimulator?.fireChat(text, getSimUser());
});
btnSimFireFollow.addEventListener('click',    () => twitchSimulator?.fireFollow(getSimUser()));
btnSimFireSubscribe.addEventListener('click', () => twitchSimulator?.fireSubscribe(getSimUser()));
btnSimFireGiftSub.addEventListener('click',   () => twitchSimulator?.fireGiftSub(undefined, getSimUser()));
btnSimFireCheer.addEventListener('click', () => {
  twitchSimulator?.fireCheer(parseInt(simCheerBits.value) || 100, undefined, getSimUser());
});
btnSimFireRaid.addEventListener('click', () => {
  twitchSimulator?.fireRaid(parseInt(simRaidViewers.value) || 50, getSimUser());
});

// Sim action chip toggles
simScenarioActions.querySelectorAll<HTMLButtonElement>('.sim-action-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const action = chip.dataset.action as ActionType;
    if (simActiveActions.has(action)) {
      if (simActiveActions.size > 1) {
        simActiveActions.delete(action);
        chip.style.borderColor = '#3a3a5a';
        chip.style.color = '#666';
      }
    } else {
      simActiveActions.add(action);
      chip.style.borderColor = '#4a90d9';
      chip.style.color = '#4a90d9';
    }
  });
});

// Sim scenario run/stop
btnSimRun.addEventListener('click', () => {
  if (!twitchSimulator) return;
  twitchSimulator.run({
    duration: parseInt(simScenarioDuration.value) || 30,
    rate: parseFloat(simScenarioRate.value) || 1,
    actions: Array.from(simActiveActions),
    onComplete: () => updateTwitchUI('connected'),
  });
  updateTwitchUI('connected');
});
btnSimStop.addEventListener('click', () => {
  twitchSimulator?.stop();
  updateTwitchUI('connected');
});

btnLookup.addEventListener('click', async () => {
  const uid = lookupIdInput.value.trim();
  if (!uid) return;
  if (!twitchChat) {
    lookupResult.textContent = 'Not connected to Twitch';
    return;
  }
  lookupResult.textContent = 'Looking up...';
  try {
    const url = await twitchChat.getProfilePictureUrl(uid);
    if (url) {
      lookupResult.innerHTML = `<img src="${url}" style="width:48px;height:48px;border-radius:50%;vertical-align:middle;margin-right:8px"><span style="color:#fff">${uid}</span>`;
    } else {
      lookupResult.textContent = 'User not found';
    }
  } catch (err) {
    lookupResult.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
});
checkboxDebug.addEventListener('change', updateSettings);
selectLogLevel.addEventListener('change', updateSettings);
btnBgTransparent.addEventListener('click', setTransparentBackground);
btnBgDefault.addEventListener('click', setDefaultBackground);
inputBgColor.addEventListener('change', applyBackgroundColor);

// Mouse capture offset handlers
function updateMouseCaptureConfig(): void {
  config.mouseCapture.offset.x = parseFloat(inputOffsetX.value) || 0;
  config.mouseCapture.offset.y = parseFloat(inputOffsetY.value) || 0;
  config.mouseCapture.scale.x = parseFloat(inputScaleX.value) || 1;
  config.mouseCapture.scale.y = parseFloat(inputScaleY.value) || 1;
  saveConfig(config);
}
inputOffsetX.addEventListener('change', updateMouseCaptureConfig);
inputOffsetY.addEventListener('change', updateMouseCaptureConfig);
inputScaleX.addEventListener('change', updateMouseCaptureConfig);
inputScaleY.addEventListener('change', updateMouseCaptureConfig);

// Initialize UI from config
inputOBSAddress.value = config.obs.address;
inputOBSPassword.value = config.obs.password;
checkboxDebug.checked = config.overlay.debug;
selectLogLevel.value = config.overlay.logLevel;
inputBgColor.value = config.overlay.background.color;
inputOffsetX.value = String(config.mouseCapture.offset.x);
inputOffsetY.value = String(config.mouseCapture.offset.y);
inputScaleX.value = String(config.mouseCapture.scale.x);
inputScaleY.value = String(config.mouseCapture.scale.y);
inputTwitchChannelId.value = config.twitch.channelId;
inputTwitchUserId.value = config.twitch.userId;
inputTwitchClientId.value = config.twitch.clientId;
renderSubPicker();
populateSimUserSelect();

// Handle resize
window.addEventListener('resize', () => {
  if (scene) {
    const size = getContainerSize();
    scene.resize(size.width, size.height);
  }
});

// Check URL params for panel visibility
const urlParams = new URLSearchParams(window.location.search);
const panelsParam = urlParams.get('panels');
const hidePanels = panelsParam === 'hidden';
const showPanels = panelsParam === 'visible'; // Force always visible

// Hide all panels and stats completely if URL param is 'hidden'
if (hidePanels) {
  [connectionPanel, settingsPanel, entityPanel, effectsPanel, inputPanel].forEach(panel => {
    panel.style.display = 'none';
  });
  statsEl.style.display = 'none';
}

// Initialize TabManager (only if panels are visible)
if (!hidePanels) {
  const tabManager = new TabManager({
    snapThreshold: 50,
    panelGap: 0,
    panelMargin: 16,
    anchorThreshold: 80,
    defaultPanelWidth: 300,
    initializeDefaultAnchors: true,
    classPrefix: 'blork-tabs',
    startHidden: !showPanels,
    // autoHideDelay omitted — we manage hide timing ourselves so hover pauses it
  });

  [
    tabManager.registerPanel('connection', connectionPanel, {
      dragHandle: connectionDragHandle,
      collapseButton: connectionCollapseBtn,
      contentWrapper: connectionContent,
      detachGrip: document.getElementById('connection-detach-grip') as HTMLDivElement,
      startCollapsed: false,
    }),
    tabManager.registerPanel('settings', settingsPanel, {
      dragHandle: settingsDragHandle,
      collapseButton: settingsCollapseBtn,
      contentWrapper: settingsContent,
      detachGrip: document.getElementById('settings-detach-grip') as HTMLDivElement,
      startCollapsed: true,
    }),
    tabManager.registerPanel('entity', entityPanel, {
      dragHandle: entityDragHandle,
      collapseButton: entityCollapseBtn,
      contentWrapper: entityContent,
      detachGrip: document.getElementById('entity-detach-grip') as HTMLDivElement,
      startCollapsed: true,
    }),
    tabManager.registerPanel('effects', effectsPanel, {
      dragHandle: effectsDragHandle,
      collapseButton: effectsCollapseBtn,
      contentWrapper: effectsContent,
      detachGrip: document.getElementById('effects-detach-grip') as HTMLDivElement,
      startCollapsed: true,
    }),
    tabManager.registerPanel('input', inputPanel, {
      dragHandle: inputDragHandle,
      collapseButton: inputCollapseBtn,
      contentWrapper: inputContent,
      detachGrip: document.getElementById('input-detach-grip') as HTMLDivElement,
      startCollapsed: true,
    }),
  ].forEach(state => togglePin(state, false));

  // Hover-aware auto-hide (only when not forced visible)
  if (!showPanels) {
    const AUTO_HIDE_DELAY = 5000;
    const allPanelEls = [connectionPanel, settingsPanel, entityPanel, effectsPanel, inputPanel];
    const panelIds = ['connection', 'settings', 'entity', 'effects', 'input'];
    let autoHideTimer: ReturnType<typeof setTimeout> | null = null;
    let panelHoverCount = 0;

    const clearHideTimer = () => {
      if (autoHideTimer !== null) { clearTimeout(autoHideTimer); autoHideTimer = null; }
    };

    const scheduleHide = () => {
      clearHideTimer();
      autoHideTimer = setTimeout(() => {
        panelIds.forEach(id => tabManager.hide(id));
      }, AUTO_HIDE_DELAY);
    };

    document.addEventListener('mousemove', () => {
      panelIds.forEach(id => tabManager.show(id));
      if (panelHoverCount === 0) scheduleHide();
    });

    allPanelEls.forEach(el => {
      el.addEventListener('mouseenter', () => {
        panelHoverCount++;
        clearHideTimer();
      });
      el.addEventListener('mouseleave', () => {
        panelHoverCount = Math.max(0, panelHoverCount - 1);
        if (panelHoverCount === 0) scheduleHide();
      });
    });
  }

  // Sync stats visibility with tab panel visibility
  if (!showPanels) {
    statsEl.style.display = 'none';
  }
  tabManager.on('panel:show', () => {
    statsEl.style.display = '';
  });
  tabManager.on('panel:hide', () => {
    if (tabManager.getAllPanels().every(p => p.isHidden)) {
      statsEl.style.display = 'none';
    }
  });

  // Create embedded debug log with 3 second hover to enlarge
  debugLog = tabManager.createDebugLog(eventLogContainer, {
    maxEntries: 50,
    showTimestamps: true,
    hoverDelay: 3000,
  });

  // Create chat debug log
  chatDebugLog = tabManager.createDebugLog(chatLogContainer, {
    maxEntries: 200,
    showTimestamps: true,
    hoverDelay: 3000,
  });

  requestAnimationFrame(() => {
    // Order: OBS Connection, Settings, Input Detection, Entity Management, Effects
    // positionPanelsFromRight takes them in reverse order (rightmost first)
    tabManager.positionPanelsFromRight(['effects', 'entity', 'input', 'settings', 'connection']);
    tabManager.createSnapChain(['connection', 'settings', 'input', 'entity', 'effects']);
  });
}

// Initialize scene
const size = getContainerSize();
createScene(size.width, size.height);
