# macOS Local Network Permission Bug — Claude Code CLI

## The Problem

Claude Code's CLI binary cannot access devices on the local network from macOS. SSH, ping, curl, and any TCP/UDP connection to LAN devices (e.g., 192.168.1.107) returns `errno 65: No route to host`. Internet access and connections to the default gateway (router) work fine.

This means Claude Code cannot directly SSH to the development server (Mac Mini at 192.168.1.107) on the same subnet.

## Root Cause

The Claude Code CLI binary (`~/Library/Application Support/Claude/claude-code/<version>/claude`) is a standalone Mach-O executable. It is code-signed as `com.anthropic.claude-code` but it is **not** a proper `.app` bundle and has **no embedded Info.plist**.

macOS requires `NSLocalNetworkUsageDescription` in an Info.plist to correctly grant Local Network permissions via the TCC (Transparency, Consent, and Control) framework. Without it, the `nehelper` daemon cannot properly resolve the binary's identity and denies access even when the System Settings toggle is set to "on".

### Evidence from system logs

Running `log stream --predicate 'subsystem == "com.apple.networkd" OR subsystem == "com.apple.network"'` while triggering an SSH connection from Claude Code reveals:

```
UserEventAgent: (com.apple.networkextension) Got local network blocked notification: pid: 2449, uuid: 16498C8A-1897-307F-AD07-860AF071CE77, bundle_id: (null)
nehelper: [com.apple.networkextension:] Draining local network replies for TEAMID.com.anthropic.claude-code with allowed: 0
```

- `bundle_id: (null)` -- macOS cannot resolve the binary's bundle identity
- `allowed: 0` -- access is explicitly denied despite the toggle being "on"

### Process chain

```
Claude.app (com.anthropic.claudefordesktop, PID 1334)
  -> disclaimer (identifier: "disclaimer", no bundle ID, PID 1376)
    -> claude CLI (com.anthropic.claude-code, no Info.plist, PID 1377)
      -> /bin/zsh (shell executing commands, PID 1736)
        -> ssh, ping, curl, etc.
```

### Code signing details

```
Identifier=com.anthropic.claude-code
Format=Mach-O thin (arm64)
Flags=0x10000(runtime)
Info.plist=not bound        <-- THIS IS THE PROBLEM
TeamIdentifier=Q6L2SF6YDW

Entitlements:
  com.apple.security.cs.allow-jit = true
  com.apple.security.cs.allow-unsigned-executable-memory = true
  com.apple.security.cs.disable-library-validation = true
```

No `com.apple.security.network.client` or local network entitlements present.

## What We Tried (in order)

### 1. Toggle Local Network permission in System Settings
- System Settings -> Privacy & Security -> Local Network
- Toggled "Claude Terminal" to on
- **Result:** Toggle kept reverting to off on every Claude Code restart

### 2. tccutil reset for the desktop app
```bash
tccutil reset SystemPolicyNetworkVolumes com.anthropic.claudefordesktop
```
- **Result:** Successfully reset. Toggle stopped reverting to off. But connections still blocked.

### 3. tccutil reset for the CLI binary
```bash
tccutil reset SystemPolicyNetworkVolumes com.anthropic.claude-code
```
- **Result:** `No such bundle identifier` -- tccutil can't find it because it's not a .app bundle

### 4. tccutil reset All (nuclear option)
```bash
tccutil reset All
```
- **Result:** Reset all privacy permissions. No improvement. No fresh Local Network prompt appeared on relaunch.

### 5. Disabled ProtonVPN WireGuard network extension
- Found via `systemextensionsctl list` that ProtonVPN WireGuard extension was still active
- Removed via System Settings -> General -> Login Items & Extensions -> Network Extensions
- **Result:** Extension removed but connections still blocked

### 6. Multiple full reboots
- Full shutdown and restart (not just restart)
- **Result:** No improvement. No Local Network permission prompt appeared on Claude Code launch.

### 7. Complete uninstall and reinstall of Claude Code
- Deleted `/Applications/Claude.app`
- Deleted `~/Library/Application Support/Claude/claude-code`
- Downloaded and installed fresh from claude.ai/download
- **Result:** No Local Network prompt appeared on first launch. Connection still blocked.

### 8. Killed tccd daemon (TCC permission daemon)
```bash
sudo killall tccd
```
- **Result:** Daemon restarted automatically. No improvement.

### 9. Killed symptomsd daemon (network filtering daemon)
```bash
sudo killall symptomsd
```
- **Result:** No improvement.

### 10. Checked packet filter rules
```bash
sudo pfctl -sr
```
- **Result:** Only default Apple anchors. No blocking rules.

### 11. Checked for configuration profiles
```bash
profiles list
```
- **Result:** No configuration profiles installed.

### 12. Read TCC database directly
```bash
sqlite3 "/Library/Application Support/com.apple.TCC/TCC.db" "SELECT * FROM access WHERE service='kTCCServiceLocalNetwork';"
```
- **Result:** Authorization denied. SIP protects the TCC database even with sudo.

### 13. System log analysis (THE DIAGNOSTIC THAT FOUND THE CAUSE)
```bash
log stream --predicate 'subsystem == "com.apple.networkd" OR subsystem == "com.apple.network"' --level debug
```
- **Result:** Revealed `bundle_id: (null)` and `allowed: 0` -- confirmed this is an Anthropic bug, not a user configuration issue.

## The Workaround

Since this is a bug in Claude Code's binary packaging (missing Info.plist), the fix must come from Anthropic. In the meantime, we use an SSH tunnel:

### Setup (run in user's own terminal, not Claude Code)

**Step 1:** Start the SSH tunnel (forwards localhost:2222 to the server's SSH port):
```bash
ssh -N -L 2222:localhost:22 mcburnia@192.168.1.107
```

**Step 2:** Load the SSH key into the agent (key has a passphrase):
```bash
ssh-add ~/.ssh/id_ed25519
```

Both commands must be run in the user's own terminal (Terminal.app or iTerm), which has proper Local Network permissions.

### Usage (Claude Code)

Claude Code connects to the server via the tunnel instead of directly:
```bash
ssh -p 2222 mcburnia@localhost 'command here'
```

All SSH commands use `-p 2222 mcburnia@localhost` instead of `mcburnia@192.168.1.107`.

SCP also works through the tunnel:
```bash
scp -P 2222 localfile mcburnia@localhost:~/cranis2/path/
```

### Why this works

The user's terminal (Terminal.app) has proper Local Network permissions because it's a proper `.app` bundle with an Info.plist. The SSH tunnel runs in the user's terminal process, so it can connect to 192.168.1.107 directly. Claude Code then connects to `localhost:2222`, which is a loopback connection (not a local network connection), so it bypasses the Local Network permission entirely.

## Bug Report

Filed at: https://github.com/anthropics/claude-code/issues

**Summary:** The Claude Code CLI binary needs an embedded Info.plist with `NSLocalNetworkUsageDescription`, or it needs to be distributed as a proper `.app` bundle, so that macOS TCC can correctly associate and enforce Local Network permissions.

## Environment

- macOS 15.4 (Darwin 24.6.0), Apple Silicon (MacBook Pro)
- Claude Desktop 1.1.4010
- Claude Code CLI 2.1.49
- Server: Mac Mini running Ubuntu Linux at 192.168.1.107
- Both machines on same subnet (192.168.1.0/24)
- Date discovered: 2026-02-22
