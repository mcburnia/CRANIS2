<!--
  Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi.mcburnie@gmail.com
-->

# USB Storage Setup (Non-Destructive)

This setup mounts the existing external drive **as-is** and uses it only for CRANIS2 backups/artefacts.

It does **not** format the drive and does **not** remove existing files.

## 1) Create mount point

```bash
sudo mkdir -p /mnt/usb-storage
```

## 2) Add persistent mount entry

Drive detected in this environment:
- Device: `/dev/sdb2`
- Filesystem: `hfsplus`
- UUID: `68297d3b-7961-3406-89a2-40a3575c43e9`

Append this line to `/etc/fstab`:

```bash
UUID=68297d3b-7961-3406-89a2-40a3575c43e9 /mnt/usb-storage hfsplus rw,uid=1000,gid=1000,umask=0022,nofail,x-systemd.automount 0 0
```

## 3) Mount and verify

```bash
sudo mount -a
findmnt /mnt/usb-storage -o SOURCE,TARGET,FSTYPE,OPTIONS
```

If it mounts read-only, Linux is likely protecting a journaled HFS+ volume. In that case, keep it read-only for safety or migrate later to a Linux-native filesystem on a separate disk workflow.

## 4) Initialize CRANIS2 folder structure on the drive

```bash
cd ~/cranis2
./scripts/usb-storage-init.sh /mnt/usb-storage
```

This creates:
- `CRANIS2-storage/artifacts/e2e`
- `CRANIS2-storage/artifacts/vitest`
- `CRANIS2-storage/backups/repo-snapshots`
- `CRANIS2-storage/backups/db-dumps`

## 5) Sync artefacts and repo snapshot

```bash
cd ~/cranis2
./scripts/usb-storage-sync-artifacts.sh /mnt/usb-storage
```

This copies generated test artefacts and writes a timestamped repository snapshot tarball.
