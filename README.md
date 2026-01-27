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
   - In the overlay's OBS Connection panel, enter the WebSocket address
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

## License

GPL-3.0
