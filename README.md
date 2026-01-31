# @blorkfield/obs-overlay

Physics-based streaming overlay with OBS Studio integration. Built on [@blorkfield/overlay-core](https://github.com/Blorkfield/overlay-core).

## Features

- Physics simulation with Matter.js (gravity, collisions, pressure collapse)
- OBS WebSocket integration (scene changes, stream/recording status)
- Real-time mouse tracking (system-wide via OBS script)
- Mouse button state detection (left, right, middle, hold detection)
- Entity spawning with customizable tags and properties
- Text obstacles with TTF font support
- Configurable effects (burst, rain, stream)
- Draggable/collapsible panel UI via [@blorkfield/blork-tabs](https://github.com/Blorkfield/blork-tabs)

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

> **Tip:** Use `?panels=hidden` in the OBS browser source URL to hide the control panels in your stream. To configure the overlay, either remove the parameter temporarily or open the URL without it in a regular browser window.

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

| Panel | Description |
|-------|-------------|
| OBS Connection | Connect to OBS WebSocket server |
| Settings | Debug mode, log level, background color |
| Input Detection | Live display of mouse position, button states, OBS events |
| Entity Management | Spawn entities and text obstacles, manage tags |
| Effects | Configure burst, rain, and stream effects |

## Configuration

Settings persist to browser localStorage. When used as an OBS Browser Source, config survives OBS restarts.

### URL Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `panels` | `hidden` | Hides all control panels (use for OBS browser source) |

**Example:** `http://localhost:5173?panels=hidden`

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
