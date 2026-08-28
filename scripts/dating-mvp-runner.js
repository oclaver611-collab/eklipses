#!/usr/bin/env node
/**
 * dating-mvp-runner.js — Headless automation driver for the dating MVP task queue
 *
 * Usage:
 *   node scripts/dating-mvp-runner.js            # run next incomplete group
 *   node scripts/dating-mvp-runner.js --loop     # keep running until all done or blocked
 *   node scripts/dating-mvp-runner.js --group G2 # run a specific group
 *   node scripts/dating-mvp-runner.js --status   # print task status without running
 *
 * How it works:
 *   1. Reads TASKS.md, finds the first group that is PENDING or IN-PROGRESS.
 *   2. For each incomplete task in that group:
 *      - If the task is a DECISION POINT → log to PENDING-APPROVALS.md, skip.
 *      - Otherwise → build a context-rich prompt and run Claude CLI in headless mode.
 *      - On success → mark the task [x] in TASKS.md.
 *      - On failure → log the error to AUTOMATION_REPORT.md, stop the group.
 *   3. When all tasks in a group are done → mark the group [COMPLETE].
 *   4. If --loop is set → move to the next group automatically.
 *
 * Non-blocking rule: tasks marked (DECISION POINT) are never blocked on — they are
 * logged to PENDING-APPROVALS.md and the runner moves to the next task.
 *
 * Requirements:
 *   - `claude` CLI must be on PATH (installed via npm install -g @anthropic-ai/claude-code)
 *   - .env.local must have ANTHROPIC_API_KEY (or the env var must be set)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs    = require('fs');
const path  = require('path');
const { spawnSync, execSync } = require('child_process');

const ROOT              = path.join(__dirname, '..');
const TASKS_FILE        = path.join(ROOT, 'TASKS.md');
const APPROVALS_FILE    = path.join(ROOT, 'PENDING-APPROVALS.md');
const REPORT_FILE       = path.join(ROOT, 'AUTOMATION_REPORT.md');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args       = process.argv.slice(2);
const loopMode   = args.includes('--loop');
const statusMode = args.includes('--status');
const targetGroup = (() => {
  const gi = args.indexOf('--group');
  return gi !== -1 ? args[gi + 1] : null;
})();

// ── Logging ───────────────────────────────────────────────────────────────────
const log  = (msg) => process.stdout.write(msg + '\n');
const hr   = ()    => log('─'.repeat(72));
const ts   = ()    => new Date().toISOString().slice(0, 19).replace('T', ' ');

// ── TASKS.md parser ───────────────────────────────────────────────────────────

function readTasks() {
  return fs.readFileSync(TASKS_FILE, 'utf8');
}

function writeTasks(content) {
  fs.writeFileSync(TASKS_FILE, content, 'utf8');
}

/**
 * Returns an array of group objects:
 * { id, label, status, lineIndex, tasks: [{ text, done, decisionPoint, risky, lineIndex }] }
 */
function parseTasks(content) {
  const lines  = content.split('\n');
  const groups = [];
  let   current = null;

  const GROUP_RE  = /^## (G\d+) — (.+?) \[(COMPLETE|IN-PROGRESS|PENDING)\]/;
  const TASK_RE   = /^- \[([ x])\] (.+)/;

  lines.forEach((line, i) => {
    const gm = GROUP_RE.exec(line);
    if (gm) {
      current = {
        id:        gm[1],
        label:     gm[2],
        status:    gm[3],
        lineIndex: i,
        tasks:     [],
      };
      groups.push(current);
      return;
    }
    if (!current) return;
    const tm = TASK_RE.exec(line);
    if (tm) {
      current.tasks.push({
        done:          tm[1] === 'x',
        text:          tm[2],
        decisionPoint: tm[2].includes('(DECISION POINT)'),
        risky:         tm[2].includes('⚠️ RISKY'),
        lineIndex:     i,
      });
    }
  });

  return groups;
}

function markTaskDone(content, lineIndex) {
  const lines = content.split('\n');
  lines[lineIndex] = lines[lineIndex].replace('- [ ]', '- [x]');
  return lines.join('\n');
}

function markGroupStatus(content, lineIndex, newStatus) {
  const lines = content.split('\n');
  lines[lineIndex] = lines[lineIndex].replace(
    /\[(COMPLETE|IN-PROGRESS|PENDING)\]/,
    `[${newStatus}]`
  );
  return lines.join('\n');
}

// ── PENDING-APPROVALS.md helpers ──────────────────────────────────────────────

function logPendingApproval(groupId, taskText, recommendation) {
  const entry = [
    '',
    `## ${groupId} — ${ts()}`,
    '',
    `**Task:** ${taskText}`,
    '',
    `**Recommendation:** ${recommendation}`,
    '',
    `**Answer required:** [ ] Yes (proceed with recommendation)  [ ] No (do this instead: ___)`,
    '',
    '---',
  ].join('\n');

  if (!fs.existsSync(APPROVALS_FILE)) {
    fs.writeFileSync(APPROVALS_FILE, '# PENDING-APPROVALS\n\nReview these and fill in answers. The runner skips tasks here and continues with the rest.\n\n---\n');
  }
  fs.appendFileSync(APPROVALS_FILE, entry);
  log(`  [APPROVAL LOGGED] ${groupId}: ${taskText.slice(0, 60)}…`);
}

// ── AUTOMATION_REPORT.md helpers ──────────────────────────────────────────────

function appendReport(section, lines) {
  const header = `\n## ${section} — ${ts()}\n\n`;
  const body   = (Array.isArray(lines) ? lines : [lines]).join('\n') + '\n';
  if (!fs.existsSync(REPORT_FILE)) {
    fs.writeFileSync(REPORT_FILE, '# AUTOMATION_REPORT\n');
  }
  fs.appendFileSync(REPORT_FILE, header + body);
}

// ── Claude CLI runner ─────────────────────────────────────────────────────────

/**
 * Runs a single task by invoking the Claude CLI in headless mode.
 * Returns { success: bool, output: string }
 */
function runClaudeTask(groupId, task, priorContext) {
  const prompt = buildPrompt(groupId, task, priorContext);

  log(`\n  [CLAUDE] Running task: ${task.text.slice(0, 80)}`);

  // Write prompt to a temp file to avoid shell quoting issues
  const promptFile = path.join(ROOT, '_runner_prompt_tmp.txt');
  fs.writeFileSync(promptFile, prompt, 'utf8');

  const result = spawnSync(
    'claude',
    [
      '--print',                         // headless / non-interactive
      '--allowedTools', [
        'Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep',
      ].join(','),
      '--max-turns', '30',
      `--prompt-file`, promptFile,
    ],
    {
      cwd:      ROOT,
      shell:    true,
      encoding: 'utf8',
      timeout:  10 * 60 * 1000,         // 10 minutes per task
      env:      { ...process.env },
    }
  );

  // Clean up temp file
  try { fs.unlinkSync(promptFile); } catch {}

  const output = (result.stdout || '') + (result.stderr || '');
  const success = result.status === 0 && !output.toLowerCase().includes('fatal error');

  if (!success) {
    log(`  [FAIL] Exit ${result.status}`);
    log('  Last output:');
    output.trim().split('\n').slice(-12).forEach(l => log('    ' + l));
  } else {
    log(`  [OK] Task completed`);
    output.trim().split('\n').slice(-6).forEach(l => log('    ' + l));
  }

  return { success, output };
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(groupId, task, priorContext) {
  const taskId   = task.text.match(/^(G\d+\.\d+)/)?.[1] || groupId;
  const taskText = task.text;
  const isRisky  = task.risky;

  return `You are working on the Eklipses dating practice app (D:/BUSINESS/executables/love/eklipses/EK7).
This is a headless automation run — no human is present. Work autonomously.

## Your task
${taskId}: ${taskText}

## Non-blocking rules
- If you need a judgment call that blocks the whole task, write the question to PENDING-APPROVALS.md (append a new ## section with the question and your recommendation) and then stop — do NOT wait for an answer.
- If a test fails after 2 fix attempts, log the failure to AUTOMATION_REPORT.md and stop — do NOT loop forever.
- Always run \`node --check <file>\` before committing any JS file.
- Deploy ONLY via \`deploy.bat "message"\` — never \`git push\` directly.
- Never commit unless explicitly part of the task.

## Project conventions
- Primary LLM: Groq llama-3.3-70b-versatile (OpenAI gpt-4o-mini fallback)
- TTS: ElevenLabs Flash v2.5 (characters), OpenAI onyx (Ryan coach)
- Session saving: Supabase user_sessions table (count-session.js)
- Rate limit: 2 free sessions per IP, then Stripe paywall ($14.99/month)
- Test suites: node tests/test-all-scenarios.js, node tests/test-paywall.js, node tests/test-lesson-player.js, node tests/test-new-features.js

## Prior context from this run
${priorContext || 'None — this is the first task in this run.'}

## What to do
1. Read the relevant file(s) to understand current state.
2. Make the minimal change needed to complete the task.
3. Run the relevant test(s) to verify.
${isRisky ? '4. Because this task is marked ⚠️ RISKY: run tests TWICE and log both results.' : ''}
4. Append a brief result summary (pass/fail, what changed, any issues) to AUTOMATION_REPORT.md under a new ## section named "${taskId} — <date>".
5. Output the word TASK_COMPLETE on its own line if the task succeeded, or TASK_FAILED if it failed.
`;
}

// ── Status printer ────────────────────────────────────────────────────────────

function printStatus() {
  const content = readTasks();
  const groups  = parseTasks(content);

  log('\n╔══════════════════════════════════════════════════════════════════════╗');
  log('║  DATING MVP — TASK STATUS                                            ║');
  log('╚══════════════════════════════════════════════════════════════════════╝\n');

  for (const g of groups) {
    if (g.id.startsWith('G')) {
      const done  = g.tasks.filter(t => t.done).length;
      const total = g.tasks.length;
      const icon  = g.status === 'COMPLETE' ? '✓' : g.status === 'IN-PROGRESS' ? '→' : '○';
      log(`${icon} ${g.id} — ${g.label} [${g.status}] (${done}/${total})`);
      for (const t of g.tasks) {
        const mark = t.done ? '✓' : t.decisionPoint ? '❓' : t.risky ? '⚠' : '○';
        log(`    ${mark} ${t.text.slice(0, 80)}`);
      }
    }
  }
  log('');
}

// ── Main runner ───────────────────────────────────────────────────────────────

async function runNextGroup(forcedGroupId) {
  let content = readTasks();
  const groups = parseTasks(content);

  const targetable = groups.filter(g =>
    g.id.startsWith('G') &&
    (forcedGroupId ? g.id === forcedGroupId : g.status !== 'COMPLETE')
  );

  if (!targetable.length) {
    log('\n✓ All groups are complete! Dating MVP is ready.\n');
    return { done: true };
  }

  const group = targetable[0];
  log(`\n${'═'.repeat(72)}`);
  log(`  RUNNING GROUP: ${group.id} — ${group.label}`);
  log(`  Status: ${group.status}`);
  log(`${'═'.repeat(72)}\n`);

  // Mark group IN-PROGRESS
  content = markGroupStatus(content, group.lineIndex, 'IN-PROGRESS');
  writeTasks(content);

  const priorContext = [];
  let allPassed = true;

  for (const task of group.tasks) {
    if (task.done) {
      log(`  [SKIP] Already done: ${task.text.slice(0, 70)}`);
      continue;
    }

    if (task.decisionPoint) {
      // Extract the recommendation from the task text (the sentence after "recommendation:")
      // Fall back to the raw task text as the recommendation.
      const recMatch = task.text.match(/recommendation:\s*(.+)/i);
      const rec = recMatch ? recMatch[1] : task.text;
      logPendingApproval(group.id, task.text, rec);
      // Decision-point tasks don't block — mark them done with a special note
      // Actually, per the spec, skip them (don't mark done — they need human answer)
      priorContext.push(`${task.text.match(/^(G\d+\.\d+)/)?.[1]}: SKIPPED (decision point, logged to PENDING-APPROVALS.md)`);
      continue;
    }

    const { success, output } = runClaudeTask(group.id, task, priorContext.join('\n'));

    priorContext.push(
      `${task.text.match(/^(G\d+\.\d+)/)?.[1]}: ${success ? 'DONE' : 'FAILED'} — ${output.slice(-200).replace(/\n/g, ' ')}`
    );

    if (success) {
      content = readTasks();         // re-read in case Claude modified the file
      content = markTaskDone(content, task.lineIndex);
      writeTasks(content);
    } else {
      appendReport(`${group.id} FAILURE`, [
        `Task: ${task.text}`,
        `Exit: failed`,
        `Last output:`,
        ...output.trim().split('\n').slice(-20),
      ]);
      allPassed = false;
      log(`\n  [STOP] Group ${group.id} halted — task failed. Check AUTOMATION_REPORT.md.\n`);
      break;
    }
  }

  // Re-parse to check final state
  content = readTasks();
  const finalGroups = parseTasks(content);
  const finalGroup  = finalGroups.find(g => g.id === group.id);
  const remainingTasks = finalGroup?.tasks.filter(t => !t.done && !t.decisionPoint) ?? [];

  if (allPassed && remainingTasks.length === 0) {
    content = markGroupStatus(content, finalGroup.lineIndex, 'COMPLETE');
    writeTasks(content);
    log(`\n✓ Group ${group.id} COMPLETE\n`);
    appendReport(`${group.id} COMPLETE`, [`All tasks in ${group.id} passed. Group marked COMPLETE.`]);
    return { done: false, groupComplete: true };
  } else {
    log(`\n○ Group ${group.id} left IN-PROGRESS (${remainingTasks.length} tasks remaining or failed)\n`);
    return { done: false, groupComplete: false };
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

(async () => {
  log('\n╔══════════════════════════════════════════════════════════════════════╗');
  log('║  EKLIPSES DATING MVP RUNNER                                          ║');
  log(`║  ${ts()}                                                   ║`);
  log('╚══════════════════════════════════════════════════════════════════════╝\n');

  if (statusMode) {
    printStatus();
    process.exit(0);
  }

  if (loopMode) {
    log('Loop mode: will keep running groups until all complete or a group fails.\n');
    while (true) {
      const { done, groupComplete } = await runNextGroup(targetGroup);
      if (done) { process.exit(0); }
      if (!groupComplete) {
        log('Loop stopped — a group did not complete. Resolve the failure and re-run.\n');
        process.exit(1);
      }
    }
  } else {
    const { done } = await runNextGroup(targetGroup);
    process.exit(done ? 0 : 0);
  }
})();
