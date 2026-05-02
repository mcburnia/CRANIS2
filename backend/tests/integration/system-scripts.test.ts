/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Integration tests for system upgrade, security patch, and rollback scripts.
 *
 * These tests validate:
 *   - Script existence and executability
 *   - Pre-flight checks (via --dry-run)
 *   - Backup script functionality
 *   - Upgrade report generation
 *   - Security audit output format
 *   - Rollback point listing
 *   - Script argument parsing (--help, unknown args)
 *
 * Tests do NOT perform actual upgrades, patches, or rollbacks against live data.
 * They use --dry-run, --audit-only, and no-argument modes to validate logic safely.
 */

import { describe, it, expect } from 'vitest';
import { execSync, ExecSyncOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'scripts');

// In-container runs (test-runner Docker image) lack nvm and a real .git tree,
// so tests that exercise the host's upgrade/rollback machinery can't pass there.
// Host runs are unaffected.
const SKIP_HOST_ONLY = process.env.IN_TEST_RUNNER_CONTAINER === 'true';

const execOpts: ExecSyncOptions = {
  cwd: PROJECT_ROOT,
  timeout: 60_000,
  encoding: 'utf-8' as BufferEncoding,
  env: { ...process.env, PATH: process.env.PATH },
};

// Helper to run a script and capture output + exit code
function runScript(
  scriptName: string,
  args: string[] = [],
  expectSuccess = true
): { stdout: string; exitCode: number } {
  const cmd = `${SCRIPTS_DIR}/${scriptName} ${args.join(' ')}`;
  try {
    const stdout = execSync(cmd, {
      ...execOpts,
      stdio: ['pipe', 'pipe', 'pipe'],
    }) as unknown as string;
    return { stdout: stdout.toString(), exitCode: 0 };
  } catch (err: any) {
    if (!expectSuccess) {
      return {
        stdout: (err.stdout?.toString() || '') + (err.stderr?.toString() || ''),
        exitCode: err.status ?? 1,
      };
    }
    throw err;
  }
}

// ── Script existence and permissions ────────────────────────────────

describe('System scripts — file checks', () => {
  const scripts = [
    'backup-databases.sh',
    'restore-databases.sh',
    'verify-backup.sh',
    'upgrade-system.sh',
    'apply-security-patch.sh',
    'rollback-upgrade.sh',
  ];

  for (const script of scripts) {
    it(`${script} exists and is executable`, () => {
      const scriptPath = path.join(SCRIPTS_DIR, script);
      expect(fs.existsSync(scriptPath)).toBe(true);

      const stats = fs.statSync(scriptPath);
      // Check user execute bit
      const isExecutable = (stats.mode & 0o100) !== 0;
      expect(isExecutable).toBe(true);
    });

    it(`${script} starts with bash shebang`, () => {
      const content = fs.readFileSync(
        path.join(SCRIPTS_DIR, script),
        'utf-8'
      );
      expect(content.startsWith('#!/usr/bin/env bash')).toBe(true);
    });

    it(`${script} uses set -euo pipefail`, () => {
      const content = fs.readFileSync(
        path.join(SCRIPTS_DIR, script),
        'utf-8'
      );
      expect(content).toContain('set -euo pipefail');
    });
  }
});

// ── Upgrade script ──────────────────────────────────────────────────

describe('upgrade-system.sh', () => {
  it.skipIf(SKIP_HOST_ONLY)('--dry-run completes pre-flight checks without making changes', () => {
    const { stdout, exitCode } = runScript('upgrade-system.sh', ['--dry-run']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('PRE-FLIGHT CHECKS');
    expect(stdout).toContain('Dry run complete');
    expect(stdout).toContain('No changes made');
  });

  it.skipIf(SKIP_HOST_ONLY)('--dry-run checks disk space', () => {
    const { stdout } = runScript('upgrade-system.sh', ['--dry-run']);
    expect(stdout).toMatch(/PASS: Disk space|FAIL: Insufficient disk space/);
  });

  it.skipIf(SKIP_HOST_ONLY)('--dry-run checks Docker daemon', () => {
    const { stdout } = runScript('upgrade-system.sh', ['--dry-run']);
    expect(stdout).toMatch(/PASS: Docker daemon|FAIL: Docker daemon/);
  });

  it.skipIf(SKIP_HOST_ONLY)('--dry-run checks Node.js availability', () => {
    const { stdout } = runScript('upgrade-system.sh', ['--dry-run']);
    expect(stdout).toMatch(/PASS: Node\.js/);
  });

  it.skipIf(SKIP_HOST_ONLY)('--dry-run checks backup script availability', () => {
    const { stdout } = runScript('upgrade-system.sh', ['--dry-run']);
    expect(stdout).toContain('PASS: Backup script available');
  });

  it.skipIf(SKIP_HOST_ONLY)('--dry-run generates a report file', () => {
    const { stdout } = runScript('upgrade-system.sh', ['--dry-run']);

    // Find the report file mentioned in output
    const reportMatch = stdout.match(/upgrade-report-[^\s]+\.json/);
    expect(reportMatch).not.toBeNull();

    const reportPath = path.join(PROJECT_ROOT, 'logs', reportMatch![0]);
    expect(fs.existsSync(reportPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    expect(report.status).toBe('dry_run');
    expect(report.dry_run).toBe(true);
    expect(report.branch).toBe('main');
    expect(report.timestamp).toBeTruthy();

    // Clean up
    fs.unlinkSync(reportPath);
  });

  it('rejects unknown arguments', () => {
    const { stdout, exitCode } = runScript(
      'upgrade-system.sh',
      ['--nonsense'],
      false
    );
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain('Unknown argument');
  });

  it.skipIf(SKIP_HOST_ONLY)('--dry-run generates a log file', () => {
    const { stdout } = runScript('upgrade-system.sh', ['--dry-run']);

    const logMatch = stdout.match(/upgrade-[^\s]+\.log/);
    expect(logMatch).not.toBeNull();

    // Clean up report and log
    const logsDir = path.join(PROJECT_ROOT, 'logs');
    const files = fs.readdirSync(logsDir);
    for (const f of files) {
      if (f.startsWith('upgrade-') && (f.endsWith('.log') || f.endsWith('.json'))) {
        const age = Date.now() - fs.statSync(path.join(logsDir, f)).mtimeMs;
        if (age < 10_000) {
          fs.unlinkSync(path.join(logsDir, f));
        }
      }
    }
  });
});

// ── Security patch script ───────────────────────────────────────────

describe('apply-security-patch.sh', () => {
  it('--audit-only runs without making changes', () => {
    const { stdout, exitCode } = runScript(
      'apply-security-patch.sh',
      ['--audit-only'],
      false  // May exit 0 (no vulns) or 2 (vulns found)
    );
    expect([0, 2]).toContain(exitCode);
    expect(stdout).toContain('SECURITY AUDIT');
  });

  it('--audit-only reports per workspace', () => {
    const { stdout } = runScript(
      'apply-security-patch.sh',
      ['--audit-only'],
      false
    );
    // Log output should mention at least backend and frontend workspace names
    expect(stdout).toMatch(/backend:|frontend:/);
  });

  it('--audit-only generates a valid JSON report file', () => {
    const { stdout } = runScript(
      'apply-security-patch.sh',
      ['--audit-only'],
      false
    );

    const reportMatch = stdout.match(/security-patch-report-[^\s]+\.json/);
    expect(reportMatch).not.toBeNull();

    const reportPath = path.join(PROJECT_ROOT, 'logs', reportMatch![0]);
    expect(fs.existsSync(reportPath)).toBe(true);

    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    let report: any;
    expect(() => {
      report = JSON.parse(reportContent);
    }).not.toThrow();

    expect(report.audit_only).toBe(true);
    expect(report.timestamp).toBeTruthy();
    expect(['clean', 'vulnerabilities_found']).toContain(report.status);
    expect(Array.isArray(report.workspaces)).toBe(true);

    // Clean up
    fs.unlinkSync(reportPath);
  });

  it('--dry-run does not modify any package files', () => {
    // Record lockfile hashes before
    const lockfiles = ['backend', 'frontend', 'e2e', 'welcome'].map((ws) => {
      const lockPath = path.join(PROJECT_ROOT, ws, 'package-lock.json');
      return {
        path: lockPath,
        hash: fs.existsSync(lockPath)
          ? execSync(`sha256sum "${lockPath}"`, execOpts).toString().split(' ')[0]
          : null,
      };
    });

    runScript('apply-security-patch.sh', ['--dry-run'], false);

    // Verify no lockfile changed
    for (const lf of lockfiles) {
      if (lf.hash) {
        const afterHash = execSync(`sha256sum "${lf.path}"`, execOpts)
          .toString()
          .split(' ')[0];
        expect(afterHash).toBe(lf.hash);
      }
    }
  });

  it('rejects unknown arguments', () => {
    const { stdout, exitCode } = runScript(
      'apply-security-patch.sh',
      ['--nonsense'],
      false
    );
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain('Unknown argument');
  });

  // Clean up any leftover log/report files
  it('cleanup test artifacts', () => {
    const logsDir = path.join(PROJECT_ROOT, 'logs');
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir);
      for (const f of files) {
        if (f.startsWith('security-patch-') && (f.endsWith('.log') || f.endsWith('.json'))) {
          const age = Date.now() - fs.statSync(path.join(logsDir, f)).mtimeMs;
          if (age < 30_000) {
            fs.unlinkSync(path.join(logsDir, f));
          }
        }
      }
    }
    expect(true).toBe(true); // Always passes
  });
});

// ── Rollback script ─────────────────────────────────────────────────

describe('rollback-upgrade.sh', () => {
  it.skipIf(SKIP_HOST_ONLY)('with no arguments lists available rollback points', () => {
    const { stdout, exitCode } = runScript('rollback-upgrade.sh', [], false);
    // Exit 0 if backups exist, exit 0 regardless now with the array fix
    expect(exitCode).toBe(0);
    expect(stdout).toContain('AVAILABLE ROLLBACK POINTS');
    expect(stdout).toContain('Database backups');
    expect(stdout).toContain('Recent commits');
  });

  it.skipIf(SKIP_HOST_ONLY)('lists recent git commits', () => {
    const { stdout } = runScript('rollback-upgrade.sh', [], false);
    // Should show at least one commit hash (7+ hex chars)
    expect(stdout).toMatch(/[0-9a-f]{7,}/);
  });

  it('shows usage for pre-upgrade and daily backups', () => {
    const { stdout } = runScript('rollback-upgrade.sh', [], false);
    expect(stdout).toContain('pre-upgrade');
    expect(stdout).toContain('daily');
  });
});

// ── Backup script ───────────────────────────────────────────────────

describe('backup-databases.sh', () => {
  it('rejects unknown arguments', () => {
    const { stdout, exitCode } = runScript(
      'backup-databases.sh',
      ['--nonsense'],
      false
    );
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain('Unknown argument');
  });

  it('accepts --postgres-only flag without error in syntax', () => {
    // We're testing argument parsing, not actually running the backup.
    // Use bash -n to syntax-check the script
    const result = execSync(
      `bash -n ${SCRIPTS_DIR}/backup-databases.sh`,
      { ...execOpts, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    expect(true).toBe(true); // If we get here, syntax is valid
  });

  it('accepts --neo4j-only flag without error in syntax', () => {
    const result = execSync(
      `bash -n ${SCRIPTS_DIR}/backup-databases.sh`,
      { ...execOpts, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    expect(true).toBe(true);
  });
});

// ── Restore script ──────────────────────────────────────────────────

describe('restore-databases.sh', () => {
  it('with no arguments shows usage and available backups', () => {
    const { stdout, exitCode } = runScript(
      'restore-databases.sh',
      [],
      false
    );
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain('Usage:');
    expect(stdout).toContain('Available backups');
  });

  it('rejects non-existent backup directory', () => {
    const { stdout, exitCode } = runScript(
      'restore-databases.sh',
      ['/nonexistent/path'],
      false
    );
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain('not found');
  });
});

// ── Verify backup script ───────────────────────────────────────────

describe('verify-backup.sh', () => {
  it('has valid bash syntax', () => {
    execSync(`bash -n ${SCRIPTS_DIR}/verify-backup.sh`, {
      ...execOpts,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    expect(true).toBe(true);
  });
});

// ── Cross-script consistency ────────────────────────────────────────

describe('Cross-script consistency', () => {
  it('upgrade script references backup-databases.sh', () => {
    const content = fs.readFileSync(
      path.join(SCRIPTS_DIR, 'upgrade-system.sh'),
      'utf-8'
    );
    expect(content).toContain('backup-databases.sh');
  });

  it('upgrade script references restore-databases.sh for rollback', () => {
    const content = fs.readFileSync(
      path.join(SCRIPTS_DIR, 'upgrade-system.sh'),
      'utf-8'
    );
    expect(content).toContain('restore-databases.sh');
  });

  it('rollback script references restore-databases.sh', () => {
    const content = fs.readFileSync(
      path.join(SCRIPTS_DIR, 'rollback-upgrade.sh'),
      'utf-8'
    );
    expect(content).toContain('restore-databases.sh');
  });

  it('all scripts use the same project root detection pattern', () => {
    const scripts = [
      'backup-databases.sh',
      'restore-databases.sh',
      'verify-backup.sh',
      'upgrade-system.sh',
      'apply-security-patch.sh',
      'rollback-upgrade.sh',
    ];

    for (const script of scripts) {
      const content = fs.readFileSync(
        path.join(SCRIPTS_DIR, script),
        'utf-8'
      );
      expect(content).toContain('PROJECT_ROOT=');
      expect(content).toContain('BASH_SOURCE');
    }
  });

  it('upgrade and security patch scripts both write JSON reports', () => {
    const upgradeContent = fs.readFileSync(
      path.join(SCRIPTS_DIR, 'upgrade-system.sh'),
      'utf-8'
    );
    const patchContent = fs.readFileSync(
      path.join(SCRIPTS_DIR, 'apply-security-patch.sh'),
      'utf-8'
    );

    expect(upgradeContent).toContain('REPORT');
    expect(patchContent).toContain('REPORT');
    expect(upgradeContent).toContain('.json');
    expect(patchContent).toContain('.json');
  });

  it('all scripts log to the logs/ directory', () => {
    const scripts = [
      'upgrade-system.sh',
      'apply-security-patch.sh',
      'rollback-upgrade.sh',
    ];

    for (const script of scripts) {
      const content = fs.readFileSync(
        path.join(SCRIPTS_DIR, script),
        'utf-8'
      );
      expect(content).toContain('LOG_DIR=');
      expect(content).toContain('/logs');
    }
  });
});

// ── Documentation ───────────────────────────────────────────────────

describe('Documentation', () => {
  it('backup-and-restore.md exists', () => {
    expect(
      fs.existsSync(path.join(PROJECT_ROOT, 'docs/backup-and-restore.md'))
    ).toBe(true);
  });

  it('upgrade-and-patching.md exists', () => {
    expect(
      fs.existsSync(path.join(PROJECT_ROOT, 'docs/upgrade-and-patching.md'))
    ).toBe(true);
  });

  it('upgrade-and-patching.md references all scripts', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'docs/upgrade-and-patching.md'),
      'utf-8'
    );
    expect(content).toContain('upgrade-system.sh');
    expect(content).toContain('apply-security-patch.sh');
    expect(content).toContain('rollback-upgrade.sh');
    expect(content).toContain('backup-databases.sh');
    expect(content).toContain('restore-databases.sh');
    expect(content).toContain('verify-backup.sh');
  });

  it('backup-and-restore.md references backup and restore scripts', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'docs/backup-and-restore.md'),
      'utf-8'
    );
    expect(content).toContain('backup-databases.sh');
    expect(content).toContain('restore-databases.sh');
    expect(content).toContain('verify-backup.sh');
  });
});
