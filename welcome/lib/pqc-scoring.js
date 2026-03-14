const { SECTIONS, QUESTIONS } = require('../data/pqc-questions');

/* ── Readiness classification ──────────────────────────────────────────── */

function determineReadinessLevel(scores) {
  const pct = scores.overallPct;
  if (pct >= 75) return 'quantum_ready';
  if (pct >= 50) return 'partially_ready';
  if (pct >= 25) return 'at_risk';
  return 'critical';
}

function getReadinessDetails(level) {
  switch (level) {
    case 'quantum_ready':
      return {
        headline: 'Well Prepared',
        description: 'Your organisation demonstrates strong quantum readiness across most areas. You are using or actively migrating to quantum-safe algorithms, have good key management practices, and are tracking relevant standards. Continue your migration plan and monitor developments in the PQC landscape.',
        urgency: 'Maintain your current trajectory. Review your migration plan annually against evolving standards.',
        colour: '#10b981',
      };
    case 'partially_ready':
      return {
        headline: 'Good Progress, Gaps Remain',
        description: 'You have made meaningful progress on quantum readiness but significant gaps remain. Some areas of your cryptographic infrastructure are well positioned, while others need attention. Focus on the priority recommendations below to close the most critical gaps.',
        urgency: 'Address quantum-vulnerable asymmetric cryptography and key management gaps within 12–18 months.',
        colour: '#f59e0b',
      };
    case 'at_risk':
      return {
        headline: 'Significant Gaps',
        description: 'Your organisation has significant exposure to quantum threats. Multiple areas of your cryptographic infrastructure rely on quantum-vulnerable algorithms without clear migration paths. The harvest-now, decrypt-later threat means that sensitive data encrypted today may be compromised in the future.',
        urgency: 'Begin a cryptographic inventory and PQC migration plan within 6 months. Prioritise long-lived sensitive data.',
        colour: '#f97316',
      };
    default:
      return {
        headline: 'Immediate Action Required',
        description: 'Your organisation has critical exposure to both classical and quantum cryptographic threats. Multiple systems are using broken or quantum-vulnerable algorithms without inventory, rotation, or migration plans. This represents both a current security risk and a future quantum threat.',
        urgency: 'Start immediately: inventory your cryptographic assets, eliminate broken algorithms (MD5, SHA-1, DES), and begin PQC migration planning.',
        colour: '#ef4444',
      };
  }
}

/* ── Scoring ───────────────────────────────────────────────────────────── */

function computeScores(answers) {
  const sectionScores = {};
  const sectionMaxes = {};
  let totalScore = 0;
  let totalMax = 0;

  SECTIONS.forEach(section => {
    sectionScores[section.id] = 0;
    sectionMaxes[section.id] = 0;
  });

  QUESTIONS.forEach(q => {
    const section = SECTIONS[q.section];
    const answer = answers[q.id];
    const score = (answer !== undefined && answer !== null) ? q.options[answer].score : 0;
    const max = 3;
    sectionScores[section.id] += score;
    sectionMaxes[section.id] += max;
    totalScore += score;
    totalMax += max;
  });

  const sectionResults = {};
  SECTIONS.forEach(section => {
    const score = sectionScores[section.id];
    const max = sectionMaxes[section.id];
    const pct = max > 0 ? Math.round((score / max) * 100) : 0;
    let level;
    if (pct >= 75) level = 'Quantum-safe';
    else if (pct >= 50) level = 'Progressing';
    else if (pct >= 25) level = 'Early stage';
    else level = 'Critical';
    sectionResults[section.id] = { score, max, pct, level };
  });

  const overallPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  return { sections: sectionResults, overallPct, totalScore, totalMax };
}

/* ── Recommendations ───────────────────────────────────────────────────── */

function getTopRecommendations(scores, answers) {
  const recommendations = [];

  const scoredSections = SECTIONS
    .map(s => ({ ...s, ...scores.sections[s.id] }))
    .sort((a, b) => a.pct - b.pct);

  scoredSections.forEach(section => {
    if (section.pct >= 75) return;
    const sectionQuestions = QUESTIONS.filter(q => SECTIONS[q.section].id === section.id);
    const weakest = sectionQuestions
      .filter(q => {
        const a = answers[q.id];
        return a === undefined || a === null || q.options[a].score < 2;
      })
      .slice(0, 2);

    weakest.forEach(q => {
      const currentAnswer = answers[q.id];
      const currentScore = (currentAnswer !== undefined && currentAnswer !== null) ? q.options[currentAnswer].score : 0;
      const nextLevel = q.options[Math.min(currentScore + 1, 3)];
      recommendations.push({
        section: section.title,
        question: q.question,
        current: currentScore === 0 ? 'Not assessed' : q.options[currentAnswer].label,
        target: nextLevel.label,
        pqc_reference: q.pqc_reference,
        priority: currentScore === 0 ? 'high' : 'medium',
      });
    });
  });

  return recommendations.sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;
    return 0;
  }).slice(0, 6);
}

module.exports = { determineReadinessLevel, getReadinessDetails, computeScores, getTopRecommendations };
