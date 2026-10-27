// AI CAPABILITIES — the tasks, kept apart from the door.
//
// src/ai.js is the door to the model. This file is the work put through it: each
// capability gathers the RIGHT SLICE of the project (never the whole thing),
// hands it to the model with a task-specific instruction, and returns a DRAFT.
// Nothing here issues, certifies or sends — a person signs.
//
// A capability sends facts, not the platform's HTML. Cheaper, and it keeps what
// leaves the country to the minimum, which matters while the model is a hosted
// API and not yet the self-hosted one.

import { callModel, aiEnabled, AI_OFF_MESSAGE } from './ai.js';
import { buildReport } from './report.js';

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// The figures a report narrative is written from — pulled out of the full
// report object so the model gets a tight fact sheet, not a web page.
export function factsFromReport(d) {
  const p = d.project || {};
  const t = d.target || {};
  const mp = d.manpower || {};
  const iss = d.issues || null;
  const lines = [];
  lines.push(`Project: ${p.name || 'Project'}${p.ref ? ' (' + p.ref + ')' : ''}`);
  lines.push(`Period: ${d.from} to ${d.to} (${d.kind})`);
  if (p.contract_completion) lines.push(`Contract completion: ${p.contract_completion}`);
  lines.push(`Activities completed in the period: ${(d.completed || []).length}`);
  lines.push(`Activities started in the period: ${(d.started || []).length}`);
  if (t.total) {
    lines.push(`Targets: ${t.cleared || 0} of ${t.total} cleared, ${t.missed || 0} missed` +
      (t.name ? ` (target set: ${t.name}${t.deadline ? ', due ' + t.deadline : ''})` : ''));
  }
  if (mp.manDays) {
    lines.push(`Manpower: ${n(mp.manDays)} man-days over ${n(mp.daysWorked)} days worked` +
      (mp.peak ? `, peak ${n(mp.peak)}${mp.peakDay ? ' on ' + mp.peakDay : ''}` : ''));
  }
  // The delays and their stated reasons — the spine of the narrative.
  if ((d.reasons || []).length) {
    lines.push('Delays reported this period:');
    for (const r of d.reasons.slice(0, 12)) {
      lines.push(`  · ${r.activity || r.wbs || 'activity'}: ${r.reason || 'no reason given'}` +
        (r.days ? ` (${r.days} d)` : ''));
    }
  }
  if (iss) {
    lines.push(`Correspondence: ${n(iss.open)} open, ${n(iss.overdue)} overdue for reply, ` +
      `${n(iss.impactDays)} impact-days claimed` +
      (iss.turnaround != null ? `, average reply ${Math.round(iss.turnaround)} d` : ''));
  }
  // The report is honest about what it could not measure; the narrative must be
  // too, so the gaps travel into it rather than reading as zeroes.
  if ((d.gaps || []).length) lines.push('Not recorded this period: ' + d.gaps.join('; '));
  return lines.join('\n');
}

const REPORT_SYSTEM =
  'You are a UAE main-contractor project manager writing the narrative section of a ' +
  'progress report for the Engineer and the client. Write plainly and factually in ' +
  'British English. Use only the figures given — never invent a number, a date or a ' +
  'cause. If the facts show a delay, say so and give the stated reason; do not reassure. ' +
  'Where a figure is marked not recorded, say it was not recorded rather than treating ' +
  'it as zero. Four short paragraphs at most: where the works stand, what moved this ' +
  'period, what is holding progress, and what is needed from the Engineer or client. ' +
  'No headings, no bullet lists, no salutation — just the paragraphs.';

// The narrative for a weekly or monthly report. The numbers stay in the report
// (they are computed, exact and shown as a table); this is only the prose around
// them, which is the part a PM actually spends Friday night on.
export async function reportNarrative(env, pid, project, kind, key, who) {
  if (!aiEnabled(env)) return { error: AI_OFF_MESSAGE, disabled: true };
  const d = await buildReport(env, pid, project, kind === 'monthly' ? 'monthly' : 'weekly', key);
  const facts = factsFromReport(d);
  const r = await callModel(env, {
    task: 'report-narrative',
    system: REPORT_SYSTEM,
    prompt: 'Write the narrative for this progress report from these facts:\n\n' + facts,
    max_tokens: 900, temperature: 0.3,
    project_id: pid, who,
  });
  if (r.error) return r;
  return {
    ok: true,
    narrative: r.text,
    facts,                          // shown beside the draft, so the PM sees what it was written from
    period: { from: d.from, to: d.to, kind: d.kind },
    model: r.model,
    // Said on every draft, because a report goes to the client over the PM's name.
    note: 'A draft written from this period’s figures. Read it against the numbers, ' +
          'edit as your own, before it goes out.',
  };
}
