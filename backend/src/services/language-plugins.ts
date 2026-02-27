// language-plugins.ts
// Plugin system for detecting programming languages and extracting import/dependency information for SBOM generation.
// No external dependencies — all detection and parsing uses regex/string matching.

export interface ImportEntry {
  raw: string;
  module: string;
  isStdLib: boolean;
}

export interface DetectedPackage {
  name: string;
  version: string;
  ecosystem: string;
  purl: string;
}

export interface LanguagePlugin {
  id: string;
  label: string;
  extensions: string[];
  detect: (content: string, filename: string) => number;
  extractImports: (content: string) => ImportEntry[];
  isStdLib: (module: string) => boolean;
  mapToPackage: (module: string) => DetectedPackage | null;
}

/* ------------------------------------------------------------------ */
/*  Helper: generic detect function                                    */
/* ------------------------------------------------------------------ */

function buildDetect(
  extensions: string[],
  patterns: RegExp[],
  negativePatterns?: RegExp[],
): (content: string, filename: string) => number {
  return (content: string, filename: string): number => {
    let score = 0;
    const ext = filename.substring(filename.lastIndexOf('.'));
    if (extensions.includes(ext)) score += 40;

    for (const p of patterns) {
      if (p.test(content)) {
        score += 15;
        if (score >= 100) return 100;
      }
    }

    if (negativePatterns) {
      for (const np of negativePatterns) {
        if (np.test(content)) return 0;
      }
    }

    return Math.min(score, 100);
  };
}

function dedup(entries: ImportEntry[]): ImportEntry[] {
  const seen = new Set<string>();
  const result: ImportEntry[] = [];
  for (const e of entries) {
    if (!seen.has(e.module)) {
      seen.add(e.module);
      result.push(e);
    }
  }
  return result;
}

/* ================================================================== */
/*  1. Python                                                          */
/* ================================================================== */

const PYTHON_STDLIB = new Set([
  'os', 'sys', 'json', 're', 'math', 'datetime', 'collections', 'typing',
  'pathlib', 'unittest', 'http', 'urllib', 'hashlib', 'logging', 'io', 'abc',
  'asyncio', 'functools', 'itertools', 'string', 'textwrap', 'struct',
  'codecs', 'time', 'calendar', 'argparse', 'getpass', 'platform', 'socket',
  'email', 'html', 'xml', 'sqlite3', 'csv', 'configparser', 'copy', 'pprint',
  'enum', 'dataclasses', 'contextlib', 'decimal', 'fractions', 'random',
  'statistics', 'array', 'queue', 'heapq', 'bisect', 'weakref', 'types',
  'traceback', 'warnings', 'subprocess', 'multiprocessing', 'threading',
  'signal', 'mmap', 'select', 'selectors', 'syslog', 'shutil', 'tempfile',
  'glob', 'fnmatch', 'zipfile', 'tarfile', 'gzip', 'bz2', 'lzma', 'zlib',
  'pdb', 'cProfile', 'timeit', 'doctest', 'venv', 'ensurepip', 'distutils',
  'importlib', 'pkgutil', 'inspect',
]);

const pythonPlugin: LanguagePlugin = {
  id: 'python',
  label: 'Python',
  extensions: ['.py'],
  detect: buildDetect(
    ['.py'],
    [/\bdef /, /\bimport /, /\bfrom \S+ import/, /\bclass \w+.*:/, /if __name__/],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re1 = /^import\s+(\S+)/gm;
    const re2 = /^from\s+(\S+)\s+import/gm;
    let m: RegExpExecArray | null;
    while ((m = re1.exec(content)) !== null) {
      const mod = m[1].split('.')[0];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    while ((m = re2.exec(content)) !== null) {
      const mod = m[1].split('.')[0];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return PYTHON_STDLIB.has(module.split('.')[0]);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    return { name: module, version: '', ecosystem: 'pypi', purl: `pkg:pypi/${module}` };
  },
};

/* ================================================================== */
/*  2. JavaScript/TypeScript                                           */
/* ================================================================== */

const JSTS_STDLIB = new Set([
  'fs', 'path', 'http', 'https', 'os', 'crypto', 'stream', 'events', 'util',
  'url', 'buffer', 'querystring', 'child_process', 'cluster', 'dgram', 'dns',
  'net', 'readline', 'repl', 'tls', 'tty', 'vm', 'zlib', 'assert',
  'perf_hooks', 'worker_threads', 'v8', 'process', 'console', 'module',
  'timers',
]);

const jstsPlugin: LanguagePlugin = {
  id: 'jsts',
  label: 'JavaScript/TypeScript',
  extensions: ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'],
  detect: buildDetect(
    ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'],
    [/\bconst /, /require\(/, /\bimport /, /\bexport /, /\bfunction /, /=>/, /\basync /],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const patterns = [
      /require\(\s*['"]([^'"]+)['"]\s*\)/g,
      /from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
    ];
    for (const re of patterns) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const raw = m[0];
        const specifier = m[1];
        // Skip relative imports
        if (specifier.startsWith('.') || specifier.startsWith('/')) continue;
        // Normalise: @scope/name stays, lodash/fp -> lodash
        let mod: string;
        if (specifier.startsWith('@')) {
          const parts = specifier.split('/');
          mod = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
        } else {
          mod = specifier.split('/')[0];
        }
        entries.push({ raw, module: mod, isStdLib: this.isStdLib(mod) });
      }
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    const base = module.startsWith('node:') ? module.slice(5) : module;
    return JSTS_STDLIB.has(base);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    const encoded = module.startsWith('@')
      ? `%40${module.slice(1)}`
      : module;
    return { name: module, version: '', ecosystem: 'npm', purl: `pkg:npm/${encoded}` };
  },
};

/* ================================================================== */
/*  3. Java                                                            */
/* ================================================================== */

const javaPlugin: LanguagePlugin = {
  id: 'java',
  label: 'Java',
  extensions: ['.java'],
  detect: buildDetect(
    ['.java'],
    [/\bpublic class\b/, /\bimport java\./, /\bpackage com\./, /System\.out/, /\bprivate /, /\bprotected /],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re = /^import\s+(?:static\s+)?([\w.]+)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const full = m[1];
      const segments = full.split('.');
      // Use first 2-3 segments as the package identifier
      const mod = segments.length >= 3 ? segments.slice(0, 3).join('.') : full;
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(full) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return /^(java|javax|sun|jdk)\./.test(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    const segments = module.split('.');
    const topPackage = segments.length >= 3 ? segments.slice(0, 3).join('.') : module;
    return { name: topPackage, version: '', ecosystem: 'maven', purl: `pkg:maven/${topPackage}` };
  },
};

/* ================================================================== */
/*  4. C#                                                              */
/* ================================================================== */

const csharpPlugin: LanguagePlugin = {
  id: 'csharp',
  label: 'C#',
  extensions: ['.cs'],
  detect: buildDetect(
    ['.cs'],
    [/\busing System/, /\bnamespace /, /\bpublic class\b/, /Console\.Write/, /\bvar /, /\basync Task/],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re = /^using\s+([\w.]+)\s*;/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return /^(System|Microsoft|Windows)\./.test(module) || module === 'System';
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    // Take first two dot-segments or the whole thing
    const segments = module.split('.');
    const name = segments.length >= 2 ? segments.slice(0, 2).join('.') : module;
    return { name, version: '', ecosystem: 'nuget', purl: `pkg:nuget/${name}` };
  },
};

/* ================================================================== */
/*  5. Ruby                                                            */
/* ================================================================== */

const RUBY_STDLIB = new Set([
  'json', 'csv', 'net/http', 'fileutils', 'optparse', 'set', 'yaml', 'erb',
  'logger', 'open-uri', 'uri', 'ostruct', 'benchmark', 'bigdecimal', 'date',
  'digest', 'drb', 'English', 'fiddle', 'forwardable', 'io/console', 'io/wait',
  'ipaddr', 'irb', 'matrix', 'minitest', 'monitor', 'mutex_m', 'net/ftp',
  'net/imap', 'net/pop', 'net/smtp', 'observer', 'open3', 'openssl', 'pathname',
  'pp', 'prettyprint', 'prime', 'pstore', 'racc', 'readline', 'reline',
  'resolv', 'ripper', 'securerandom', 'shellwords', 'singleton', 'stringio',
  'strscan', 'syslog', 'tempfile', 'timeout', 'tmpdir', 'tsort', 'un',
  'weakref', 'webrick', 'zlib',
]);

const rubyPlugin: LanguagePlugin = {
  id: 'ruby',
  label: 'Ruby',
  extensions: ['.rb'],
  detect: buildDetect(
    ['.rb'],
    [/require ['"]/, /class \w+ < /, /\bdef /, /\bend\b/, /attr_accessor/, /\bputs /, /\bmodule /],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re1 = /^require\s+['"]([^'"]+)['"]/gm;
    const re2 = /^gem\s+['"]([^'"]+)['"]/gm;
    let m: RegExpExecArray | null;
    while ((m = re1.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    while ((m = re2.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: false });
    }
    // Skip require_relative (project-local)
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return RUBY_STDLIB.has(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    return { name: module, version: '', ecosystem: 'gem', purl: `pkg:gem/${module}` };
  },
};

/* ================================================================== */
/*  6. PHP                                                             */
/* ================================================================== */

const phpPlugin: LanguagePlugin = {
  id: 'php',
  label: 'PHP',
  extensions: ['.php'],
  detect: buildDetect(
    ['.php'],
    [/<\?php/, /\bnamespace /, /\buse /, /\bfunction /, /\bclass /, /\becho /, /\$/],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re = /^use\s+([\w\\]+)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const full = m[1];
      const segments = full.split('\\').filter(Boolean);
      // Take first two backslash segments, lowercase
      const mod = segments.length >= 2
        ? `${segments[0].toLowerCase()}/${segments[1].toLowerCase()}`
        : segments[0].toLowerCase();
      entries.push({ raw: m[0], module: mod, isStdLib: false });
    }
    return dedup(entries);
  },
  isStdLib(_module: string): boolean {
    // PHP has no stdlib imports — all `use` statements are userland namespaces
    return false;
  },
  mapToPackage(module: string): DetectedPackage | null {
    return { name: module, version: '', ecosystem: 'composer', purl: `pkg:composer/${module}` };
  },
};

/* ================================================================== */
/*  7. Go                                                              */
/* ================================================================== */

const goPlugin: LanguagePlugin = {
  id: 'go',
  label: 'Go',
  extensions: ['.go'],
  detect: buildDetect(
    ['.go'],
    [/\bpackage /, /\bfunc /, /import "/, /\bgo func/, /\bvar /, /\btype /, /interface\s*\{/],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    // Handle both: import "fmt" and import (\n"fmt"\n"os"\n)
    const blockRe = /import\s*\(([\s\S]*?)\)/g;
    const singleRe = /import\s+"([^"]+)"/g;
    const innerRe = /"([^"]+)"/g;

    let m: RegExpExecArray | null;
    // Block imports
    while ((m = blockRe.exec(content)) !== null) {
      const block = m[1];
      let inner: RegExpExecArray | null;
      while ((inner = innerRe.exec(block)) !== null) {
        const mod = inner[1];
        entries.push({ raw: inner[0], module: mod, isStdLib: this.isStdLib(mod) });
      }
    }
    // Single imports (outside blocks)
    while ((m = singleRe.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    // Standard library packages have no dot in the path
    return !module.includes('.');
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    // For external packages (contains dot), take first 3 path segments for github.com
    const segments = module.split('/');
    const name = segments.length >= 3 ? segments.slice(0, 3).join('/') : module;
    return { name, version: '', ecosystem: 'golang', purl: `pkg:golang/${name}` };
  },
};

/* ================================================================== */
/*  8. Rust                                                            */
/* ================================================================== */

const RUST_STDLIB = new Set(['std', 'core', 'alloc', 'proc_macro']);

const rustPlugin: LanguagePlugin = {
  id: 'rust',
  label: 'Rust',
  extensions: ['.rs'],
  detect: buildDetect(
    ['.rs'],
    [/fn main\(\)/, /\buse std::/, /\blet mut /, /\bimpl /, /\bpub fn/, /\bmatch /, /#\[derive/],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re = /^use\s+([a-z_][a-z0-9_]*)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return RUST_STDLIB.has(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    return { name: module, version: '', ecosystem: 'cargo', purl: `pkg:cargo/${module}` };
  },
};

/* ================================================================== */
/*  9. Dart                                                            */
/* ================================================================== */

const dartPlugin: LanguagePlugin = {
  id: 'dart',
  label: 'Dart',
  extensions: ['.dart'],
  detect: buildDetect(
    ['.dart'],
    [/import ['"]package:/, /void main\(\)/, /class \w+ extends/, /\bWidget /, /@override/],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    // package imports
    const rePkg = /^import\s+['"]package:([^/'"]+)/gm;
    // dart: imports
    const reDart = /^import\s+['"]dart:([^'"]+)['"]/gm;
    let m: RegExpExecArray | null;
    while ((m = rePkg.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: false });
    }
    while ((m = reDart.exec(content)) !== null) {
      const mod = `dart:${m[1]}`;
      entries.push({ raw: m[0], module: mod, isStdLib: true });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return module.startsWith('dart:');
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    return { name: module, version: '', ecosystem: 'pub', purl: `pkg:pub/${module}` };
  },
};

/* ================================================================== */
/*  10. Elixir                                                         */
/* ================================================================== */

const ELIXIR_STDLIB = new Set([
  'Kernel', 'Enum', 'Map', 'String', 'IO', 'File', 'Path', 'List', 'Tuple',
  'Agent', 'Task', 'GenServer', 'Supervisor', 'Application', 'Logger', 'Access',
  'Base', 'Code', 'Date', 'DateTime', 'Exception', 'Float', 'Function',
  'Integer', 'Macro', 'MapSet', 'Module', 'NaiveDateTime', 'Process',
  'Protocol', 'Range', 'Regex', 'Registry', 'Stream', 'System', 'Time',
  'URI', 'Version',
]);

const elixirPlugin: LanguagePlugin = {
  id: 'elixir',
  label: 'Elixir',
  extensions: ['.ex', '.exs'],
  detect: buildDetect(
    ['.ex', '.exs'],
    [/\bdefmodule /, /\bdef /, /\buse /, /\bimport /, /\balias /, /\|>/, /\bdo\b/, /\bend\b/],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    // From mix.exs deps
    const reDeps = /\{:(\w+),\s*["'](?:~>|>=|>)/g;
    let m: RegExpExecArray | null;
    while ((m = reDeps.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return ELIXIR_STDLIB.has(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    return { name: module, version: '', ecosystem: 'hex', purl: `pkg:hex/${module}` };
  },
};

/* ================================================================== */
/*  11. Swift                                                          */
/* ================================================================== */

const SWIFT_STDLIB = new Set([
  'Foundation', 'UIKit', 'SwiftUI', 'Combine', 'CoreData', 'CoreGraphics',
  'CoreLocation', 'MapKit', 'AVFoundation', 'CloudKit', 'GameKit', 'HealthKit',
  'HomeKit', 'Metal', 'MetalKit', 'SceneKit', 'SpriteKit', 'StoreKit',
  'WatchKit', 'AppKit', 'Cocoa', 'Darwin', 'Dispatch', 'ObjectiveC', 'os',
  'Swift', 'XCTest', 'Accelerate', 'CoreFoundation', 'CoreImage', 'CoreML',
  'CoreMotion', 'CoreText', 'CryptoKit', 'NaturalLanguage', 'Network',
  'PDFKit', 'QuartzCore', 'RealityKit', 'Security', 'Vision', 'WebKit',
]);

const swiftPlugin: LanguagePlugin = {
  id: 'swift',
  label: 'Swift',
  extensions: ['.swift'],
  detect: buildDetect(
    ['.swift'],
    [/\bimport Foundation/, /\bfunc /, /\blet /, /\bvar /, /\bstruct /, /\bclass /, /\bprotocol /, /\bguard let/],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re = /^import\s+(\w+)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return SWIFT_STDLIB.has(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    return { name: module, version: '', ecosystem: 'swift', purl: `pkg:swift/${module}` };
  },
};

/* ================================================================== */
/*  12. Terraform                                                      */
/* ================================================================== */

const terraformPlugin: LanguagePlugin = {
  id: 'terraform',
  label: 'Terraform',
  extensions: ['.tf'],
  detect: buildDetect(
    ['.tf'],
    [/resource "/, /provider "/, /variable "/, /module "/, /data "/, /output "/],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re = /source\s*=\s*"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: false });
    }
    return dedup(entries);
  },
  isStdLib(_module: string): boolean {
    return false;
  },
  mapToPackage(module: string): DetectedPackage | null {
    // hashicorp/consul/aws -> pkg:terraform/hashicorp/consul
    const segments = module.split('/');
    const name = segments.length >= 2 ? segments.slice(0, 2).join('/') : module;
    return { name, version: '', ecosystem: 'terraform', purl: `pkg:terraform/${name}` };
  },
};

/* ================================================================== */
/*  13. C                                                              */
/* ================================================================== */

const C_STDLIB = new Set([
  'stdio.h', 'stdlib.h', 'string.h', 'math.h', 'ctype.h', 'errno.h',
  'float.h', 'limits.h', 'locale.h', 'setjmp.h', 'signal.h', 'stdarg.h',
  'stddef.h', 'time.h', 'assert.h', 'complex.h', 'fenv.h', 'inttypes.h',
  'iso646.h', 'stdbool.h', 'stdint.h', 'tgmath.h', 'wchar.h', 'wctype.h',
  'stdalign.h', 'stdatomic.h', 'stdnoreturn.h', 'threads.h', 'uchar.h',
  'unistd.h', 'fcntl.h', 'sys/types.h', 'sys/stat.h', 'sys/socket.h',
  'sys/wait.h', 'sys/mman.h', 'netinet/in.h', 'arpa/inet.h', 'pthread.h',
  'dirent.h', 'termios.h', 'poll.h', 'dlfcn.h', 'semaphore.h',
]);

const CPP_SIGNALS = [/\bstd::/, /\bnamespace /, /template\s*</, /\biostream\b/, /\bvector</, /\bcout\b/];

const cPlugin: LanguagePlugin = {
  id: 'c',
  label: 'C',
  extensions: ['.c', '.h'],
  detect(content: string, filename: string): number {
    // If C++ signals are detected, reduce confidence to 0
    for (const sig of CPP_SIGNALS) {
      if (sig.test(content)) return 0;
    }
    const patterns = [/#include\s*</, /int main\(/, /\bvoid /, /printf\(/, /malloc\(/, /sizeof\(/, /\btypedef /];
    let score = 0;
    const ext = filename.substring(filename.lastIndexOf('.'));
    if (['.c', '.h'].includes(ext)) score += 40;
    for (const p of patterns) {
      if (p.test(content)) {
        score += 15;
        if (score >= 100) return 100;
      }
    }
    return Math.min(score, 100);
  },
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re = /^#include\s*[<"]([^>"]+)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const header = m[1];
      entries.push({ raw: m[0], module: header, isStdLib: this.isStdLib(header) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return C_STDLIB.has(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    // openssl/ssl.h -> openssl, curl/curl.h -> curl
    const topLevel = module.split('/')[0].replace(/\.h$/, '');
    return { name: topLevel, version: '', ecosystem: 'conan', purl: `pkg:conan/${topLevel}` };
  },
};

/* ================================================================== */
/*  14. C++                                                            */
/* ================================================================== */

const CPP_STDLIB = new Set([
  // All C headers
  ...Array.from(C_STDLIB),
  // C++ headers
  'iostream', 'fstream', 'sstream', 'string', 'vector', 'map', 'set',
  'unordered_map', 'unordered_set', 'list', 'deque', 'queue', 'stack',
  'array', 'algorithm', 'functional', 'numeric', 'memory', 'utility',
  'tuple', 'optional', 'variant', 'any', 'type_traits', 'chrono', 'thread',
  'mutex', 'condition_variable', 'future', 'atomic', 'bitset', 'complex',
  'random', 'regex', 'filesystem', 'format', 'ranges', 'span', 'concepts',
  'coroutine', 'source_location', 'expected', 'print',
]);

const cppPlugin: LanguagePlugin = {
  id: 'cpp',
  label: 'C++',
  extensions: ['.cpp', '.hpp', '.cc', '.cxx', '.hxx', '.hh'],
  detect: buildDetect(
    ['.cpp', '.hpp', '.cc', '.cxx', '.hxx', '.hh'],
    [
      /#include\s*<iostream>/, /\bstd::/, /\bnamespace /,
      /template\s*</, /\bclass /, /\bcout\b/, /vector</, /map</,
      /unique_ptr/, /shared_ptr/,
    ],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re = /^#include\s*[<"]([^>"]+)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const header = m[1];
      entries.push({ raw: m[0], module: header, isStdLib: this.isStdLib(header) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return CPP_STDLIB.has(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    const topLevel = module.split('/')[0].replace(/\.h(pp)?$/, '');
    return { name: topLevel, version: '', ecosystem: 'conan', purl: `pkg:conan/${topLevel}` };
  },
};

/* ================================================================== */
/*  15. Assembly                                                       */
/* ================================================================== */

const ASM_LIBC_SYMBOLS = new Set([
  'printf', 'scanf', 'malloc', 'free', 'calloc', 'realloc', 'exit', 'memcpy',
  'memset', 'memmove', 'strlen', 'strcpy', 'strcmp', 'strcat', 'fopen',
  'fclose', 'fread', 'fwrite', 'puts', 'getchar', 'putchar', 'abs', 'atoi',
  'atof', 'rand', 'srand',
]);

const assemblyPlugin: LanguagePlugin = {
  id: 'assembly',
  label: 'Assembly',
  extensions: ['.asm', '.s', '.S'],
  detect: buildDetect(
    ['.asm', '.s', '.S'],
    [
      /section \.text/, /global _start/, /\bmov /, /\bextern /,
      /%include/, /\.globl/, /\.section/, /\bpush\b/, /\bpop\b/,
      /\bcall /, /\bret\b/, /\bjmp /, /\bsyscall\b/,
    ],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const reExtern = /extern\s+(\w+)/g;
    const reInclude1 = /%include\s+"([^"]+)"/g;
    const reInclude2 = /\.include\s+"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = reExtern.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    while ((m = reInclude1.exec(content)) !== null) {
      entries.push({ raw: m[0], module: m[1], isStdLib: false });
    }
    while ((m = reInclude2.exec(content)) !== null) {
      entries.push({ raw: m[0], module: m[1], isStdLib: false });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return ASM_LIBC_SYMBOLS.has(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) {
      return { name: 'libc', version: '', ecosystem: 'generic', purl: 'pkg:generic/libc' };
    }
    return { name: module, version: '', ecosystem: 'generic', purl: `pkg:generic/${module}` };
  },
};

/* ================================================================== */
/*  16. Fortran                                                        */
/* ================================================================== */

const FORTRAN_STDLIB = new Set([
  'iso_fortran_env', 'iso_c_binding', 'ieee_arithmetic', 'ieee_exceptions',
  'ieee_features', 'omp_lib', 'openacc',
]);

const fortranPlugin: LanguagePlugin = {
  id: 'fortran',
  label: 'Fortran',
  extensions: ['.f', '.f90', '.f95', '.f03', '.f08', '.for', '.fpp'],
  detect: buildDetect(
    ['.f', '.f90', '.f95', '.f03', '.f08', '.for', '.fpp'],
    [
      /\bPROGRAM\b/i, /\bSUBROUTINE\b/i, /IMPLICIT NONE/i,
      /\bINTEGER\b/i, /\bREAL\b/i, /\bCHARACTER\b/i,
      /\bMODULE\b/i, /\bCALL\b/i, /\bDO\b/i, /\bEND DO\b/i,
    ],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re = /^\s*use\s+(\w+)/gim;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const mod = m[1].toLowerCase();
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return FORTRAN_STDLIB.has(module.toLowerCase());
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    return { name: module, version: '', ecosystem: 'generic', purl: `pkg:generic/${module}` };
  },
};

/* ================================================================== */
/*  17. COBOL                                                          */
/* ================================================================== */

const cobolPlugin: LanguagePlugin = {
  id: 'cobol',
  label: 'COBOL',
  extensions: ['.cob', '.cbl', '.cpy', '.CBL', '.COB'],
  detect: buildDetect(
    ['.cob', '.cbl', '.cpy', '.CBL', '.COB'],
    [
      /IDENTIFICATION DIVISION/i, /DATA DIVISION/i, /PROCEDURE DIVISION/i,
      /WORKING-STORAGE/i, /\bPERFORM\b/i, /\bMOVE\b/i, /\bDISPLAY\b/i,
    ],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re = /COPY\s+(\S+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const mod = m[1].replace(/\.$/, '');
      entries.push({ raw: m[0], module: mod, isStdLib: false });
    }
    return dedup(entries);
  },
  isStdLib(_module: string): boolean {
    // All COPY statements are project-local by convention
    return false;
  },
  mapToPackage(module: string): DetectedPackage | null {
    return { name: module, version: '', ecosystem: 'generic', purl: `pkg:generic/${module}` };
  },
};

/* ================================================================== */
/*  18. Ada                                                            */
/* ================================================================== */

const adaPlugin: LanguagePlugin = {
  id: 'ada',
  label: 'Ada',
  extensions: ['.adb', '.ads'],
  detect: buildDetect(
    ['.adb', '.ads'],
    [
      /\bwith Ada\./, /\bprocedure /, /\bpackage body/,
      /\bpragma /, /\bbegin\b/, /\bend;/, /\bis\b/,
      /\bfunction .+return\b/,
    ],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re = /^with\s+([\w.]+)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return /^(Ada|System|Interfaces|GNAT)\./i.test(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    return { name: module, version: '', ecosystem: 'generic', purl: `pkg:generic/${module}` };
  },
};

/* ================================================================== */
/*  19. Erlang                                                         */
/* ================================================================== */

const ERLANG_STDLIB = new Set([
  'kernel', 'stdlib', 'sasl', 'mnesia', 'inets', 'crypto', 'ssl',
  'public_key', 'ssh', 'snmp', 'os_mon', 'runtime_tools', 'tools',
  'compiler', 'syntax_tools', 'parsetools', 'et', 'observer', 'debugger',
  'wx', 'xmerl', 'edoc', 'erl_interface', 'jinterface', 'megaco',
  'diameter', 'eldap', 'ftp', 'tftp',
]);

const erlangPlugin: LanguagePlugin = {
  id: 'erlang',
  label: 'Erlang',
  extensions: ['.erl', '.hrl'],
  detect: buildDetect(
    ['.erl', '.hrl'],
    [/-module\(/, /-export\(/, /\bspawn\(/, /\breceive\b/, /-spec/, /-behaviour/, /-record/],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re1 = /-include\("([^"]+)"\)/g;
    const re2 = /-include_lib\("([^/]+)\//g;
    const re3 = /-behaviour\((\w+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re1.exec(content)) !== null) {
      entries.push({ raw: m[0], module: m[1], isStdLib: false });
    }
    while ((m = re2.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    while ((m = re3.exec(content)) !== null) {
      const mod = m[1].toLowerCase();
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return ERLANG_STDLIB.has(module.toLowerCase());
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    return { name: module, version: '', ecosystem: 'hex', purl: `pkg:hex/${module}` };
  },
};

/* ================================================================== */
/*  20. Haskell                                                        */
/* ================================================================== */

const HASKELL_STDLIB_PREFIXES = [
  'Prelude', 'Data.', 'Control.', 'System.', 'GHC.', 'Foreign.', 'Numeric',
  'Text.Show', 'Text.Read', 'Type.',
];

const HASKELL_KNOWN_PACKAGES: Record<string, string> = {
  'Data.Aeson': 'aeson',
  'Data.ByteString': 'bytestring',
  'Data.Text': 'text',
  'Data.Map': 'containers',
  'Data.Set': 'containers',
  'Data.HashMap': 'unordered-containers',
  'Data.HashSet': 'unordered-containers',
  'Data.Vector': 'vector',
  'Data.Conduit': 'conduit',
  'Network.HTTP': 'http-client',
  'Network.Wai': 'wai',
  'Database.Persist': 'persistent',
  'Data.Yaml': 'yaml',
  'Data.Csv': 'cassava',
  'Text.Megaparsec': 'megaparsec',
  'Text.Parsec': 'parsec',
  'Options.Applicative': 'optparse-applicative',
  'Lens': 'lens',
};

function isHaskellStdLib(module: string): boolean {
  if (module === 'Prelude' || module === 'Numeric') return true;
  for (const prefix of HASKELL_STDLIB_PREFIXES) {
    if (module.startsWith(prefix)) {
      // Check it's not a known external package
      for (const key of Object.keys(HASKELL_KNOWN_PACKAGES)) {
        if (module.startsWith(key)) return false;
      }
      return true;
    }
  }
  return false;
}

const haskellPlugin: LanguagePlugin = {
  id: 'haskell',
  label: 'Haskell',
  extensions: ['.hs', '.lhs'],
  detect: buildDetect(
    ['.hs', '.lhs'],
    [
      /\bmodule /, /import qualified/, /\bdata /, /\bwhere\b/, /::/,
      /->/, /\bderiving\b/, /\binstance /, /\bnewtype /,
    ],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re = /^import\s+(?:qualified\s+)?([\w.]+)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return isHaskellStdLib(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    // Check well-known mappings (longest prefix match)
    let bestKey = '';
    for (const key of Object.keys(HASKELL_KNOWN_PACKAGES)) {
      if (module.startsWith(key) && key.length > bestKey.length) {
        bestKey = key;
      }
    }
    if (bestKey) {
      const pkg = HASKELL_KNOWN_PACKAGES[bestKey];
      return { name: pkg, version: '', ecosystem: 'hackage', purl: `pkg:hackage/${pkg}` };
    }
    // Fallback: lowercase first segment
    const name = module.split('.')[0].toLowerCase();
    return { name, version: '', ecosystem: 'hackage', purl: `pkg:hackage/${name}` };
  },
};

/* ================================================================== */
/*  21. OCaml                                                          */
/* ================================================================== */

const OCAML_STDLIB = new Set([
  'Stdlib', 'Printf', 'List', 'Array', 'String', 'Hashtbl', 'Map', 'Set',
  'Buffer', 'Bytes', 'Char', 'Complex', 'Digest', 'Filename', 'Format',
  'Fun', 'Gc', 'In_channel', 'Int', 'Int32', 'Int64', 'Lazy', 'Lexing',
  'Marshal', 'Nativeint', 'Obj', 'Oo', 'Option', 'Out_channel', 'Parsing',
  'Printexc', 'Queue', 'Random', 'Result', 'Scanf', 'Seq', 'Stack', 'Sys',
  'Uchar', 'Unit',
]);

const ocamlPlugin: LanguagePlugin = {
  id: 'ocaml',
  label: 'OCaml',
  extensions: ['.ml', '.mli'],
  detect: buildDetect(
    ['.ml', '.mli'],
    [/\blet /, /\bopen /, /\bmodule /, /\bval /, /\btype /, /\bmatch\b/, /\bwith\b/, /->/, /\bfun /, /;;/],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re = /^open\s+(\w+)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return OCAML_STDLIB.has(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    const name = module.toLowerCase();
    return { name, version: '', ecosystem: 'opam', purl: `pkg:opam/${name}` };
  },
};

/* ================================================================== */
/*  22. R                                                              */
/* ================================================================== */

const R_STDLIB = new Set([
  'base', 'utils', 'stats', 'graphics', 'grDevices', 'datasets', 'methods',
  'grid', 'parallel', 'splines', 'stats4', 'tcltk', 'tools', 'compiler',
]);

const rPlugin: LanguagePlugin = {
  id: 'r',
  label: 'R',
  extensions: ['.R', '.r', '.Rmd'],
  detect: buildDetect(
    ['.R', '.r', '.Rmd'],
    [/\blibrary\(/, /\brequire\(/, /<-/, /\bfunction\(/, /data\.frame/, /%>%/, /\bggplot\b/, /\btibble\b/],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re1 = /library\(["']?(\w+)["']?\)/g;
    const re2 = /require\(["']?(\w+)["']?\)/g;
    const re3 = /(\w+)::/g;
    let m: RegExpExecArray | null;
    while ((m = re1.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    while ((m = re2.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    while ((m = re3.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return R_STDLIB.has(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    return { name: module, version: '', ecosystem: 'cran', purl: `pkg:cran/${module}` };
  },
};

/* ================================================================== */
/*  23. Julia                                                          */
/* ================================================================== */

const JULIA_STDLIB = new Set([
  'Base', 'Core', 'LinearAlgebra', 'Statistics', 'Distributed', 'Dates',
  'Printf', 'Random', 'SparseArrays', 'Test', 'UUIDs', 'Unicode',
  'Markdown', 'REPL', 'Pkg', 'InteractiveUtils', 'Sockets', 'SHA',
  'Serialization', 'SharedArrays', 'FileWatching', 'LibGit2', 'Logging',
  'Mmap', 'Profile', 'TOML', 'DelimitedFiles',
]);

const juliaPlugin: LanguagePlugin = {
  id: 'julia',
  label: 'Julia',
  extensions: ['.jl'],
  detect: buildDetect(
    ['.jl'],
    [
      /\busing /, /\bimport /, /\bmodule /, /\bfunction /,
      /\bend\b/, /\bmutable struct\b/, /\babstract type\b/, /\bbegin\b/, /\bmacro /,
    ],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re1 = /^using\s+([\w.]+)/gm;
    const re2 = /^import\s+([\w.]+)/gm;
    let m: RegExpExecArray | null;
    while ((m = re1.exec(content)) !== null) {
      // Take first segment before any : or .
      const mod = m[1].split(/[.:]/)[0];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    while ((m = re2.exec(content)) !== null) {
      const mod = m[1].split(/[.:]/)[0];
      entries.push({ raw: m[0], module: mod, isStdLib: this.isStdLib(mod) });
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return JULIA_STDLIB.has(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    return { name: module, version: '', ecosystem: 'julia', purl: `pkg:julia/${module}` };
  },
};

/* ================================================================== */
/*  24. Pascal                                                         */
/* ================================================================== */

const PASCAL_STDLIB = new Set([
  'System', 'SysUtils', 'Classes', 'Math', 'StrUtils', 'Types', 'DateUtils',
  'Variants', 'IniFiles', 'Registry', 'FileUtil', 'LazUtils', 'LCLType',
  'LCLIntf', 'Forms', 'Controls', 'Graphics', 'Dialogs', 'StdCtrls',
  'ExtCtrls', 'ComCtrls', 'Menus', 'ActnList', 'Buttons',
]);

const pascalPlugin: LanguagePlugin = {
  id: 'pascal',
  label: 'Pascal',
  extensions: ['.pas', '.pp', '.lpr', '.dpr'],
  detect: buildDetect(
    ['.pas', '.pp', '.lpr', '.dpr'],
    [
      /\bprogram\b/i, /\bbegin\b/i, /\bend\./i, /\buses\b/i,
      /\bprocedure\b/i, /\bfunction\b/i, /\bvar\b/i, /\bconst\b/i, /\btype\b/i,
    ],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re = /uses\s+([\w,\s]+);/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const units = m[1].split(',').map((u) => u.trim()).filter(Boolean);
      for (const unit of units) {
        entries.push({ raw: m[0], module: unit, isStdLib: this.isStdLib(unit) });
      }
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return PASCAL_STDLIB.has(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    return { name: module, version: '', ecosystem: 'generic', purl: `pkg:generic/${module}` };
  },
};

/* ================================================================== */
/*  25. Bash/Shell                                                     */
/* ================================================================== */

const bashPlugin: LanguagePlugin = {
  id: 'bash',
  label: 'Bash/Shell',
  extensions: ['.sh', '.bash', '.zsh'],
  detect: buildDetect(
    ['.sh', '.bash', '.zsh'],
    [
      /^#!\/bin\/bash/m, /^#!\/bin\/sh/m, /^#!\/bin\/zsh/m,
      /\bsource /, /\. \//, /\bexport /, /if \[/, /\bfi\b/,
      /\bfunction /, /\becho /,
    ],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    const re1 = /source\s+(\S+)/g;
    const re2 = /\.\s+(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re1.exec(content)) !== null) {
      const mod = m[1];
      entries.push({ raw: m[0], module: mod, isStdLib: false });
    }
    while ((m = re2.exec(content)) !== null) {
      // Only match if it looks like a file path (contains / or .)
      const mod = m[1];
      if (mod.includes('/') || mod.includes('.')) {
        entries.push({ raw: m[0], module: mod, isStdLib: false });
      }
    }
    return dedup(entries);
  },
  isStdLib(_module: string): boolean {
    // All source/. targets are project-local
    return false;
  },
  mapToPackage(module: string): DetectedPackage | null {
    const name = module.split('/').pop() || module;
    return { name, version: '', ecosystem: 'generic', purl: `pkg:generic/${name}` };
  },
};

/* ================================================================== */
/*  26. Nix                                                            */
/* ================================================================== */

const NIX_STDLIB = new Set([
  'stdenv', 'fetchurl', 'fetchFromGitHub', 'lib', 'callPackage',
  'writeShellScriptBin', 'runCommand', 'writeText', 'pkgs',
]);

const nixPlugin: LanguagePlugin = {
  id: 'nix',
  label: 'Nix',
  extensions: ['.nix'],
  detect: buildDetect(
    ['.nix'],
    [
      /\{ pkgs \? import/, /mkDerivation/, /buildInputs/,
      /fetchurl/, /fetchFromGitHub/, /\bstdenv\b/, /\blib\./,
      /with pkgs;/,
    ],
  ),
  extractImports(content: string): ImportEntry[] {
    const entries: ImportEntry[] = [];
    // Match buildInputs, nativeBuildInputs, propagatedBuildInputs
    const re = /(?:buildInputs|nativeBuildInputs|propagatedBuildInputs)\s*=\s*(?:with\s+\w+;\s*)?\[([^\]]+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const block = m[1];
      // Extract pkgs.name or bare names
      const itemRe = /(?:pkgs\.)?([a-zA-Z0-9_-]+)/g;
      let item: RegExpExecArray | null;
      while ((item = itemRe.exec(block)) !== null) {
        const mod = item[1];
        entries.push({ raw: item[0], module: mod, isStdLib: this.isStdLib(mod) });
      }
    }
    return dedup(entries);
  },
  isStdLib(module: string): boolean {
    return NIX_STDLIB.has(module);
  },
  mapToPackage(module: string): DetectedPackage | null {
    if (this.isStdLib(module)) return null;
    return { name: module, version: '', ecosystem: 'nix', purl: `pkg:nix/${module}` };
  },
};

/* ================================================================== */
/*  Export                                                             */
/* ================================================================== */

export const LANGUAGE_PLUGINS: LanguagePlugin[] = [
  pythonPlugin,
  jstsPlugin,
  javaPlugin,
  csharpPlugin,
  rubyPlugin,
  phpPlugin,
  goPlugin,
  rustPlugin,
  dartPlugin,
  elixirPlugin,
  swiftPlugin,
  terraformPlugin,
  cPlugin,
  cppPlugin,
  assemblyPlugin,
  fortranPlugin,
  cobolPlugin,
  adaPlugin,
  erlangPlugin,
  haskellPlugin,
  ocamlPlugin,
  rPlugin,
  juliaPlugin,
  pascalPlugin,
  bashPlugin,
  nixPlugin,
];
