// Multi-format lockfile parsers — no external dependencies
// Each parser produces a common ParsedDependency[] output
// Supports 28 lockfile/manifest formats across all major ecosystems

export interface ParsedDependency {
  name: string;
  version: string;
  ecosystem: string;   // 'npm' | 'pip' | 'go' | 'cargo' | 'gem' | 'maven' | 'nuget' | etc.
  purl: string;        // pkg:ecosystem/name@version
  isDirect: boolean;
}

export interface LockfileParseResult {
  dependencies: ParsedDependency[];
  lockfileType: string;
  ecosystem: string;
}

// ══════════════════════════════════════════════════════════════════
// EXISTING PARSERS (npm, pip, go, cargo, gem) — 49 tests passing
// ══════════════════════════════════════════════════════════════════

// ── npm: package-lock.json ──────────────────────────────────────

export function parsePackageLockJson(content: string): LockfileParseResult {
  const lockfile = JSON.parse(content);
  const deps: ParsedDependency[] = [];
  const seen = new Set<string>();

  if (lockfile.lockfileVersion >= 2 && lockfile.packages) {
    for (const [path, meta] of Object.entries(lockfile.packages)) {
      if (path === '') continue;
      const m = meta as any;
      const name = path.replace(/^.*node_modules\//, '');
      if (!m.version || !name) continue;
      const key = `${name}@${m.version}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deps.push({
        name, version: m.version, ecosystem: 'npm',
        purl: `pkg:npm/${name.startsWith('@') ? name.replace('@', '%40') : name}@${m.version}`,
        isDirect: path.split('node_modules/').length === 2,
      });
    }
  } else if (lockfile.dependencies) {
    const parseDepsV1 = (depsObj: any, direct: boolean) => {
      for (const [name, meta] of Object.entries(depsObj)) {
        const m = meta as any;
        if (!m.version) continue;
        const key = `${name}@${m.version}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deps.push({
          name, version: m.version, ecosystem: 'npm',
          purl: `pkg:npm/${name.startsWith('@') ? name.replace('@', '%40') : name}@${m.version}`,
          isDirect: direct,
        });
        if (m.dependencies) parseDepsV1(m.dependencies, false);
      }
    };
    parseDepsV1(lockfile.dependencies, true);
  }

  return { dependencies: deps, lockfileType: 'package-lock.json', ecosystem: 'npm' };
}

// ── npm: yarn.lock (v1) ─────────────────────────────────────────

export function parseYarnLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  const seen = new Set<string>();
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;
    const header = lines[0];
    if (header.startsWith('#') || header.startsWith('__metadata')) continue;
    const nameMatch = header.match(/^"?(@?[^@\s,]+)@/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const versionLine = lines.find(l => l.match(/^\s+version\s/));
    if (!versionLine) continue;
    const versionMatch = versionLine.match(/version\s+"?([^"\s]+)"?/);
    if (!versionMatch) continue;
    const version = versionMatch[1];
    const key = `${name}@${version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deps.push({
      name, version, ecosystem: 'npm',
      purl: `pkg:npm/${name.startsWith('@') ? name.replace('@', '%40') : name}@${version}`,
      isDirect: false,
    });
  }
  return { dependencies: deps, lockfileType: 'yarn.lock', ecosystem: 'npm' };
}

// ── npm: pnpm-lock.yaml ─────────────────────────────────────────

export function parsePnpmLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  const seen = new Set<string>();
  const patterns = [
    /^\s+\/?(@[^@\s/]+\/[^@\s/]+)@(\d[^:\s]*)/gm,
    /^\s+\/?([^@\s/]+)@(\d[^:\s]*)/gm,
    /^\s+'?(@[^@\s']+\/[^@\s']+)@(\d[^:']*)/gm,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1], version = match[2];
      const key = `${name}@${version}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deps.push({
        name, version, ecosystem: 'npm',
        purl: `pkg:npm/${name.startsWith('@') ? name.replace('@', '%40') : name}@${version}`,
        isDirect: false,
      });
    }
  }
  return { dependencies: deps, lockfileType: 'pnpm-lock.yaml', ecosystem: 'npm' };
}

// ── Python: Pipfile.lock ────────────────────────────────────────

export function parsePipfileLock(content: string): LockfileParseResult {
  const lockfile = JSON.parse(content);
  const deps: ParsedDependency[] = [];
  const defaultDeps = lockfile.default || {};
  for (const [name, meta] of Object.entries(defaultDeps)) {
    const m = meta as any;
    const version = (m.version || '').replace(/^==/, '');
    if (!version) continue;
    const normName = name.toLowerCase().replace(/-/g, '_');
    deps.push({ name, version, ecosystem: 'pip', purl: `pkg:pypi/${normName}@${version}`, isDirect: true });
  }
  return { dependencies: deps, lockfileType: 'Pipfile.lock', ecosystem: 'pip' };
}

// ── Python: poetry.lock ─────────────────────────────────────────

export function parsePoetryLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  const packageRegex = /\[\[package\]\]\s*\n([\s\S]*?)(?=\n\[\[|\n*$)/g;
  let blockMatch;
  while ((blockMatch = packageRegex.exec(content)) !== null) {
    const block = blockMatch[1];
    const nameMatch = block.match(/^name\s*=\s*"([^"]+)"/m);
    const versionMatch = block.match(/^version\s*=\s*"([^"]+)"/m);
    if (!nameMatch || !versionMatch) continue;
    const name = nameMatch[1], version = versionMatch[1];
    const normName = name.toLowerCase().replace(/-/g, '_');
    deps.push({ name, version, ecosystem: 'pip', purl: `pkg:pypi/${normName}@${version}`, isDirect: false });
  }
  return { dependencies: deps, lockfileType: 'poetry.lock', ecosystem: 'pip' };
}

// ── Go: go.sum ──────────────────────────────────────────────────

export function parseGoSum(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  const seen = new Set<string>();
  for (const line of content.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const modulePath = parts[0], rawVersion = parts[1];
    if (!rawVersion.startsWith('v') && !rawVersion.match(/^v?\d/)) continue;
    if (!parts[2].startsWith('h1:')) continue;
    let version = rawVersion.replace(/\/go\.mod$/, '');
    if (rawVersion.endsWith('/go.mod') && seen.has(`${modulePath}@${version}`)) continue;
    version = version.replace(/^v/, '');
    const key = `${modulePath}@${version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deps.push({ name: modulePath, version, ecosystem: 'go', purl: `pkg:golang/${modulePath}@${version}`, isDirect: false });
  }
  return { dependencies: deps, lockfileType: 'go.sum', ecosystem: 'go' };
}

// ── Rust: Cargo.lock ────────────────────────────────────────────

export function parseCargoLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  const packageRegex = /\[\[package\]\]\s*\n([\s\S]*?)(?=\n\[\[|\n*$)/g;
  let blockMatch;
  while ((blockMatch = packageRegex.exec(content)) !== null) {
    const block = blockMatch[1];
    const nameMatch = block.match(/^name\s*=\s*"([^"]+)"/m);
    const versionMatch = block.match(/^version\s*=\s*"([^"]+)"/m);
    if (!nameMatch || !versionMatch) continue;
    deps.push({
      name: nameMatch[1], version: versionMatch[1], ecosystem: 'cargo',
      purl: `pkg:cargo/${nameMatch[1]}@${versionMatch[1]}`, isDirect: false,
    });
  }
  return { dependencies: deps, lockfileType: 'Cargo.lock', ecosystem: 'cargo' };
}

// ── Ruby: Gemfile.lock ──────────────────────────────────────────

export function parseGemfileLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  const specRegex = /^ {4}(\S+) \((\d[^)]*)\)/gm;
  let match;
  while ((match = specRegex.exec(content)) !== null) {
    deps.push({ name: match[1], version: match[2], ecosystem: 'gem', purl: `pkg:gem/${match[1]}@${match[2]}`, isDirect: false });
  }
  return { dependencies: deps, lockfileType: 'Gemfile.lock', ecosystem: 'gem' };
}

// ══════════════════════════════════════════════════════════════════
// NEW PARSERS — Dependabot-supported ecosystems
// ══════════════════════════════════════════════════════════════════

// ── Java: build.gradle.lock ─────────────────────────────────────

export function parseGradleLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([^:]+):([^:]+):([^=\s]+)/);
      if (match) {
        const [, groupId, artifactId, version] = match;
        deps.push({
          name: `${groupId}:${artifactId}`, version, ecosystem: 'maven',
          purl: `pkg:maven/${groupId}/${artifactId}@${version}`, isDirect: false,
        });
      }
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'build.gradle.lock', ecosystem: 'maven' };
}

// ── C#: packages.lock.json (NuGet) ──────────────────────────────

export function parseNuGetLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const json = JSON.parse(content);
    const frameworks = json.dependencies || {};
    const seen = new Set<string>();
    for (const framework of Object.keys(frameworks)) {
      for (const [name, info] of Object.entries(frameworks[framework] || {}) as [string, any][]) {
        const version = info?.resolved || info?.version || '';
        const key = `${name}@${version}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deps.push({ name, version, ecosystem: 'nuget', purl: `pkg:nuget/${name}@${version}`, isDirect: info?.type === 'Direct' });
      }
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'packages.lock.json', ecosystem: 'nuget' };
}

// ── PHP: composer.lock ──────────────────────────────────────────

export function parseComposerLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const json = JSON.parse(content);
    for (const pkg of [...(json.packages || []), ...(json['packages-dev'] || [])]) {
      if (!pkg.name) continue;
      let version = pkg.version || '';
      if (version.startsWith('v') || version.startsWith('V')) version = version.slice(1);
      deps.push({ name: pkg.name, version, ecosystem: 'composer', purl: `pkg:composer/${pkg.name}@${version}`, isDirect: false });
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'composer.lock', ecosystem: 'composer' };
}

// ── Swift: Package.resolved ─────────────────────────────────────

export function parseSwiftPackageResolved(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const json = JSON.parse(content);
    let pins: any[] = [];
    if (json.pins && Array.isArray(json.pins)) pins = json.pins;
    else if (json.object?.pins && Array.isArray(json.object.pins)) pins = json.object.pins;
    for (const pin of pins) {
      const name = pin.identity || pin.package || '';
      if (!name) continue;
      const version = pin.state?.version || pin.state?.revision || '';
      deps.push({ name, version, ecosystem: 'swift', purl: `pkg:swift/${name}${version ? '@' + version : ''}`, isDirect: true });
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'Package.resolved', ecosystem: 'swift' };
}

// ── Dart: pubspec.lock ──────────────────────────────────────────

export function parsePubspecLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const lines = content.split('\n');
    let inPackages = false, currentPackage = '';
    for (const line of lines) {
      if (/^packages:/.test(line)) { inPackages = true; continue; }
      if (!inPackages) continue;
      if (/^\S/.test(line) && !line.startsWith(' ')) { inPackages = false; continue; }
      const pkgMatch = line.match(/^  (\S[^:]*):$/);
      if (pkgMatch) { currentPackage = pkgMatch[1].trim(); continue; }
      if (currentPackage) {
        const verMatch = line.match(/^\s+version:\s*"?([^"\s]+)"?/);
        if (verMatch) {
          deps.push({ name: currentPackage, version: verMatch[1], ecosystem: 'pub', purl: `pkg:pub/${currentPackage}@${verMatch[1]}`, isDirect: false });
          currentPackage = '';
        }
      }
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'pubspec.lock', ecosystem: 'pub' };
}

// ── Elixir: mix.lock ────────────────────────────────────────────

export function parseMixLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const regex = /"([^"]+)":\s*\{:hex,\s*:([^,]+),\s*"([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      deps.push({ name: match[1], version: match[3], ecosystem: 'hex', purl: `pkg:hex/${match[1]}@${match[3]}`, isDirect: true });
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'mix.lock', ecosystem: 'hex' };
}

// ── Terraform: .terraform.lock.hcl ──────────────────────────────

export function parseTerraformLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const providerRegex = /provider\s+"([^"]+)"\s*\{([^}]*)\}/g;
    let providerMatch: RegExpExecArray | null;
    while ((providerMatch = providerRegex.exec(content)) !== null) {
      let cleanPath = providerMatch[1];
      const versionMatch = providerMatch[2].match(/version\s*=\s*"([^"]+)"/);
      const version = versionMatch ? versionMatch[1] : '';
      if (cleanPath.startsWith('registry.terraform.io/')) cleanPath = cleanPath.slice('registry.terraform.io/'.length);
      deps.push({ name: cleanPath, version, ecosystem: 'terraform', purl: `pkg:terraform/${cleanPath}${version ? '@' + version : ''}`, isDirect: true });
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: '.terraform.lock.hcl', ecosystem: 'terraform' };
}

// ══════════════════════════════════════════════════════════════════
// NEW PARSERS — NOT supported by Dependabot
// ══════════════════════════════════════════════════════════════════

// ── C/C++: conan.lock ───────────────────────────────────────────

function parseConanRef(ref: string): { dep: ParsedDependency; key: string } | null {
  const cleaned = ref.split('#')[0].split('@')[0];
  const slashIdx = cleaned.indexOf('/');
  if (slashIdx === -1) return null;
  const name = cleaned.slice(0, slashIdx), version = cleaned.slice(slashIdx + 1);
  if (!name) return null;
  return { key: `${name}@${version}`, dep: { name, version, ecosystem: 'conan', purl: `pkg:conan/${name}@${version}`, isDirect: false } };
}

export function parseConanLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const json = JSON.parse(content);
    const seen = new Set<string>();
    for (const list of [json.requires, json.build_requires]) {
      if (Array.isArray(list)) {
        for (const ref of list) {
          const p = parseConanRef(ref);
          if (p && !seen.has(p.key)) { seen.add(p.key); deps.push(p.dep); }
        }
      }
    }
    if (json.graph_lock?.nodes) {
      for (const node of Object.values(json.graph_lock.nodes) as any[]) {
        if (node.ref) {
          const p = parseConanRef(node.ref);
          if (p && !seen.has(p.key)) { seen.add(p.key); deps.push(p.dep); }
        }
      }
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'conan.lock', ecosystem: 'conan' };
}

// ── C/C++: vcpkg.json ───────────────────────────────────────────

export function parseVcpkgJson(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const json = JSON.parse(content);
    for (const dep of (json.dependencies || [])) {
      let name = '', version = '';
      if (typeof dep === 'string') name = dep;
      else if (dep && typeof dep === 'object') { name = dep.name || ''; version = dep['version>='] || dep.version || ''; }
      if (!name) continue;
      deps.push({ name, version, ecosystem: 'vcpkg', purl: `pkg:vcpkg/${name}${version ? '@' + version : ''}`, isDirect: true });
    }
    if (Array.isArray(json.overrides)) {
      const seen = new Set(deps.map(d => d.name));
      for (const ov of json.overrides) {
        if (ov?.name && !seen.has(ov.name)) {
          const v = ov.version || '';
          deps.push({ name: ov.name, version: v, ecosystem: 'vcpkg', purl: `pkg:vcpkg/${ov.name}${v ? '@' + v : ''}`, isDirect: true });
        }
      }
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'vcpkg.json', ecosystem: 'vcpkg' };
}

// ── Erlang: rebar.lock ──────────────────────────────────────────

export function parseRebarLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const regex = /\{<<"([^"]+)">>,\s*\{pkg,\s*<<"([^"]+)">>,\s*<<"([^"]+)">>/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      deps.push({ name: match[1], version: match[3], ecosystem: 'hex', purl: `pkg:hex/${match[1]}@${match[3]}`, isDirect: true });
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'rebar.lock', ecosystem: 'hex' };
}

// ── Haskell: cabal.project.freeze ───────────────────────────────

export function parseCabalFreeze(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const regex = /any\.([^\s]+)\s+==([^\s,]+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      deps.push({ name: match[1], version: match[2], ecosystem: 'hackage', purl: `pkg:hackage/${match[1]}@${match[2]}`, isDirect: false });
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'cabal.project.freeze', ecosystem: 'hackage' };
}

// ── Haskell: stack.yaml.lock ────────────────────────────────────

export function parseStackLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const regex = /hackage:\s+(.+)-(\d[\d.]*\d)@/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      deps.push({ name: match[1], version: match[2], ecosystem: 'hackage', purl: `pkg:hackage/${match[1]}@${match[2]}`, isDirect: false });
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'stack.yaml.lock', ecosystem: 'hackage' };
}

// ── R: renv.lock ────────────────────────────────────────────────

export function parseRenvLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const json = JSON.parse(content);
    for (const [key, info] of Object.entries(json.Packages || {}) as [string, any][]) {
      const name = info?.Package || key, version = info?.Version || '';
      if (!name) continue;
      deps.push({ name, version, ecosystem: 'cran', purl: `pkg:cran/${name}${version ? '@' + version : ''}`, isDirect: false });
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'renv.lock', ecosystem: 'cran' };
}

// ── Julia: Manifest.toml ────────────────────────────────────────

export function parseJuliaManifest(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const lines = content.split('\n');
    let currentPackage = '';
    for (const line of lines) {
      const trimmed = line.trim();
      const depsMatch = trimmed.match(/^\[\[deps\.([^\]]+)\]\]/);
      if (depsMatch) { currentPackage = depsMatch[1].trim(); continue; }
      const directMatch = trimmed.match(/^\[\[([A-Za-z][A-Za-z0-9_]*)\]\]/);
      if (directMatch) { currentPackage = directMatch[1].trim(); continue; }
      if (trimmed.startsWith('[') && !trimmed.startsWith('[[')) { currentPackage = ''; continue; }
      if (currentPackage) {
        const verMatch = trimmed.match(/^version\s*=\s*"([^"]+)"/);
        if (verMatch) {
          deps.push({ name: currentPackage, version: verMatch[1], ecosystem: 'julia', purl: `pkg:julia/${currentPackage}@${verMatch[1]}`, isDirect: false });
          currentPackage = '';
        }
      }
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'Manifest.toml', ecosystem: 'julia' };
}

// ── Nix: flake.lock ─────────────────────────────────────────────

export function parseNixFlakeLock(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const json = JSON.parse(content);
    const seen = new Set<string>();
    for (const [key, node] of Object.entries(json.nodes || {}) as [string, any][]) {
      if (key === 'root') continue;
      const locked = node.locked;
      if (!locked) continue;
      const owner = locked.owner || '', repo = locked.repo || '', rev = locked.rev || '';
      if (!owner && !repo) continue;
      const name = owner && repo ? `${owner}/${repo}` : repo || owner;
      const seeKey = `${name}@${rev}`;
      if (seen.has(seeKey)) continue;
      seen.add(seeKey);
      deps.push({ name, version: rev, ecosystem: 'nix', purl: `pkg:nix/${name}${rev ? '@' + rev : ''}`, isDirect: false });
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'flake.lock', ecosystem: 'nix' };
}

// ══════════════════════════════════════════════════════════════════
// NEW PARSERS — Manifests (fallback, lower priority than lockfiles)
// ══════════════════════════════════════════════════════════════════

// ── Python: requirements.txt ────────────────────────────────────

export function parseRequirementsTxt(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-r ') ||
          trimmed.startsWith('-e ') || trimmed.startsWith('-i ') ||
          trimmed.startsWith('--') || trimmed.startsWith('-c ') || trimmed.startsWith('-f ')) continue;
      const noComment = trimmed.split('#')[0].trim();
      if (!noComment) continue;
      const noMarker = noComment.split(';')[0].trim();
      const noExtras = noMarker.replace(/\[[^\]]*\]/, '');
      const match = noExtras.match(/^([A-Za-z0-9_][A-Za-z0-9._-]*)\s*(==|>=|~=|<=|!=|===)\s*([^\s;,]+)/);
      if (match) {
        deps.push({ name: match[1], version: match[3], ecosystem: 'pypi', purl: `pkg:pypi/${match[1].toLowerCase()}@${match[3]}`, isDirect: true });
      } else {
        const nameOnly = noExtras.match(/^([A-Za-z0-9_][A-Za-z0-9._-]*)\s*$/);
        if (nameOnly) deps.push({ name: nameOnly[1], version: '', ecosystem: 'pypi', purl: `pkg:pypi/${nameOnly[1].toLowerCase()}`, isDirect: true });
      }
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'requirements.txt', ecosystem: 'pypi' };
}

// ── Python: pyproject.toml ──────────────────────────────────────

export function parsePyprojectToml(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const seen = new Set<string>();
    // PEP 621: dependencies = [...] arrays
    const depsBlockRegex = /dependencies\s*=\s*\[([\s\S]*?)\]/g;
    let blockMatch: RegExpExecArray | null;
    while ((blockMatch = depsBlockRegex.exec(content)) !== null) {
      const entryRegex = /"([^"]+)"|'([^']+)'/g;
      let entryMatch: RegExpExecArray | null;
      while ((entryMatch = entryRegex.exec(blockMatch[1])) !== null) {
        const entry = (entryMatch[1] || entryMatch[2]).trim();
        if (!entry) continue;
        const noExtras = entry.split(';')[0].trim().replace(/\[[^\]]*\]/, '');
        const pinned = noExtras.match(/^([A-Za-z0-9_][A-Za-z0-9._-]*)\s*(==|>=|~=)\s*([^\s,;]+)/);
        if (pinned && !seen.has(pinned[1].toLowerCase())) {
          seen.add(pinned[1].toLowerCase());
          deps.push({ name: pinned[1], version: pinned[3], ecosystem: 'pypi', purl: `pkg:pypi/${pinned[1].toLowerCase()}@${pinned[3]}`, isDirect: true });
        } else {
          const nameOnly = noExtras.match(/^([A-Za-z0-9_][A-Za-z0-9._-]*)/);
          if (nameOnly && !seen.has(nameOnly[1].toLowerCase())) {
            seen.add(nameOnly[1].toLowerCase());
            deps.push({ name: nameOnly[1], version: '', ecosystem: 'pypi', purl: `pkg:pypi/${nameOnly[1].toLowerCase()}`, isDirect: true });
          }
        }
      }
    }
    // Poetry: [tool.poetry.dependencies]
    const poetrySection = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\n\[|$)/);
    if (poetrySection) {
      for (const line of poetrySection[1].split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[') || trimmed.startsWith('python')) continue;
        const simple = trimmed.match(/^([A-Za-z0-9_][A-Za-z0-9._-]*)\s*=\s*"([^"]+)"/);
        if (simple && !seen.has(simple[1].toLowerCase())) {
          seen.add(simple[1].toLowerCase());
          const v = simple[2].replace(/^[\^~>=<!]+/, '');
          deps.push({ name: simple[1], version: v, ecosystem: 'pypi', purl: `pkg:pypi/${simple[1].toLowerCase()}@${v}`, isDirect: true });
          continue;
        }
        const table = trimmed.match(/^([A-Za-z0-9_][A-Za-z0-9._-]*)\s*=\s*\{.*version\s*=\s*"([^"]+)"/);
        if (table && !seen.has(table[1].toLowerCase())) {
          seen.add(table[1].toLowerCase());
          const v = table[2].replace(/^[\^~>=<!]+/, '');
          deps.push({ name: table[1], version: v, ecosystem: 'pypi', purl: `pkg:pypi/${table[1].toLowerCase()}@${v}`, isDirect: true });
        }
      }
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'pyproject.toml', ecosystem: 'pypi' };
}

// ── Go: go.mod ──────────────────────────────────────────────────

export function parseGoMod(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const lines = content.split('\n');
    let inRequireBlock = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('require (') || trimmed === 'require (') { inRequireBlock = true; continue; }
      if (inRequireBlock && trimmed === ')') { inRequireBlock = false; continue; }
      const singleMatch = trimmed.match(/^require\s+(\S+)\s+(\S+)/);
      if (singleMatch) {
        deps.push({ name: singleMatch[1], version: singleMatch[2], ecosystem: 'go', purl: `pkg:golang/${singleMatch[1]}@${singleMatch[2]}`, isDirect: !trimmed.includes('// indirect') });
        continue;
      }
      if (inRequireBlock) {
        if (!trimmed || trimmed.startsWith('//')) continue;
        const match = trimmed.match(/^(\S+)\s+(\S+)/);
        if (match) deps.push({ name: match[1], version: match[2], ecosystem: 'go', purl: `pkg:golang/${match[1]}@${match[2]}`, isDirect: !trimmed.includes('// indirect') });
      }
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'go.mod', ecosystem: 'go' };
}

// ── Rust: Cargo.toml (manifest fallback) ────────────────────────

export function parseCargoToml(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const lines = content.split('\n');
    let inDeps = false;
    for (const line of lines) {
      const trimmed = line.trim();
      const sectionMatch = trimmed.match(/^\[([^\]]+)\]/);
      if (sectionMatch) { inDeps = /dependencies$/.test(sectionMatch[1].trim()); continue; }
      if (!inDeps || !trimmed || trimmed.startsWith('#')) continue;
      const simpleMatch = trimmed.match(/^([A-Za-z0-9_][A-Za-z0-9_-]*)\s*=\s*"([^"]+)"/);
      if (simpleMatch) {
        const v = simpleMatch[2].replace(/^[\^~>=<!*]+/, '');
        deps.push({ name: simpleMatch[1], version: v, ecosystem: 'cargo', purl: `pkg:cargo/${simpleMatch[1]}@${v}`, isDirect: true });
        continue;
      }
      const tableMatch = trimmed.match(/^([A-Za-z0-9_][A-Za-z0-9_-]*)\s*=\s*\{.*version\s*=\s*"([^"]+)"/);
      if (tableMatch) {
        const v = tableMatch[2].replace(/^[\^~>=<!*]+/, '');
        deps.push({ name: tableMatch[1], version: v, ecosystem: 'cargo', purl: `pkg:cargo/${tableMatch[1]}@${v}`, isDirect: true });
      }
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'Cargo.toml', ecosystem: 'cargo' };
}

// ── Java: pom.xml (manifest fallback) ───────────────────────────

export function parsePomXml(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    const depRegex = /<dependency>\s*([\s\S]*?)\s*<\/dependency>/g;
    let depMatch: RegExpExecArray | null;
    while ((depMatch = depRegex.exec(content)) !== null) {
      const block = depMatch[1];
      const groupMatch = block.match(/<groupId>\s*([^<]+)\s*<\/groupId>/);
      const artMatch = block.match(/<artifactId>\s*([^<]+)\s*<\/artifactId>/);
      const verMatch = block.match(/<version>\s*([^<$]+)\s*<\/version>/);
      if (!groupMatch || !artMatch || !verMatch) continue;
      const version = verMatch[1].trim();
      if (version.startsWith('$')) continue; // skip property references
      const groupId = groupMatch[1].trim(), artifactId = artMatch[1].trim();
      deps.push({
        name: `${groupId}:${artifactId}`, version, ecosystem: 'maven',
        purl: `pkg:maven/${groupId}/${artifactId}@${version}`, isDirect: true,
      });
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'pom.xml', ecosystem: 'maven' };
}

// ── Docker: Dockerfile ──────────────────────────────────────────

export function parseDockerfile(content: string): LockfileParseResult {
  const deps: ParsedDependency[] = [];
  try {
    // Join continuation lines
    const joined: string[] = [];
    let buffer = '';
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.endsWith('\\')) { buffer += trimmed.slice(0, -1) + ' '; }
      else { buffer += trimmed; joined.push(buffer); buffer = ''; }
    }
    if (buffer) joined.push(buffer);

    const seenImages = new Set<string>();
    const seenPackages = new Set<string>();

    for (const line of joined) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;

      // FROM image:tag
      const fromMatch = trimmed.match(/^FROM\s+(?:--platform=\S+\s+)?(\S+)/i);
      if (fromMatch) {
        let image = fromMatch[1];
        if (image.toLowerCase() === 'scratch' || image.startsWith('$')) continue;
        let tag = '';
        const atIdx = image.indexOf('@');
        if (atIdx !== -1) { tag = image.slice(atIdx + 1); image = image.slice(0, atIdx); }
        const colonIdx = image.indexOf(':');
        if (colonIdx !== -1 && !tag) { tag = image.slice(colonIdx + 1); image = image.slice(0, colonIdx); }
        const key = `${image}:${tag}`;
        if (!seenImages.has(key)) {
          seenImages.add(key);
          deps.push({ name: image, version: tag || 'latest', ecosystem: 'docker', purl: `pkg:docker/${image}@${tag || 'latest'}`, isDirect: true });
        }
        continue;
      }

      // RUN apt-get install / apk add / yum install
      const pkgMatch = trimmed.match(/(?:apt-get|apt)\s+install\s+(?:-[^\s]+\s+)*(.+)/i) ||
                        trimmed.match(/apk\s+(?:--[^\s]+\s+)*add\s+(?:--[^\s]+\s+)*(.+)/i) ||
                        trimmed.match(/(?:yum|dnf)\s+install\s+(?:-[^\s]+\s+)*(.+)/i);
      if (pkgMatch) {
        for (const token of pkgMatch[1].split(/\s+/)) {
          const clean = token.trim();
          if (clean === '&&' || clean === '||' || clean === ';' || clean === '|') break;
          if (clean.startsWith('-') || !clean || clean.startsWith('>') || clean.startsWith('<')) continue;
          let name = clean, version = '';
          const eqIdx = clean.indexOf('=');
          if (eqIdx !== -1) { name = clean.slice(0, eqIdx); version = clean.slice(eqIdx + 1); }
          if (!name || seenPackages.has(name)) continue;
          seenPackages.add(name);
          deps.push({ name, version, ecosystem: 'system', purl: version ? `pkg:generic/${name}@${version}` : `pkg:generic/${name}`, isDirect: true });
        }
      }
    }
  } catch { /* graceful empty */ }
  return { dependencies: deps, lockfileType: 'Dockerfile', ecosystem: 'docker' };
}

// ══════════════════════════════════════════════════════════════════
// DISPATCHER — Registration order determines fallback priority
// ══════════════════════════════════════════════════════════════════

export const LOCKFILE_CONFIGS: Array<{ filename: string; parser: (content: string) => LockfileParseResult }> = [
  // ── Existing parsers (tested, 49 tests pass) ──
  { filename: 'package-lock.json', parser: parsePackageLockJson },
  { filename: 'yarn.lock', parser: parseYarnLock },
  { filename: 'pnpm-lock.yaml', parser: parsePnpmLock },
  { filename: 'Pipfile.lock', parser: parsePipfileLock },
  { filename: 'poetry.lock', parser: parsePoetryLock },
  { filename: 'go.sum', parser: parseGoSum },
  { filename: 'Cargo.lock', parser: parseCargoLock },
  { filename: 'Gemfile.lock', parser: parseGemfileLock },
  // ── Dependabot-supported ecosystems ──
  { filename: 'build.gradle.lock', parser: parseGradleLock },
  { filename: 'packages.lock.json', parser: parseNuGetLock },
  { filename: 'composer.lock', parser: parseComposerLock },
  { filename: 'Package.resolved', parser: parseSwiftPackageResolved },
  { filename: 'pubspec.lock', parser: parsePubspecLock },
  { filename: 'mix.lock', parser: parseMixLock },
  { filename: '.terraform.lock.hcl', parser: parseTerraformLock },
  // ── Non-Dependabot ecosystems ──
  { filename: 'conan.lock', parser: parseConanLock },
  { filename: 'vcpkg.json', parser: parseVcpkgJson },
  { filename: 'rebar.lock', parser: parseRebarLock },
  { filename: 'cabal.project.freeze', parser: parseCabalFreeze },
  { filename: 'stack.yaml.lock', parser: parseStackLock },
  { filename: 'renv.lock', parser: parseRenvLock },
  { filename: 'Manifest.toml', parser: parseJuliaManifest },
  { filename: 'flake.lock', parser: parseNixFlakeLock },
  // ── Manifests (fallback — lower priority than lockfiles) ──
  { filename: 'requirements.txt', parser: parseRequirementsTxt },
  { filename: 'pyproject.toml', parser: parsePyprojectToml },
  { filename: 'go.mod', parser: parseGoMod },
  { filename: 'Cargo.toml', parser: parseCargoToml },
  { filename: 'pom.xml', parser: parsePomXml },
  { filename: 'Dockerfile', parser: parseDockerfile },
];

export function parseLockfile(filename: string, content: string): LockfileParseResult {
  const config = LOCKFILE_CONFIGS.find(c => c.filename === filename);
  if (!config) throw new Error(`Unsupported lockfile: ${filename}`);
  return config.parser(content);
}
