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
 * Feedback Notification Subject Formatter Tests
 *
 * Pure unit tests for buildFeedbackEmailSubject — the helper that constructs
 * the support@cranis2.com email subject line for in-app feedback submissions.
 * Resend is not invoked here; the integration with the route is covered by
 * routes/feedback.test.ts and verified end-to-end via prod smoke.
 */

import { describe, it, expect } from 'vitest';
import { buildFeedbackEmailSubject } from '../../src/services/email.js';

describe('buildFeedbackEmailSubject', () => {
  it('uppercases the category and tags the prefix', () => {
    expect(buildFeedbackEmailSubject('bug', 'Sync button greyed out')).toBe(
      '[CRANIS2 BUG] Sync button greyed out',
    );
    expect(buildFeedbackEmailSubject('feature', 'Add CSV export')).toBe(
      '[CRANIS2 FEATURE] Add CSV export',
    );
    expect(buildFeedbackEmailSubject('feedback', 'Loving the new UI')).toBe(
      '[CRANIS2 FEEDBACK] Loving the new UI',
    );
  });

  it('trims surrounding whitespace from the submitter subject', () => {
    expect(buildFeedbackEmailSubject('bug', '   leading and trailing spaces   ')).toBe(
      '[CRANIS2 BUG] leading and trailing spaces',
    );
  });

  it('truncates with an ellipsis when the subject exceeds 120 characters', () => {
    const long = 'a'.repeat(200);
    const subject = buildFeedbackEmailSubject('feedback', long);
    expect(subject.startsWith('[CRANIS2 FEEDBACK] ')).toBe(true);
    expect(subject.endsWith('...')).toBe(true);
    expect(subject.length).toBe('[CRANIS2 FEEDBACK] '.length + 120);
  });

  it('leaves short subjects untouched (no ellipsis at the boundary)', () => {
    const exactly120 = 'b'.repeat(120);
    const subject = buildFeedbackEmailSubject('bug', exactly120);
    expect(subject).toBe(`[CRANIS2 BUG] ${exactly120}`);
    expect(subject.endsWith('...')).toBe(false);
  });
});
