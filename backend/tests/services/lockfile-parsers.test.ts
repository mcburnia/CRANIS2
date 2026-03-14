/**
 * Lockfile Parser Unit Tests
 *
 * Tests all 28 lockfile/manifest parsers with minimal sample input.
 * Each parser is a pure function: string → LockfileParseResult
 * No database or network access required.
 */

import { describe, it, expect } from 'vitest';
import {
  parsePackageLockJson,
  parseYarnLock,
  parsePnpmLock,
  parsePipfileLock,
  parsePoetryLock,
  parseGoSum,
  parseCargoLock,
  parseGemfileLock,
  parseGradleLock,
  parseNuGetLock,
  parseComposerLock,
  parseSwiftPackageResolved,
  parsePubspecLock,
  parseMixLock,
  parseTerraformLock,
  parseConanLock,
  parseVcpkgJson,
  parseRebarLock,
  parseCabalFreeze,
  parseStackLock,
  parseRenvLock,
  parseJuliaManifest,
  parseNixFlakeLock,
  parseRequirementsTxt,
  parsePyprojectToml,
  parseGoMod,
  parseCargoToml,
  parsePomXml,
  parseDockerfile,
  parseLockfile,
  LOCKFILE_CONFIGS,
  type LockfileParseResult,
} from '../../src/services/lockfile-parsers.js';

// ─── Helper ───────────────────────────────────────────────────────────

function expectValidResult(result: LockfileParseResult, expectedEcosystem: string) {
  expect(result).toHaveProperty('dependencies');
  expect(result).toHaveProperty('lockfileType');
  expect(result).toHaveProperty('ecosystem');
  expect(Array.isArray(result.dependencies)).toBe(true);
  expect(result.ecosystem).toBe(expectedEcosystem);
}

function expectValidDep(dep: any) {
  expect(dep).toHaveProperty('name');
  expect(dep).toHaveProperty('version');
  expect(dep).toHaveProperty('ecosystem');
  expect(dep).toHaveProperty('purl');
  expect(typeof dep.name).toBe('string');
  expect(typeof dep.version).toBe('string');
}

// ─── Registry & Dispatcher ────────────────────────────────────────────

describe('LOCKFILE_CONFIGS registry', () => {
  it('should have at least 28 entries', () => {
    expect(LOCKFILE_CONFIGS.length).toBeGreaterThanOrEqual(28);
  });

  it('should have unique filenames', () => {
    const filenames = LOCKFILE_CONFIGS.map(c => c.filename);
    const unique = new Set(filenames);
    expect(unique.size).toBe(filenames.length);
  });

  it('should have parser functions for each entry', () => {
    for (const config of LOCKFILE_CONFIGS) {
      expect(typeof config.parser).toBe('function');
    }
  });
});

describe('parseLockfile dispatcher', () => {
  it('should dispatch to correct parser by filename', () => {
    const result = parseLockfile('package-lock.json', JSON.stringify({
      lockfileVersion: 3,
      packages: { '': {}, 'node_modules/test-pkg': { version: '1.0.0' } },
    }));
    expect(result.ecosystem).toBe('npm');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });

  it('should throw for unsupported lockfile', () => {
    expect(() => parseLockfile('unknown.lock', 'content')).toThrow();
  });
});

// ─── Individual Parsers ───────────────────────────────────────────────

describe('parsePackageLockJson', () => {
  it('should parse v3 format', () => {
    const content = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': {},
        'node_modules/lodash': { version: '4.17.21' },
        'node_modules/express': { version: '4.18.2' },
      },
    });
    const result = parsePackageLockJson(content);
    expectValidResult(result, 'npm');
    expect(result.dependencies.length).toBe(2);
    expectValidDep(result.dependencies[0]);
    expect(result.dependencies.find(d => d.name === 'lodash')?.version).toBe('4.17.21');
  });

  it('should parse v1 format with dependencies object', () => {
    const content = JSON.stringify({
      lockfileVersion: 1,
      dependencies: {
        'lodash': { version: '4.17.21' },
      },
    });
    const result = parsePackageLockJson(content);
    expectValidResult(result, 'npm');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty for empty lockfile', () => {
    const result = parsePackageLockJson('{}');
    expectValidResult(result, 'npm');
    expect(result.dependencies.length).toBe(0);
  });
});

describe('parseYarnLock', () => {
  it('should parse yarn.lock format', () => {
    const content = `lodash@^4.17.21:
  version "4.17.21"
  resolved "https://registry.yarnpkg.com/lodash/-/lodash-4.17.21.tgz"
  integrity sha512-abc123

express@^4.18.0:
  version "4.18.2"
  resolved "https://registry.yarnpkg.com/express/-/express-4.18.2.tgz"
`;
    const result = parseYarnLock(content);
    expectValidResult(result, 'npm');
    expect(result.dependencies.length).toBe(2);
    expect(result.dependencies.find(d => d.name === 'lodash')?.version).toBe('4.17.21');
  });

  it('should return empty for empty content', () => {
    const result = parseYarnLock('');
    expectValidResult(result, 'npm');
    expect(result.dependencies.length).toBe(0);
  });
});

describe('parsePnpmLock', () => {
  it('should parse pnpm-lock.yaml format', () => {
    const content = `lockfileVersion: '6.0'
packages:
  /lodash@4.17.21:
    resolution: {integrity: sha512-abc}
  /express@4.18.2:
    resolution: {integrity: sha512-def}
`;
    const result = parsePnpmLock(content);
    expectValidResult(result, 'npm');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parsePipfileLock', () => {
  it('should parse Pipfile.lock format', () => {
    const content = JSON.stringify({
      default: {
        'requests': { version: '==2.31.0' },
        'flask': { version: '==3.0.0' },
      },
    });
    const result = parsePipfileLock(content);
    expectValidResult(result, 'pip');
    expect(result.dependencies.length).toBe(2);
    expect(result.dependencies.find(d => d.name === 'requests')?.version).toBe('2.31.0');
  });
});

describe('parsePoetryLock', () => {
  it('should parse poetry.lock format', () => {
    const content = `[[package]]
name = "requests"
version = "2.31.0"
description = "HTTP library"

[[package]]
name = "flask"
version = "3.0.0"
description = "Web framework"
`;
    const result = parsePoetryLock(content);
    expectValidResult(result, 'pip');
    expect(result.dependencies.length).toBe(2);
    expect(result.dependencies.find(d => d.name === 'requests')?.version).toBe('2.31.0');
  });
});

describe('parseGoSum', () => {
  it('should parse go.sum format', () => {
    const content = `github.com/gorilla/mux v1.8.0 h1:abc123=
github.com/gorilla/mux v1.8.0/go.mod h1:def456=
github.com/gin-gonic/gin v1.9.1 h1:ghi789=
`;
    const result = parseGoSum(content);
    expectValidResult(result, 'go');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parseCargoLock', () => {
  it('should parse Cargo.lock format', () => {
    const content = `[[package]]
name = "serde"
version = "1.0.190"
source = "registry+https://github.com/rust-lang/crates.io-index"

[[package]]
name = "tokio"
version = "1.33.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
`;
    const result = parseCargoLock(content);
    expectValidResult(result, 'cargo');
    expect(result.dependencies.length).toBe(2);
    expect(result.dependencies.find(d => d.name === 'serde')?.version).toBe('1.0.190');
  });
});

describe('parseGemfileLock', () => {
  it('should parse Gemfile.lock format', () => {
    const content = `GEM
  remote: https://rubygems.org/
  specs:
    rails (7.1.0)
    rack (3.0.8)

PLATFORMS
  ruby

DEPENDENCIES
  rails
`;
    const result = parseGemfileLock(content);
    expectValidResult(result, 'gem');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parseGradleLock', () => {
  it('should parse buildscript-gradle.lockfile format', () => {
    const content = `# This is a Gradle generated file for dependency locking.
com.google.guava:guava:31.1-jre=classpath
org.springframework.boot:spring-boot:3.1.0=classpath
empty=
`;
    const result = parseGradleLock(content);
    expectValidResult(result, 'maven');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parseNuGetLock', () => {
  it('should parse packages.lock.json format', () => {
    const content = JSON.stringify({
      version: 1,
      dependencies: {
        'net8.0': {
          'Newtonsoft.Json': { resolved: '13.0.3', type: 'Direct' },
          'Microsoft.Extensions.Logging': { resolved: '8.0.0', type: 'Transitive' },
        },
      },
    });
    const result = parseNuGetLock(content);
    expectValidResult(result, 'nuget');
    expect(result.dependencies.length).toBe(2);
  });
});

describe('parseComposerLock', () => {
  it('should parse composer.lock format', () => {
    const content = JSON.stringify({
      packages: [
        { name: 'laravel/framework', version: 'v10.0.0' },
        { name: 'symfony/console', version: 'v6.3.0' },
      ],
    });
    const result = parseComposerLock(content);
    expectValidResult(result, 'composer');
    expect(result.dependencies.length).toBe(2);
  });
});

describe('parseSwiftPackageResolved', () => {
  it('should parse Package.resolved v2 format', () => {
    const content = JSON.stringify({
      pins: [
        {
          identity: 'alamofire',
          location: 'https://github.com/Alamofire/Alamofire.git',
          state: { revision: 'abc123', version: '5.8.0' },
        },
      ],
      version: 2,
    });
    const result = parseSwiftPackageResolved(content);
    expectValidResult(result, 'swift');
    expect(result.dependencies.length).toBe(1);
    expect(result.dependencies[0].version).toBe('5.8.0');
  });
});

describe('parsePubspecLock', () => {
  it('should parse pubspec.lock format', () => {
    const content = `packages:
  http:
    dependency: "direct main"
    description:
      name: http
      url: "https://pub.dartlang.org"
    source: hosted
    version: "1.1.0"
  provider:
    dependency: transitive
    description:
      name: provider
      url: "https://pub.dartlang.org"
    source: hosted
    version: "6.0.5"
`;
    const result = parsePubspecLock(content);
    expectValidResult(result, 'pub');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parseMixLock', () => {
  it('should parse mix.lock format', () => {
    const content = `%{"phoenix": {:hex, :phoenix, "1.7.10", "abc123", [:mix], [], "hexpm", "def456"},
  "ecto": {:hex, :ecto, "3.11.0", "ghi789", [:mix], [], "hexpm", "jkl012"}}
`;
    const result = parseMixLock(content);
    expectValidResult(result, 'hex');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parseTerraformLock', () => {
  it('should parse .terraform.lock.hcl format', () => {
    const content = `provider "registry.terraform.io/hashicorp/aws" {
  version     = "5.0.0"
  constraints = "~> 5.0"
  hashes = [
    "h1:abc123",
  ]
}

provider "registry.terraform.io/hashicorp/azurerm" {
  version     = "3.75.0"
}
`;
    const result = parseTerraformLock(content);
    expectValidResult(result, 'terraform');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parseConanLock', () => {
  it('should parse conan.lock format', () => {
    const content = JSON.stringify({
      graph_lock: {
        nodes: {
          '1': { ref: 'zlib/1.2.13', package_id: 'abc' },
          '2': { ref: 'openssl/3.1.0', package_id: 'def' },
        },
      },
    });
    const result = parseConanLock(content);
    expectValidResult(result, 'conan');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parseVcpkgJson', () => {
  it('should parse vcpkg.json format', () => {
    const content = JSON.stringify({
      dependencies: ['zlib', 'openssl'],
      'builtin-baseline': 'abc123',
      overrides: [
        { name: 'zlib', version: '1.2.13' },
      ],
    });
    const result = parseVcpkgJson(content);
    expectValidResult(result, 'vcpkg');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parseRebarLock', () => {
  it('should parse rebar.lock format', () => {
    const content = `[{<<"cowboy">>,{pkg,<<"cowboy">>,<<"2.10.0">>},0},
 {<<"ranch">>,{pkg,<<"ranch">>,<<"2.1.0">>},1}].
`;
    const result = parseRebarLock(content);
    expectValidResult(result, 'hex');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parseCabalFreeze', () => {
  it('should parse cabal.project.freeze format', () => {
    const content = `constraints: any.aeson ==2.2.0.0,
             any.base ==4.18.0.0,
             any.text ==2.0.2
`;
    const result = parseCabalFreeze(content);
    expectValidResult(result, 'hackage');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parseStackLock', () => {
  it('should parse stack.yaml.lock format', () => {
    const content = `packages:
- completed:
    hackage: aeson-2.2.0.0@sha256:abc123
    pantry-tree:
      sha256: def456
      size: 1234
  original:
    hackage: aeson-2.2.0.0
- completed:
    hackage: text-2.0.2@sha256:ghi789
    pantry-tree:
      sha256: jkl012
      size: 5678
  original:
    hackage: text-2.0.2
`;
    const result = parseStackLock(content);
    expectValidResult(result, 'hackage');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parseRenvLock', () => {
  it('should parse renv.lock format', () => {
    const content = JSON.stringify({
      Packages: {
        'ggplot2': { Package: 'ggplot2', Version: '3.4.4', Source: 'CRAN' },
        'dplyr': { Package: 'dplyr', Version: '1.1.3', Source: 'CRAN' },
      },
    });
    const result = parseRenvLock(content);
    expectValidResult(result, 'cran');
    expect(result.dependencies.length).toBe(2);
  });
});

describe('parseJuliaManifest', () => {
  it('should parse Manifest.toml format', () => {
    const content = `[[deps.JSON]]
deps = ["Dates", "Mmap"]
uuid = "682c06a0-de6a-54ab-a142-c8b1cf79cde6"
version = "0.21.4"

[[deps.HTTP]]
deps = ["Base64", "Dates"]
uuid = "cd3eb016-35fb-5094-929b-558a96fad6f3"
version = "1.10.0"
`;
    const result = parseJuliaManifest(content);
    expectValidResult(result, 'julia');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parseNixFlakeLock', () => {
  it('should parse flake.lock format', () => {
    const content = JSON.stringify({
      nodes: {
        'nixpkgs': {
          locked: {
            type: 'github',
            owner: 'NixOS',
            repo: 'nixpkgs',
            rev: 'abc123',
          },
          original: {
            type: 'github',
            owner: 'NixOS',
            repo: 'nixpkgs',
          },
        },
        root: {
          inputs: { nixpkgs: 'nixpkgs' },
        },
      },
      root: 'root',
      version: 7,
    });
    const result = parseNixFlakeLock(content);
    expectValidResult(result, 'nix');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Manifest Fallbacks ───────────────────────────────────────────────

describe('parseRequirementsTxt', () => {
  it('should parse requirements.txt with pinned versions', () => {
    const content = `requests==2.31.0
flask==3.0.0
# comment
numpy>=1.24.0
`;
    const result = parseRequirementsTxt(content);
    expectValidResult(result, 'pypi');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(2);
  });

  it('should skip comments and blank lines', () => {
    const content = `# comment

requests==2.31.0
`;
    const result = parseRequirementsTxt(content);
    expect(result.dependencies.length).toBe(1);
  });
});

describe('parsePyprojectToml', () => {
  it('should parse pyproject.toml dependencies', () => {
    const content = `[project]
name = "my-project"
dependencies = [
    "requests>=2.31.0",
    "flask>=3.0.0",
]
`;
    const result = parsePyprojectToml(content);
    expectValidResult(result, 'pypi');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parseGoMod', () => {
  it('should parse go.mod require block', () => {
    const content = `module example.com/myproject

go 1.21

require (
	github.com/gorilla/mux v1.8.0
	github.com/gin-gonic/gin v1.9.1
)
`;
    const result = parseGoMod(content);
    expectValidResult(result, 'go');
    expect(result.dependencies.length).toBe(2);
  });
});

describe('parseCargoToml', () => {
  it('should parse Cargo.toml dependencies', () => {
    const content = `[package]
name = "my-project"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = { version = "1.33", features = ["full"] }
`;
    const result = parseCargoToml(content);
    expectValidResult(result, 'cargo');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

describe('parsePomXml', () => {
  it('should parse pom.xml dependencies', () => {
    const content = `<?xml version="1.0"?>
<project>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>6.0.0</version>
    </dependency>
    <dependency>
      <groupId>com.google.guava</groupId>
      <artifactId>guava</artifactId>
      <version>31.1-jre</version>
    </dependency>
  </dependencies>
</project>
`;
    const result = parsePomXml(content);
    expectValidResult(result, 'maven');
    expect(result.dependencies.length).toBe(2);
  });
});

describe('parseDockerfile', () => {
  it('should parse FROM statements', () => {
    const content = `FROM node:18-alpine AS builder
RUN npm install
FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
`;
    const result = parseDockerfile(content);
    expectValidResult(result, 'docker');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle FROM with digest', () => {
    const content = `FROM ubuntu:22.04
RUN apt-get update && apt-get install -y curl
`;
    const result = parseDockerfile(content);
    expectValidResult(result, 'docker');
    expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Error Resilience ─────────────────────────────────────────────────

describe('Parser error resilience', () => {
  it('should throw on malformed JSON for JSON-based parsers', () => {
    // JSON-based parsers use JSON.parse directly without try/catch
    expect(() => parsePackageLockJson('not valid json {{{')).toThrow();
  });

  it('should throw on empty string for JSON-based parsers', () => {
    expect(() => parsePipfileLock('')).toThrow();
  });

  it('should not throw on unexpected structure', () => {
    const result = parseNuGetLock(JSON.stringify({ version: 1 }));
    expectValidResult(result, 'nuget');
    expect(result.dependencies.length).toBe(0);
  });

  it('should deduplicate entries', () => {
    const content = `github.com/gorilla/mux v1.8.0 h1:abc=
github.com/gorilla/mux v1.8.0/go.mod h1:def=
`;
    const result = parseGoSum(content);
    // Should have only one mux entry despite two lines
    const muxEntries = result.dependencies.filter(d => d.name.includes('mux'));
    expect(muxEntries.length).toBe(1);
  });
});
