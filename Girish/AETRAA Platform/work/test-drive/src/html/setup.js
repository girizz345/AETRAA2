import { THEME_CSS } from './theme.js';
import { icon } from './icons.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK } from './shared.js';
import { ADMIN_CSS, ADMIN_BAR, ADMIN_JS } from './admin-nav.js';
import { SIGNBOX_JS } from './signboxes.js';

// The AETRAA Admin console — onboard a client: create the Company, the Project
// with its contract terms, and assign the Principal. Owner/platform login only.
//
// TWO PAGES IN ONE, decided by the address.
//
//   /setup            the platform console: every company, every project, the
//                     email domains. What AETRAA itself uses.
//   /setup?p=<id>     THIS PROJECT'S setup, reached from the project's own tab
//                     bar. It must never show the other projects — the operator
//                     clicked Setup on Tower A and landed on a list of four
//                     companies, with no bar and no way back: "it goes to all
//                     projects". It opens instead on what he asked to see: the
//                     real dashboard each position on this job will get, and
//                     under it the settings that belong to this project only.
//
// WHY IT WENT TO ALL PROJECTS. The page had been written to pin itself to one
// project — it hides the pickers when window.PROJECT_ID is set — but the
// script that sets PROJECT_ID (ADMIN_JS) was never added to this page, nor its
// styles. So PROJECT_ID was never set, and the page fell back to everything.
// It now reads the project from the address, which is there before any script
// runs, and carries the bar like every other admin screen.
export const setupHTML = (pid = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AETRAA Admin · Project Setup</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${ADMIN_CSS}
.wrap { max-width: 1100px; }
.cols { display: grid; gap: 16px; grid-template-columns: 1.3fr 1fr; align-items: start; }
@media (max-width: 900px){ .cols { grid-template-columns: 1fr; } }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; box-shadow: var(--shadow); margin: 0 0 16px; }
.card h2 { font-size: var(--fs-body); margin: 0 0 14px; }
.card h3 { font-size: var(--fs-label); text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin: 16px 0 8px; }
.frm { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
.f { display: flex; flex-direction: column; gap: 4px; }
.f.full { grid-column: 1 / -1; }
label { font-size: var(--fs-secondary); color: var(--ink-2); }
input, select { font: inherit; font-size: var(--fs-body); padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--ink); }
.btn { font: inherit; font-size: var(--fs-body); padding: 9px 16px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); cursor: pointer; text-decoration: none; }
.btn.prim { background: var(--series-1); border-color: var(--series-1); color: var(--on-accent); }
.hint { font-size: var(--fs-secondary); color: var(--muted); margin-top: 8px; line-height: 1.5; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
th { text-align: left; font-size: var(--fs-label); text-transform: uppercase; letter-spacing: .04em; color: var(--muted); padding: 6px 8px; border-bottom: 1px solid var(--border); }
td { padding: 8px; border-bottom: 1px solid var(--grid); }
.pill { font-size: var(--fs-secondary); padding: 2px 9px; border-radius: 999px; background: color-mix(in srgb, var(--good-text) 16%, transparent); color: var(--good-text); }
.msg { padding: 10px 14px; border-radius: 9px; margin: 0 0 14px; font-size: var(--fs-secondary); display: none; }
.msg.ok { background: color-mix(in srgb, var(--good-text) 14%, transparent); color: var(--good-text); display: block; }
.msg.err { background: color-mix(in srgb, var(--critical) 14%, transparent); color: var(--critical); display: block; }
.logobox { margin-top: 6px; min-height: 40px; display: flex; align-items: center; }
.logobox img { max-height: 40px; max-width: 150px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 3px; }
.logobox span { font-size: var(--fs-secondary); color: var(--muted); }
.modgrid { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
@media (max-width: 700px){ .modgrid { grid-template-columns: 1fr; } }
.mod { display: flex; gap: 10px; align-items: flex-start; padding: 9px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); cursor: pointer; }
.mod input { margin: 3px 0 0; padding: 0; width: 16px; height: 16px; flex: none; }
.mod > div { flex: 1; text-align: left; }
.mod b { display: block; font-size: var(--fs-secondary); font-weight: 500; }
.mod span { display: block; font-size: var(--fs-secondary); color: var(--muted); line-height: 1.4; }
.mod.core { opacity: .75; cursor: default; }
.modlinks { font-size: var(--fs-secondary); margin: 0 0 8px; }
.modlinks a { color: var(--series-1); cursor: pointer; margin-right: 12px; }
.have { font-size: var(--fs-secondary); color: var(--muted); padding: 9px 11px; margin-bottom: 10px;
        border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); }
.have b { color: var(--ink); }
.gatenote { display: none; font-size: var(--fs-secondary); color: var(--muted); padding: 10px 12px; border: 1px dashed var(--border); border-radius: 9px; }
.card.gated .gatenote { display: block; }
.card.gated > :not(h2):not(.gatenote) { display: none; }

/* ---- the real dashboard for each position */
.dv { display: grid; grid-template-columns: 250px 1fr; gap: 14px; align-items: start; }
@media (max-width: 900px) { .dv { grid-template-columns: 1fr; } }
.dvl { max-height: 820px; overflow: auto; padding-right: 2px; }
.dvl .g { font-size: var(--fs-label); font-weight: 500; letter-spacing: .07em; text-transform: uppercase;
          color: var(--muted); margin: 12px 0 5px 4px; }
.dvl .g:first-child { margin-top: 0; }
.dvl button { display: flex; width: 100%; gap: 8px; align-items: baseline; text-align: left; font: inherit;
              font-size: var(--fs-secondary); padding: 7px 9px; border-radius: 8px; border: 1px solid transparent;
              background: none; color: var(--ink); cursor: pointer; }
.dvl button:hover { background: var(--surface-2); }
.dvl button.on { background: var(--surface-2); border-color: var(--border); font-weight: 500; }
.dvl button .l { flex: 1 1 auto; min-width: 0; }
.dvl button .h { font-size: var(--fs-secondary); color: var(--muted); white-space: nowrap; font-weight: 400; }
.dvl button .h.none { color: var(--accent-text); }
/* Signs: the pen line icon (the ✍ emoji drew in another font). */
.dvl button.sign .l::before { content: ""; display: inline-block; width: 13px; height: 13px; margin-right: 6px; vertical-align: -2px; background: currentColor;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20h9'/%3E%3Cpath d='M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z'/%3E%3C/svg%3E") center / contain no-repeat;
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20h9'/%3E%3Cpath d='M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z'/%3E%3C/svg%3E") center / contain no-repeat; }
.dvh { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.dvh .sp { flex: 1 1 auto; }
.dvh b { font-size: var(--fs-body); }
.dvchips { display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; }
.dvchips span { font-size: var(--fs-secondary); padding: 3px 8px; border-radius: 6px; border: 1px solid var(--border);
                background: var(--surface-2); }
.dvchips span.full { border-color: color-mix(in srgb, var(--good-ink) 45%, transparent); }
.dvchips span i { font-style: normal; color: var(--muted); font-size: var(--fs-secondary); margin-left: 4px; }
#dvFrame { width: 100%; height: 780px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
.dvnote { font-size: var(--fs-secondary); color: var(--muted); margin: 0 0 12px; line-height: 1.55; }
.settings-h { font-size: var(--fs-secondary); text-transform: uppercase; letter-spacing: .06em; color: var(--muted);
              margin: 22px 0 10px 2px; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>AETRAA Admin</h1><div class="sub">project setup &amp; onboarding</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/home">All projects</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  ${pid ? ADMIN_BAR : ''}
  <div class="msg" id="msg"></div>

  <!-- THIS PROJECT ONLY. The real application, booted as each position on this
       job, on this project's real data. Read-only: every write carrying the
       preview stamp is refused at the server's front door, not just hidden. -->
  <div class="card" id="dashv" style="display:none">
    <h2>The real dashboard for each position</h2>
    <div class="dvnote">Pick a position. What opens beside it is the actual application, on this
      project's real data, exactly as the person in that position will see it on the day it goes
      live. Nothing can be changed from here.</div>
    <div class="dv">
      <div class="dvl" id="dvList"><div class="hint">Loading the positions…</div></div>
      <div>
        <div class="dvh">
          <div><b id="dvName">—</b><div class="hint" id="dvWho" style="margin-top:2px"></div></div>
          <span class="sp"></span>
          <a class="btn" id="dvEdit" href="#">Change what it opens</a>
          <a class="btn" id="dvFull" href="#" target="_blank" rel="noopener">Full screen ${icon('external', 14)}</a>
        </div>
        <div class="dvchips" id="dvDash"></div>
        <iframe id="dvFrame" title="The dashboard this position sees"></iframe>
      </div>
    </div>
  </div>
  <div class="settings-h" id="settingsH" style="display:none">This project's settings</div>

  <!-- REPORTS & DISTRIBUTION. Set on the project's own Setup, before anybody on
       the client side has signed in — it used to live only on the client's
       admin page. With it, whether the programme is current: every date in
       every report is read from it. -->
  <div class="card" id="repCard" style="display:none">
    <h2>Reports &amp; distribution</h2>
    <div class="have" id="repProg"></div>
    <div class="hint" id="repMail" style="margin:0 0 12px"></div>
    <div class="frm">
      <div class="f full"><label>Who receives them — email addresses, separated by commas</label>
        <input id="repTo" autocomplete="off" placeholder="name@company.com, name2@company.com"></div>
    </div>
    <div class="modgrid" style="margin-top:12px">
      <label class="mod"><input type="checkbox" id="repDaily"><div><b>Daily report</b><span id="repDailyAt">every evening</span></div></label>
      <label class="mod"><input type="checkbox" id="repWeekly"><div><b>Weekly report</b><span id="repWeeklyAt">every Monday</span></div></label>
      <label class="mod"><input type="checkbox" id="repMonthly"><div><b>Monthly report</b><span id="repMonthlyAt">on the 1st</span></div></label>
      <label class="mod"><input type="checkbox" id="repDigest"><div><b>Each person's morning list</b><span id="repDigestAt">what needs their attention today</span></div></label>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;align-items:center">
      <button class="btn prim" id="repSave">Save</button>
      <button class="btn" id="repTest">Send today's daily report now</button>
      <span class="hint" id="repOut" style="margin:0"></span>
    </div>
  </div>
  <div class="cols">
    <div class="card">
      <h2>Companies &amp; projects <span class="hint" id="count"></span></h2>
      <div id="list"><div class="hint">Loading…</div></div>
    </div>
  </div>

  <div class="card">
    <h2>Company email domains</h2>
    <div class="frm">
      <div class="f full"><label>Company</label><select id="dom_co"></select></div>
      <div class="f"><label>Company email domain(s)</label><input id="dom_list" placeholder="company.com"></div>
      <div class="f"><label>Also allowed — partner domains or single addresses</label><input id="dom_allow" placeholder="partner.com, name@partner.com"></div>
    </div>
    <div class="hint">Only these addresses can be added to the company — by you, the Principal or the PM. Leave the first box empty to unlock. People already added are not affected.</div>
    <div style="margin-top:12px"><button class="btn prim" id="dom_go">Save email domains</button></div>
  </div>

  <div class="card">
    <h2>Response periods — calendar days</h2>
    <div class="frm"><div class="f full"><label>Project</label><select id="rp_pid"></select></div></div>
    <div class="hint" style="margin-top:8px">How long each document may take before it shows as overdue. <b>From issue</b> runs from the day Document Control issues it
      (the consultant’s reply); <b>from raised</b> runs from the day it is raised (closing it out inside the team). A date typed into the form when raising a document always wins.</div>
    <div class="modgrid" id="rp_grid" style="margin-top:10px"></div>
    <div style="margin-top:12px"><button class="btn prim" id="rp_go">Save response periods</button> <button class="btn" id="rp_reset">Back to defaults</button></div>
  </div>

  <div class="card" data-needs="boq" data-pidsel="pt_pid">
    <h2>Payment terms — what the IPC follows</h2>
    <div class="gatenote" data-gatefor="pt_pid"></div>
    <div class="frm"><div class="f full"><label>Project</label><select id="pt_pid"></select></div></div>
    <div class="hint" style="margin-top:8px">Taken from the Contract (Particular Conditions). The QS never types these into an application — the platform applies them and shows the working.</div>
    <div class="frm" style="margin-top:10px">
      <div class="f"><label>Retention %</label><input id="pt_ret" type="number" step="0.01"></div>
      <div class="f"><label>Retention cap % of contract</label><input id="pt_cap" type="number" step="0.01"></div>
      <div class="f"><label>Advance payment %</label><input id="pt_adv" type="number" step="0.01"></div>
      <div class="f"><label>Advance amount (leave blank to use the %)</label><input id="pt_advamt" type="number" step="0.01"></div>
      <div class="f"><label>Recovered at % of work valued (blank = same as advance %)</label><input id="pt_rec" type="number" step="0.01"></div>
      <div class="f"><label>Recovery starts once valued reaches %</label><input id="pt_recstart" type="number" step="0.01"></div>
      <div class="f"><label>Fully recovered by % of contract</label><input id="pt_recfull" type="number" step="0.01"></div>
      <div class="f"><label>Materials on site paid at % of cost</label><input id="pt_mos" type="number" step="0.01"></div>
      <div class="f"><label>VAT %</label><input id="pt_vat" type="number" step="0.01"></div>
      <div class="f"><label>Days for the Engineer to certify</label><input id="pt_cert" type="number"></div>
      <div class="f"><label>Days for the client to pay</label><input id="pt_pay" type="number"></div>
      <div class="f"><label>HSE: hours in a standard site day (for man-hours)</label><input id="pt_hse" type="number" step="0.5" placeholder="10"></div>
      <div class="f"><label style="display:flex;gap:8px;align-items:center"><input id="pt_rcvd" type="checkbox" style="width:auto;height:auto"> The advance payment has been received</label></div>
    </div>
    <div class="hint" id="pt_note"></div>
    <div style="margin-top:12px"><button class="btn prim" id="pt_go">Save payment terms</button></div>
  </div>

  <div class="card">
    <h2>Contract reference — bond, insurance, damages, dates</h2>
    <div class="frm"><div class="f full"><label>Project</label><select id="cr_pid"></select></div></div>
    <div class="hint" style="margin-top:8px">From the Appendix to Tender. Kept for the record — nothing on the platform reads these back into a certificate or a calculation.</div>
    <div class="frm" style="margin-top:10px">
      <div class="f"><label>Performance bond %</label><input id="cr_bond" type="number" step="0.01"></div>
      <div class="f"><label>All-risk insurance (AED, per accident)</label><input id="cr_insurance" type="number" step="0.01"></div>
      <div class="f"><label>Commencement period (days from Notice to Proceed)</label><input id="cr_commence" type="number"></div>
      <div class="f"><label>Mobilization (calendar days)</label><input id="cr_mob" type="number"></div>
      <div class="f"><label>Construction (calendar months)</label><input id="cr_constr" type="number" step="0.01"></div>
      <div class="f"><label>Testing, commissioning & handover (calendar days)</label><input id="cr_testing" type="number"></div>
      <div class="f"><label>Defects liability period (calendar months)</label><input id="cr_dlp" type="number" step="0.01"></div>
      <div class="f"><label>Liquidated damages to Owner (AED/calendar day)</label><input id="cr_ldowner" type="number" step="0.01"></div>
      <div class="f"><label>Liquidated damages to Owner — cap % of contract</label><input id="cr_ldownercap" type="number" step="0.01"></div>
      <div class="f"><label>Liquidated damages to Engineer (AED/calendar day)</label><input id="cr_ldeng" type="number" step="0.01"></div>
    </div>
    <div class="hint" id="cr_note"></div>
    <div style="margin-top:12px"><button class="btn prim" id="cr_go">Save contract reference</button></div>
  </div>

  <div class="card">
    <h2>Modules — add or remove for a project</h2>
    <div class="frm"><div class="f full"><label>Project</label><select id="mod_pid"></select></div></div>
    <div class="modlinks" style="margin-top:12px"><a data-modall="mode">Select all</a><a data-modnone="mode">Clear</a></div>
    <div class="modgrid" id="mod_edit"></div>
    <div class="hint">Switching a module off hides it from everyone on the project and blocks it on the server. Nothing is deleted — switch it back on and every record is where it was.</div>
    <div style="margin-top:12px"><button class="btn prim" id="mod_go">Save modules</button></div>
  </div>

  <div class="card">
    <h2>Programme — upload the Primavera .xer</h2>
    <div class="frm">
      <div class="f"><label>Project</label><select id="xer_pid"></select></div>
      <div class="f"><label>Programme file (.xer)</label><input id="xer_file" type="file" accept=".xer"></div>
    </div>
    <div class="hint" id="xer_hint">The programme is the project's spine — activities, drawing submissions, material approvals and procurement dates all come from it. Nothing is saved until you review what it found.</div>
    <div style="margin-top:12px"><button class="btn prim" id="xer_read" disabled>Read the programme</button></div>
    <div id="xer_review" style="margin-top:16px"></div>
  </div>

  <div class="card" data-needs="boq" data-pidsel="boq_pid">
    <h2>Import priced BOQ</h2>
    <div class="gatenote" data-gatefor="boq_pid"></div>
    <div class="frm">
      <div class="f"><label>Project</label><select id="boq_pid"></select></div>
      <div class="f"><label>BOQ file (Excel .xlsx / .csv)</label><input id="boq_file" type="file" accept=".xlsx,.xlsm,.csv"></div>
    </div>
    <!-- WHAT IS ALREADY THERE. The card used to say only "Import", so a person
         looking at it could not tell whether a bill had ever been loaded — and
         a re-import REPLACES the bill every certificate is computed from. -->
    <div class="have" id="boq_have">Checking what is already imported\u2026</div>
    <div class="hint" id="boq_prev">Every sheet is read; each sheet's header row is found on its own. Recognised columns: <b>Section, Ref, Description, Unit, Qty, Rate, Amount, Billed%</b>. Lines with no rate or a wrong sum are flagged, and the QS fixes or accepts each one before the bill is imported; the PM then approves it.</div>
    <div style="margin-top:12px"><button class="btn prim" id="boq_go" disabled>Check BOQ</button>
      <a class="btn" href="/bills" id="boq_check" hidden>Finish the check on BOQ &amp; BOM</a>
      <a class="btn" href="/files?s=fig.boq" id="boq_open" hidden>Open the bill</a></div>
  </div>

  <div class="card" data-needs="bom" data-pidsel="bom_pid">
    <h2>Import BOM (budget quantities)</h2>
    <div class="gatenote" data-gatefor="bom_pid"></div>
    <div class="frm">
      <div class="f"><label>Project</label><select id="bom_pid"></select></div>
      <div class="f"><label>BOM file (Excel .xlsx / .csv)</label><input id="bom_file" type="file" accept=".xlsx,.xlsm,.csv"></div>
    </div>
    <div class="hint" id="bom_prev">First row must be a header. Recognised columns: <b>Ref, Material, Unit, Budget Qty (or Qty), Rate, Amount, BOQ ref, Discipline</b>. Each material is matched to a BOQ line, and Procurement resolves the rest before the PM approves. Re-importing updates budgets but <b>keeps</b> what site has already ordered and received.</div>
    <div style="margin-top:12px"><button class="btn prim" id="bom_go" disabled>Check BOM</button>
      <a class="btn" href="/bills" id="bom_check" hidden>Finish the check on BOQ &amp; BOM</a></div>
  </div>

  <div class="card">
    <h2>Branding — logos for this project</h2>
    <div class="frm">
      <div class="f full"><label>Project</label><select id="br_pid"></select></div>
      <div class="f"><label>Client / employer</label><input class="brf" data-k="logo_client" type="file" accept="image/*"><div class="logobox" id="pv_logo_client"></div></div>
      <div class="f"><label>Consultant / Engineer</label><input class="brf" data-k="logo_consultant" type="file" accept="image/*"><div class="logobox" id="pv_logo_consultant"></div></div>
      <div class="f"><label>Consultant (second)</label><input class="brf" data-k="logo_consultant2" type="file" accept="image/*"><div class="logobox" id="pv_logo_consultant2"></div></div>
      <div class="f"><label>Contractor</label><input class="brf" data-k="logo_contractor" type="file" accept="image/*"><div class="logobox" id="pv_logo_contractor"></div></div>
    </div>
    <div class="hint">Images are shrunk in your browser before saving, so any size file is fine. These marks are printed on the project's documents and reports.</div>
    <div style="margin-top:12px"><button class="btn prim" id="br_go">Save branding</button> <button class="btn" id="br_clear">Clear all</button></div>
  </div>

  <div class="card" data-needs="templates" data-pidsel="tpl_pid">
    <h2>Consultant document templates</h2>
    <div class="gatenote" data-gatefor="tpl_pid"></div>
    <div class="hint" style="margin-bottom:12px">
      Upload the consultant's own blank form — <b>Word (.docx)</b> or <b>Excel (.xlsx)</b>, whichever
      he issues. Type a placeholder in double braces into the cell or the line where a value belongs —
      for example <code>{{ref}}</code>, <code>{{subject}}</code>, <code>{{date}}</code>. You can also use
      any field label from the form itself, e.g. <code>{{Discipline}}</code>. Every document the platform
      issues for this project then comes out on his form, in his layout, with his logos.
    </div>
    <div class="frm">
      <div class="f"><label>Project</label><select id="tpl_pid"></select></div>
      <div class="f"><label>Document type</label><select id="tpl_type"></select></div>
      <div class="f full"><label>Template file (.docx, .xlsx or a PDF form)</label><input id="tpl_file" type="file" accept=".docx,.xlsx,.pdf"></div>
    </div>
    <div class="hint" id="tpl_prev">Standard placeholders: <span id="tpl_std"></span></div>
    <div style="margin-top:12px"><button class="btn prim" id="tpl_go" disabled>Upload template</button></div>
    <div id="tpl_list" style="margin-top:16px"></div>
  </div>

  <div class="card" data-needs="authorities" data-pidsel="au_pid">
    <h2>Authorities — NOCs this project must clear</h2>
    <div class="gatenote" data-gatefor="au_pid"></div>
    <div class="frm">
      <div class="f"><label>Project</label><select id="au_pid"></select></div>
      <div class="f"><label>Emirate / list</label><select id="au_em"></select></div>
    </div>
    <div id="au_list" style="margin-top:12px"></div>
    <div class="frm" style="margin-top:12px">
      <div class="f"><label>Add your own — name</label><input id="au_cname" placeholder="Master developer"></div>
      <div class="f"><label>Scope</label><input id="au_cscope" placeholder="Community NOC"></div>
    </div>
    <div class="hint">Tick the authorities that apply. Each one becomes a tracked item in the authority register with its own reference, action date and status. You can add more at any time.</div>
    <div style="margin-top:12px"><button class="btn prim" id="au_go">Add to project</button></div>
    <div id="au_have" style="margin-top:14px"></div>
  </div>
  <div class="card" data-needs="drawings" data-pidsel="rules_pid">
    <h2>Drawing numbering &mdash; the gate</h2>
    <div class="gatenote" data-gatefor="rules_pid"></div>
    <p class="hint" style="margin:0 0 12px">A contractor who runs three projects and pays for one has an obvious move: file the other two here. The numbering scheme is the only test that reliably catches it, because another project's drawings genuinely <em>are</em> numbered differently. Take these prefixes from the contractor's own drawing register.
      <b>Until this is set, the drawing gate does nothing</b> &mdash; and the platform says so rather than implying protection that is not there.</p>
    <div class="frm">
      <div class="f"><label>Project</label><select id="rules_pid"></select></div>
      <div class="f"><label>&nbsp;</label><div id="rules_state" class="hint" style="margin:0"></div></div>
    </div>
    <table style="margin-top:12px"><thead><tr><th>Prefix</th><th>Discipline</th><th>Trade group</th><th></th></tr></thead>
      <tbody id="rules_rows"></tbody></table>
    <div class="frm" style="margin-top:10px">
      <div class="f"><label>Add prefix</label><input id="rule_match" placeholder="ST"></div>
      <div class="f"><label>Discipline</label><input id="rule_disc" placeholder="Structural"></div>
    </div>
    <div style="margin-top:12px"><button class="btn" id="rule_add">Add</button>
      <button class="btn prim" id="rules_save" style="margin-left:8px">Save numbering</button></div>
    <div class="hint">A held drawing can also be approved <em>and</em> its prefix learned, so the same hold never happens twice &mdash; a subcontractor numbering shop drawings SUB- on a project set up for ST- would otherwise generate a hold on every sheet, forever.</div>
  </div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

<script>
function val(id){ var e=document.getElementById(id); return e?e.value.trim():''; }
function numv(id){ var v=val(id); return v===''?null:Number(v); }
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function msg(t,ok){ var m=document.getElementById('msg'); m.textContent=t; m.className='msg '+(ok?'ok':'err'); }

// ---- company email domains -----------------------------------------------
var COS={};
function listOf(raw){ try{ var a=JSON.parse(raw||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function paintDomains(){
  var c=COS[document.getElementById('dom_co').value]||{};
  document.getElementById('dom_list').value=listOf(c.email_domains).join(', ');
  document.getElementById('dom_allow').value=listOf(c.email_allowed).join(', ');
}
document.getElementById('dom_co').addEventListener('change',paintDomains);
document.getElementById('dom_go').addEventListener('click',async function(){
  var cid=document.getElementById('dom_co').value; if(!cid){ msg('Pick a company first.',false); return; }
  this.disabled=true;
  try{
    var r=await fetch('/api/setup/company-email',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({company_id:cid,email_domains:val('dom_list'),email_allowed:val('dom_allow')})});
    var d=await r.json();
    if(d.ok){ msg(d.email_domains.length?('Locked to @'+d.email_domains.join(', @')+(d.email_allowed.length?' — also allowed: '+d.email_allowed.join(', '):'')+'.'):'Unlocked — any address can be added.',true); loadList(); }
    else msg(d.error||'Could not save.',false);
  }catch(e){ msg('Could not reach the server.',false); }
  this.disabled=false;
});

// ---- response periods ------------------------------------------------------
var RP=null;
async function loadPeriods(){
  var pid=document.getElementById('rp_pid').value; var g=document.getElementById('rp_grid');
  if(!pid){ g.innerHTML='<div class="hint">Create a project first.</div>'; return; }
  try{
    var r=await fetch('/api/setup/response-days?project='+encodeURIComponent(pid),{cache:'no-store'});
    var d=await r.json(); RP=d.periods||{};
    g.innerHTML=Object.keys(RP).map(function(k){ var p=RP[k];
      return '<label class="mod" style="align-items:center"><div><b>'+esc(p.label)+'</b><span>'+esc(p.what)+' · from '+(p.from==='issue'?'issue':p.from==='received'?'receipt':'raised')+
        (p.days!==p.default?' · default '+p.default:'')+'</span></div><input type="number" min="1" max="365" class="rpd" data-k="'+esc(k)+
        '" value="'+p.days+'" style="width:70px;height:auto;padding:6px 8px"></label>'; }).join('');
  }catch(e){ g.innerHTML='<div class="hint">Could not load.</div>'; }
}
document.getElementById('rp_pid').addEventListener('change',loadPeriods);
async function savePeriods(reset){
  var pid=document.getElementById('rp_pid').value; if(!pid){ msg('Pick a project first.',false); return; }
  var periods={}; document.querySelectorAll('.rpd').forEach(function(i){ periods[i.getAttribute('data-k')]= reset && RP ? RP[i.getAttribute('data-k')].default : Number(i.value); });
  try{
    var r=await fetch('/api/setup/response-days',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project_id:pid,periods:periods})});
    var d=await r.json();
    if(d.ok){ msg(reset?'Back to the default response periods.':'Response periods saved. New documents use them; documents already issued keep their date.',true); loadPeriods(); }
    else msg(d.error||'Could not save.',false);
  }catch(e){ msg('Could not reach the server.',false); }
}
document.getElementById('rp_go').addEventListener('click',function(){ savePeriods(false); });
// ---- payment terms -----------------------------------------------------
var PT_IDS={retention_pct:'pt_ret',retention_cap_pct:'pt_cap',advance_pct:'pt_adv',advance_amount:'pt_advamt',recovery_pct:'pt_rec',
  recovery_start_pct:'pt_recstart',recovery_full_pct:'pt_recfull',mos_pct:'pt_mos',vat_pct:'pt_vat',certify_days:'pt_cert',payment_days:'pt_pay',hse_hours_per_day:'pt_hse'};
async function loadTerms(){
  var pid=document.getElementById('pt_pid').value; if(!pid) return;
  try{
    var r=await fetch('/api/setup/payment-terms?project='+encodeURIComponent(pid),{cache:'no-store'});
    var d=await r.json(); var t=d.terms||{};
    Object.keys(PT_IDS).forEach(function(k){ var el=document.getElementById(PT_IDS[k]); if(el) el.value=(t[k]==null?'':t[k]); });
    var raw=d.raw||{}; document.getElementById('pt_hse').value=(raw.hse_hours_per_day==null?'':raw.hse_hours_per_day); document.getElementById('pt_advamt').value=(raw.advance_amount==null?'':raw.advance_amount); document.getElementById('pt_rec').value=(raw.recovery_pct==null?'':raw.recovery_pct);
    document.getElementById('pt_rcvd').checked=!!t.advance_received;
    document.getElementById('pt_note').textContent=d.contract?('BOQ total '+Number(d.contract).toLocaleString(undefined,{minimumFractionDigits:2})+' — advance '+Number(t.advance_amount||0).toLocaleString(undefined,{minimumFractionDigits:2})+'.'):'Import the priced BOQ to see the advance as an amount.';
  }catch(e){}
}
document.getElementById('pt_pid').addEventListener('change',loadTerms);
document.getElementById('pt_go').addEventListener('click',async function(){
  var pid=document.getElementById('pt_pid').value; if(!pid){ msg('Pick a project first.',false); return; }
  var terms={advance_received:document.getElementById('pt_rcvd').checked};
  Object.keys(PT_IDS).forEach(function(k){ var v=document.getElementById(PT_IDS[k]).value; if(v!=='') terms[k]=Number(v); });
  try{
    var r=await fetch('/api/setup/payment-terms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project_id:pid,terms:terms})});
    var d=await r.json();
    if(d.ok){ msg('Payment terms saved. Applications raised from now on follow them.',true); loadTerms(); }
    else msg(d.error||'Could not save.',false);
  }catch(e){ msg('Could not reach the server.',false); }
});

document.getElementById('rp_reset').addEventListener('click',function(){ savePeriods(true); });

// ---- contract reference -------------------------------------------------
var CR_IDS={performance_bond_pct:'cr_bond',all_risk_insurance_aed:'cr_insurance',commencement_days:'cr_commence',
  mobilization_days:'cr_mob',construction_months:'cr_constr',testing_handover_days:'cr_testing',dlp_months:'cr_dlp',
  ld_owner_aed_per_day:'cr_ldowner',ld_owner_cap_pct:'cr_ldownercap',ld_engineer_aed_per_day:'cr_ldeng'};
async function loadContractRef(){
  var pid=document.getElementById('cr_pid').value; if(!pid) return;
  try{
    var r=await fetch('/api/setup/contract-terms?project='+encodeURIComponent(pid),{cache:'no-store'});
    var d=await r.json(); var t=d.terms||{};
    Object.keys(CR_IDS).forEach(function(k){ var el=document.getElementById(CR_IDS[k]); if(el) el.value=(t[k]==null?'':t[k]); });
  }catch(e){}
}
document.getElementById('cr_pid').addEventListener('change',loadContractRef);
document.getElementById('cr_go').addEventListener('click',async function(){
  var pid=document.getElementById('cr_pid').value; if(!pid){ msg('Pick a project first.',false); return; }
  var terms={};
  Object.keys(CR_IDS).forEach(function(k){ var v=document.getElementById(CR_IDS[k]).value; if(v!=='') terms[k]=Number(v); });
  try{
    var r=await fetch('/api/setup/contract-terms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project_id:pid,terms:terms})});
    var d=await r.json();
    if(d.ok){ msg('Contract reference saved.',true); loadContractRef(); }
    else msg(d.error||'Could not save.',false);
  }catch(e){ msg('Could not reach the server.',false); }
});

// ---- modules -----------------------------------------------------------
var CAT=null, PMODS={};
function parseMods(raw){                    // null = everything (projects set up before modules)
  if(raw==null||raw==='') return null;
  try{ var a=JSON.parse(raw); return Array.isArray(a)?a:null; }catch(e){ return null; }
}
function allIds(){ return CAT?CAT.modules.map(function(m){return m.id;}):[]; }
function modsFor(pid){ var m=PMODS[pid]; return m==null?allIds():m; }
function modSummary(list){
  if(!CAT) return '';
  var on=list==null?allIds():list;
  if(on.length===allIds().length) return 'all modules';
  if(!on.length) return 'base platform only';
  return on.map(function(id){ var m=CAT.modules.filter(function(x){return x.id===id;})[0]; return m?m.label:id; }).join(' · ');
}
function modBoxes(cls){
  if(!CAT) return '';
  var core=CAT.core.map(function(c){ return '<label class="mod core"><input type="checkbox" checked disabled><div><b>'+esc(c.label)+' — always included</b><span>'+esc(c.note)+'</span></div></label>'; }).join('');
  return core+CAT.modules.map(function(m){
    return '<label class="mod"><input type="checkbox" class="'+cls+'" value="'+esc(m.id)+'"><div><b>'+esc(m.label)+'</b><span>'+esc(m.note)+'</span></div></label>';
  }).join('');
}
function checkedMods(cls){ var out=[]; document.querySelectorAll('.'+cls).forEach(function(c){ if(c.checked) out.push(c.value); }); return out; }
function paintModEdit(){
  var pid=document.getElementById('mod_pid').value; var on=modsFor(pid);
  document.querySelectorAll('.mode').forEach(function(c){ c.checked=on.indexOf(c.value)>=0; });
}
// A setup card is only needed while a module that uses it is on.
function stepOn(pid,step){
  if(!CAT) return true;
  var on=modsFor(pid);
  return CAT.modules.some(function(m){ return on.indexOf(m.id)>=0 && (m.setup||[]).indexOf(step)>=0; });
}
function gateCards(){
  document.querySelectorAll('.card[data-needs]').forEach(function(card){
    var step=card.getAttribute('data-needs'); var sel=document.getElementById(card.getAttribute('data-pidsel'));
    var pid=sel?sel.value:''; var on=!pid||stepOn(pid,step);
    card.classList.toggle('gated',!on);
    if(!on){
      var need=CAT.modules.filter(function(m){ return (m.setup||[]).indexOf(step)>=0; }).map(function(m){ return m.label; });
      card.querySelector('.gatenote').textContent='Not needed for this project — it uses the '+need.join(' or ')+' module, which is switched off. Switch it on in Modules above to load this.';
    }
  });
}
async function loadModules(){
  try{
    var r=await fetch('/api/setup/modules',{cache:'no-store'});
    if(!r.ok) return;
    CAT=await r.json();
    document.getElementById('mod_new').innerHTML=modBoxes('modn');
    document.getElementById('mod_edit').innerHTML=modBoxes('mode');
    paintModEdit(); gateCards();
  }catch(e){}
}
document.addEventListener('click',function(ev){
  var a=ev.target.closest('[data-modall]'); if(a){ document.querySelectorAll('.'+a.getAttribute('data-modall')).forEach(function(c){c.checked=true;}); return; }
  var n=ev.target.closest('[data-modnone]'); if(n){ document.querySelectorAll('.'+n.getAttribute('data-modnone')).forEach(function(c){c.checked=false;}); return; }
});
document.getElementById('mod_pid').addEventListener('change',paintModEdit);
['boq_pid','bom_pid','tpl_pid','au_pid','rules_pid'].forEach(function(id){ var e=document.getElementById(id); if(e) e.addEventListener('change',gateCards); });

/* WHAT IS ALREADY IMPORTED.
 *
 * The complaint this answers, verbatim: "boq, when I open it says import, I
 * don't know what is attached". The card offered an action and reported no
 * state, so there was no way to tell an empty project from one whose bill was
 * already loaded — and an import REPLACES that bill.
 */
async function boqHave(){
  var box=document.getElementById('boq_have'); if(!box) return;
  var pid=document.getElementById('boq_pid').value;
  var open=document.getElementById('boq_open');
  if(!pid){ box.textContent='Pick a project.'; if(open) open.hidden=true; return; }
  box.textContent='Checking what is already imported\u2026';
  try{
    var r=await fetch('/api/section?project='+encodeURIComponent(pid)+'&id=fig.boq',{cache:'no-store'});
    var d=await r.json();
    var f=(d&&d.figures)||{};
    if(f.lines){
      var t=Number(f.total||0).toLocaleString('en-AE',{maximumFractionDigits:2});
      box.innerHTML='A priced bill is already loaded: <b>'+f.lines+' lines</b>, total <b>AED '+t+'</b>'
        +(f.source?' — from <b>'+String(f.source).replace(/[<>&]/g,'')+'</b>':'')
        +'. Importing again <b>replaces</b> it, and every certificate is computed from it.';
      if(open){ open.hidden=false; open.href='/files?p='+encodeURIComponent(pid)+'&s=fig.boq'; }
    } else {
      box.textContent='Nothing imported yet on this project. Until a priced bill is loaded, no payment certificate can be valued.';
      if(open) open.hidden=true;
    }
  }catch(e){ box.textContent='Could not check what is already imported.'; }
}
var _bq=document.getElementById('boq_pid');
if(_bq) _bq.addEventListener('change', boqHave);
document.getElementById('mod_go').addEventListener('click',async function(){
  var pid=document.getElementById('mod_pid').value; if(!pid){ msg('Pick a project first.',false); return; }
  var list=checkedMods('mode');
  var before=modsFor(pid); var dropping=before.filter(function(x){ return list.indexOf(x)<0; });
  if(dropping.length && !confirm('Switch off '+modSummary(dropping)+'? Its screens will be hidden from everyone on this project. No data is deleted.')) return;
  this.disabled=true; this.textContent='Saving…';
  try{
    var r=await fetch('/api/setup/modules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project_id:pid,modules:list})});
    var d=await r.json();
    if(d.ok){ PMODS[pid]=d.modules; msg('Saved — this project now has '+modSummary(d.modules)+'.',true); gateCards(); loadList(); }
    else msg(d.error||'Could not save.',false);
  }catch(e){ msg('Could not reach the server.',false); }
  this.disabled=false; this.textContent='Save modules';
});

async function loadList(){
  var r=await fetch('/api/setup/companies',{cache:'no-store'});
  if(r.status===401){ location.href='/'; return; }
  var d=await r.json();
  var byCo={}; (d.projects||[]).forEach(function(p){ (byCo[p.org_id]=byCo[p.org_id]||[]).push(p); });
  COS={}; (d.companies||[]).forEach(function(c){ COS[c.id]=c; });
  var dc=document.getElementById('dom_co'); var keepd=dc.value;
  dc.innerHTML=(d.companies||[]).map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>';}).join('')||'<option value="">— no companies yet —</option>';
  if(keepd) dc.value=keepd; paintDomains();
  document.getElementById('count').textContent=(d.companies||[]).length+' companies · '+(d.projects||[]).length+' projects';
  var opts=(d.projects||[]).map(function(p){return '<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>';}).join('')||'<option value="">— no projects yet —</option>';
  var xp=document.getElementById('xer_pid'); var keepx=xp.value;
  xp.innerHTML=opts; if(keepx) xp.value=keepx;
  document.getElementById('boq_pid').innerHTML=opts;
  setTimeout(boqHave, 0);
  document.getElementById('bom_pid').innerHTML=opts;
  var br=document.getElementById('br_pid'); var keep=br.value;
  br.innerHTML=opts; if(keep) br.value=keep;
  var tp=document.getElementById('tpl_pid'); var keept=tp.value;
  tp.innerHTML=opts; if(keept) tp.value=keept;
  var au=document.getElementById('au_pid'); var keepa=au.value;
  au.innerHTML=opts; if(keepa) au.value=keepa;
  ['xer_pid','boq_pid','bom_pid','br_pid','tpl_pid','au_pid','mod_pid'].forEach(function(id){
    var e=document.getElementById(id); var w=e&&e.getAttribute('data-want');
    if(w){ e.innerHTML=opts; e.value=w; e.removeAttribute('data-want'); } });
  /* ONE PROJECT, CHOSEN ON THE HOME SCREEN.
   *
   * This page carried eleven project pickers, one per card, each remembering
   * whatever was last left in it. An Admin who imported a BOQ and then a
   * programme could quite easily do the two to different projects and get no
   * warning at all. The project now comes from the address, the same one the
   * bar at the top names, and the pickers follow it and get out of the way. */
  // From the address, which is there before any script runs — not from
  // window.PROJECT_ID, which depended on a script this page never carried.
  var want = SCOPED;
  if (want) {
    ['xer_pid','boq_pid','bom_pid','br_pid','tpl_pid','au_pid','mod_pid','pt_pid','cr_pid','rp_pid','rules_pid']
      .forEach(function(id){
        var e=document.getElementById(id); if(!e) return;
        if(!e.options.length || e.innerHTML.indexOf('no projects yet')>=0) e.innerHTML=opts;
        e.value = want;
        var f = e.closest('.f'); if (f) f.hidden = true;
        e.dispatchEvent(new Event('change'));
      });
  }
  PMODS={}; (d.projects||[]).forEach(function(p){ PMODS[p.id]=parseMods(p.modules); });
  var mp=document.getElementById('mod_pid'); var keepm=mp.value;
  mp.innerHTML=opts; if(keepm) mp.value=keepm;
  paintModEdit(); gateCards();
  var rpp=document.getElementById('rp_pid'); var keepr=rpp.value; rpp.innerHTML=opts; if(keepr) rpp.value=keepr; loadPeriods();
  var ptp=document.getElementById('pt_pid'); var keept=ptp.value; ptp.innerHTML=opts; if(keept) ptp.value=keept; loadTerms();
  var crp=document.getElementById('cr_pid'); var keepc=crp.value; crp.innerHTML=opts; if(keepc) crp.value=keepc; loadContractRef();
  var rl=document.getElementById('rules_pid'); var keepl=rl.value; rl.innerHTML=opts; if(keepl) rl.value=keepl; loadRules();
  loadBranding(); loadTemplates(); loadAuthorities();
  document.getElementById('list').innerHTML=(d.companies||[]).length? (d.companies||[]).map(function(c){
    var ps=byCo[c.id]||[];
    var dl=listOf(c.email_domains);
    return '<div style="margin-bottom:14px"><b>'+esc(c.name)+'</b>'+
      '<div class="hint" style="margin:2px 0 0">'+(dl.length?'Email: @'+esc(dl.join(', @')):'Email: not locked')+'</div>'+
      (ps.length?'<table style="margin-top:6px"><tr><th>Project</th><th>Ref</th><th>State</th></tr>'+
      ps.map(function(p){return '<tr><td>'+esc(p.name)+'<div class="hint" style="margin-top:2px">'+esc(modSummary(PMODS[p.id]))+'</div></td><td class="hint">'+esc(p.ref||'')+'</td><td><span class="pill">'+esc(p.setup_state||'live')+'</span></td></tr>';}).join('')+'</table>':'<div class="hint">No projects yet.</div>')+'</div>';
  }).join(''):'<div class="hint">No companies yet — create your first project on the left.</div>';
}

// ---- drawing numbering: the gate's only strong signal ----
var RULES=[];
function paintRules(){
  document.getElementById('rules_rows').innerHTML = RULES.length? RULES.map(function(r,i){
    return '<tr><td><b>'+esc(r.match)+'</b></td><td>'+esc(r.discipline||'Unsorted')+'</td>'+
      '<td>'+esc(r.trade_group||'')+'</td>'+
      '<td><a href="#" data-i="'+i+'" class="rule_del" style="color:var(--critical)">remove</a></td></tr>';
  }).join('') : '<tr><td colspan="4" class="hint">No numbering set &mdash; the gate is off for this project.</td></tr>';
  [].forEach.call(document.querySelectorAll('.rule_del'),function(a){
    a.addEventListener('click',function(e){ e.preventDefault(); RULES.splice(Number(this.dataset.i),1); paintRules(); });
  });
}
async function loadRules(){
  var pid=val('rules_pid'); if(!pid){ RULES=[]; paintRules(); return; }
  try{
    var r=await fetch('/api/setup/rules?project='+encodeURIComponent(pid),{cache:'no-store'});
    var d=await r.json();
    RULES=d.rules||[];
    document.getElementById('rules_state').innerHTML = d.configured
      ? '<span style="color:var(--good-text)">Gate is on &mdash; '+RULES.length+' prefix'+(RULES.length===1?'':'es')+'.</span>'
      : '<span style="color:var(--critical)">Gate is off for this project.</span>';
    paintRules();
  }catch(e){}
}
document.getElementById('rules_pid').addEventListener('change',loadRules);
document.getElementById('rule_add').addEventListener('click',function(){
  var m=val('rule_match').toUpperCase(); if(!m){ msg('Give a prefix, e.g. ST.',false); return; }
  if(RULES.some(function(r){return r.match===m;})){ msg('That prefix is already there.',false); return; }
  RULES.push({ match:m, on:'number', discipline: val('rule_disc')||'Unsorted', trade_group:'' });
  document.getElementById('rule_match').value=''; document.getElementById('rule_disc').value='';
  paintRules();
});
document.getElementById('rules_save').addEventListener('click',async function(){
  var pid=val('rules_pid'); if(!pid){ msg('Pick a project.',false); return; }
  if(!RULES.length){ msg('Add at least one prefix, or the gate stays off.',false); return; }
  this.disabled=true;
  try{
    var r=await fetch('/api/setup/rules?project='+encodeURIComponent(pid),{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({rules:RULES})});
    var d=await r.json();
    if(d.ok){ msg('Numbering saved. The gate is now on for this project.',true); loadRules(); }
    else msg(d.error||'Could not save.',false);
  }catch(e){ msg('Could not reach the server.',false); }
  this.disabled=false;
});

// ---- programme (.xer): read → review → commit ----
var XER_B64=null;
var DISCIPLINES=['Civil','MEP','Architecture','Structural','Finishes','Infrastructure','Facade','Landscape'];
function toB64(buf){ var u8=new Uint8Array(buf), s='', CH=0x8000;
  for(var i=0;i<u8.length;i+=CH){ s+=String.fromCharCode.apply(null,u8.subarray(i,i+CH)); }
  return btoa(s); }
document.getElementById('xer_file').addEventListener('change',function(){
  var f=this.files&&this.files[0]; var go=document.getElementById('xer_read');
  XER_B64=null; go.disabled=true; document.getElementById('xer_review').innerHTML='';
  if(!f) return;
  var rd=new FileReader();
  rd.onload=function(e){ XER_B64=toB64(e.target.result); go.disabled=false;
    document.getElementById('xer_hint').textContent=f.name+' — '+Math.round(f.size/1024)+' KB ready to read.'; };
  rd.readAsArrayBuffer(f);
});
document.getElementById('xer_read').addEventListener('click',async function(){
  var pid=document.getElementById('xer_pid').value;
  if(!pid||!XER_B64){ msg('Pick a project and a .xer file.',false); return; }
  this.disabled=true; this.textContent='Reading…';
  try{
    var r=await fetch('/api/setup/xer/preview',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({project_id:pid,file_b64:XER_B64})});
    var d=await r.json();
    if(!d.ok){ msg(d.error||'Could not read that .xer.',false); }
    else paintXerReview(d);
  }catch(e){ msg('Could not reach the server.',false); }
  this.disabled=false; this.textContent='Read the programme';
});
function paintXerReview(d){
  var c=d.counts||{};
  var html='<div class="hint" style="margin-bottom:10px"><b>'+d.total+' activities</b> · data date '+esc(d.data_date)+
    ' · site work '+(c.site||0)+' · drawing submissions '+(c.drawing||0)+
    ' · material approvals '+(c.material||0)+' · procurement '+(c.procurement||0)+'</div>';
  html+='<div class="hint" style="margin-bottom:10px">Assign each WBS branch to a discipline — this is what decides which site engineer sees which activities.</div>';
  html+='<table><tr><th>WBS branch</th><th>Activities</th><th>Discipline</th></tr>'+
    (d.branches||[]).map(function(b,i){
      return '<tr><td><b>'+esc(b.branch)+'</b></td><td>'+b.activities+'</td>'+
        '<td><select class="xbr" data-branch="'+esc(b.branch)+'"><option value="">— unassigned —</option>'+
        DISCIPLINES.map(function(x){ return '<option'+(x.toLowerCase()===String(b.branch).toLowerCase()?' selected':'')+'>'+x+'</option>'; }).join('')+
        '</select></td></tr>';
    }).join('')+'</table>';
  if(d.will_derive){
    var bd=d.derive_breakdown||{};
    html+='<div class="msg err" style="display:block;margin-top:12px">'+
      '<b>'+d.will_derive+' dates will be derived</b>, because the programme has no activity for them — '+
      Object.keys(bd).map(function(k){return bd[k]+' '+k;}).join(' · ')+
      '. Derived dates are calculated backwards from when the work starts and are <b>assumptions until your planner accepts them</b>. They will be labelled "derived" everywhere they appear.</div>';
  } else {
    html+='<div class="msg ok" style="display:block;margin-top:12px">Every deliverable came from the programme itself — nothing had to be derived.</div>';
  }
  html+='<div class="hint" style="margin-top:12px"><b>Lead times used for derived dates (days):</b> '+
    'shop drawing '+d.leads.drawing_submit+' before · review '+d.leads.drawing_review+
    ' · material submittal '+d.leads.material_submit+' · approval '+d.leads.material_approval+
    ' · delivery '+d.leads.delivery_before+' before the work.</div>';
  html+='<div style="margin-top:14px"><button class="btn prim" id="xer_commit">Load this programme into the project</button></div>';
  document.getElementById('xer_review').innerHTML=html;
  document.getElementById('xer_commit').addEventListener('click',commitXer);
}
async function commitXer(){
  var pid=document.getElementById('xer_pid').value; if(!pid||!XER_B64) return;
  var map={};
  document.querySelectorAll('.xbr').forEach(function(s){ if(s.value) map[s.dataset.branch]=s.value; });
  var unmapped=document.querySelectorAll('.xbr').length-Object.keys(map).length;
  if(unmapped>0 && !confirm(unmapped+' WBS branch(es) have no discipline. Their activities will not appear on any site engineer\\'s screen. Continue?')) return;
  this.disabled=true; this.textContent='Loading…';
  try{
    var r=await fetch('/api/setup/xer/commit',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({project_id:pid,file_b64:XER_B64,discipline_by_branch:map,replace:true})});
    var d=await r.json();
    if(d.ok){ msg('Programme loaded: '+d.saved+' lines ('+d.from_programme+' from the programme, '+d.derived+' derived).',true);
      document.getElementById('xer_review').innerHTML=''; document.getElementById('xer_file').value=''; XER_B64=null; }
    else { msg(d.error||'Could not load the programme.',false); }
  }catch(e){ msg('Could not reach the server.',false); }
  this.disabled=false; this.textContent='Load this programme into the project';
}

// ---- K1: BOQ and BOM go to the platform's own check (v5 E7, E8) ----
// The file itself is sent, not rows worked out in the browser: the platform
// reads every sheet and row, checks the totals, flags each line with no rate
// or a wrong sum, and keeps the file against its SHA-256. The flags are fixed
// or accepted on BOQ & BOM (/bills), and the PM approves the bill there.
function billFileB64(f){
  return new Promise(function(ok, no){
    var fr=new FileReader();
    fr.onload=function(){ var s=String(fr.result); ok(s.slice(s.indexOf(',')+1)); };
    fr.onerror=function(){ no(fr.error); };
    fr.readAsDataURL(f);
  });
}
function billCard(kind){
  var file=document.getElementById(kind+'_file'), go=document.getElementById(kind+'_go'), prev=document.getElementById(kind+'_prev');
  var link=document.getElementById(kind+'_check');
  file.addEventListener('change',function(){ go.disabled=!(this.files&&this.files[0]); if(link) link.hidden=true; });
  go.addEventListener('click',async function(){
    var pid=document.getElementById(kind+'_pid').value, f=file.files&&file.files[0];
    if(!pid||!f){ msg('Pick a project and a file first.',false); return; }
    var label=kind==='bom'?'Check BOM':'Check BOQ';
    this.disabled=true; this.textContent='Reading every sheet…';
    try{
      var r=await fetch('/api/bills/upload',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({project_id:pid,kind:kind,filename:f.name,data:await billFileB64(f)})});
      var d=await r.json();
      if(d.error){ msg(d.error,false); prev.textContent=d.error; }
      else{
        prev.innerHTML='Read <b>'+d.line_count+'</b> lines · total <b>'+d.total+'</b> · '
          +(d.flags_open?'<b>'+d.flags_open+'</b> flagged line(s) to fix or accept':'nothing flagged')
          +'. Nothing is imported until the check is finished on BOQ &amp; BOM.';
        if(link){ link.hidden=false; link.href='/bills?project='+encodeURIComponent(pid); }
        file.value='';
      }
    }catch(e){ msg('Could not reach the server.',false); }
    this.disabled=!(file.files&&file.files[0]); this.textContent=label;
  });
}
billCard('boq');
billCard('bom');

// ---- branding: shrink in the browser, preview, save ----
var BRAND={};
var LOGO_KEYS=['logo_client','logo_consultant','logo_consultant2','logo_contractor'];
function shrink(file,cb){
  var rd=new FileReader();
  rd.onload=function(e){
    var img=new Image();
    img.onload=function(){
      var max=320; var w=img.width, h=img.height;
      if(w>max){ h=Math.round(h*max/w); w=max; }
      if(h>120){ w=Math.round(w*120/h); h=120; }
      var c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      try{ cb(c.toDataURL('image/png')); }catch(err){ cb(null); }
    };
    img.onerror=function(){ cb(null); };
    img.src=e.target.result;
  };
  rd.readAsDataURL(file);
}
function paint(k){
  var box=document.getElementById('pv_'+k); if(!box) return;
  box.innerHTML = BRAND[k] ? '<img src="'+BRAND[k]+'" alt="">' : '<span>none</span>';
}
document.querySelectorAll('.brf').forEach(function(inp){
  inp.addEventListener('change',function(){
    var k=this.dataset.k; var f=this.files&&this.files[0]; if(!f) return;
    shrink(f,function(dataUrl){
      if(!dataUrl){ msg('Could not read that image.',false); return; }
      BRAND[k]=dataUrl; paint(k);
    });
  });
});
async function loadBranding(){
  var pid=document.getElementById('br_pid').value; if(!pid) return;
  try{
    var r=await fetch('/api/setup/branding?project='+encodeURIComponent(pid),{cache:'no-store'});
    var d=await r.json(); BRAND=d.branding||{};
    LOGO_KEYS.forEach(paint);
  }catch(e){}
}
document.getElementById('br_pid').addEventListener('change',loadBranding);
document.getElementById('br_go').addEventListener('click',async function(){
  var pid=document.getElementById('br_pid').value; if(!pid){ msg('Pick a project first.',false); return; }
  var body={project_id:pid};
  LOGO_KEYS.forEach(function(k){ if(k in BRAND) body[k]=BRAND[k]; });
  if(Object.keys(body).length===1){ msg('Choose at least one logo.',false); return; }
  this.disabled=true; this.textContent='Saving…';
  try{
    var r=await fetch('/api/setup/branding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var d=await r.json();
    msg(d.ok?('Branding saved for this project.'):(d.error||'Could not save.'), !!d.ok);
  }catch(e){ msg('Could not reach the server.',false); }
  this.disabled=false; this.textContent='Save branding';
});
document.getElementById('br_clear').addEventListener('click',async function(){
  var pid=document.getElementById('br_pid').value; if(!pid) return;
  var body={project_id:pid}; LOGO_KEYS.forEach(function(k){ body[k]=null; BRAND[k]=null; });
  await fetch('/api/setup/branding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  LOGO_KEYS.forEach(paint); msg('Logos cleared for this project.',true);
});

// ---- consultant templates ----
var TPL_FILE=null;
function b64(buf){ var u8=new Uint8Array(buf), s=''; for(var i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]); return btoa(s); }
document.getElementById('tpl_file').addEventListener('change',function(){
  var f=this.files&&this.files[0]; var go=document.getElementById('tpl_go');
  TPL_FILE=null; go.disabled=true; if(!f) return;
  if(!/\.(docx|xlsx)$/i.test(f.name)){ msg('Please upload a Word .docx or Excel .xlsx form.',false); return; }
  var rd=new FileReader();
  rd.onload=function(e){ TPL_FILE={name:f.name, b64:b64(e.target.result)}; go.disabled=false; };
  rd.readAsArrayBuffer(f);
});
async function loadTemplates(){
  var pid=document.getElementById('tpl_pid').value;
  try{
    var r=await fetch('/api/setup/templates'+(pid?'?project='+encodeURIComponent(pid):''),{cache:'no-store'});
    var d=await r.json();
    var ts=document.getElementById('tpl_type');
    if(!ts.options.length){
      ts.innerHTML=Object.keys(d.doc_types||{}).map(function(k){return '<option value="'+esc(k)+'">'+esc(d.doc_types[k])+'</option>';}).join('');
    }
    document.getElementById('tpl_std').innerHTML=(d.standard_tokens||[]).map(function(t){return '<code>{{'+t+'}}</code>';}).join(' ');
    var list=d.templates||[];
    document.getElementById('tpl_list').innerHTML=list.length
      ? '<table><tr><th>Document</th><th>File</th><th>Placeholders found</th><th></th></tr>'+list.map(function(t){
          return '<tr><td><b>'+esc((d.doc_types||{})[t.doc_type]||t.doc_type)+'</b></td>'+
            '<td class="hint">'+esc(t.filename||'')+' <b>'+(t.format==='xlsx'?'Excel':'Word')+'</b></td>'+
            '<td class="hint">'+(t.tokens.length?t.tokens.map(function(x){return '<code>{{'+esc(x)+'}}</code>';}).join(' '):'<b>none — nothing will be filled in</b>')+
              (function(){ var u=[]; try{ u=JSON.parse(t.unknown_tokens||'[]')||[]; }catch(e){} return u.length?'<div style="color:var(--warn-ink)">Prints blank: '+u.map(function(x){return '<b>'+esc(x.token)+'</b>';}).join(', ')+'</div>':''; })()+'</td>'+
            '<td style="white-space:nowrap">'+(t.format==='xlsx'||t.fields?'<button class="btn" data-signs="'+esc(t.doc_type)+'">Signature boxes'+
              ((t.sign_map&&t.sign_map.steps&&Object.keys(t.sign_map.steps).length)?' ('+Object.keys(t.sign_map.steps).length+')':'')+'</button> ':'')+
            '<button class="btn" data-del="'+esc(t.doc_type)+'">Remove</button></td></tr>';
        }).join('')+'</table>'
      : '<div class="hint">No templates uploaded for this project yet.</div>';
    document.querySelectorAll('#tpl_list [data-signs]').forEach(function(b){
      b.addEventListener('click',function(){ openSignBoxes(pid, b.dataset.signs, (d.doc_types||{})[b.dataset.signs]||b.dataset.signs); });
    });
    document.querySelectorAll('#tpl_list [data-del]').forEach(function(b){
      b.addEventListener('click',async function(){
        await fetch('/api/setup/template',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({project_id:pid,doc_type:b.dataset.del,remove:true})});
        msg('Template removed.',true); loadTemplates();
      });
    });
  }catch(e){}
}
document.getElementById('tpl_pid').addEventListener('change',loadTemplates);
document.getElementById('tpl_go').addEventListener('click',async function(){
  var pid=document.getElementById('tpl_pid').value, type=document.getElementById('tpl_type').value;
  if(!pid||!type||!TPL_FILE){ msg('Pick a project, a document type and a .docx or .xlsx form.',false); return; }
  this.disabled=true; this.textContent='Uploading…';
  try{
    var r=await fetch('/api/setup/template',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({project_id:pid,doc_type:type,filename:TPL_FILE.name,file_b64:TPL_FILE.b64})});
    var d=await r.json();
    if(d.ok){
      var fmt=d.format==='xlsx'?'Excel form':'Word form';
      msg(d.warning ? ('Saved as the '+fmt+', but '+d.warning)
        : ('Saved as the '+fmt+'. Placeholders found: '+(d.tokens||[]).join(', ')), !d.warning);
      TPL_FILE=null; document.getElementById('tpl_file').value=''; loadTemplates();
    } else { msg(d.error||'Upload failed.',false); }
  }catch(e){ msg('Could not reach the server.',false); }
  this.disabled=false; this.textContent='Upload template';
});

${SIGNBOX_JS}
window.onSignBoxesSaved=function(label){ msg('Signature boxes saved for '+label+'.',true); loadTemplates(); };

// ---- authorities ----
var AU_LIB=null;
function paintAuthorityList(){
  var em=document.getElementById('au_em').value;
  var list=(AU_LIB&&AU_LIB[em])||[];
  document.getElementById('au_list').innerHTML=list.length
    ? '<table><tr><th style="width:34px"></th><th>Authority</th><th>Scope</th><th style="width:130px">Action by</th></tr>'+
      list.map(function(a,i){
        return '<tr><td><input type="checkbox" class="auck" data-i="'+i+'"></td>'+
          '<td><b>'+esc(a.name)+'</b><div class="hint">'+esc(a.code)+'</div></td>'+
          '<td class="hint">'+esc(a.scope)+'</td>'+
          '<td><input type="date" class="audue" data-i="'+i+'"></td></tr>';
      }).join('')+'</table>'
    : '<div class="hint">No list for that selection.</div>';
}
async function loadAuthorities(){
  var pid=document.getElementById('au_pid').value;
  try{
    var r=await fetch('/api/setup/authorities'+(pid?'?project='+encodeURIComponent(pid):''),{cache:'no-store'});
    var d=await r.json();
    AU_LIB=d.library||{};
    var sel=document.getElementById('au_em');
    if(!sel.options.length){
      sel.innerHTML=Object.keys(AU_LIB).map(function(k){return '<option>'+esc(k)+'</option>';}).join('');
    }
    if(d.suggested && sel.value!==d.suggested) sel.value=d.suggested;
    paintAuthorityList();
    var have=d.existing||[];
    document.getElementById('au_have').innerHTML=have.length
      ? '<div class="hint" style="margin-bottom:6px"><b>Already on this project</b></div><table><tr><th>Ref</th><th>Authority</th><th>Status</th></tr>'+
        have.map(function(h){return '<tr><td class="hint">'+esc(h.ref)+'</td><td>'+esc(h.name)+'</td><td class="hint">'+esc(h.status||'')+'</td></tr>';}).join('')+'</table>'
      : '<div class="hint">None added to this project yet.</div>';
  }catch(e){}
}
document.getElementById('au_pid').addEventListener('change',loadAuthorities);
document.getElementById('au_em').addEventListener('change',paintAuthorityList);
document.getElementById('au_go').addEventListener('click',async function(){
  var pid=document.getElementById('au_pid').value; if(!pid){ msg('Pick a project first.',false); return; }
  var em=document.getElementById('au_em').value; var lib=(AU_LIB&&AU_LIB[em])||[];
  var chosen=[];
  document.querySelectorAll('.auck').forEach(function(ck){
    if(!ck.checked) return;
    var i=Number(ck.dataset.i); var a=lib[i]; if(!a) return;
    var due=document.querySelector('.audue[data-i="'+i+'"]');
    chosen.push({code:a.code,name:a.name,scope:a.scope,due:due?due.value:''});
  });
  var cn=document.getElementById('au_cname').value.trim();
  if(cn) chosen.push({code:'CUSTOM',name:cn,scope:document.getElementById('au_cscope').value.trim()});
  if(!chosen.length){ msg('Tick at least one authority, or type your own.',false); return; }
  this.disabled=true; this.textContent='Adding…';
  try{
    var r=await fetch('/api/setup/authorities',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({project_id:pid,authorities:chosen})});
    var d=await r.json();
    if(d.ok){ msg('Added '+d.added.length+' authorit'+(d.added.length===1?'y':'ies')+' to the project.',true);
      document.getElementById('au_cname').value=''; document.getElementById('au_cscope').value='';
      loadAuthorities(); }
    else { msg(d.error||'Could not add.',false); }
  }catch(e){ msg('Could not reach the server.',false); }
  this.disabled=false; this.textContent='Add to project';
});

document.getElementById('themeBtn').addEventListener('click',function(){var cur=document.documentElement.getAttribute('data-theme');var next=cur==='dark'?'light':cur==='light'?'':'dark';if(next)document.documentElement.setAttribute('data-theme',next);else document.documentElement.removeAttribute('data-theme');try{localStorage.setItem('sm-theme',JSON.stringify(next));}catch(e){}});
try{var sv=localStorage.getItem('sm-theme');if(sv)document.documentElement.setAttribute('data-theme',JSON.parse(sv));}catch(e){}
/* ================================================ this project, and only it */

var SCOPED = new URLSearchParams(location.search).get('p') || '';
var DV = null, DV_ROLE = null;

function scopeToProject(){
  if (!SCOPED) return;
  // What belongs to the platform, not to this project: the list of every
  // company and project, and the company-wide email domains.
  // What has moved to its own step: modules (Modules tab); the programme, the
  // priced BOQ and the templates (Documents, dropped straight on the section).
  ['list', 'dom_co', 'mod_pid', 'xer_pid', 'boq_pid', 'tpl_pid'].forEach(function(id){
    var e = document.getElementById(id);
    var c = e && e.closest('.card');
    if (c) c.style.display = 'none';
  });
  var cols = document.querySelector('.cols');
  if (cols && !cols.querySelector('.card:not([style*="none"])')) cols.style.display = 'none';
  document.getElementById('dashv').style.display = '';
  document.getElementById('settingsH').style.display = '';
  document.getElementById('repCard').style.display = '';
  loadReports();
  document.title = 'Setup · AETRAA';
  loadPositions();
}

async function loadPositions(){
  try {
    var r = await fetch('/api/org-roles?project=' + encodeURIComponent(SCOPED), { cache: 'no-store' });
    var d = await r.json();
    if (!r.ok) { document.getElementById('dvList').innerHTML = '<div class="hint">' + esc(d.error || 'Could not read the positions.') + '</div>'; return; }
    DV = d;
    paintPositions();
    // Open on somebody who will actually use it: the first position anybody
    // holds, and the Principal if nobody holds anything yet.
    var roles = (d.roles || []).filter(function(x){ return !x.retired; });
    var held = roles.filter(function(x){ return ((d.holders || {})[x.id] || []).length; })[0];
    var want = new URLSearchParams(location.search).get('as');
    showPosition(want && roles.some(function(x){ return x.id === want; }) ? want
                 : held ? held.id : (roles[0] || {}).id);
  } catch (e) { document.getElementById('dvList').innerHTML = '<div class="hint">Could not reach the server.</div>'; }
}

function paintPositions(){
  var roles = (DV.roles || []).filter(function(x){ return !x.retired; });
  var out = '';
  (DV.groups || []).forEach(function(g){
    var inG = roles.filter(function(x){ return x.grp === g; });
    if (!inG.length) return;
    out += '<div class="g">' + esc(g) + '</div>';
    inG.forEach(function(x){
      var h = (DV.holders || {})[x.id] || [];
      out += '<button data-as="' + esc(x.id) + '" class="' + (x.id === DV_ROLE ? 'on' : '') + (x.signatory ? ' sign' : '') + '">'
        + '<span class="l">' + esc(x.label) + '</span>'
        + '<span class="h' + (h.length ? '' : ' none') + '">' + (h.length ? esc(h.length === 1 ? h[0] : h.length + ' people') : 'nobody yet') + '</span>'
        + '</button>';
    });
  });
  document.getElementById('dvList').innerHTML = out || '<div class="hint">No positions on this project yet.</div>';
}

function showPosition(id){
  if (!id || !DV) return;
  DV_ROLE = id;
  var x = (DV.roles || []).filter(function(r){ return r.id === id; })[0];
  if (!x) return;
  var h = (DV.holders || {})[id] || [];
  var labels = {};
  (DV.dashboards || []).forEach(function(d){ labels[d.id] = d.label; });
  var dash = x.dash || [];
  var full = dash.filter(function(d){ return d[1] !== 'read'; }).length;

  document.getElementById('dvName').textContent = x.label;
  document.getElementById('dvWho').textContent = (h.length ? 'Held by ' + h.join(', ') : 'Nobody holds this position yet')
    + ' \u00b7 opens ' + dash.length + ' dashboard' + (dash.length === 1 ? '' : 's')
    + (dash.length ? ' (' + full + ' can act, ' + (dash.length - full) + ' read only)' : '');
  document.getElementById('dvDash').innerHTML = dash.map(function(d){
    return '<span class="' + (d[1] === 'read' ? '' : 'full') + '">' + esc(labels[d[0]] || d[0])
      + '<i>' + (d[1] === 'read' ? 'read only' : 'can act') + '</i></span>';
  }).join('') || '<span>Opens nothing yet \u2014 give it dashboards on Organisation</span>';

  var src = '/preview?p=' + encodeURIComponent(SCOPED) + '&as=' + encodeURIComponent(id);
  var f = document.getElementById('dvFrame');
  if (f.getAttribute('src') !== src) f.setAttribute('src', src);
  document.getElementById('dvFull').setAttribute('href', src);
  document.getElementById('dvEdit').setAttribute('href',
    '/org?p=' + encodeURIComponent(SCOPED) + '&r=' + encodeURIComponent(id));
  history.replaceState(null, '', '/setup?p=' + encodeURIComponent(SCOPED) + '&as=' + encodeURIComponent(id));
  paintPositions();
}

/* ---- reports & distribution, and whether the programme is current */

function daysWord(n){ return n === 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago'; }

async function loadReports(){
  try {
    var r = await fetch('/api/setup/reports?project=' + encodeURIComponent(SCOPED), { cache: 'no-store' });
    var d = await r.json();
    if (!r.ok) { document.getElementById('repOut').textContent = d.error || 'Could not read the report settings.'; return; }
    document.getElementById('repTo').value = (d.recipients || []).join(', ');
    document.getElementById('repDaily').checked = !!d.daily;
    document.getElementById('repWeekly').checked = !!d.weekly;
    document.getElementById('repMonthly').checked = !!d.monthly;
    document.getElementById('repDigest').checked = !!d.digest;
    var sc = d.schedule || {};
    document.getElementById('repDailyAt').textContent = 'every evening at ' + (sc.daily || '18:00') + ' UAE';
    document.getElementById('repWeeklyAt').textContent = 'every ' + (sc.weekly || 'Monday 07:00') + ' UAE';
    document.getElementById('repMonthlyAt').textContent = (sc.monthly || '1st of the month 08:00') + ' UAE \u2014 the month just closed';
    document.getElementById('repDigestAt').textContent = 'at ' + (sc.digest || '06:00') + ', to each person, what needs them today';

    // WHETHER ANYTHING CAN ACTUALLY BE SENT. "Switched on" means nothing if the
    // server has no sender.
    var m = d.email || {};
    var mail = document.getElementById('repMail');
    mail.innerHTML = m.ready
      ? 'Sent by <b>' + esc(m.label) + '</b>. Send a test after saving to see one arrive.'
      : '<span style="color:var(--critical)"><b>Nothing will be sent yet.</b> ' + esc(m.why || '') + '</span>';
    document.getElementById('repTest').disabled = !m.ready;

    // IS THE PROGRAMME CURRENT? Every forecast date in every report is read
    // from it, so a skipped weekly update is every date quietly drifting.
    var pg = d.programme || {};
    var box = document.getElementById('repProg');
    if (!pg.activities) {
      box.innerHTML = '<b>No programme loaded yet.</b> Reports will carry no forecast until one is \u2014 '
        + 'drop the baseline .xer on the Programme section in Documents.';
    } else if (pg.no_logic) {
      // A DIFFERENT FAULT FROM BEING OVERDUE, and saying "out of date" about it
      // would send somebody to re-run an update that cannot fix it.
      box.innerHTML = '<span style="color:var(--critical)"><b>The programme has no logic.</b></span> '
        + pg.activities + ' activities are loaded, but no predecessors or successors came with them \u2014 '
        + 'so there is no critical path, and every forecast is a straight read of the planned dates. '
        + 'This happens when a .xer is filed as a document instead of being read as a programme. '
        + 'Drop the .xer again on the <b>Programme</b> section in Documents and it will load properly.';
      box.style.borderColor = 'var(--critical)';
    } else {
      var when = pg.data_date ? 'Data date <b>' + esc(pg.data_date) + '</b>' + (pg.days_old != null ? ' (' + daysWord(pg.days_old) + ')' : '')
                              : 'No data date recorded';
      var last = pg.last ? ' \u00b7 last uploaded by ' + esc(pg.last.who || 'somebody') + ' on ' + esc(String(pg.last.at).slice(0, 10)) : '';
      box.innerHTML = (pg.stale
          ? '<span style="color:var(--critical)"><b>The programme is out of date.</b></span> '
          : '<b>The programme is current.</b> ')
        + when + ', ' + pg.activities + ' activities' + last + '.'
        + (pg.stale ? ' The weekly update has been missed: the Planning Engineer downloads the progress for P6 on '
          + 'the Programme screen, updates P6, and uploads the new .xer there.' : '');
      box.style.borderColor = pg.stale ? 'var(--critical)' : '';
    }
  } catch (e) { document.getElementById('repOut').textContent = 'Could not reach the server.'; }
}

document.getElementById('repSave').addEventListener('click', async function(){
  var out = document.getElementById('repOut');
  this.disabled = true; out.textContent = '';
  try {
    var r = await fetch('/api/setup/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: SCOPED, recipients: document.getElementById('repTo').value,
        daily: document.getElementById('repDaily').checked, weekly: document.getElementById('repWeekly').checked,
        monthly: document.getElementById('repMonthly').checked, digest: document.getElementById('repDigest').checked }) });
    var d = await r.json();
    if (!r.ok || d.error) { out.style.color = 'var(--critical)'; out.textContent = d.error || 'Not saved.'; }
    else { out.style.color = ''; out.textContent = 'Saved \u2014 ' + (d.recipients || []).length + ' recipient'
             + ((d.recipients || []).length === 1 ? '' : 's') + '.'; await loadReports(); }
  } catch (e) { out.textContent = 'Could not reach the server.'; }
  this.disabled = false;
});

document.getElementById('repTest').addEventListener('click', async function(){
  var out = document.getElementById('repOut');
  this.disabled = true; out.style.color = ''; out.textContent = 'Sending\u2026';
  try {
    var r = await fetch('/api/setup/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: SCOPED, action: 'test', kind: 'daily' }) });
    var d = await r.json();
    if (!r.ok || !d.ok) { out.style.color = 'var(--critical)'; out.textContent = d.error || 'It did not send.'; }
    else out.textContent = 'Sent to ' + d.sent + ' recipient' + (d.sent === 1 ? '' : 's') + '. Check the inbox.';
  } catch (e) { out.textContent = 'Could not reach the server.'; }
  this.disabled = false;
});

document.getElementById('dvList').addEventListener('click', function(e){
  var b = e.target && e.target.closest && e.target.closest('[data-as]');
  if (b) showPosition(b.getAttribute('data-as'));
});

scopeToProject();
loadModules().then(loadList);
${PWA_BOOT}
</script>
${pid ? ADMIN_JS('setup') : ''}
</body>
</html>`;
