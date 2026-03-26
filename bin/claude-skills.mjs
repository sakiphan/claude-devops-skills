#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_SKILLS_DIR = join(homedir(), '.claude', 'skills');
const MANIFEST_PATH = join(CLAUDE_SKILLS_DIR, '.devops-manifest.json');

const COMMANDS = {
  list:      'List installed devops skills',
  info:      'Show details of a specific skill',
  doctor:    'Check health, version, and file stats',
  install:   'Install/reinstall skills to ~/.claude/skills/',
  update:    'Update to the latest version from npm',
  uninstall: 'Remove skills from ~/.claude/skills/',
  help:      'Show this help message'
};

function getManifest() {
  if (!existsSync(MANIFEST_PATH)) return null;
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
}

function getPkgVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return null;
  }
}

function getDirSize(dirPath) {
  let total = 0;
  if (!existsSync(dirPath)) return 0;
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirSize(full);
    } else {
      total += statSync(full).size;
    }
  }
  return total;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function countFiles(dirPath) {
  let count = 0;
  if (!existsSync(dirPath)) return 0;
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(join(dirPath, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

function parseSkillFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
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

// ── Commands ──────────────────────────────────────

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
  console.log(`\n  Version:   v${manifest.version}`);
  console.log(`  Installed: ${manifest.installedAt}`);
  console.log(`  Location:  ${CLAUDE_SKILLS_DIR}\n`);
}

function info(skillName) {
  if (!skillName) {
    console.log('\n  Usage: claude-skills-devops info <skill-name>');
    console.log('  Example: claude-skills-devops info devops-k8s\n');
    return;
  }

  // Allow with or without devops- prefix
  if (!skillName.startsWith('devops-')) {
    skillName = `devops-${skillName}`;
  }

  const skillDir = join(CLAUDE_SKILLS_DIR, skillName);
  const skillFile = join(skillDir, 'SKILL.md');

  if (!existsSync(skillFile)) {
    console.log(`\n  \x1b[31m✗\x1b[0m Skill not found: ${skillName}`);
    console.log('  Run: claude-skills-devops list\n');
    return;
  }

  const content = readFileSync(skillFile, 'utf-8');
  const fm = parseSkillFrontmatter(content);
  const lines = content.split('\n').length;
  const size = formatSize(getDirSize(skillDir));
  const files = countFiles(skillDir);

  // Count references
  const refDir = join(skillDir, 'references');
  const refs = existsSync(refDir) ? readdirSync(refDir) : [];

  console.log(`\n\x1b[36m[claude-skills-devops]\x1b[0m Skill info: \x1b[1m/${skillName}\x1b[0m\n`);
  console.log(`  Name:         ${fm.name || skillName}`);
  console.log(`  Description:  ${fm.description || '(none)'}`);
  if (fm['argument-hint']) {
    console.log(`  Arguments:    ${fm['argument-hint']}`);
  }
  console.log(`  SKILL.md:     ${lines} lines`);
  console.log(`  Total size:   ${size} (${files} files)`);

  if (refs.length > 0) {
    console.log(`\n  References (${refs.length}):`);
    for (const ref of refs) {
      const refSize = formatSize(statSync(join(refDir, ref)).size);
      console.log(`    • ${ref} (${refSize})`);
    }
  }

  console.log(`\n  Use: \x1b[1m/${skillName}${fm['argument-hint'] ? ' ' + fm['argument-hint'] : ''}\x1b[0m\n`);
}

function doctor() {
  const manifest = getManifest();
  const pkgVersion = getPkgVersion();

  console.log('\n\x1b[36m[claude-skills-devops]\x1b[0m Health check:\n');

  if (!manifest) {
    console.log('  \x1b[31m✗\x1b[0m No manifest found. Skills not installed.');
    console.log('  Run: claude-skills-devops install\n');
    return;
  }

  // Version info
  console.log(`  Package version:   v${pkgVersion || '?'}`);
  console.log(`  Manifest version:  v${manifest.version}`);
  console.log(`  Installed at:      ${manifest.installedAt}`);

  // Check for version mismatch
  if (pkgVersion && manifest.version !== pkgVersion) {
    console.log(`  \x1b[33m⚠ Version mismatch!\x1b[0m Run: claude-skills-devops install`);
  }
  console.log('');

  // Skill checks
  let healthy = true;
  let totalSize = 0;
  let totalFiles = 0;
  let totalRefs = 0;

  for (const skill of manifest.skills) {
    const skillDir = join(CLAUDE_SKILLS_DIR, skill);
    const skillFile = join(skillDir, 'SKILL.md');

    if (!existsSync(skillDir)) {
      console.log(`  \x1b[31m✗\x1b[0m /${skill} — directory missing`);
      healthy = false;
    } else if (!existsSync(skillFile)) {
      console.log(`  \x1b[31m✗\x1b[0m /${skill} — SKILL.md missing`);
      healthy = false;
    } else {
      const content = readFileSync(skillFile, 'utf-8');
      const hasName = content.includes('name:');
      const hasDesc = content.includes('description:');
      const size = getDirSize(skillDir);
      const files = countFiles(skillDir);
      const refDir = join(skillDir, 'references');
      const refs = existsSync(refDir) ? readdirSync(refDir).length : 0;

      totalSize += size;
      totalFiles += files;
      totalRefs += refs;

      if (!hasName || !hasDesc) {
        console.log(`  \x1b[33m!\x1b[0m /${skill} — missing frontmatter (${formatSize(size)})`);
        healthy = false;
      } else {
        console.log(`  \x1b[32m✓\x1b[0m /${skill} (${formatSize(size)}, ${files} files, ${refs} refs)`);
      }
    }
  }

  // Check for stale .bak files
  const bakFiles = existsSync(CLAUDE_SKILLS_DIR)
    ? readdirSync(CLAUDE_SKILLS_DIR).filter(f => f.endsWith('.bak'))
    : [];

  if (bakFiles.length > 0) {
    console.log(`\n  \x1b[33m⚠\x1b[0m Found ${bakFiles.length} stale .bak files:`);
    for (const bak of bakFiles) {
      console.log(`    • ${bak}`);
    }
    console.log('  Run: claude-skills-devops install (to clean them up)');
    healthy = false;
  }

  // Summary
  console.log(`\n  ─────────────────────────────`);
  console.log(`  Skills:     ${manifest.skills.length}`);
  console.log(`  Files:      ${totalFiles}`);
  console.log(`  References: ${totalRefs}`);
  console.log(`  Total size: ${formatSize(totalSize)}`);
  console.log(`  Status:     ${healthy ? '\x1b[32m✓ Healthy\x1b[0m' : '\x1b[31m✗ Issues found\x1b[0m'}\n`);
}

function update() {
  console.log('\n\x1b[36m[claude-skills-devops]\x1b[0m Checking for updates...\n');
  try {
    const latest = execSync('npm view claude-skills-devops version', { encoding: 'utf-8' }).trim();
    const current = getPkgVersion();

    if (current === latest) {
      console.log(`  Already on latest version: \x1b[32mv${current}\x1b[0m\n`);
      return;
    }

    console.log(`  Current: v${current}`);
    console.log(`  Latest:  v${latest}`);
    console.log('  Updating...\n');
    execSync('npm install -g claude-skills-devops@latest', { stdio: 'inherit' });
    console.log('\n  \x1b[32m✓\x1b[0m Updated successfully!\n');
  } catch (err) {
    console.error(`  \x1b[31m✗\x1b[0m Update failed: ${err.message}\n`);
    process.exit(1);
  }
}

function install() {
  const scriptPath = join(__dirname, '..', 'scripts', 'install.mjs');
  execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
}

function uninstall() {
  const scriptPath = join(__dirname, '..', 'scripts', 'uninstall.mjs');
  execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
}

function help() {
  const version = getPkgVersion();
  console.log(`\n\x1b[36mclaude-skills-devops\x1b[0m v${version || '?'} — Interactive DevOps skills for Claude Code\n`);
  console.log('  Usage: claude-skills-devops <command> [args]\n');
  console.log('  Commands:');
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`    ${cmd.padEnd(12)} ${desc}`);
  }
  console.log('\n  Examples:');
  console.log('    claude-skills-devops list');
  console.log('    claude-skills-devops info k8s');
  console.log('    claude-skills-devops doctor');
  console.log('    claude-skills-devops update\n');
}

// ── Main ──────────────────────────────────────────

const command = process.argv[2] || 'help';
const args = process.argv.slice(3);

switch (command) {
  case 'list':      list(); break;
  case 'info':      info(args[0]); break;
  case 'doctor':    doctor(); break;
  case 'install':   install(); break;
  case 'update':    update(); break;
  case 'uninstall': uninstall(); break;
  case 'help': case '--help': case '-h': help(); break;
  default:
    console.log(`\n  Unknown command: ${command}`);
    help();
    process.exit(1);
}
