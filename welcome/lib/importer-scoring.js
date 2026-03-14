const { SECTIONS, QUESTIONS } = require('../data/importer-questions');

function computeScores(answers) {
  const sectionScores = {};
  const sectionMaxes = {};
  let totalScore = 0;
  let totalMax = 0;

  SECTIONS.forEach((section) => {
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

function getReadinessLevel(overallPct) {
  if (overallPct >= 80) return { level: 'Well prepared', colour: '#22c55e', advice: 'Your importer compliance processes are mature. Focus on maintaining documentation and staying up to date with regulatory changes.' };
  if (overallPct >= 60) return { level: 'Good progress', colour: '#3b82f6', advice: 'You have a solid foundation. Address the gaps identified below to reach full compliance before the December 2027 deadline.' };
  if (overallPct >= 40) return { level: 'Developing', colour: '#f59e0b', advice: 'Several key obligations need attention. Prioritise manufacturer verification and documentation retention to reduce your compliance risk.' };
  if (overallPct >= 20) return { level: 'Early stage', colour: '#f97316', advice: 'Significant gaps remain in your importer compliance programme. Start with verifying manufacturer conformity assessments and establishing traceability records.' };
  return { level: 'Not started', colour: '#ef4444', advice: 'Your importer obligations under CRA Article 18 are not yet addressed. Immediate action is needed: the CRA becomes fully enforceable in December 2027.' };
}

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

module.exports = { computeScores, getReadinessLevel, getTopRecommendations };
