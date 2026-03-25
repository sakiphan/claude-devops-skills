#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_SKILLS_DIR = join(homedir(), '.claude', 'skills');
const MANIFEST_PATH = join(CLAUDE_SKILLS_DIR, '.devops-manifest.json');

const COMMANDS = {
  list: 'List installed devops skills',
  install: 'Install/reinstall skills to ~/.claude/skills/',
  uninstall: 'Remove skills from ~/.claude/skills/',
  doctor: 'Check that all skills are properly installed',
  help: 'Show this help message'
};

function getManifest() {
  if (!existsSync(MANIFEST_PATH)) return null;
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
}

function list() {
  const manifest = getManifest();
  if (!manifest) {
    console.log('\n  No devops skills installed. Run: claude-skills-devops install\n');
    return;
  }

  console.log('\n\x1b[36m[claude-skills-devops]\x1b[0m Installed skills:\n');
  for (const skill of manifest.skills) {
    const skillPath = join(CLAUDE_SKILLS_DIR, skill, 'SKILL.md');
    const exists = existsSync(skillPath);
    const icon = exists ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`  ${icon}  /${skill}`);
  }
  console.log(`\n  Installed: ${manifest.installedAt}`);
  console.log(`  Location:  ${CLAUDE_SKILLS_DIR}\n`);
}

function install() {
  const scriptPath = join(__dirname, '..', 'scripts', 'install.mjs');
  execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
}

function uninstall() {
  const scriptPath = join(__dirname, '..', 'scripts', 'uninstall.mjs');
  execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
}

function doctor() {
  const manifest = getManifest();
  console.log('\n\x1b[36m[claude-skills-devops]\x1b[0m Health check:\n');

  if (!manifest) {
    console.log('  \x1b[31m✗\x1b[0m No manifest found. Skills not installed.');
    console.log('  Run: claude-skills-devops install\n');
    return;
  }

  let healthy = true;
  for (const skill of manifest.skills) {
    const skillDir = join(CLAUDE_SKILLS_DIR, skill);
    const skillFile = join(skillDir, 'SKILL.md');

    if (!existsSync(skillDir)) {
      console.log(`  \x1b[31m✗\x1b[0m /${skill} - directory missing`);
      healthy = false;
    } else if (!existsSync(skillFile)) {
      console.log(`  \x1b[31m✗\x1b[0m /${skill} - SKILL.md missing`);
      healthy = false;
    } else {
      const content = readFileSync(skillFile, 'utf-8');
      const hasName = content.includes('name:');
      const hasDesc = content.includes('description:');
      if (!hasName || !hasDesc) {
        console.log(`  \x1b[33m!\x1b[0m /${skill} - missing frontmatter fields`);
        healthy = false;
      } else {
        console.log(`  \x1b[32m✓\x1b[0m /${skill}`);
      }
    }
  }

  // Check references exist
  const refCount = manifest.skills.reduce((count, skill) => {
    const refDir = join(CLAUDE_SKILLS_DIR, skill, 'references');
    if (existsSync(refDir)) {
      return count + readdirSync(refDir).length;
    }
    return count;
  }, 0);

  console.log(`\n  Reference files: ${refCount}`);
  console.log(`  Status: ${healthy ? '\x1b[32mHealthy\x1b[0m' : '\x1b[31mIssues found - run: claude-skills-devops install\x1b[0m'}\n`);
}

function help() {
  console.log('\n\x1b[36mclaude-skills-devops\x1b[0m - Interactive DevOps skills for Claude Code\n');
  console.log('  Usage: claude-skills-devops <command>\n');
  console.log('  Commands:');
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`    ${cmd.padEnd(12)} ${desc}`);
  }
  console.log('');
}

// Main
const command = process.argv[2] || 'help';

switch (command) {
  case 'list': list(); break;
  case 'install': install(); break;
  case 'uninstall': uninstall(); break;
  case 'doctor': doctor(); break;
  case 'help': case '--help': case '-h': help(); break;
  default:
    console.log(`\n  Unknown command: ${command}`);
    help();
    process.exit(1);
}
