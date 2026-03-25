#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, renameSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_SOURCE = join(__dirname, '..', 'skills');
const CLAUDE_SKILLS_DIR = join(homedir(), '.claude', 'skills');
const MANIFEST_PATH = join(CLAUDE_SKILLS_DIR, '.devops-manifest.json');

function install() {
  // Ensure ~/.claude/skills/ exists
  if (!existsSync(CLAUDE_SKILLS_DIR)) {
    mkdirSync(CLAUDE_SKILLS_DIR, { recursive: true });
  }

  const skillDirs = readdirSync(SKILLS_SOURCE, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const installed = [];
  const backedUp = [];

  for (const skill of skillDirs) {
    const target = join(CLAUDE_SKILLS_DIR, skill);

    // Backup existing skill if not ours
    if (existsSync(target)) {
      const backupPath = `${target}.bak`;
      renameSync(target, backupPath);
      backedUp.push(skill);
    }

    // Copy skill directory
    cpSync(join(SKILLS_SOURCE, skill), target, { recursive: true });
    installed.push(skill);
  }

  // Write manifest for clean uninstall
  const manifest = {
    version: '1.0.0',
    installedAt: new Date().toISOString(),
    skills: installed,
    backups: backedUp
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  // Print summary
  console.log('\n\x1b[36m[claude-skills-devops]\x1b[0m Installed successfully!\n');
  console.log('  Skills installed:');
  for (const skill of installed) {
    const cmd = `/${skill}`;
    console.log(`    \x1b[32m+\x1b[0m ${cmd}`);
  }
  if (backedUp.length > 0) {
    console.log(`\n  \x1b[33mWarning:\x1b[0m Backed up existing skills: ${backedUp.join(', ')}`);
  }
  console.log(`\n  Location: ${CLAUDE_SKILLS_DIR}`);
  console.log('  Run \x1b[1mclaude-skills-devops list\x1b[0m to see all skills.\n');
}

try {
  install();
} catch (err) {
  console.error(`\x1b[31m[claude-skills-devops]\x1b[0m Install failed: ${err.message}`);
  process.exit(1);
}
