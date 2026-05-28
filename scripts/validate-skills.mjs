#!/usr/bin/env node

/**
 * Validates skill content (not just install mechanics):
 *   1. Every skills/<dir> has a SKILL.md
 *   2. Frontmatter exists and has `name` + `description`
 *   3. `name` matches the directory name
 *   4. Every [text](references/foo.md) link points to a file that exists
 *   5. Every file in references/ is linked from SKILL.md (no orphans)
 *
 * Exits non-zero on any failure so CI fails loudly.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '..', 'skills');

const errors = [];
const warnings = [];

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      fm[key] = val;
    }
  }
  return fm;
}

const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

if (skillDirs.length === 0) {
  errors.push('No skill directories found under skills/');
}

for (const skill of skillDirs) {
  const skillDir = join(SKILLS_DIR, skill);
  const skillFile = join(skillDir, 'SKILL.md');

  if (!existsSync(skillFile)) {
    errors.push(`${skill}: missing SKILL.md`);
    continue;
  }

  const content = readFileSync(skillFile, 'utf-8');

  // 2. Frontmatter
  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push(`${skill}: missing or malformed frontmatter block`);
    continue;
  }
  if (!fm.name) errors.push(`${skill}: frontmatter missing \`name\``);
  if (!fm.description) errors.push(`${skill}: frontmatter missing \`description\``);

  // 3. name === directory
  if (fm.name && fm.name !== skill) {
    errors.push(`${skill}: frontmatter name "${fm.name}" does not match directory "${skill}"`);
  }

  // 4. reference mentions resolve — catches both markdown links
  //    `(references/foo.md)` and inline/backtick mentions `references/foo.md`.
  const linked = new Set();
  const refRe = /references\/([A-Za-z0-9._-]+\.md)/g;
  let m;
  while ((m = refRe.exec(content)) !== null) {
    const refFile = m[1];
    linked.add(refFile);
    if (!existsSync(join(skillDir, 'references', refFile))) {
      errors.push(`${skill}: broken reference link -> references/${refFile}`);
    }
  }

  // 5. orphan reference files (warning only)
  const refDir = join(skillDir, 'references');
  if (existsSync(refDir)) {
    for (const ref of readdirSync(refDir)) {
      if (!linked.has(ref)) {
        warnings.push(`${skill}: references/${ref} exists but is not linked from SKILL.md`);
      }
    }
  }
}

// ── Report ──────────────────────────────────────
if (warnings.length > 0) {
  console.log('\x1b[33mWarnings:\x1b[0m');
  for (const w of warnings) console.log(`  ! ${w}`);
  console.log('');
}

if (errors.length > 0) {
  console.log('\x1b[31mValidation failed:\x1b[0m');
  for (const e of errors) console.log(`  \x1b[31m✗\x1b[0m ${e}`);
  console.log(`\n  ${errors.length} error(s) across ${skillDirs.length} skills.\n`);
  process.exit(1);
}

console.log(`\x1b[32m✓\x1b[0m All ${skillDirs.length} skills valid (frontmatter + reference links).`);
