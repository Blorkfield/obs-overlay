import { OverlayScene, setLogLevel } from '@blorkfield/overlay-core';
import { TabManager } from '@blorkfield/blork-tabs';
import '@blorkfield/blork-tabs/styles.css';
import { OBSClient } from './obs/index.js';
import { loadConfig, saveConfig } from './config.js';

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
const eventLog = document.getElementById('event-log') as HTMLDivElement;

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

const inputPanel = document.getElementById('input-panel') as HTMLDivElement;
const inputDragHandle = document.getElementById('input-drag-handle') as HTMLDivElement;
const inputCollapseBtn = document.getElementById('input-collapse') as HTMLButtonElement;
const inputContent = document.getElementById('input-content') as HTMLDivElement;

// Scene state
let scene: OverlayScene | null = null;
let canvas: HTMLCanvasElement | null = null;

// Mouse WebSocket state
let mouseWs: WebSocket | null = null;

// Event logging
function logEvent(eventName: string, data?: Record<string, unknown>): void {
  if (!eventLog) return;

  const entry = document.createElement('div');
  entry.className = 'event-log-entry';

  const dataStr = data ? `: ${JSON.stringify(data)}` : '';
  entry.innerHTML = `<span class="event-name">${eventName}</span><span class="event-data">${dataStr}</span>`;

  eventLog.appendChild(entry);
  eventLog.scrollTop = eventLog.scrollHeight;

  // Limit log entries (keep title + 50 entries)
  while (eventLog.children.length > 50) {
    eventLog.removeChild(eventLog.children[0]);
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
        scene?.setMousePosition(x, y);
        scene?.setFollowTarget('absolute', x, y);
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

        // For left button, use grab API (mouse position already set with offset above)
        if (button === 'left') {
          if (pressed) {
            const grabbedId = scene?.startGrab();
            logEvent('ws:grab:start', { x, y, grabbed: grabbedId ?? null });
          } else {
            scene?.endGrab();
            logEvent('ws:grab:end', { x, y });
          }
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
const spawnableTags = ['falling', 'follow', 'follow-absolute', 'grabable'];
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
    scene.setMousePosition(x, y);
  });

  canvas.addEventListener('mousedown', (e) => {
    if (!canvas) return;
    const button = e.button === 0 ? 'left' : e.button === 1 ? 'middle' : 'right';
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    // For left click, grab at current mouse position (no offset for direct interaction)
    if (button === 'left') {
      const grabbedId = scene?.startGrab();
      logEvent('canvas:grab:start', { x, y, grabbed: grabbedId ?? null });
    }

    // Only update scene interaction, not the display (that comes from OBS script)
    obsClient.setMouseButton(button, true);
  });

  canvas.addEventListener('mouseup', (e) => {
    if (!canvas) return;
    const button = e.button === 0 ? 'left' : e.button === 1 ? 'middle' : 'right';
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    if (button === 'left') {
      scene?.endGrab();
      logEvent('canvas:grab:end', { x, y });
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

// Auto-hide panels logic (default behavior, disable with ?panels=visible)
if (!hidePanels && !showPanels) {
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;
  const AUTO_HIDE_DELAY = 3000;

  function hideUI(): void {
    document.body.classList.add('panels-auto-hide');
  }

  function showUI(): void {
    document.body.classList.remove('panels-auto-hide');
  }

  function resetHideTimer(): void {
    showUI();
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(hideUI, AUTO_HIDE_DELAY);
  }

  // Start hidden
  hideUI();

  // Show on browser interaction (not WebSocket data)
  document.addEventListener('mousemove', resetHideTimer);
  document.addEventListener('mousedown', resetHideTimer);
  document.addEventListener('keydown', resetHideTimer);
}

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
  });

  tabManager.registerPanel('connection', connectionPanel, {
    dragHandle: connectionDragHandle,
    collapseButton: connectionCollapseBtn,
    contentWrapper: connectionContent,
    detachGrip: document.getElementById('connection-detach-grip') as HTMLDivElement,
    startCollapsed: false,
  });

  tabManager.registerPanel('settings', settingsPanel, {
    dragHandle: settingsDragHandle,
    collapseButton: settingsCollapseBtn,
    contentWrapper: settingsContent,
    detachGrip: document.getElementById('settings-detach-grip') as HTMLDivElement,
    startCollapsed: true,
  });

  tabManager.registerPanel('entity', entityPanel, {
    dragHandle: entityDragHandle,
    collapseButton: entityCollapseBtn,
    contentWrapper: entityContent,
    detachGrip: document.getElementById('entity-detach-grip') as HTMLDivElement,
    startCollapsed: true,
  });

  tabManager.registerPanel('effects', effectsPanel, {
    dragHandle: effectsDragHandle,
    collapseButton: effectsCollapseBtn,
    contentWrapper: effectsContent,
    detachGrip: document.getElementById('effects-detach-grip') as HTMLDivElement,
    startCollapsed: true,
  });

  tabManager.registerPanel('input', inputPanel, {
    dragHandle: inputDragHandle,
    collapseButton: inputCollapseBtn,
    contentWrapper: inputContent,
    detachGrip: document.getElementById('input-detach-grip') as HTMLDivElement,
    startCollapsed: true,
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
