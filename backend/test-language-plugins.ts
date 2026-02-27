/**
 * test-language-plugins.ts
 * Smoke tests for all 26 language plugins.
 * Run with: npx tsx test-language-plugins.ts
 */

import { LANGUAGE_PLUGINS, type LanguagePlugin, type ImportEntry, type DetectedPackage } from './src/services/language-plugins.js';

let passed = 0, failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ FAIL: ${msg}`); }
}

function section(name: string) {
  console.log(`\n${'='.repeat(60)}\n  ${name}\n${'='.repeat(60)}`);
}

// ─────────────────────────────────────────────────────────────────
// META: Registry
// ─────────────────────────────────────────────────────────────────
section('META: Plugin Registry');
assert(LANGUAGE_PLUGINS.length === 26, `26 plugins registered (got ${LANGUAGE_PLUGINS.length})`);

const ids = LANGUAGE_PLUGINS.map(p => p.id);
const expectedIds = [
  'python', 'jsts', 'java', 'csharp', 'ruby', 'php', 'go', 'rust',
  'dart', 'elixir', 'swift', 'terraform', 'c', 'cpp', 'assembly',
  'fortran', 'cobol', 'ada', 'erlang', 'haskell', 'ocaml', 'r',
  'julia', 'pascal', 'bash', 'nix',
];
for (const id of expectedIds) {
  assert(ids.includes(id), `Plugin '${id}' registered`);
}

// ─────────────────────────────────────────────────────────────────
// Helper: run a full plugin test
// ─────────────────────────────────────────────────────────────────
interface PluginTest {
  pluginId: string;
  sampleFilename: string;
  sampleContent: string;
  expectedDetectMin: number;
  expectedImports: string[];        // module names we expect to find
  stdlibModules: string[];          // should be filtered as stdlib
  externalModules: string[];        // should map to packages
  expectedEcosystem?: string;       // expected PURL ecosystem prefix
}

function runPluginTest(test: PluginTest) {
  const plugin = LANGUAGE_PLUGINS.find(p => p.id === test.pluginId);
  if (!plugin) {
    assert(false, `Plugin '${test.pluginId}' not found`);
    return;
  }

  // Detection
  const confidence = plugin.detect(test.sampleContent, test.sampleFilename);
  assert(confidence >= test.expectedDetectMin,
    `detect() confidence >= ${test.expectedDetectMin} (got ${confidence})`);

  // Import extraction
  const imports = plugin.extractImports(test.sampleContent);
  for (const expected of test.expectedImports) {
    assert(imports.some(i => i.module === expected || i.module.includes(expected)),
      `extractImports() found '${expected}'`);
  }

  // Stdlib check
  for (const mod of test.stdlibModules) {
    assert(plugin.isStdLib(mod), `isStdLib('${mod}') = true`);
  }

  // External check → mapToPackage
  for (const mod of test.externalModules) {
    assert(!plugin.isStdLib(mod), `isStdLib('${mod}') = false`);
    const pkg = plugin.mapToPackage(mod);
    assert(pkg !== null, `mapToPackage('${mod}') returns package`);
    if (pkg && test.expectedEcosystem) {
      assert(pkg.purl.startsWith(`pkg:${test.expectedEcosystem}/`),
        `PURL starts with pkg:${test.expectedEcosystem}/ (got: ${pkg.purl})`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// 1. Python
// ─────────────────────────────────────────────────────────────────
section('1. Python');
runPluginTest({
  pluginId: 'python',
  sampleFilename: 'app.py',
  sampleContent: `import os\nimport sys\nfrom datetime import datetime\nimport requests\nfrom flask import Flask\nimport numpy as np\n`,
  expectedDetectMin: 40,
  expectedImports: ['os', 'sys', 'datetime', 'requests', 'flask', 'numpy'],
  stdlibModules: ['os', 'sys', 'datetime', 'json', 'math', 'collections'],
  externalModules: ['requests', 'flask', 'numpy'],
  expectedEcosystem: 'pypi',
});

// ─────────────────────────────────────────────────────────────────
// 2. JavaScript/TypeScript
// ─────────────────────────────────────────────────────────────────
section('2. JavaScript/TypeScript');
runPluginTest({
  pluginId: 'jsts',
  sampleFilename: 'server.ts',
  sampleContent: `import express from 'express';\nconst cors = require('cors');\nimport { readFileSync } from 'fs';\nimport path from 'path';\nimport '@types/node';\nimport lodash from 'lodash';\n`,
  expectedDetectMin: 40,
  expectedImports: ['express', 'cors', 'fs', 'path', 'lodash'],
  stdlibModules: ['fs', 'path', 'http', 'os', 'crypto', 'stream'],
  externalModules: ['express', 'cors', 'lodash'],
  expectedEcosystem: 'npm',
});

// ─────────────────────────────────────────────────────────────────
// 3. Java
// ─────────────────────────────────────────────────────────────────
section('3. Java');
runPluginTest({
  pluginId: 'java',
  sampleFilename: 'App.java',
  sampleContent: `package com.example.app;\nimport java.util.List;\nimport java.io.IOException;\nimport org.springframework.boot.SpringApplication;\nimport com.google.gson.Gson;\n`,
  expectedDetectMin: 40,
  expectedImports: ['java.util.List', 'org.springframework.boot', 'com.google.gson'],
  stdlibModules: ['java.util.List', 'java.io.File', 'javax.swing.JFrame'],
  externalModules: ['org.springframework.boot', 'com.google.gson'],
  expectedEcosystem: 'maven',
});

// ─────────────────────────────────────────────────────────────────
// 4. C#
// ─────────────────────────────────────────────────────────────────
section('4. C#');
runPluginTest({
  pluginId: 'csharp',
  sampleFilename: 'Program.cs',
  sampleContent: `using System;\nusing System.Collections.Generic;\nusing Newtonsoft.Json;\nusing Serilog;\nnamespace MyApp\n{\n  public class Program { }\n}\n`,
  expectedDetectMin: 40,
  expectedImports: ['System', 'System.Collections.Generic', 'Newtonsoft.Json', 'Serilog'],
  stdlibModules: ['System', 'System.Collections.Generic', 'Microsoft.Extensions'],
  externalModules: ['Newtonsoft.Json', 'Serilog'],
  expectedEcosystem: 'nuget',
});

// ─────────────────────────────────────────────────────────────────
// 5. Ruby
// ─────────────────────────────────────────────────────────────────
section('5. Ruby');
runPluginTest({
  pluginId: 'ruby',
  sampleFilename: 'app.rb',
  sampleContent: `require 'json'\nrequire 'nokogiri'\nrequire 'sinatra'\nrequire_relative './config'\n`,
  expectedDetectMin: 40,
  expectedImports: ['json', 'nokogiri', 'sinatra'],
  stdlibModules: ['json', 'csv', 'yaml', 'set', 'logger'],
  externalModules: ['nokogiri', 'sinatra'],
  expectedEcosystem: 'gem',
});

// ─────────────────────────────────────────────────────────────────
// 6. PHP
// ─────────────────────────────────────────────────────────────────
section('6. PHP');
runPluginTest({
  pluginId: 'php',
  sampleFilename: 'index.php',
  sampleContent: `<?php\nnamespace App\\Http;\nuse Illuminate\\Http\\Request;\nuse Monolog\\Logger;\nuse App\\Models\\User;\n`,
  expectedDetectMin: 40,
  expectedImports: ['illuminate/http', 'monolog/logger'],
  stdlibModules: [],
  externalModules: ['illuminate/http', 'monolog/logger'],
  expectedEcosystem: 'composer',
});

// ─────────────────────────────────────────────────────────────────
// 7. Go
// ─────────────────────────────────────────────────────────────────
section('7. Go');
runPluginTest({
  pluginId: 'go',
  sampleFilename: 'main.go',
  sampleContent: `package main\n\nimport (\n\t"fmt"\n\t"net/http"\n\t"github.com/gin-gonic/gin"\n\t"github.com/jackc/pgx/v5"\n)\n\nfunc main() {\n\tfmt.Println("hello")\n}\n`,
  expectedDetectMin: 40,
  expectedImports: ['fmt', 'net/http', 'github.com/gin-gonic/gin'],
  stdlibModules: ['fmt', 'os', 'net/http', 'encoding/json'],
  externalModules: ['github.com/gin-gonic/gin', 'github.com/jackc/pgx/v5'],
  expectedEcosystem: 'golang',
});

// ─────────────────────────────────────────────────────────────────
// 8. Rust
// ─────────────────────────────────────────────────────────────────
section('8. Rust');
runPluginTest({
  pluginId: 'rust',
  sampleFilename: 'main.rs',
  sampleContent: `use std::io;\nuse serde::Deserialize;\nuse tokio::runtime;\nuse axum::Router;\n\nfn main() {\n    println!("hello");\n}\n`,
  expectedDetectMin: 40,
  expectedImports: ['std', 'serde', 'tokio', 'axum'],
  stdlibModules: ['std', 'core', 'alloc'],
  externalModules: ['serde', 'tokio', 'axum'],
  expectedEcosystem: 'cargo',
});

// ─────────────────────────────────────────────────────────────────
// 9. Dart
// ─────────────────────────────────────────────────────────────────
section('9. Dart');
runPluginTest({
  pluginId: 'dart',
  sampleFilename: 'main.dart',
  sampleContent: `import 'dart:io';\nimport 'dart:async';\nimport 'package:flutter_bloc/flutter_bloc.dart';\nimport 'package:http/http.dart' as http;\n\nvoid main() {}\n`,
  expectedDetectMin: 40,
  expectedImports: ['flutter_bloc', 'http'],
  stdlibModules: ['dart:io', 'dart:async', 'dart:core'],
  externalModules: ['flutter_bloc', 'http'],
  expectedEcosystem: 'pub',
});

// ─────────────────────────────────────────────────────────────────
// 10. Elixir
// ─────────────────────────────────────────────────────────────────
section('10. Elixir');
runPluginTest({
  pluginId: 'elixir',
  sampleFilename: 'mix.exs',
  sampleContent: `defmodule MyApp.MixProject do\n  use Mix.Project\n  defp deps do\n    [\n      {:phoenix, "~> 1.7"},\n      {:ecto, "~> 3.11"},\n      {:plug_cowboy, "~> 2.6"}\n    ]\n  end\nend\n`,
  expectedDetectMin: 40,
  expectedImports: ['phoenix', 'ecto', 'plug_cowboy'],
  stdlibModules: ['Kernel', 'Enum', 'Map', 'IO', 'String'],
  externalModules: ['phoenix', 'ecto', 'plug_cowboy'],
  expectedEcosystem: 'hex',
});

// ─────────────────────────────────────────────────────────────────
// 11. Swift
// ─────────────────────────────────────────────────────────────────
section('11. Swift');
runPluginTest({
  pluginId: 'swift',
  sampleFilename: 'App.swift',
  sampleContent: `import Foundation\nimport UIKit\nimport Alamofire\nimport SnapKit\n\nclass AppDelegate {\n  func application() {\n    let url = URL(string: "https://example.com")!\n  }\n}\n`,
  expectedDetectMin: 40,
  expectedImports: ['Foundation', 'UIKit', 'Alamofire', 'SnapKit'],
  stdlibModules: ['Foundation', 'UIKit', 'SwiftUI', 'Combine'],
  externalModules: ['Alamofire', 'SnapKit'],
  expectedEcosystem: 'swift',
});

// ─────────────────────────────────────────────────────────────────
// 12. Terraform
// ─────────────────────────────────────────────────────────────────
section('12. Terraform');
runPluginTest({
  pluginId: 'terraform',
  sampleFilename: 'main.tf',
  sampleContent: `resource "aws_instance" "web" {\n  ami = "abc"\n}\n\nmodule "vpc" {\n  source = "terraform-aws-modules/vpc/aws"\n  version = "5.5.0"\n}\n\nmodule "s3" {\n  source = "terraform-aws-modules/s3-bucket/aws"\n}\n`,
  expectedDetectMin: 40,
  expectedImports: ['terraform-aws-modules/vpc/aws', 'terraform-aws-modules/s3-bucket/aws'],
  stdlibModules: [],
  externalModules: ['terraform-aws-modules/vpc/aws'],
  expectedEcosystem: 'terraform',
});

// ─────────────────────────────────────────────────────────────────
// 13. C
// ─────────────────────────────────────────────────────────────────
section('13. C');
runPluginTest({
  pluginId: 'c',
  sampleFilename: 'main.c',
  sampleContent: `#include <stdio.h>\n#include <stdlib.h>\n#include <openssl/ssl.h>\n#include <curl/curl.h>\n\nint main(void) {\n  printf("hello");\n  return 0;\n}\n`,
  expectedDetectMin: 40,
  expectedImports: ['stdio.h', 'stdlib.h', 'openssl/ssl.h', 'curl/curl.h'],
  stdlibModules: ['stdio.h', 'stdlib.h', 'string.h', 'math.h'],
  externalModules: ['openssl/ssl.h', 'curl/curl.h'],
  expectedEcosystem: 'conan',
});

// C vs C++ disambiguation
section('13b. C vs C++ disambiguation');
{
  const cPlugin = LANGUAGE_PLUGINS.find(p => p.id === 'c')!;
  const cppPlugin = LANGUAGE_PLUGINS.find(p => p.id === 'cpp')!;
  const cppContent = `#include <iostream>\n#include <vector>\nusing namespace std;\nint main() { std::cout << "hi"; }\n`;
  const cConf = cPlugin.detect(cppContent, 'main.cpp');
  const cppConf = cppPlugin.detect(cppContent, 'main.cpp');
  assert(cConf < cppConf, `C++ content: C confidence (${cConf}) < C++ confidence (${cppConf})`);
}

// ─────────────────────────────────────────────────────────────────
// 14. C++
// ─────────────────────────────────────────────────────────────────
section('14. C++');
runPluginTest({
  pluginId: 'cpp',
  sampleFilename: 'main.cpp',
  sampleContent: `#include <iostream>\n#include <vector>\n#include <boost/asio.hpp>\n#include <nlohmann/json.hpp>\n\nnamespace myapp {\n  class App {};\n}\n`,
  expectedDetectMin: 40,
  expectedImports: ['iostream', 'vector', 'boost/asio.hpp', 'nlohmann/json.hpp'],
  stdlibModules: ['iostream', 'vector', 'string', 'memory', 'algorithm'],
  externalModules: ['boost/asio.hpp', 'nlohmann/json.hpp'],
  expectedEcosystem: 'conan',
});

// ─────────────────────────────────────────────────────────────────
// 15. Assembly
// ─────────────────────────────────────────────────────────────────
section('15. Assembly');
runPluginTest({
  pluginId: 'assembly',
  sampleFilename: 'boot.asm',
  sampleContent: `section .text\nglobal _start\nextern printf\nextern custom_func\n\n_start:\n  mov eax, 1\n  syscall\n`,
  expectedDetectMin: 40,
  expectedImports: ['printf', 'custom_func'],
  stdlibModules: ['printf', 'malloc', 'free', 'exit'],
  externalModules: ['custom_func'],
  expectedEcosystem: 'generic',
});

// ─────────────────────────────────────────────────────────────────
// 16. Fortran
// ─────────────────────────────────────────────────────────────────
section('16. Fortran');
runPluginTest({
  pluginId: 'fortran',
  sampleFilename: 'solver.f90',
  sampleContent: `PROGRAM solver\n  USE iso_fortran_env\n  USE mpi_module\n  USE lapack_module\n  IMPLICIT NONE\n  INTEGER :: n\n  REAL :: x\nEND PROGRAM\n`,
  expectedDetectMin: 40,
  expectedImports: ['iso_fortran_env', 'mpi_module', 'lapack_module'],
  stdlibModules: ['iso_fortran_env', 'iso_c_binding', 'ieee_arithmetic'],
  externalModules: ['mpi_module', 'lapack_module'],
  expectedEcosystem: 'generic',
});

// ─────────────────────────────────────────────────────────────────
// 17. COBOL
// ─────────────────────────────────────────────────────────────────
section('17. COBOL');
runPluginTest({
  pluginId: 'cobol',
  sampleFilename: 'MAINPROG.cob',
  sampleContent: `       IDENTIFICATION DIVISION.\n       PROGRAM-ID. MAINPROG.\n       DATA DIVISION.\n       WORKING-STORAGE SECTION.\n       COPY CUSTOMER-RECORD.\n       COPY TRANSACTION-LOG.\n       PROCEDURE DIVISION.\n           DISPLAY "HELLO".\n           STOP RUN.\n`,
  expectedDetectMin: 40,
  expectedImports: ['CUSTOMER-RECORD', 'TRANSACTION-LOG'],
  stdlibModules: [],
  externalModules: ['CUSTOMER-RECORD', 'TRANSACTION-LOG'],
  expectedEcosystem: 'generic',
});

// ─────────────────────────────────────────────────────────────────
// 18. Ada
// ─────────────────────────────────────────────────────────────────
section('18. Ada');
runPluginTest({
  pluginId: 'ada',
  sampleFilename: 'main.adb',
  sampleContent: `with Ada.Text_IO;\nwith Ada.Integer_Text_IO;\nwith GPS_Library;\nprocedure Main is\nbegin\n  Ada.Text_IO.Put_Line("Hello");\nend Main;\n`,
  expectedDetectMin: 40,
  expectedImports: ['Ada.Text_IO', 'Ada.Integer_Text_IO', 'GPS_Library'],
  stdlibModules: ['Ada.Text_IO', 'Ada.Integer_Text_IO', 'System.Storage_Elements', 'Interfaces.C'],
  externalModules: ['GPS_Library'],
  expectedEcosystem: 'generic',
});

// ─────────────────────────────────────────────────────────────────
// 19. Erlang
// ─────────────────────────────────────────────────────────────────
section('19. Erlang');
runPluginTest({
  pluginId: 'erlang',
  sampleFilename: 'server.erl',
  sampleContent: `-module(server).\n-export([start/0]).\n-include_lib("kernel/include/file.hrl").\n-include_lib("cowboy/include/http.hrl").\n-behaviour(gen_server).\n\nstart() ->\n  spawn(fun() -> ok end).\n`,
  expectedDetectMin: 40,
  expectedImports: ['kernel', 'cowboy'],
  stdlibModules: ['kernel', 'stdlib', 'crypto', 'ssl'],
  externalModules: ['cowboy'],
  expectedEcosystem: 'hex',
});

// ─────────────────────────────────────────────────────────────────
// 20. Haskell
// ─────────────────────────────────────────────────────────────────
section('20. Haskell');
runPluginTest({
  pluginId: 'haskell',
  sampleFilename: 'Main.hs',
  sampleContent: `module Main where\n\nimport Data.List\nimport Data.Map\nimport Data.Aeson\nimport Network.HTTP.Simple\nimport qualified Data.Text as T\n`,
  expectedDetectMin: 40,
  expectedImports: ['Data.List', 'Data.Map', 'Data.Aeson', 'Network.HTTP.Simple', 'Data.Text'],
  stdlibModules: ['Data.List', 'Control.Monad', 'System.IO', 'Prelude'],
  externalModules: ['Data.Aeson', 'Network.HTTP.Simple'],
  expectedEcosystem: 'hackage',
});

// Check well-known Haskell mappings
section('20b. Haskell well-known mappings');
{
  const hs = LANGUAGE_PLUGINS.find(p => p.id === 'haskell')!;
  const aesonPkg = hs.mapToPackage('Data.Aeson');
  assert(aesonPkg !== null && aesonPkg.name === 'aeson', `Data.Aeson → aeson (got: ${aesonPkg?.name})`);
  const mapPkg = hs.mapToPackage('Data.Map');
  assert(mapPkg !== null && mapPkg.name === 'containers', `Data.Map → containers (got: ${mapPkg?.name})`);
}

// ─────────────────────────────────────────────────────────────────
// 21. OCaml
// ─────────────────────────────────────────────────────────────────
section('21. OCaml');
runPluginTest({
  pluginId: 'ocaml',
  sampleFilename: 'main.ml',
  sampleContent: `open Printf\nopen List\nopen Lwt\nopen Cohttp\n\nlet () =\n  let x = 42 in\n  Printf.printf "%d\n" x\n`,
  expectedDetectMin: 40,
  expectedImports: ['Printf', 'List', 'Lwt', 'Cohttp'],
  stdlibModules: ['Printf', 'List', 'Array', 'String', 'Hashtbl'],
  externalModules: ['Lwt', 'Cohttp'],
  expectedEcosystem: 'opam',
});

// ─────────────────────────────────────────────────────────────────
// 22. R
// ─────────────────────────────────────────────────────────────────
section('22. R');
runPluginTest({
  pluginId: 'r',
  sampleFilename: 'analysis.R',
  sampleContent: `library(ggplot2)\nrequire(dplyr)\nlibrary(tidyr)\n\ndata <- read.csv("data.csv")\nresult <- data %>% filter(x > 0)\n`,
  expectedDetectMin: 40,
  expectedImports: ['ggplot2', 'dplyr', 'tidyr'],
  stdlibModules: ['base', 'utils', 'stats', 'graphics'],
  externalModules: ['ggplot2', 'dplyr', 'tidyr'],
  expectedEcosystem: 'cran',
});

// ─────────────────────────────────────────────────────────────────
// 23. Julia
// ─────────────────────────────────────────────────────────────────
section('23. Julia');
runPluginTest({
  pluginId: 'julia',
  sampleFilename: 'main.jl',
  sampleContent: `using DataFrames\nusing CSV\nimport Statistics\nusing LinearAlgebra\n\nfunction compute(x)\n  return x^2\nend\n`,
  expectedDetectMin: 40,
  expectedImports: ['DataFrames', 'CSV', 'Statistics', 'LinearAlgebra'],
  stdlibModules: ['Base', 'Core', 'LinearAlgebra', 'Statistics', 'Dates'],
  externalModules: ['DataFrames', 'CSV'],
  expectedEcosystem: 'julia',
});

// ─────────────────────────────────────────────────────────────────
// 24. Pascal
// ─────────────────────────────────────────────────────────────────
section('24. Pascal');
runPluginTest({
  pluginId: 'pascal',
  sampleFilename: 'main.pas',
  sampleContent: `program HelloWorld;\nuses SysUtils, Classes, CustomUnit;\n\nvar\n  s: string;\nbegin\n  WriteLn('Hello, World!');\nend.\n`,
  expectedDetectMin: 40,
  expectedImports: ['SysUtils', 'Classes', 'CustomUnit'],
  stdlibModules: ['System', 'SysUtils', 'Classes', 'Math'],
  externalModules: ['CustomUnit'],
  expectedEcosystem: 'generic',
});

// ─────────────────────────────────────────────────────────────────
// 25. Bash
// ─────────────────────────────────────────────────────────────────
section('25. Bash');
runPluginTest({
  pluginId: 'bash',
  sampleFilename: 'deploy.sh',
  sampleContent: `#!/bin/bash\nset -e\nsource ./config.sh\n. /usr/local/lib/helpers.sh\nexport PATH=$PATH:/opt/bin\necho "deploying"\nif [ -f "app" ]; then\n  ./app\nfi\n`,
  expectedDetectMin: 40,
  expectedImports: ['./config.sh', '/usr/local/lib/helpers.sh'],
  stdlibModules: [],
  externalModules: ['./config.sh'],
  expectedEcosystem: 'generic',
});

// ─────────────────────────────────────────────────────────────────
// 26. Nix
// ─────────────────────────────────────────────────────────────────
section('26. Nix');
runPluginTest({
  pluginId: 'nix',
  sampleFilename: 'default.nix',
  sampleContent: `{ pkgs ? import <nixpkgs> {} }:\n\npkgs.mkDerivation {\n  name = "my-app";\n  buildInputs = with pkgs; [ openssl zlib curl ];\n  nativeBuildInputs = [ pkgs.cmake ];\n}\n`,
  expectedDetectMin: 40,
  expectedImports: ['openssl', 'zlib', 'curl', 'cmake'],
  stdlibModules: ['stdenv', 'fetchurl', 'lib'],
  externalModules: ['openssl', 'zlib', 'curl'],
  expectedEcosystem: 'nix',
});

// ─────────────────────────────────────────────────────────────────
// EDGE: Wrong extension detection
// ─────────────────────────────────────────────────────────────────
section('EDGE: Extension mismatch + content detection');
{
  // .h file with C++ content should get higher C++ confidence
  const cppPlugin = LANGUAGE_PLUGINS.find(p => p.id === 'cpp')!;
  const cPlugin = LANGUAGE_PLUGINS.find(p => p.id === 'c')!;
  const cppInH = `#include <iostream>\n#include <vector>\nnamespace foo { class Bar {}; }\n`;
  const cppConf = cppPlugin.detect(cppInH, 'widget.h');
  const cConf = cPlugin.detect(cppInH, 'widget.h');
  assert(cppConf > cConf, `.h file with C++ content: C++ (${cppConf}) > C (${cConf})`);
}

// ─────────────────────────────────────────────────────────────────
// EDGE: Empty content
// ─────────────────────────────────────────────────────────────────
section('EDGE: Empty content');
{
  for (const plugin of LANGUAGE_PLUGINS) {
    const imports = plugin.extractImports('');
    assert(imports.length === 0, `${plugin.id}: empty content → 0 imports`);
  }
}


// ─────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
}
