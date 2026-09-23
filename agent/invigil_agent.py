"""
invigilAI Desktop Agent v3.1 (Universal Real-Time Tracker)
============================================================
- UNIVERSAL App Tracker: Automatically detects ANY application (VS Code, File Explorer,
  Chrome, Notepad, Discord, Terminals, custom tools, games, etc.) without hardcoding!
- Browser & AI Intelligence: Extracts exact website/tab names (ChatGPT, Claude, Gemini, YouTube, etc.)
- Win32 Desktop Binding: Binds to user's interactive 'default' desktop so it never loses focus.
- Session Persistence: Remembers active session across restarts.
- Local HTTP Bridge on 127.0.0.1:48123 for Chrome verification & control.
"""
import sys
import os
import shutil
import ctypes
import json
import threading
import time
import winreg
import urllib.request
from ctypes import wintypes
from http.server import HTTPServer, BaseHTTPRequestHandler
import psutil

# Fix PyInstaller windowed mode NoneType stdout/stderr crash
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w", encoding="utf-8")

def get_install_dir():
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or os.path.expanduser("~")
    return os.path.join(base, "invigilAI")

INSTALL_DIR    = get_install_dir()
INSTALL_PATH   = os.path.join(INSTALL_DIR, "invigilAI-Agent.exe")
SESSION_FILE   = os.path.join(INSTALL_DIR, "active_session.json")
STARTUP_KEY    = r"Software\Microsoft\Windows\CurrentVersion\Run"
PORT           = 48123
MARKER_FILE    = os.path.join(INSTALL_DIR, ".installed")
DESKTOP_ALL    = 0x01FF

def log_debug(msg):
    try:
        os.makedirs(INSTALL_DIR, exist_ok=True)
        with open(os.path.join(INSTALL_DIR, "agent_debug.log"), "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    except Exception:
        pass

# ── Constants ─────────────────────────────────────────────────────────────────
AGENT_NAME     = "invigilAI-Agent"

# ── Win32 API Setup with explicit 64-bit signatures ───────────────────────────
user32   = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

user32.OpenDesktopW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
user32.OpenDesktopW.restype = wintypes.HANDLE
user32.SetThreadDesktop.argtypes = [wintypes.HANDLE]
user32.SetThreadDesktop.restype = wintypes.BOOL

user32.GetForegroundWindow.restype = wintypes.HWND
user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
user32.GetWindowTextLengthW.restype = ctypes.c_int
user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetWindowTextW.restype = ctypes.c_int
user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
user32.GetWindowThreadProcessId.restype = wintypes.DWORD

def ensure_default_desktop():
    try:
        h = user32.OpenDesktopW("default", 0, False, DESKTOP_ALL)
        if h:
            user32.SetThreadDesktop(h)
    except Exception:
        pass

# ── Session state ─────────────────────────────────────────────────────────────
SESSION = {
    "is_monitoring": False,
    "server_url":    "http://localhost:5000",
    "session_id":    "",
    "student_name":  "",
    "roll_no":       "",
    "last_app":      "",
    "last_title":    "",
}

def save_session_state():
    try:
        os.makedirs(INSTALL_DIR, exist_ok=True)
        with open(SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "session_id":   SESSION["session_id"],
                "student_name": SESSION["student_name"],
                "roll_no":      SESSION["roll_no"],
                "server_url":   SESSION["server_url"],
                "is_monitoring": SESSION["is_monitoring"]
            }, f)
    except Exception:
        pass

def load_session_state():
    try:
        if os.path.exists(SESSION_FILE):
            with open(SESSION_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("session_id") and data.get("roll_no"):
                    SESSION["session_id"]    = data.get("session_id", "")
                    SESSION["student_name"]  = data.get("student_name", "")
                    SESSION["roll_no"]       = data.get("roll_no", "")
                    SESSION["server_url"]    = data.get("server_url", "http://localhost:5000")
                    SESSION["is_monitoring"] = data.get("is_monitoring", False)
                    return True
    except Exception:
        pass
    return False

# ── Common Apps Map ───────────────────────────────────────────────────────────
KNOWN_APPS = {
    "explorer.exe":         "File Explorer",
    "code.exe":             "VS Code",
    "chrome.exe":           "Google Chrome",
    "msedge.exe":           "Microsoft Edge",
    "firefox.exe":          "Mozilla Firefox",
    "brave.exe":            "Brave Browser",
    "opera.exe":            "Opera",
    "notepad.exe":          "Notepad",
    "notepadapp.exe":       "Notepad",
    "notepad++.exe":        "Notepad++",
    "sublime_text.exe":     "Sublime Text",
    "pycharm64.exe":        "PyCharm",
    "idea64.exe":           "IntelliJ IDEA",
    "cmd.exe":              "Command Prompt",
    "powershell.exe":       "PowerShell",
    "pwsh.exe":             "PowerShell",
    "windowsterminal.exe":  "Windows Terminal",
    "taskmgr.exe":          "Task Manager",
    "calc.exe":             "Calculator",
    "calculatorapp.exe":    "Calculator",
    "discord.exe":          "Discord",
    "spotify.exe":          "Spotify",
    "whatsapp.exe":         "WhatsApp",
    "telegram.exe":         "Telegram",
    "slack.exe":            "Slack",
    "teams.exe":            "Microsoft Teams",
    "winword.exe":          "Microsoft Word",
    "excel.exe":            "Microsoft Excel",
    "powerpnt.exe":         "Microsoft PowerPoint",
}

def clean_app_name(pname):
    """Dynamically converts ANY process name (e.g. custom_app.exe) into a clean title."""
    if not pname:
        return "Desktop"
    lower = pname.lower()
    if lower in KNOWN_APPS:
        return KNOWN_APPS[lower]
    
    # Generic universal clean: strip .exe and format
    base = os.path.splitext(pname)[0]
    return base.replace("_", " ").replace("-", " ").title()

def is_installed():
    return os.path.exists(MARKER_FILE)

def self_install():
    try:
        os.makedirs(INSTALL_DIR, exist_ok=True)
        src = sys.executable if getattr(sys, 'frozen', False) else os.path.abspath(__file__)
        if os.path.abspath(src).lower() != INSTALL_PATH.lower():
            try:
                shutil.copy2(src, INSTALL_PATH)
            except Exception:
                pass
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, STARTUP_KEY, 0, winreg.KEY_SET_VALUE) as key:
                winreg.SetValueEx(key, AGENT_NAME, 0, winreg.REG_SZ, INSTALL_PATH)
        except Exception:
            pass
        with open(MARKER_FILE, "w") as f:
            f.write("installed")
    except Exception:
        pass

def get_active_window_info():
    """Extract foreground active app name and clean website/tab title for ANY application."""
    ensure_default_desktop()
    try:
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return "Desktop", "Standby"

        raw_title = ""
        length = user32.GetWindowTextLengthW(hwnd)
        if length > 0:
            buf = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buf, length + 1)
            raw_title = buf.value.strip()

        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        
        proc_name = ""
        if pid.value:
            try:
                p = psutil.Process(pid.value)
                proc_name = p.name()
            except Exception:
                proc_name = ""

        # Handle Windows 11 ApplicationFrameHost for UWP apps (Notepad, Calculator, etc.)
        if proc_name.lower() == "applicationframehost.exe":
            lt = raw_title.lower()
            if "notepad" in lt:
                proc_name = "notepad.exe"
            elif "calc" in lt:
                proc_name = "calc.exe"
            elif "settings" in lt:
                proc_name = "settings.exe"

        app_name = clean_app_name(proc_name) if proc_name else "Desktop"

        # If window title is empty (e.g. desktop, taskbar), use the app name
        if not raw_title:
            raw_title = app_name

        # Clean browser and app title suffixes to isolate the exact tab/website
        clean_title = raw_title
        suffixes = [
            " - Google Chrome", " - Chromium", " - Microsoft Edge",
            " - Mozilla Firefox", " - Firefox", " - Brave",
            " - Opera", " - Notepad", " - Visual Studio Code",
            " - Visual Studio", " - Sublime Text", " - PyCharm",
            " - File Explorer"
        ]
        for s in suffixes:
            if clean_title.endswith(s):
                clean_title = clean_title[:-len(s)].strip()
                break

        # Browser Website & AI Intelligence:
        # Detect exact website (ChatGPT, YouTube, Claude, Gemini, etc.)
        lower_app = app_name.lower()
        is_browser = any(b in lower_app for b in ["chrome", "edge", "firefox", "brave", "opera", "browser"])
        if is_browser:
            lower_title = clean_title.lower()
            if "chatgpt" in lower_title:
                app_name = "ChatGPT"
            elif "claude" in lower_title:
                app_name = "Claude AI"
            elif "gemini" in lower_title:
                app_name = "Google Gemini"
            elif "youtube" in lower_title:
                app_name = "YouTube"
            elif "stackoverflow" in lower_title or "stack overflow" in lower_title:
                app_name = "Stack Overflow"
            elif "github" in lower_title:
                app_name = "GitHub"
            elif "whatsapp" in lower_title:
                app_name = "WhatsApp Web"
            elif "discord" in lower_title:
                app_name = "Discord Web"
            elif "invigilai" in lower_title or "exam" in lower_title or "localhost:5173" in lower_title:
                app_name = "Exam Portal"
            else:
                if clean_title:
                    app_name = f"{app_name} ({clean_title[:24]})"

        return app_name, (clean_title or raw_title)
    except Exception:
        return "Desktop", "Standby"

def get_idle_seconds():
    class LII(ctypes.Structure):
        _fields_ = [('cbSize', wintypes.UINT), ('dwTime', wintypes.DWORD)]
    try:
        lii = LII()
        lii.cbSize = ctypes.sizeof(LII)
        if user32.GetLastInputInfo(ctypes.byref(lii)):
            return (kernel32.GetTickCount() - lii.dwTime) / 1000.0
    except Exception:
        pass
    return 0

def send_event(event_type, app_name="", title="", extra=None):
    s = SESSION
    if not s["session_id"] or not s["roll_no"]:
        return
    try:
        payload_dict = {
            "sessionId":   s["session_id"],
            "studentId":   s["roll_no"],
            "studentName": s["student_name"],
            "eventType":   event_type,
            "appName":     app_name,
            "windowTitle": title,
        }
        if extra:
            payload_dict.update(extra)

        payload = json.dumps(payload_dict).encode("utf-8")
        
        targets = []
        if s.get("server_url"):
            clean_surl = s["server_url"].strip().rstrip("/")
            if clean_surl:
                targets.append(clean_surl)
        if "http://localhost:5000" not in targets:
            targets.append("http://localhost:5000")

        for u in targets:
            try:
                base = u.rstrip("/")
                req = urllib.request.Request(
                    f"{base}/api/agent/event",
                    data=payload,
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=4) as res:
                    if res.status == 200:
                        break
            except Exception as e:
                log_debug(f"Failed sending event to {u}: {e}")
                continue
    except Exception:
        pass

def telemetry_loop():
    s = SESSION
    ensure_default_desktop()
    send_event("join", "invigilAI Agent", f"{s['student_name']} ({s['roll_no']}) connected with Universal Agent")

    last_app = ""
    last_title = ""
    last_idle_alert = 0

    while s["is_monitoring"]:
        try:
            app, title = get_active_window_info()
            idle = get_idle_seconds()

            # Ignore transient desktop/system blank states if we already have an app
            if app in ("Desktop", "System") and (not title or title == "Standby") and last_app:
                time.sleep(0.5)
                continue

            # Trigger on ANY application switch or window/tab switch
            if app != last_app or title != last_title:
                last_app = app
                last_title = title
                s["last_app"] = app
                s["last_title"] = title
                send_event("app_switch", app, title, {"idleSeconds": int(idle)})

            # Idle detection alert (> 3 minutes, once per minute)
            if idle > 180 and int(idle) - last_idle_alert >= 60:
                last_idle_alert = int(idle)
                send_event("idle", app, f"{title} (Inactive for {int(idle)}s)", {"idleSeconds": int(idle)})

        except Exception:
            pass

        time.sleep(0.5)

# ─────────────────────────────────────────────────────────────────────────────
# LOCAL HTTP SERVER
# ─────────────────────────────────────────────────────────────────────────────

class AgentHandler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path in ("/ping", "/status"):
            body = json.dumps({
                "status":       "ready",
                "is_monitoring": SESSION["is_monitoring"],
                "student":      SESSION["student_name"],
                "session":      SESSION["session_id"],
                "version":      "3.1.0",
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self._cors()
            self.end_headers()

    def do_POST(self):
        if self.path == "/start_session":
            length = int(self.headers.get("Content-Length", 0))
            try:
                data = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception:
                data = {}

            s = SESSION
            s["is_monitoring"] = False
            time.sleep(0.1)

            raw_url = data.get("serverUrl", "http://localhost:5000") or "http://localhost:5000"
            s["server_url"]    = raw_url.strip().rstrip("/")
            s["session_id"]    = data.get("sessionId", "")
            s["student_name"]  = data.get("name", "")
            s["roll_no"]       = data.get("rollNo", "")
            s["last_app"]      = ""
            s["last_title"]    = ""
            s["is_monitoring"] = True

            save_session_state()
            threading.Thread(target=telemetry_loop, daemon=True).start()

            body = json.dumps({"success": True, "message": "Universal monitoring active"}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)

        elif self.path == "/stop_session":
            SESSION["is_monitoring"] = False
            SESSION["session_id"]    = ""
            SESSION["student_name"]  = ""
            SESSION["roll_no"]       = ""
            save_session_state()

            body = json.dumps({"success": True}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self._cors()
            self.end_headers()

class ReusableHTTPServer(HTTPServer):
    allow_reuse_address = True

def start_http_server():
    log_debug("start_http_server called")
    srv = None
    for attempt in range(15):
        try:
            srv = ReusableHTTPServer(("127.0.0.1", PORT), AgentHandler)
            log_debug(f"Bound to port {PORT} on attempt {attempt}")
            break
        except OSError as e:
            log_debug(f"Attempt {attempt} bind failed: {e}")
            time.sleep(1)

    if srv:
        log_debug("Serving HTTP forever...")
        try:
            srv.serve_forever()
        except Exception as ex:
            log_debug(f"serve_forever crashed: {ex}")
        finally:
            log_debug("serve_forever finished/exited")
    else:
        log_debug("FATAL: Could not bind to port after 15 attempts!")

if __name__ == "__main__":
    log_debug("=== Process started ===")
    try:
        if not is_installed():
            log_debug("Not installed, calling self_install()")
            self_install()
        else:
            log_debug("Already installed")

        if load_session_state() and SESSION["is_monitoring"]:
            log_debug(f"Resuming monitoring for session {SESSION['session_id']}")
            threading.Thread(target=telemetry_loop, daemon=True).start()
        else:
            log_debug("No active session to resume")

        start_http_server()
    except Exception as e:
        log_debug(f"Unhandled exception in __main__: {e}")
        import traceback
        try:
            with open(os.path.join(INSTALL_DIR, "crash.log"), "w", encoding="utf-8") as f:
                traceback.print_exc(file=f)
        except Exception:
            pass


