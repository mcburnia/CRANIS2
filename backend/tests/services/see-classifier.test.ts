/**
 * SEE Classifier — Unit Tests
 *
 * Tests the deterministic commit classification and branch type detection.
 * Pure functions — no database or network required.
 */

import { describe, it, expect } from 'vitest';
import { classifyCommit, classifyBranch, type CommitType, type BranchType } from '../../src/services/see-classifier.js';

// ═══════════════════════════════════════════════════════════════════
// Commit Classification
// ═══════════════════════════════════════════════════════════════════

describe('classifyCommit', () => {
  describe('fix detection', () => {
    it('classifies "fix:" prefix', () => {
      expect(classifyCommit('fix: resolve null pointer in parser')).toBe('fix');
    });
    it('classifies "bugfix:" prefix', () => {
      expect(classifyCommit('bugfix: handle empty response')).toBe('fix');
    });
    it('classifies "hotfix:" prefix', () => {
      expect(classifyCommit('hotfix: critical auth bypass')).toBe('fix');
    });
    it('classifies messages containing "fixes"', () => {
      expect(classifyCommit('This fixes the login timeout issue')).toBe('fix');
    });
    it('classifies messages containing "bug"', () => {
      expect(classifyCommit('Address bug in date formatting')).toBe('fix');
    });
    it('classifies messages containing "resolved"', () => {
      expect(classifyCommit('Resolved race condition in scheduler')).toBe('fix');
    });
  });

  describe('feature detection', () => {
    it('classifies "feat:" prefix', () => {
      expect(classifyCommit('feat: add SBOM export endpoint')).toBe('feature');
    });
    it('classifies "feature:" prefix', () => {
      expect(classifyCommit('feature: implement batch triage')).toBe('feature');
    });
    it('classifies "add:" prefix', () => {
      expect(classifyCommit('add: new compliance checklist widget')).toBe('feature');
    });
    it('classifies "implement:" prefix', () => {
      expect(classifyCommit('implement: ENISA reporting workflow')).toBe('feature');
    });
  });

  describe('refactor detection', () => {
    it('classifies "refactor:" prefix', () => {
      expect(classifyCommit('refactor: extract obligation engine')).toBe('refactor');
    });
    it('classifies "restructure:" prefix', () => {
      expect(classifyCommit('restructure: split admin routes')).toBe('refactor');
    });
    it('classifies "simplify:" prefix', () => {
      expect(classifyCommit('simplify: flatten nested conditionals')).toBe('refactor');
    });
    it('classifies "rename:" prefix', () => {
      expect(classifyCommit('rename: camelCase to snake_case')).toBe('refactor');
    });
    it('classifies "extract:" prefix', () => {
      expect(classifyCommit('extract: shared middleware into helpers')).toBe('refactor');
    });
  });

  describe('test detection', () => {
    it('classifies "test:" prefix', () => {
      expect(classifyCommit('test: add SEE classifier unit tests')).toBe('test');
    });
    it('classifies "tests:" prefix', () => {
      expect(classifyCommit('tests: expand field issue coverage')).toBe('test');
    });
    it('classifies messages about adding tests', () => {
      expect(classifyCommit('Added tests for billing lifecycle')).toBe('test');
    });
    it('classifies messages about test coverage', () => {
      expect(classifyCommit('Improve test coverage for auth module')).toBe('test');
    });
  });

  describe('docs detection', () => {
    it('classifies "docs:" prefix', () => {
      expect(classifyCommit('docs: update API reference')).toBe('docs');
    });
    it('classifies "update readme" messages', () => {
      expect(classifyCommit('Update README with new setup instructions')).toBe('docs');
    });
  });

  describe('experiment detection', () => {
    it('classifies "experiment:" prefix', () => {
      expect(classifyCommit('experiment: try alternative caching strategy')).toBe('experiment');
    });
    it('classifies "spike:" prefix', () => {
      expect(classifyCommit('spike: evaluate neo4j graph traversal performance')).toBe('experiment');
    });
    it('classifies "poc:" prefix', () => {
      expect(classifyCommit('poc: proof of concept for OSCAL export')).toBe('experiment');
    });
    it('classifies "prototype:" prefix', () => {
      expect(classifyCommit('prototype: new dashboard layout')).toBe('experiment');
    });
    it('classifies "wip:" prefix', () => {
      expect(classifyCommit('wip: work in progress on session capture')).toBe('experiment');
    });
    it('classifies messages containing "experimental"', () => {
      // "Add" triggers feature before "experimental" triggers experiment
      expect(classifyCommit('This is an experimental approach')).toBe('experiment');
    });
  });

  describe('style detection', () => {
    it('classifies "style:" prefix', () => {
      // Note: "style: fix" contains "fix" which matches first; use unambiguous message
      expect(classifyCommit('style: adjust spacing in header')).toBe('style');
    });
    it('classifies "format:" prefix', () => {
      expect(classifyCommit('format: run prettier on all files')).toBe('style');
    });
    it('classifies "lint:" prefix', () => {
      expect(classifyCommit('lint: remove unused imports')).toBe('style');
    });
  });

  describe('chore detection', () => {
    it('classifies "chore:" prefix', () => {
      expect(classifyCommit('chore: update dependencies')).toBe('chore');
    });
    it('classifies "build:" prefix', () => {
      expect(classifyCommit('build: update Dockerfile')).toBe('chore');
    });
    it('classifies "ci:" prefix', () => {
      expect(classifyCommit('ci: update GitHub Actions workflow')).toBe('chore');
    });
    it('classifies "deps:" prefix', () => {
      expect(classifyCommit('deps: upgrade express to 4.19')).toBe('chore');
    });
    it('classifies "bump:" prefix', () => {
      expect(classifyCommit('bump: version to 2.1.0')).toBe('chore');
    });
    it('classifies "merge:" prefix', () => {
      expect(classifyCommit('merge: branch feature/new-ui into main')).toBe('chore');
    });
  });

  describe('other / fallback', () => {
    it('returns "other" for empty string', () => {
      expect(classifyCommit('')).toBe('other');
    });
    it('returns "other" for whitespace-only', () => {
      expect(classifyCommit('   ')).toBe('other');
    });
    it('returns "other" for unclassifiable messages', () => {
      expect(classifyCommit('Initial commit')).toBe('other');
    });
    it('returns "other" for ambiguous messages', () => {
      expect(classifyCommit('Monday morning changes')).toBe('other');
    });
  });

  describe('priority ordering', () => {
    it('fix takes priority over feature when both match', () => {
      // "fix" patterns are checked before "feature"
      expect(classifyCommit('fix: add missing null check')).toBe('fix');
    });
    it('handles conventional commit with scope', () => {
      expect(classifyCommit('feat(auth): add OAuth callback')).toBe('feature');
    });
    it('handles conventional commit with breaking change', () => {
      expect(classifyCommit('fix(api): correct response format')).toBe('fix');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Branch Classification
// ═══════════════════════════════════════════════════════════════════

describe('classifyBranch', () => {
  describe('default branch', () => {
    it('classifies default branch regardless of name', () => {
      expect(classifyBranch('main', true)).toBe('default');
    });
    it('classifies master as default when isDefault is true', () => {
      expect(classifyBranch('master', true)).toBe('default');
    });
    it('classifies develop as default when isDefault is true', () => {
      expect(classifyBranch('develop', true)).toBe('default');
    });
  });

  describe('feature branches', () => {
    it('classifies feature/ prefix', () => {
      expect(classifyBranch('feature/add-sbom-export', false)).toBe('feature');
    });
    it('classifies feat/ prefix', () => {
      expect(classifyBranch('feat/new-dashboard', false)).toBe('feature');
    });
    it('classifies feature- prefix', () => {
      expect(classifyBranch('feature-obligation-engine', false)).toBe('feature');
    });
  });

  describe('bugfix branches', () => {
    it('classifies fix/ prefix', () => {
      expect(classifyBranch('fix/null-pointer', false)).toBe('bugfix');
    });
    it('classifies bugfix/ prefix', () => {
      expect(classifyBranch('bugfix/login-timeout', false)).toBe('bugfix');
    });
    it('classifies bug/ prefix', () => {
      expect(classifyBranch('bug/date-format', false)).toBe('bugfix');
    });
  });

  describe('hotfix branches', () => {
    it('classifies hotfix/ prefix', () => {
      expect(classifyBranch('hotfix/critical-auth', false)).toBe('hotfix');
    });
    it('classifies security/ prefix', () => {
      expect(classifyBranch('security/patch-xss', false)).toBe('hotfix');
    });
  });

  describe('release branches', () => {
    it('classifies release/ prefix', () => {
      expect(classifyBranch('release/2.0.0', false)).toBe('release');
    });
    it('classifies version branches', () => {
      expect(classifyBranch('v2.1.0', false)).toBe('release');
    });
  });

  describe('experiment branches', () => {
    it('classifies experiment/ prefix', () => {
      expect(classifyBranch('experiment/new-caching', false)).toBe('experiment');
    });
    it('classifies spike/ prefix', () => {
      expect(classifyBranch('spike/graph-performance', false)).toBe('experiment');
    });
    it('classifies poc/ prefix', () => {
      expect(classifyBranch('poc/oscal-bridge', false)).toBe('experiment');
    });
    it('classifies prototype/ prefix', () => {
      expect(classifyBranch('prototype/new-ui', false)).toBe('experiment');
    });
    it('classifies wip/ prefix', () => {
      expect(classifyBranch('wip/session-capture', false)).toBe('experiment');
    });
  });

  describe('other branches', () => {
    it('classifies unrecognised names as other', () => {
      expect(classifyBranch('my-branch', false)).toBe('other');
    });
    it('classifies plain names as other', () => {
      expect(classifyBranch('development', false)).toBe('other');
    });
  });
});
