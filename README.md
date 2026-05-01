<p align="center">
  <img src="https://img.shields.io/badge/Platform-macOS%20|%20Linux%20|%20Windows-blue?style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/badge/ADB-34.0+-green?style=for-the-badge&logo=android" alt="ADB" />
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/WebUSB-Chrome%20|%20Edge-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="WebUSB" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License" />
</p>

# 🤖 DroidPurge — ADB App Manager

A beautiful, modern web interface for managing Android applications via ADB. Browse installed apps, search packages, and **mass-uninstall** applications from any connected Android device.

**🌐 Works in two modes:**
- **☁️ Cloud / WebUSB** — Visit [adb-app-manager.vercel.app](https://adb-app-manager.vercel.app), plug in your phone, and manage apps directly from Chrome/Edge. Zero installs.
- **💻 Local / Express** — Clone & run locally for full ADB access from any browser.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔌 **WebUSB (Browser-Native ADB)** | Connect to your Android device directly from Chrome/Edge — no server needed |
| 📱 **Device Detection** | Auto-detects all connected Android devices with model info & status |
| 🔄 **Multi-Device Support** | Switch between multiple connected phones/tablets seamlessly |
| 📦 **App Listing** | View all user-installed or system apps |
| 🔍 **Live Search** | Instantly filter packages by name as you type |
| ☑️ **Batch Selection** | Select All / Deselect All with individual checkboxes |
| 🗑️ **Mass Uninstall** | Remove multiple apps at once with a single click |
| ⚠️ **Confirmation Modal** | Safety confirmation dialog before any destructive action |
| 📊 **Results Dashboard** | Clear success/failure report after uninstall operations |
| 🎨 **Premium Dark UI** | Glassmorphism, micro-animations, and responsive design |

---

## 🌐 Use Online (WebUSB — No Install)

1. Open **[adb-app-manager.vercel.app](https://adb-app-manager.vercel.app)** in **Chrome** or **Edge**
2. Enable **USB Debugging** on your Android phone
3. Plug in your phone via USB
4. Click **"Connect Android Device"** and select your device in the browser popup
5. Accept the USB debugging prompt on your phone
6. Browse & uninstall apps!

> ⚠️ **Important:** If you get a "device claimed" error, run `adb kill-server` on your computer first (the native ADB daemon may be holding the USB connection).

> 💡 **Browser requirement:** WebUSB requires a Chromium-based browser (Chrome, Edge, Brave). Firefox/Safari are not supported.

---

## 💻 Run Locally (Full ADB Mode)

### Prerequisites

1. **Node.js** (v18 or higher) — [Download](https://nodejs.org/)
2. **ADB** (Android Debug Bridge) — Install via:
   ```bash
   # macOS (Homebrew)
   brew install android-platform-tools

   # Ubuntu/Debian
   sudo apt install adb

   # Windows (Scoop)
   scoop install adb
   ```
3. **USB Debugging** enabled on your Android device:
   - Go to `Settings → About Phone → Tap "Build Number" 7 times`
   - Then `Settings → Developer Options → Enable USB Debugging`

### Installation

```bash
# Clone the repository
git clone https://github.com/atul573/droidpurge.git
cd droidpurge

# Install dependencies
npm install

# Start the server
npm start
```

Open **http://localhost:3000** in your browser.

### One-liner

```bash
git clone https://github.com/atul573/droidpurge.git && cd droidpurge && npm install && npm start
```

---

## 📖 Usage Guide

### 1. Connect Your Device

**WebUSB (cloud):** Click "Connect Android Device" → select in popup → accept on phone.

**Local:** Plug in via USB. The app auto-detects connected devices.

### 2. Select Device

Click on a device card to select it.

### 3. Browse Apps

- **User Apps** — Shows only third-party installed apps (default)
- **All Apps** — Shows system + user apps (use with caution)

### 4. Search & Select

Use the search bar to filter packages. Select apps individually or use **Select All**.

### 5. Mass Uninstall

Click the red **"Uninstall Selected"** button → confirm in the modal → done!

> ⚠️ **Warning:** Uninstalling system apps (in "All Apps" mode) uses `pm uninstall -k --user 0` which disables them for the current user. This can be reversed by factory resetting. Be careful with system apps.

---

## 🏗️ Architecture

```
droidpurge/
├── server.js           # Express backend — ADB command bridge (local mode)
├── public/
│   ├── index.html      # Main HTML page
│   ├── style.css       # Premium dark theme CSS
│   ├── webadb.js       # WebUSB ADB protocol implementation (browser mode)
│   └── app.js          # Client-side logic (dual-mode: WebUSB + API)
├── package.json
├── vercel.json         # Vercel deployment config
├── .gitignore
├── LICENSE
└── README.md
```

### How It Works

**WebUSB Mode (Cloud/Browser):**
```
Browser → WebUSB API → USB → Android Device
         (webadb.js implements ADB protocol)
```

**Local Mode (Express):**
```
Browser → Express API → ADB CLI → USB → Android Device
         (server.js bridges HTTP to ADB commands)
```

### API Endpoints (Local Mode Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/devices` | List connected ADB devices |
| `GET` | `/api/packages?serial=XXX` | List user-installed packages |
| `GET` | `/api/packages/all?serial=XXX` | List all packages (system + user) |
| `POST` | `/api/uninstall` | Uninstall user packages (body: `{serial, packages[]}`) |
| `POST` | `/api/uninstall-system` | Uninstall system packages for user 0 |

---

## 🛠️ Tech Stack

- **WebUSB:** Browser-native USB communication (Chrome/Edge)
- **Backend:** Node.js + Express (local mode)
- **Frontend:** Vanilla HTML/CSS/JS
- **Styling:** Custom CSS with glassmorphism, CSS Grid, animations
- **Typography:** [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts)
- **Device Interface:** ADB protocol (WebUSB) / ADB CLI (local)

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API) for browser-native USB access
- [Android Debug Bridge (ADB)](https://developer.android.com/tools/adb) by Google
- [Inter Typeface](https://rsms.me/inter/) by Rasmus Andersson
- Built with ❤️ for the Android community

---

<p align="center">
  <strong>Star ⭐ this repo if you found it useful!</strong>
</p>
