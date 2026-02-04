# @blorkfield/obs-overlay

Physics-based streaming overlay with OBS Studio integration. Built on [@blorkfield/overlay-core](https://github.com/Blorkfield/overlay-core).

## Features

- **Physics simulation** - Matter.js powered gravity, collisions, and pressure collapse
- **OBS integration** - WebSocket connection for scene changes, stream/recording status
- **Mouse tracking** - System-wide mouse capture via OBS script (position and button states)
- **Entity system** - Spawn physics objects with customizable images, tags, TTL, and weight
- **Text obstacles** - Add text as physical obstacles with TTF font support
- **Effects** - Configurable burst, rain, and stream particle effects
- **Grabbing** - Click and drag entities around the scene
- **Panel UI** - Draggable, collapsible, auto-hiding panels via [@blorkfield/blork-tabs](https://github.com/Blorkfield/blork-tabs)
- **Event debugging** - Embedded event log with hover-to-enlarge for easy debugging in OBS

## Quick Start

### Development

```bash
pnpm install
pnpm dev
```

Overlay runs at http://localhost:5173

### Docker

```bash
docker compose up
```

Overlay runs at http://localhost:5173 (dev) or http://localhost:80 (production)

## OBS Setup

### 1. Browser Source

1. Add a new **Browser Source** in OBS
2. Set URL to `http://localhost:5173?panels=hidden` (dev) or your production URL with the same parameter
3. Set dimensions to match your canvas (e.g., 1920x1080)
4. Enable transparency if desired

> **Tip:** Use `?panels=hidden` in the OBS browser source URL to hide the control panels in your stream. To configure the overlay, open `http://localhost:5173?panels=visible` in a regular browser window to keep panels always visible while adjusting settings.

### 2. WebSocket Connection

1. In OBS: **Tools > WebSocket Server Settings**
2. Enable the WebSocket server (default port: 4455)
3. Set a password if desired
4. In the overlay's Connection panel, enter the WebSocket address and connect

### 3. Mouse Capture Script

The overlay tracks your system mouse position via an OBS script. This captures mouse coordinates relative to your screen display - not browser interaction.

#### Install Python Dependencies

**Arch Linux (AUR):**
```bash
yay -S python-pynput python-websocket-client
```

**Debian/Ubuntu:**
```bash
sudo apt install python3-pynput python3-websocket
```

**Fedora:**
```bash
sudo dnf install python3-pynput python3-websocket-client
```

**macOS/Windows/Other (pip):**
```bash
pip install pynput websocket-client
```

#### Configure OBS Python Path

1. In OBS: **Tools > Scripts > Python Settings**
2. Set the Python install path:
   - **Arch Linux:** `/usr` (not the full python3 path)
   - **Debian/Ubuntu:** `/usr`
   - **Fedora:** `/usr`
   - **macOS (Homebrew):** `/opt/homebrew/Frameworks/Python.framework/Versions/3.x` or `/usr/local/Cellar/python@3.x/...`
   - **Windows:** `C:\Python311` or your Python install directory

   > **Note:** On Linux, OBS expects the prefix directory (e.g., `/usr`), not the python binary path. OBS will look for `lib/python3.x/` under this path.

#### Add the Script

1. In OBS: **Tools > Scripts**
2. Click **+** and select `obs-scripts/mouse_capture.py` from this repository
3. Configure the script settings:
   - **Overlay WebSocket URL**: `ws://localhost:5173/mouse?source=obs`
   - **Enable mouse capture**: checked
   - **Send interval**: 16ms (~60fps, adjust if needed)

The script connects automatically when OBS starts. Check **Script Log** for connection status.

## Architecture

```
Your Mouse (system-wide)
    │
    ▼
OBS Script (mouse_capture.py)
    │ pynput captures position
    ▼
WebSocket ───────────────────► Overlay (browser source)
    ws://localhost:PORT/mouse     │ receives & displays
                                  ▼
                             OBS Scene
```

Mouse data flows from the OBS script (running inside OBS) through WebSocket to the overlay. No separate background process required - the script runs within OBS itself.

## Panels

All panels auto-hide after 5 seconds of inactivity and reappear on mouse/keyboard activity. This keeps the overlay clean during streams while remaining accessible for configuration.

| Panel | Description |
|-------|-------------|
| **OBS Connection** | Connect to OBS WebSocket server |
| **Settings** | Debug mode, log level, background color, mouse capture offset/scale |
| **Entity Management** | Spawn entities and text obstacles, manage tags |
| **Effects** | Configure burst, rain, and stream effects |
| **Event Detection** | Live mouse position, button states, OBS events, and event log |

### Event Log

The Event Detection panel includes an embedded event log for debugging click/grab events. Hover over the log for 3 seconds to enlarge it to 75% of the screen for easier reading—useful when debugging in OBS browser sources without console access.

## Configuration

Settings persist to browser localStorage. When used as an OBS Browser Source, config survives OBS restarts.

### URL Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `panels` | `hidden` | Completely hides all panels and stats (use for OBS browser source) |
| `panels` | `visible` | Disables auto-hide, keeps panels always visible |

**Examples:**
- `http://localhost:5173?panels=hidden` — Production/streaming (no UI)
- `http://localhost:5173?panels=visible` — Configuration (panels always visible)
- `http://localhost:5173` — Default (panels auto-hide after 5 seconds)

### Mouse Capture Calibration

If mouse coordinates from the OBS script don't align with your overlay (e.g., multi-monitor setups, scaled displays), use the **Mouse Capture Offset** settings:

| Setting | Description |
|---------|-------------|
| **Offset X/Y** | Pixel offset to subtract from raw coordinates |
| **Scale X/Y** | Multiplier for coordinate scaling (default: 1.0) |

The transformation applied is: `canvas_pos = (raw_pos - offset) * scale`

## Development

```bash
pnpm install      # Install dependencies
pnpm dev          # Start dev server with hot reload
pnpm build        # Build for production
pnpm start        # Run production server (after build)
pnpm typecheck    # Run TypeScript checks
```

## CI/CD

This project uses shared workflows from [blork-infra](https://github.com/Blorkfield/blork-infra).

### Automated Pipeline

1. **Push to feature branch** (e.g., `feat/add-new-effect`)
   - Auto-PR workflow creates a PR and changeset based on branch prefix
   - Branch naming: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `perf/`, `test/`, `breaking/`

2. **PR to main**
   - CI runs build and typecheck
   - Auto-merges on success (squash + delete branch)

3. **Merge to main with changesets**
   - Creates a release PR to version the package

4. **Release PR merges**
   - Builds and pushes Docker image to `ghcr.io/blorkfield/obs-overlay`

### Manual Publish

Trigger a manual publish via GitHub Actions > Publish > Run workflow.

## Requirements

- Node.js 22+
- pnpm
- OBS Studio 28+ (includes WebSocket server)
- Python 3.x with `pynput` and `websocket-client`

## License

GPL-3.0
