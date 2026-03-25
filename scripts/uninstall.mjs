#!/usr/bin/env node

import { existsSync, readFileSync, rmSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CLAUDE_SKILLS_DIR = join(homedir(), '.claude', 'skills');
const MANIFEST_PATH = join(CLAUDE_SKILLS_DIR, '.devops-manifest.json');

function uninstall() {
  if (!existsSync(MANIFEST_PATH)) {
    console.log('\x1b[33m[claude-skills-devops]\x1b[0m No manifest found, nothing to remove.');
    return;
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  const removed = [];

  for (const skill of manifest.skills) {
    const target = join(CLAUDE_SKILLS_DIR, skill);
    if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true });
      removed.push(skill);
    }

    // Restore backup if exists
    const backupPath = `${target}.bak`;
    if (existsSync(backupPath)) {
      renameSync(backupPath, target);
      console.log(`  \x1b[33mRestored\x1b[0m backup: ${skill}`);
    }
  }

  unlinkSync(MANIFEST_PATH);

  console.log('\n\x1b[36m[claude-skills-devops]\x1b[0m Uninstalled successfully!\n');
  for (const skill of removed) {
    console.log(`    \x1b[31m-\x1b[0m /${skill}`);
  }
  console.log('');
}

try {
  uninstall();
} catch (err) {
  console.error(`\x1b[31m[claude-skills-devops]\x1b[0m Uninstall failed: ${err.message}`);
  process.exit(1);
}
