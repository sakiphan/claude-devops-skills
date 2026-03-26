#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_SOURCE = join(__dirname, '..', 'skills');
const CLAUDE_SKILLS_DIR = join(homedir(), '.claude', 'skills');
const MANIFEST_PATH = join(CLAUDE_SKILLS_DIR, '.devops-manifest.json');

function getExistingManifest() {
  if (!existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function install() {
  // Ensure ~/.claude/skills/ exists
  if (!existsSync(CLAUDE_SKILLS_DIR)) {
    mkdirSync(CLAUDE_SKILLS_DIR, { recursive: true });
  }

  const existingManifest = getExistingManifest();
  const ownSkills = new Set(existingManifest?.skills || []);

  const skillDirs = readdirSync(SKILLS_SOURCE, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const installed = [];
  const updated = [];

  for (const skill of skillDirs) {
    const target = join(CLAUDE_SKILLS_DIR, skill);

    if (existsSync(target)) {
      if (ownSkills.has(skill)) {
        // Our own skill — just overwrite, no backup needed
        rmSync(target, { recursive: true, force: true });
        updated.push(skill);
      } else {
        // Foreign skill — skip and warn, don't create .bak files
        console.log(`  \x1b[33m⚠\x1b[0m Skipping /${skill} — already exists (not ours). Remove it manually to install.`);
        continue;
      }
    }

    // Copy skill directory
    cpSync(join(SKILLS_SOURCE, skill), target, { recursive: true });
    if (!updated.includes(skill)) {
      installed.push(skill);
    }
  }

  // Clean up any leftover .bak files from previous versions
  for (const skill of skillDirs) {
    const bakPath = join(CLAUDE_SKILLS_DIR, `${skill}.bak`);
    if (existsSync(bakPath)) {
      rmSync(bakPath, { recursive: true, force: true });
    }
  }

  // Read package version
  let version = '?.?.?';
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    version = pkg.version;
  } catch {}

  // Write manifest for clean uninstall
  const manifest = {
    version,
    installedAt: new Date().toISOString(),
    skills: [...new Set([...installed, ...updated])]
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  // Print summary
  console.log('\n\x1b[36m[claude-skills-devops]\x1b[0m Installed successfully!\n');
  console.log(`  Version: \x1b[1mv${version}\x1b[0m`);

  if (installed.length > 0) {
    console.log('\n  New skills:');
    for (const skill of installed) {
      console.log(`    \x1b[32m+\x1b[0m /${skill}`);
    }
  }
  if (updated.length > 0) {
    console.log('\n  Updated skills:');
    for (const skill of updated) {
      console.log(`    \x1b[34m↑\x1b[0m /${skill}`);
    }
  }

  console.log(`\n  Location: ${CLAUDE_SKILLS_DIR}`);
  console.log('  Run \x1b[1mclaude-skills-devops doctor\x1b[0m to verify.\n');
}

try {
  install();
} catch (err) {
  console.error(`\x1b[31m[claude-skills-devops]\x1b[0m Install failed: ${err.message}`);
  process.exit(1);
}
