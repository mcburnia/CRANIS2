const { SECTIONS, QUESTIONS } = require('../data/cra-questions');

function computeScores(answers) {
  const sectionScores = {};
  const sectionMaxes = {};
  let totalScore = 0;
  let totalMax = 0;

  SECTIONS.forEach((section, idx) => {
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

function determineCategory(answers) {
  const classificationQuestions = QUESTIONS.filter(q => q.section === 0);
  let total = 0;
  let count = 0;
  classificationQuestions.forEach(q => {
    const answer = answers[q.id];
    if (answer !== undefined && answer !== null) {
      total += q.options[answer].score;
      count++;
    }
  });

  if (count === 0) return 'default';
  const avg = total / (count * 3); // normalise to 0–1
  if (avg >= 0.75) return 'critical';
  if (avg >= 0.50) return 'important_ii';
  if (avg >= 0.25) return 'important_i';
  return 'default';
}

function getConformityModule(category) {
  switch (category) {
    case 'critical':
      return { module: 'Module H', fullName: 'Module H — Full Quality Assurance', needsNB: true,
        description: 'Your product requires the most rigorous assessment procedure. A notified body must approve your quality assurance system covering design, production, and post-market surveillance, with periodic inspections.' };
    case 'important_ii':
      return { module: 'Module B+C or H', fullName: 'Module B+C (EU-Type Examination) or Module H (Full QA)', needsNB: true,
        description: 'Your product requires third-party assessment regardless of whether harmonised standards are applied. You may choose between EU-type examination (Module B+C) or full quality assurance (Module H).' };
    case 'important_i':
      return { module: 'Module A or B+C', fullName: 'Module A (Self-Assessment) or Module B+C', needsNB: false,
        description: 'If you have fully applied relevant harmonised standards (EN 18031), you can self-assess under Module A. Otherwise, you\u2019ll need EU-type examination (Module B+C) from a notified body.' };
    default:
      return { module: 'Module A', fullName: 'Module A — Internal Control', needsNB: false,
        description: 'Your product qualifies for self-assessment. You perform the conformity assessment internally, prepare your technical documentation and EU Declaration of Conformity, and affix the CE marking yourself. No notified body involvement required.' };
  }
}

function getTopRecommendations(scores, answers) {
  const recommendations = [];

  // Find weakest sections (excluding classification)
  const scoredSections = SECTIONS.filter(s => s.id !== 'classification')
    .map(s => ({ ...s, ...scores.sections[s.id] }))
    .sort((a, b) => a.pct - b.pct);

  scoredSections.forEach(section => {
    if (section.pct >= 75) return; // already advanced
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
        cra_reference: q.cra_reference,
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

module.exports = { computeScores, determineCategory, getConformityModule, getTopRecommendations };
