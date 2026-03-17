/**
 * SEE Estimator Service — Unit Tests
 *
 * Tests file classification, language detection, LOC counting,
 * and report generation. Pure functions — no database required.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyFile, detectLanguage, countLOC, generateEstimateReport,
  type SEEAnalysisResult,
} from '../../src/services/see-estimator.js';

// ═══════════════════════════════════════════════════════════════════
// File Classification
// ═══════════════════════════════════════════════════════════════════

describe('classifyFile', () => {
  describe('production files', () => {
    it('classifies src/ TypeScript files as production', () => {
      expect(classifyFile('src/routes/products.ts')).toBe('production');
    });
    it('classifies lib/ JavaScript files as production', () => {
      expect(classifyFile('lib/utils/helper.js')).toBe('production');
    });
    it('classifies Python source files as production', () => {
      expect(classifyFile('app/models/user.py')).toBe('production');
    });
  });

  describe('test files', () => {
    it('classifies files in tests/ directory', () => {
      expect(classifyFile('tests/unit/auth.test.ts')).toBe('test');
    });
    it('classifies files in __tests__/ directory', () => {
      expect(classifyFile('src/__tests__/helper.test.js')).toBe('test');
    });
    it('classifies .test.ts files', () => {
      expect(classifyFile('src/routes/products.test.ts')).toBe('test');
    });
    it('classifies .spec.ts files', () => {
      expect(classifyFile('src/services/billing.spec.ts')).toBe('test');
    });
    it('classifies _test.go files', () => {
      expect(classifyFile('pkg/handler_test.go')).toBe('test');
    });
    it('classifies test_*.py files', () => {
      expect(classifyFile('tests/test_auth.py')).toBe('test');
    });
    it('classifies conftest.py', () => {
      expect(classifyFile('tests/conftest.py')).toBe('test');
    });
    it('classifies e2e/ directory files', () => {
      expect(classifyFile('e2e/login.spec.ts')).toBe('test');
    });
    it('classifies cypress/ directory files', () => {
      expect(classifyFile('src/cypress/integration/smoke.js')).toBe('test');
    });
  });

  describe('config files', () => {
    it('classifies package.json', () => {
      expect(classifyFile('package.json')).toBe('config');
    });
    it('classifies tsconfig.json', () => {
      expect(classifyFile('tsconfig.json')).toBe('config');
    });
    it('classifies Dockerfile', () => {
      expect(classifyFile('Dockerfile')).toBe('config');
    });
    it('classifies docker-compose.yml', () => {
      expect(classifyFile('docker-compose.yml')).toBe('config');
    });
    it('classifies .github/ workflow files', () => {
      expect(classifyFile('.github/workflows/ci.yml')).toBe('config');
    });
    it('classifies .eslintrc files', () => {
      expect(classifyFile('.eslintrc.json')).toBe('config');
    });
    it('classifies Cargo.toml', () => {
      expect(classifyFile('Cargo.toml')).toBe('config');
    });
    it('classifies go.mod', () => {
      expect(classifyFile('go.mod')).toBe('config');
    });
  });

  describe('generated files', () => {
    it('classifies node_modules/ files', () => {
      expect(classifyFile('src/node_modules/express/index.js')).toBe('generated');
    });
    it('classifies dist/ files', () => {
      expect(classifyFile('frontend/dist/bundle.js')).toBe('generated');
    });
    it('classifies build/ files', () => {
      expect(classifyFile('frontend/build/output.css')).toBe('generated');
    });
    it('classifies .min.js files', () => {
      expect(classifyFile('public/app.min.js')).toBe('generated');
    });
    it('classifies .map files', () => {
      expect(classifyFile('frontend/dist/index.js.map')).toBe('generated');
    });
    it('classifies __pycache__/ files', () => {
      expect(classifyFile('src/__pycache__/module.cpython-310.pyc')).toBe('generated');
    });
  });

  describe('vendor files', () => {
    it('classifies vendor/ directory', () => {
      expect(classifyFile('src/vendor/github.com/lib/pq/conn.go')).toBe('vendor');
    });
    it('classifies third_party/ directory', () => {
      expect(classifyFile('src/third_party/protobuf/message.cc')).toBe('vendor');
    });
  });

  describe('docs files', () => {
    it('classifies .md files', () => {
      expect(classifyFile('README.md')).toBe('docs');
    });
    it('classifies docs/ directory files', () => {
      expect(classifyFile('docs/api-reference.md')).toBe('docs');
    });
    it('classifies LICENSE', () => {
      expect(classifyFile('LICENSE')).toBe('docs');
    });
    it('classifies CHANGELOG', () => {
      expect(classifyFile('CHANGELOG.md')).toBe('docs');
    });
  });

  describe('priority ordering', () => {
    it('generated takes priority over test', () => {
      // A test file inside node_modules should be classified as generated
      expect(classifyFile('src/node_modules/jest/test.js')).toBe('generated');
    });
    it('vendor takes priority over production', () => {
      expect(classifyFile('src/vendor/lib/helper.ts')).toBe('vendor');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Language Detection
// ═══════════════════════════════════════════════════════════════════

describe('detectLanguage', () => {
  it('detects TypeScript', () => {
    expect(detectLanguage('src/index.ts')).toBe('TypeScript');
  });
  it('detects TSX as TypeScript', () => {
    expect(detectLanguage('src/App.tsx')).toBe('TypeScript');
  });
  it('detects JavaScript', () => {
    expect(detectLanguage('lib/helper.js')).toBe('JavaScript');
  });
  it('detects Python', () => {
    expect(detectLanguage('app/main.py')).toBe('Python');
  });
  it('detects Go', () => {
    expect(detectLanguage('cmd/server/main.go')).toBe('Go');
  });
  it('detects Rust', () => {
    expect(detectLanguage('src/lib.rs')).toBe('Rust');
  });
  it('detects Java', () => {
    expect(detectLanguage('src/Main.java')).toBe('Java');
  });
  it('detects C#', () => {
    expect(detectLanguage('Program.cs')).toBe('C#');
  });
  it('detects C', () => {
    expect(detectLanguage('src/main.c')).toBe('C');
  });
  it('detects C++', () => {
    expect(detectLanguage('src/engine.cpp')).toBe('C++');
  });
  it('detects Ruby', () => {
    expect(detectLanguage('app/models/user.rb')).toBe('Ruby');
  });
  it('detects PHP', () => {
    expect(detectLanguage('src/Controller.php')).toBe('PHP');
  });
  it('detects SQL', () => {
    expect(detectLanguage('migrations/001.sql')).toBe('SQL');
  });
  it('detects Shell', () => {
    expect(detectLanguage('scripts/deploy.sh')).toBe('Shell');
  });
  it('detects HTML', () => {
    expect(detectLanguage('public/index.html')).toBe('HTML');
  });
  it('detects CSS', () => {
    expect(detectLanguage('src/styles/main.css')).toBe('CSS');
  });
  it('detects Vue', () => {
    expect(detectLanguage('src/App.vue')).toBe('Vue');
  });
  it('detects Terraform', () => {
    expect(detectLanguage('infra/main.tf')).toBe('Terraform');
  });
  it('returns null for unknown extensions', () => {
    expect(detectLanguage('data/model.bin')).toBeNull();
  });
  it('returns null for extensionless files', () => {
    expect(detectLanguage('Makefile')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// LOC Counting
// ═══════════════════════════════════════════════════════════════════

describe('countLOC', () => {
  it('counts non-empty, non-comment lines', () => {
    const code = `
function hello() {
  console.log('world');
}
`;
    expect(countLOC(code, 'JavaScript')).toBe(3);
  });

  it('excludes blank lines', () => {
    const code = `line1

line2

line3`;
    expect(countLOC(code, null)).toBe(3);
  });

  it('excludes single-line comments in TypeScript', () => {
    const code = `// This is a comment
const x = 1;
// Another comment
const y = 2;`;
    expect(countLOC(code, 'TypeScript')).toBe(2);
  });

  it('excludes block comments in TypeScript', () => {
    const code = `/**
 * A block comment
 */
const x = 1;`;
    expect(countLOC(code, 'TypeScript')).toBe(1);
  });

  it('excludes Python comments', () => {
    const code = `# Comment
x = 1
# Another comment
y = 2`;
    expect(countLOC(code, 'Python')).toBe(2);
  });

  it('excludes SQL comments', () => {
    const code = `-- Create table
CREATE TABLE users (
  id SERIAL PRIMARY KEY
);`;
    expect(countLOC(code, 'SQL')).toBe(3);
  });

  it('returns 0 for empty content', () => {
    expect(countLOC('', 'TypeScript')).toBe(0);
  });

  it('returns 0 for only blank lines', () => {
    expect(countLOC('\n\n\n', 'TypeScript')).toBe(0);
  });

  it('returns 0 for only comments', () => {
    const code = `// line 1
// line 2
// line 3`;
    expect(countLOC(code, 'JavaScript')).toBe(0);
  });

  it('counts lines when language is null (no comment stripping)', () => {
    const code = `// This would be a comment in JS
but is counted as code with null language`;
    expect(countLOC(code, null)).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Report Generation
// ═══════════════════════════════════════════════════════════════════

describe('generateEstimateReport', () => {
  const mockResult: SEEAnalysisResult = {
    id: 'test-run-001',
    productId: 'test-product-001',
    scanStatus: 'completed',
    completedAt: '2026-03-17T10:00:00Z',
    createdAt: '2026-03-17T10:00:00Z',
    totalFiles: 150,
    totalLoc: 25000,
    productionLoc: 18000,
    testLoc: 5000,
    configLoc: 1000,
    generatedLoc: 500,
    vendorLoc: 200,
    docsLoc: 300,
    languageBreakdown: {
      TypeScript: { loc: 15000, files: 80, productionLoc: 12000, testLoc: 3000 },
      Python: { loc: 5000, files: 30, productionLoc: 4000, testLoc: 1000 },
      CSS: { loc: 2000, files: 15, productionLoc: 2000, testLoc: 0 },
    },
    effortMonths: { low: 5.2, mid: 12.8, high: 25.6 },
    costEur: { low: 41600, mid: 166400, high: 486400 },
    teamSize: { low: 1, mid: 2, high: 3 },
    rebuildMonths: { low: 5.2, mid: 7.0, high: 10.2 },
    complexityCategory: 'multi_tier',
    complexityMultiplier: 1.2,
    assumptions: {
      locPerMonthLow: 800,
      locPerMonthMid: 1500,
      locPerMonthHigh: 3000,
      dailyRateLow: 400,
      dailyRateMid: 650,
      dailyRateHigh: 950,
      workingDaysPerMonth: 20,
      testCodeWeight: 0.3,
      languageAdjusters: {},
    },
    executiveSummary: 'This is a test executive summary.',
  };

  it('generates a Markdown report', () => {
    const report = generateEstimateReport(mockResult, 'TestProduct');
    expect(report).toContain('# Software Evidence Engine');
    expect(report).toContain('## TestProduct');
  });

  it('includes executive summary', () => {
    const report = generateEstimateReport(mockResult, 'TestProduct');
    expect(report).toContain('This is a test executive summary.');
  });

  it('includes code metrics table', () => {
    const report = generateEstimateReport(mockResult, 'TestProduct');
    expect(report).toContain('25,000');
    expect(report).toContain('18,000');
    expect(report).toContain('5,000');
  });

  it('includes language breakdown table', () => {
    const report = generateEstimateReport(mockResult, 'TestProduct');
    expect(report).toContain('TypeScript');
    expect(report).toContain('Python');
  });

  it('includes effort estimates', () => {
    const report = generateEstimateReport(mockResult, 'TestProduct');
    expect(report).toContain('5.2');
    expect(report).toContain('25.6');
  });

  it('includes cost estimates', () => {
    const report = generateEstimateReport(mockResult, 'TestProduct');
    expect(report).toContain('41,600');
    expect(report).toContain('486,400');
  });

  it('includes complexity assessment', () => {
    const report = generateEstimateReport(mockResult, 'TestProduct');
    expect(report).toContain('multi_tier');
    expect(report).toContain('1.2x');
  });

  it('includes methodology section', () => {
    const report = generateEstimateReport(mockResult, 'TestProduct');
    expect(report).toContain('## Methodology');
    expect(report).toContain('deterministic');
  });

  it('includes caveats section', () => {
    const report = generateEstimateReport(mockResult, 'TestProduct');
    expect(report).toContain('## Caveats and Limitations');
  });

  it('includes CRANIS2 attribution', () => {
    const report = generateEstimateReport(mockResult, 'TestProduct');
    expect(report).toContain('CRANIS2 Software Evidence Engine');
  });
});
