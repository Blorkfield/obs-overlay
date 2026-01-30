# @blorkfield/obs-overlay

Physics-based streaming overlay with OBS Studio integration. Built on [@blorkfield/overlay-core](https://github.com/Blorkfield/overlay-core).

## Features

- Physics simulation with Matter.js (gravity, collisions, pressure collapse)
- OBS WebSocket integration (scene changes, stream/recording status, mouse events)
- Real-time input detection (mouse position, left/right/middle click, hold detection)
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

Open http://localhost:5173 in your browser.

### Docker

```bash
docker build -t obs-overlay .
docker run -p 8080:80 obs-overlay
```

Open http://localhost:8080 in your browser.

## OBS Setup

1. **Enable WebSocket Server in OBS:**
   - Go to Tools → WebSocket Server Settings
   - Enable the server (default port: 4455)
   - Optionally enable authentication and set a password

2. **Add Browser Source in OBS:**
   - Add a new Browser Source
   - URL: `http://localhost:5173` (dev) or `http://localhost:8080` (docker)
   - Width/Height: Match your canvas size (e.g., 1920x1080)
   - Check "Shutdown source when not visible" if desired

3. **Connect the Overlay:**
   - Right-click the Browser Source → "Interact" to open the interaction window
   - In the OBS Connection panel, enter the WebSocket address
   - Enter password if authentication is enabled
   - Click Connect

## Panels

| Panel | Description |
|-------|-------------|
| OBS Connection | Connect to OBS WebSocket server |
| Settings | Debug mode, log level, background color |
| Input Detection | Live display of mouse position, button states, OBS events |
| Entity Management | Spawn entities and text obstacles, manage tags |
| Effects | Configure burst, rain, and stream effects |

## Configuration

Settings are persisted to browser localStorage. When used as an OBS Browser Source, config survives OBS restarts.

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

Trigger a manual publish via GitHub Actions → Publish → Run workflow.

### Local Development

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm typecheck        # Run TypeScript checks
```

## License

GPL-3.0
