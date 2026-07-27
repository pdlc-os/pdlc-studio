# 🌐 PDLC Studio

[![npm Version](https://img.shields.io/npm/v/pdlc-studio)](https://www.npmjs.com/package/pdlc-studio)
[![npm Downloads](https://img.shields.io/npm/dt/pdlc-studio)](https://www.npmjs.com/package/pdlc-studio)
[![License](https://img.shields.io/github/license/pdlc-os/pdlc-studio)](https://github.com/pdlc-os/pdlc-studio/blob/main/LICENSE)
[![CI](https://github.com/pdlc-os/pdlc-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/pdlc-os/pdlc-studio/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/pdlc-os/pdlc-studio)](https://github.com/pdlc-os/pdlc-studio/releases)

> **A modern web interface for Claude Code CLI** - Transform your command-line coding experience into an intuitive web-based chat interface

[🎬 **View Demo**](https://github.com/user-attachments/assets/33e769b0-b17e-470b-8163-c71ef186b5af)

## 📱 Screenshots

<div align="center">

| Desktop Interface                                                                                                                                  | Mobile Experience                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| <img src="https://github.com/pdlc-os/pdlc-studio/raw/main/docs/images/screenshot-desktop-basic-dark.png" alt="Desktop Interface" width="600"> | <img src="https://github.com/pdlc-os/pdlc-studio/raw/main/docs/images/screenshot-mobile-basic-dark.png" alt="Mobile Interface" width="250"> |
| _Chat-based coding interface with instant responses and ready input field_                                                                         | _Mobile-optimized chat experience with touch-friendly design_                                                                                    |

</div>

<details>
<summary><strong>💡 Light Theme Screenshots</strong></summary>

<div align="center">

| Desktop (Light)                                                                                                                                 | Mobile (Light)                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| <img src="https://github.com/pdlc-os/pdlc-studio/raw/main/docs/images/screenshot-desktop-basic.png" alt="Desktop Light Theme" width="600"> | <img src="https://github.com/pdlc-os/pdlc-studio/raw/main/docs/images/screenshot-mobile-basic.png" alt="Mobile Light Theme" width="250"> |
| _Clean light interface for daytime coding sessions_                                                                                             | _iPhone SE optimized light theme interface_                                                                                                   |

</div>

</details>

<details>
<summary><strong>🔧 Advanced Features</strong></summary>

<div align="center">

| Desktop Permission Dialog                                                                                                                                   | Mobile Permission Dialog                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <img src="https://github.com/pdlc-os/pdlc-studio/raw/main/docs/images/screenshot-desktop-fileOperations-dark.png" alt="Permission Dialog" width="600"> | <img src="https://github.com/pdlc-os/pdlc-studio/raw/main/docs/images/screenshot-mobile-fileOperations-dark.png" alt="Mobile Permission" width="250"> |
| _Secure tool access with granular permission controls and clear approval workflow_                                                                          | _Touch-optimized permission interface for mobile devices_                                                                                                  |

</div>

</details>

---

## 📑 Table of Contents

- [✨ Why PDLC Studio?](#-why-pdlc-studio)
- [🚀 Quick Start](#-quick-start)
- [⚙️ CLI Options](#-cli-options)
- [🚨 Troubleshooting](#-troubleshooting)
- [🔧 Development](#-development)
- [🔒 Security Considerations](#-security-considerations)
- [📚 Documentation](#-documentation)
- [❓ FAQ](#-faq)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Why PDLC Studio?

**Transform the way you interact with Claude Code**

Instead of being limited to command-line interactions, PDLC Studio brings you:

| CLI Experience                | Web UI Experience            |
| ----------------------------- | ---------------------------- |
| ⌨️ Terminal only              | 🌐 Any device with a browser |
| 📱 Desktop bound              | 📱 Mobile-friendly interface |
| 📝 Plain text output          | 🎨 Rich formatted responses  |
| 🗂️ Manual directory switching | 📁 Visual project selection  |

### 🎯 Key Features

- **📋 Permission Mode Switching** - Toggle between normal and plan mode execution
- **🔄 Real-time streaming responses** - Live Claude Code output in chat interface
- **📁 Project directory selection** - Visual project picker for context-aware sessions
- **💬 Conversation history** - Browse and restore previous chat sessions
- **🛠️ Tool permission management** - Granular control over Claude's tool access
- **🎨 Dark/light theme support** - Automatic system preference detection
- **📱 Mobile-responsive design** - Touch-optimized interface for any device

---

## 🚀 Quick Start

Get up and running in under 2 minutes:

### Option 1: npm Package (Recommended)

```bash
# Install globally via npm
npm install -g pdlc-studio

# Start the server
pdlc-studio

# Open browser to http://localhost:8080
```

### Option 2: Binary Release

```bash
# Download and run (macOS ARM64 example)
curl -LO https://github.com/pdlc-os/pdlc-studio/releases/latest/download/pdlc-studio-macos-arm64
chmod +x pdlc-studio-macos-arm64
./pdlc-studio-macos-arm64

# Open browser to http://localhost:8080
```

### Option 3: Development Mode

```bash
# Backend (choose one)
cd backend && deno task dev    # Deno runtime
cd backend && npm run dev      # Node.js runtime

# Frontend (new terminal)
cd frontend && npm run dev

# Open browser to http://localhost:3000
```

### Prerequisites

- ✅ **Claude CLI** installed and authenticated ([Get it here](https://github.com/anthropics/claude-code))
- ✅ **Node.js >=22.9.0** (for npm installation) or **Deno** (for development)
- ✅ **Modern browser** (Chrome, Firefox, Safari, Edge)

---

## ⚙️ CLI Options

The backend server supports the following command-line options:

| Option                 | Description                                               | Default     |
| ---------------------- | --------------------------------------------------------- | ----------- |
| `-p, --port <port>`    | Port to listen on                                         | 8080        |
| `--host <host>`        | Host address to bind to (use 0.0.0.0 for all interfaces)  | 127.0.0.1   |
| `--claude-path <path>` | Path to claude executable (overrides automatic detection) | Auto-detect |
| `-d, --debug`          | Enable debug mode                                         | false       |
| `-h, --help`           | Show help message                                         | -           |
| `-v, --version`        | Show version                                              | -           |

### Environment Variables

- `PORT` - Same as `--port`
- `DEBUG` - Same as `--debug`

### Examples

```bash
# Default (localhost:8080)
pdlc-studio

# Custom port
pdlc-studio --port 3000

# Bind to all interfaces (accessible from network)
pdlc-studio --host 0.0.0.0 --port 9000

# Enable debug mode
pdlc-studio --debug

# Custom Claude CLI path (for non-standard installations or aliases)
pdlc-studio --claude-path /path/to/claude

# Using environment variables
PORT=9000 DEBUG=true pdlc-studio
```

---

## 🚨 Troubleshooting

### Claude CLI Path Detection Issues

If you encounter "Claude Code process exited with code 1" or similar errors, this typically indicates Claude CLI path detection failure.

**Quick Solution:**

```bash
pdlc-studio --claude-path "$(which claude)"
```

**Common scenarios requiring explicit path specification:**

- **Node.js environment managers** (Volta, asdf, nvm, etc.)
- **Custom installation locations**
- **Shell aliases or wrapper scripts**

**Environment-specific commands:**

```bash
# For Volta users
pdlc-studio --claude-path "$(volta which claude)"

# For asdf users
pdlc-studio --claude-path "$(asdf which claude)"
```

**Native Binary Installation:**
Supported. Script path detection may fail and show warnings, but the application will work correctly as long as the Claude executable path is valid.

**Debug Mode:**
Use `--debug` flag for detailed error information:

```bash
pdlc-studio --debug
```

---

## 🔧 Development

### Setup

```bash
# Clone repository
git clone https://github.com/pdlc-os/pdlc-studio.git
cd pdlc-studio


# Start backend (choose one)
cd backend
deno task dev    # Deno runtime
# OR
npm run dev      # Node.js runtime

# Start frontend (new terminal)
cd frontend
npm run dev
```

### Port Configuration

Create `.env` file in project root:

```bash
echo "PORT=9000" > .env
```

Both dev tasks load the root `.env` themselves:

```bash
# Backend
cd backend
deno task dev    # Deno
npm run dev      # Node.js

# Frontend (uses Vite's built-in .env support)
cd frontend
npm run dev
```

Alternative: Set environment variables directly:

```bash
PORT=9000 deno task dev     # Deno
PORT=9000 npm run dev       # Node.js
```

---

## 🔒 Security Considerations

**Important**: This tool executes Claude CLI locally and provides web access to it.

### ✅ Safe Usage Patterns

- **🏠 Local development**: Default localhost access
- **📱 Personal network**: LAN access from your own devices

### ⚠️ Security Notes

- **Permission prompts are disabled by default**: sessions start in `bypassPermissions`, so Claude runs every tool — including shell commands via `Bash` — without asking. Cycle the mode indicator in the chat input (or `Ctrl+Shift+M`) to switch to `normal mode` for per-tool approval. To change the default, see "Permission Mode Switching" in `CLAUDE.md`.
- **No authentication**: Currently no built-in auth mechanism
- **System access**: Claude can read/write files in selected projects
- **Network exposure**: Configurable but requires careful consideration

> [!CAUTION]
> The combination of the two notes above matters: with no authentication and prompts disabled, anyone who can reach the port can run commands on this machine as you. Keep the default `127.0.0.1` bind, or put an authenticating proxy in front of it before using `--host 0.0.0.0`.

### 🛡️ Best Practices

```bash
# Local only (recommended)
pdlc-studio --port 8080

# Network access (trusted networks only)
pdlc-studio --port 8080 --host 0.0.0.0
```

**Never expose to public internet without proper security measures.**

---

## 📚 Documentation

For comprehensive technical documentation, see [CLAUDE.md](./CLAUDE.md) which covers:

- Architecture overview and design decisions
- Detailed development setup instructions
- API reference and message types

---

## ❓ FAQ

<details>
<summary><strong>Q: Do I need Claude API access?</strong></summary>

Yes, you need the Claude CLI tool installed and authenticated. The web UI is a frontend for the existing Claude CLI.

</details>

<details>
<summary><strong>Q: Can I use this on mobile?</strong></summary>

Yes! The web interface is fully responsive and works great on mobile devices when connected to your local network.

</details>

<details>
<summary><strong>Q: Is my code safe?</strong></summary>

Yes, everything runs locally. No data is sent to external servers except Claude's normal API calls through the CLI.

</details>

<details>
<summary><strong>Q: Can I deploy this to a server?</strong></summary>

While technically possible, it's designed for local use. If deploying remotely, ensure proper authentication and security measures.

</details>

<details>
<summary><strong>Q: How do I update?</strong></summary>

Download the latest binary from releases or pull the latest code for development mode.

</details>

<details>
<summary><strong>Q: What if Claude CLI isn't found or I get "process exited with code 1"?</strong></summary>

These errors typically indicate Claude CLI path detection issues. See the [Troubleshooting](#-troubleshooting) section for detailed solutions including environment manager workarounds and debug steps.

</details>

---

## 🔗 Related Projects

**Alternative PDLC Studios:**

- **[siteboon/claudecodeui](https://github.com/siteboon/claudecodeui)**
  - A popular web-based Claude Code interface with mobile and remote management focus
  - Offers additional features for project and session management
  - Great alternative if you need more advanced remote access capabilities

Both projects aim to make Claude Code more accessible through web interfaces, each with their own strengths and approach.

---

## 🤝 Contributing

We welcome contributions! Please see our [development setup](#-development) and feel free to:

- 🐛 Report bugs
- ✨ Suggest features
- 📝 Improve documentation
- 🔧 Submit pull requests

**Fun fact**: This project is almost entirely written and committed by Claude Code itself! 🤖  
We'd love to see pull requests from your Claude Code sessions too :)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Made with ❤️ for the Claude Code community**

[⭐ Star this repo](https://github.com/pdlc-os/pdlc-studio) • [🐛 Report issues](https://github.com/pdlc-os/pdlc-studio/issues) • [💬 Discussions](https://github.com/pdlc-os/pdlc-studio/discussions)

</div>
