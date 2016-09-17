#!/usr/bin/env node
"use strict";

/* eslint-disable no-magic-numbers, no-console, no-process-exit, max-statements */

const fs = require("fs");
const Path = require("path");
const acorn = require("acorn");
const _ = require("lodash");
const mkdirp = require("mkdirp");
const argv = require("yargs")
  .usage("Usage: $0 --bundle [bundle.js] --stats [stats.json] --dir [output_dir] --rewrite")
  .alias("b", "bundle")
  .nargs("b", 1)
  .describe("b", "JS bundle file from webpack")
  .alias("s", "stats")
  .nargs("s", 1)
  .default("s", "dist/server/stats.json")
  .describe("s", "stats JSON file from webpack")
  .alias("r", "rewrite")
  .describe("r", "rewrite the bundle file with module ID comments removed")
  .alias("d", "dir")
  .describe("d", "directory to write the analyze results")
  .default("d", ".etmp")
  .help("h")
  .alias("h", "help")
  .demand(["bundle"])
  .argv;

const stats = require(Path.resolve(argv.stats));
const code = fs.readFileSync(argv.bundle).toString();
const comments = [];
acorn.parse(code, {ranges: false, onComment: comments});

const getOutputDir = () => {
  const dir = argv.dir;

  if (dir === ".etmp" && !fs.existsSync(Path.resolve(".etmp"))) {
    mkdirp.sync(dir);
    fs.writeFileSync(`${dir}/.gitignore`, "# Electrode tmp dir\n*\n");
  }

  return dir;
};

const outputDir = getOutputDir();

const modIdsFromComments = comments.filter((c) => {
  if (c.type === "Block" && c.value.match(/^ [0-9]+ $/)) {
    const x = code.substr(c.end + 1, 1);
    return x === "," || x === "[" || x.match(/[0-9]/) || code.substr(c.end + 1, 8) === "function";
  }
});

if (modIdsFromComments.length <= 0) {
  console.error("analyze-bundle: bundle doesn't contain comments with module IDs, can't analyze");
  process.exit(1);
}

const nm = "node_modules";
const cwd = process.cwd();
const mods = [];
let current = null;
let codeIndex = 0;

const updatedCode = [];

function saveCode(start, end) {
  if (argv.rewrite) {
    updatedCode.push(code.substring(start, end).trim());
  }
}

modIdsFromComments.forEach((c) => {
  const m = _.find(stats.modules, (x) => {
    return ` ${x.id} ` === c.value;
  });

  let iden = m.identifier;
  let x = iden.lastIndexOf("!");
  if (x < 0) {
    x = 0;
  } else {
    x++;
  }

  iden = iden.substring(x, iden.length);
  iden = iden.replace(cwd, ".");
  const n = iden.lastIndexOf(nm);

  if (n >= 0) {
    iden = `~${iden.substring(n + nm.length, iden.length)}`;
  }

  if (current) {
    const size = c.start - current.end;
    mods.push({id: current.id, name: current.name, size: size, iden: current.iden});
  }

  saveCode(codeIndex, c.start);
  codeIndex = c.end;

  current = {id: m.id, name: m.name, end: c.end, iden: iden};
});

const findLastEndIndex = () => {
  const x = code.indexOf("}]))", current.end);

  if (x === null || isNaN(x) || x <= current.end) {
    return code.length;
  }

  return x;
};

const endAt = findLastEndIndex();

saveCode(current.end, code.length);

current.size = endAt - current.end + 1;
mods.push(current);

if (argv.rewrite) {
  console.log("analyze-bundle: rewriting bundle without module ID comments");
  fs.writeFileSync(argv.bundle, updatedCode.join(""));
}

fs.writeFileSync(`${outputDir}/bundle.analyze.json`, JSON.stringify(mods, null, 2));
fs.writeFileSync(`${outputDir}/bundle.analyze.tsv`, mods.reduce((a, m) => {
  return `${a}${m.id}\t${m.name}\t${m.iden}\t${m.size}\n`;
}, "Module ID\tFull Path\tIdentity Path\tSize (bytes)\n"));
