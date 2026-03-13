const { SECTIONS, QUESTIONS } = require('../data/nis2-questions');

function determineEntityClass(answers) {
  const sectorScore = answers.sector !== undefined ? QUESTIONS[0].options[answers.sector].score : 0;
  const sizeScore = answers.entity_size !== undefined ? QUESTIONS[1].options[answers.entity_size].score : 0;

  // Size-independent entities (score 3) are always essential
  if (sizeScore === 3) return 'essential_critical';

  // Not in a listed sector → likely not in scope
  if (sectorScore === 0) return 'not_in_scope';

  // Large entities in Annex I sectors → essential
  if (sizeScore >= 2 && sectorScore >= 2) return 'essential';

  // Medium entities in Annex I, or large in Annex II → important
  if (sizeScore >= 1 && sectorScore >= 1) return 'important';

  // Small entities in listed sectors; generally not in scope but may be
  return 'not_in_scope';
}

function getEntityDetails(entityClass) {
  switch (entityClass) {
    case 'essential_critical':
      return {
        supervision: 'Proactive supervision',
        penalties: 'Up to €10,000,000 or 2% of global annual turnover (whichever is higher)',
        description: 'As a provider of critical digital infrastructure services, your organisation is classified as an essential entity regardless of size. You will be subject to proactive supervision by the competent authority, meaning they may conduct audits and inspections at any time, not only after an incident.',
        regime: 'Essential entities are subject to the most intensive supervisory regime (Article 32).',
      };
    case 'essential':
      return {
        supervision: 'Proactive supervision',
        penalties: 'Up to €10,000,000 or 2% of global annual turnover (whichever is higher)',
        description: 'As a large entity in a highly critical sector, your organisation is classified as essential. You will be subject to proactive supervision. The competent authority may conduct audits, security scans, and on-site inspections at any time.',
        regime: 'Essential entities are subject to the most intensive supervisory regime (Article 32).',
      };
    case 'important':
      return {
        supervision: 'Reactive supervision (ex-post)',
        penalties: 'Up to €7,000,000 or 1.4% of global annual turnover (whichever is higher)',
        description: 'Your organisation is classified as an important entity. You are subject to the same cybersecurity obligations as essential entities, but the supervision regime is less intensive. Authorities will typically investigate only after an incident or when given evidence of non-compliance.',
        regime: 'Important entities are subject to reactive supervision (Article 33).',
      };
    default:
      return {
        supervision: 'Not directly supervised under NIS2',
        penalties: 'N/A – not in scope',
        description: 'Based on your responses, your organisation appears unlikely to fall directly within NIS2 scope. However, you may still be affected indirectly. If your customers are in-scope entities, they may impose NIS2-aligned cybersecurity requirements on you through supply chain provisions. Adopting NIS2 measures voluntarily is considered good practice.',
        regime: 'Consider voluntary adoption of NIS2 measures, especially if you serve in-scope customers.',
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
    if (pct >= 75) level = 'Advanced';
    else if (pct >= 50) level = 'Developing';
    else if (pct >= 25) level = 'Early stage';
    else level = 'Not started';
    sectionResults[section.id] = { score, max, pct, level };
  });

  const overallPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  return { sections: sectionResults, overallPct, totalScore, totalMax };
}

function getTopRecommendations(scores, answers) {
  const recommendations = [];

  const scoredSections = SECTIONS.filter(s => s.id !== 'applicability')
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
        current: currentScore === 0 ? 'Not started' : q.options[currentAnswer].label,
        target: nextLevel.label,
        nis2_reference: q.nis2_reference,
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

module.exports = { determineEntityClass, getEntityDetails, computeScores, getTopRecommendations };
