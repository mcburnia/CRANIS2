/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * Key Rotation Tooling Tests — WS3 Session 60
 *
 * Tests for:
 *   1. Script existence, permissions, and syntax
 *   2. rotate-credentials.sh --dry-run
 *   3. rotate-encryption-key.sh --dry-run
 *   4. rotate-signing-keys.sh --dry-run
 *   5. check-rotation-age.sh output
 *   6. Cross-script consistency
 *   7. Documentation completeness
 */

import { describe, it, expect } from 'vitest';
import { execSync, ExecSyncOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'scripts');

// In-container runs lack nvm/host context that the rotation scripts depend on.
const SKIP_HOST_ONLY = process.env.IN_TEST_RUNNER_CONTAINER === 'true';

const execOpts: ExecSyncOptions = {
  cwd: PROJECT_ROOT,
  timeout: 60_000,
  encoding: 'utf-8' as BufferEncoding,
  env: { ...process.env, PATH: process.env.PATH },
};

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

// ── Script File Checks ──────────────────────────────────────────────

describe('Key rotation scripts — file checks', () => {
  const scripts = [
    'rotate-credentials.sh',
    'rotate-encryption-key.sh',
    'rotate-signing-keys.sh',
    'apply-key-rotation.sh',
    'check-rotation-age.sh',
    'generate-signing-keys.sh',
  ];

  for (const script of scripts) {
    it(`${script} exists and is executable`, () => {
      const scriptPath = path.join(SCRIPTS_DIR, script);
      expect(fs.existsSync(scriptPath)).toBe(true);
      const stats = fs.statSync(scriptPath);
      expect((stats.mode & 0o100) !== 0).toBe(true);
    });

    it(`${script} has valid bash syntax`, () => {
      execSync(`bash -n ${SCRIPTS_DIR}/${script}`, {
        ...execOpts,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it(`${script} uses set -euo pipefail`, () => {
      const content = fs.readFileSync(path.join(SCRIPTS_DIR, script), 'utf-8');
      expect(content).toContain('set -euo pipefail');
    });
  }
});

// ── Credential Rotation ─────────────────────────────────────────────

describe('rotate-credentials.sh', () => {
  it('--dry-run completes without making changes', () => {
    const { stdout, exitCode } = runScript('rotate-credentials.sh', ['--dry-run']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('CREDENTIAL ROTATION');
    expect(stdout).toContain('DRY RUN');
    expect(stdout).toContain('Dry run complete');
  });

  it('--dry-run mentions all credential types', () => {
    const { stdout } = runScript('rotate-credentials.sh', ['--dry-run']);
    expect(stdout).toContain('POSTGRES');
    expect(stdout).toContain('NEO4J');
    expect(stdout).toContain('FORGEJO');
    expect(stdout).toContain('JWT');
    expect(stdout).toContain('WELCOME');
  });

  it('supports --db-only flag', () => {
    const { stdout, exitCode } = runScript('rotate-credentials.sh', ['--db-only', '--dry-run']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('POSTGRES');
  });

  it('supports --jwt-only flag', () => {
    const { stdout, exitCode } = runScript('rotate-credentials.sh', ['--jwt-only', '--dry-run']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('JWT');
  });

  it('rejects unknown arguments', () => {
    const { exitCode } = runScript('rotate-credentials.sh', ['--nonsense'], false);
    expect(exitCode).not.toBe(0);
  });
});

// ── Encryption Key Rotation ─────────────────────────────────────────

describe('rotate-encryption-key.sh', () => {
  it.skipIf(SKIP_HOST_ONLY)('--dry-run shows PAT count without making changes', () => {
    const { stdout, exitCode } = runScript('rotate-encryption-key.sh', ['--dry-run']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('ENCRYPTION KEY ROTATION');
    expect(stdout).toContain('DRY RUN');
    expect(stdout).toContain('PATs to re-encrypt');
  });

  it('rejects unknown arguments', () => {
    const { exitCode } = runScript('rotate-encryption-key.sh', ['--nonsense'], false);
    expect(exitCode).not.toBe(0);
  });
});

// ── Signing Key Rotation ────────────────────────────────────────────

describe('rotate-signing-keys.sh', () => {
  it('--dry-run completes without generating keys', () => {
    const { stdout, exitCode } = runScript('rotate-signing-keys.sh', ['--dry-run']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('SIGNING KEY ROTATION');
    expect(stdout).toContain('DRY RUN');
  });

  it('rejects unknown arguments', () => {
    const { exitCode } = runScript('rotate-signing-keys.sh', ['--nonsense'], false);
    expect(exitCode).not.toBe(0);
  });
});

// ── Rotation Age Checker ────────────────────────────────────────────

describe('check-rotation-age.sh', () => {
  it('runs and produces output', () => {
    const { stdout, exitCode } = runScript('check-rotation-age.sh', [], false);
    // Exit 0 (all ok), 1 (overdue), or 2 (no ledger) are all valid
    expect([0, 1, 2]).toContain(exitCode);
    expect(stdout.length).toBeGreaterThan(0);
  });

  it('--json produces valid JSON', () => {
    const { stdout, exitCode } = runScript('check-rotation-age.sh', ['--json'], false);
    expect([0, 1, 2]).toContain(exitCode);

    let parsed: any;
    expect(() => {
      parsed = JSON.parse(stdout);
    }).not.toThrow();

    // Two valid shapes: full report or no-ledger
    if (parsed.status === 'no_ledger') {
      expect(parsed).toHaveProperty('message');
    } else {
      expect(parsed).toHaveProperty('checked_at');
      expect(parsed).toHaveProperty('overdue');
    }
  });

  it('rejects unknown arguments', () => {
    const { exitCode } = runScript('check-rotation-age.sh', ['--nonsense'], false);
    expect(exitCode).not.toBe(0);
  });
});

// ── Apply Key Rotation ──────────────────────────────────────────────

describe('apply-key-rotation.sh', () => {
  it('shows usage when called with no arguments', () => {
    const { stdout, exitCode } = runScript('apply-key-rotation.sh', [], false);
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain('Usage:');
  });

  it('rejects non-existent rotation directory', () => {
    const { stdout, exitCode } = runScript(
      'apply-key-rotation.sh',
      ['/nonexistent/path'],
      false
    );
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain('not found');
  });
});

// ── Cross-Script Consistency ────────────────────────────────────────

describe('Cross-script consistency', () => {
  it('all rotation scripts write to the same ledger file', () => {
    const scripts = ['rotate-credentials.sh', 'rotate-encryption-key.sh', 'rotate-signing-keys.sh'];
    for (const script of scripts) {
      const content = fs.readFileSync(path.join(SCRIPTS_DIR, script), 'utf-8');
      expect(content).toContain('rotation-ledger.json');
    }
  });

  it('check-rotation-age.sh reads from the same ledger', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'check-rotation-age.sh'), 'utf-8');
    expect(content).toContain('rotation-ledger.json');
  });

  it('apply-key-rotation.sh references backup and restore scripts', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'apply-key-rotation.sh'), 'utf-8');
    expect(content).toContain('backup-databases.sh');
  });

  it('all rotation scripts log to the logs/ directory', () => {
    const scripts = [
      'rotate-credentials.sh',
      'rotate-encryption-key.sh',
      'rotate-signing-keys.sh',
      'apply-key-rotation.sh',
    ];
    for (const script of scripts) {
      const content = fs.readFileSync(path.join(SCRIPTS_DIR, script), 'utf-8');
      expect(content).toContain('LOG_DIR=');
      expect(content).toContain('/logs');
    }
  });
});

// ── Documentation ───────────────────────────────────────────────────

describe('Key rotation documentation', () => {
  it('key-rotation.md exists', () => {
    expect(fs.existsSync(path.join(PROJECT_ROOT, 'docs/key-rotation.md'))).toBe(true);
  });

  it('references all rotation scripts', () => {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, 'docs/key-rotation.md'), 'utf-8');
    expect(content).toContain('rotate-credentials.sh');
    expect(content).toContain('rotate-encryption-key.sh');
    expect(content).toContain('rotate-signing-keys.sh');
    expect(content).toContain('apply-key-rotation.sh');
    expect(content).toContain('check-rotation-age.sh');
  });

  it('documents the rotation schedule', () => {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, 'docs/key-rotation.md'), 'utf-8');
    expect(content).toContain('Monthly');
    expect(content).toContain('Annually');
  });

  it('documents rollback procedures', () => {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, 'docs/key-rotation.md'), 'utf-8');
    expect(content).toContain('Rollback');
  });

  it('documents HNDL context', () => {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, 'docs/key-rotation.md'), 'utf-8');
    expect(content).toContain('HNDL');
    expect(content).toContain('Harvest Now');
  });
});
