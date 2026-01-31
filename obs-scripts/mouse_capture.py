"""
OBS Mouse Capture Script
Captures mouse position and button states, sends to obs-overlay via WebSocket.

Installation:

1. Install Python dependencies:

   Arch Linux (AUR):
     yay -S python-pynput python-websocket-client

   Debian/Ubuntu:
     sudo apt install python3-pynput python3-websocket

   Fedora:
     sudo dnf install python3-pynput python3-websocket-client

   macOS/Windows/Other:
     pip install pynput websocket-client

2. Configure OBS Python path:
   - Tools > Scripts > Python Settings
   - Linux: Set to /usr (the prefix, not the binary)
   - macOS: Set to your Python framework path
   - Windows: Set to your Python install directory (e.g., C:\\Python311)

3. Add this script:
   - Tools > Scripts > Click + > Select this file

4. Configure script settings:
   - Set overlay WebSocket URL (default: ws://localhost:5173/mouse?source=obs)
   - Enable mouse capture

The overlay must be running before enabling this script.
"""

import obspython as obs
import threading
import json
import time

# Attempt imports - will fail gracefully if not installed
try:
    from pynput import mouse
    PYNPUT_AVAILABLE = True
except ImportError:
    PYNPUT_AVAILABLE = False

try:
    import websocket
    WEBSOCKET_AVAILABLE = True
except ImportError:
    WEBSOCKET_AVAILABLE = False

# Configuration
overlay_url = "ws://localhost:5173/mouse?source=obs"
enabled = True
send_interval_ms = 16  # ~60fps

# State
ws = None
ws_connected = False
mouse_listener = None
current_x = 0
current_y = 0
buttons_state = {"left": False, "right": False, "middle": False}
last_send_time = 0
reconnect_timer = None


def script_description():
    return """<h2>Mouse Capture for OBS Overlay</h2>
<p>Captures mouse position and sends to the overlay via WebSocket.</p>
<p><b>Requirements:</b> pip install pynput websocket-client</p>"""


def script_properties():
    props = obs.obs_properties_create()
    obs.obs_properties_add_text(props, "overlay_url", "Overlay WebSocket URL", obs.OBS_TEXT_DEFAULT)
    obs.obs_properties_add_bool(props, "enabled", "Enable mouse capture")
    obs.obs_properties_add_int_slider(props, "send_interval_ms", "Send interval (ms)", 8, 100, 1)
    return props


def script_defaults(settings):
    obs.obs_data_set_default_string(settings, "overlay_url", "ws://localhost:5173/mouse?source=obs")
    obs.obs_data_set_default_bool(settings, "enabled", True)
    obs.obs_data_set_default_int(settings, "send_interval_ms", 16)


def script_update(settings):
    global overlay_url, enabled, send_interval_ms
    overlay_url = obs.obs_data_get_string(settings, "overlay_url")
    enabled = obs.obs_data_get_bool(settings, "enabled")
    send_interval_ms = obs.obs_data_get_int(settings, "send_interval_ms")

    if enabled:
        start_capture()
    else:
        stop_capture()


def script_load(settings):
    if not PYNPUT_AVAILABLE:
        obs.script_log(obs.LOG_ERROR, "pynput not installed. Run: pip install pynput")
        return
    if not WEBSOCKET_AVAILABLE:
        obs.script_log(obs.LOG_ERROR, "websocket-client not installed. Run: pip install websocket-client")
        return

    obs.script_log(obs.LOG_INFO, "Mouse capture script loaded")


def script_unload():
    stop_capture()
    obs.script_log(obs.LOG_INFO, "Mouse capture script unloaded")


def connect_websocket():
    global ws, ws_connected, reconnect_timer

    if not enabled:
        return

    try:
        ws = websocket.create_connection(overlay_url, timeout=5)
        ws_connected = True
        obs.script_log(obs.LOG_INFO, f"Connected to overlay at {overlay_url}")
    except Exception as e:
        ws_connected = False
        obs.script_log(obs.LOG_WARNING, f"Failed to connect to overlay: {e}. Retrying in 5s...")
        reconnect_timer = threading.Timer(5.0, connect_websocket)
        reconnect_timer.daemon = True
        reconnect_timer.start()


def send_mouse_data():
    global ws, ws_connected, last_send_time

    if not ws_connected or not ws:
        return

    now = time.time() * 1000
    if now - last_send_time < send_interval_ms:
        return

    last_send_time = now

    try:
        data = json.dumps({
            "type": "mouse",
            "x": current_x,
            "y": current_y,
            "buttons": buttons_state
        })
        ws.send(data)
    except Exception as e:
        obs.script_log(obs.LOG_WARNING, f"WebSocket send failed: {e}")
        ws_connected = False
        connect_websocket()


def on_move(x, y):
    global current_x, current_y
    current_x = int(x)
    current_y = int(y)
    send_mouse_data()


def on_click(x, y, button, pressed):
    global buttons_state, current_x, current_y
    current_x = int(x)
    current_y = int(y)

    button_name = button.name if hasattr(button, 'name') else str(button)
    if button_name in buttons_state:
        buttons_state[button_name] = pressed

    # Send button events immediately
    if ws_connected and ws:
        try:
            data = json.dumps({
                "type": "click",
                "button": button_name,
                "pressed": pressed,
                "x": current_x,
                "y": current_y
            })
            ws.send(data)
        except Exception:
            pass

    send_mouse_data()


def start_capture():
    global mouse_listener

    if not PYNPUT_AVAILABLE or not WEBSOCKET_AVAILABLE:
        return

    stop_capture()
    connect_websocket()

    mouse_listener = mouse.Listener(on_move=on_move, on_click=on_click)
    mouse_listener.daemon = True
    mouse_listener.start()

    obs.script_log(obs.LOG_INFO, "Mouse capture started")


def stop_capture():
    global ws, ws_connected, mouse_listener, reconnect_timer

    if reconnect_timer:
        reconnect_timer.cancel()
        reconnect_timer = None

    if mouse_listener:
        mouse_listener.stop()
        mouse_listener = None

    if ws:
        try:
            ws.close()
        except Exception:
            pass
        ws = None

    ws_connected = False
    obs.script_log(obs.LOG_INFO, "Mouse capture stopped")
