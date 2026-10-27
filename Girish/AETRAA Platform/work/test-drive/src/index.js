// AETRAA platform - request router
// Routes, auth and JSON API. The pages live in ./html/*.js
//
// Multi-project: every row of programme data carries a project_id. Who you are and
// which project you are in are decided together, at sign-in:
//   - the owner code is a Worker secret and opens every project (and the portfolio)
//   - every other code lives hashed in the projects table and opens exactly one

import { dashboardHTML } from './html/dashboard.js';
import { siteHTML } from './html/site.js';
import { loginHTML } from './html/login.js';
import { signupHTML, forgotHTML, accountHTML, welcomeHTML } from './html/auth.js';
import { myfilesHTML } from './html/myfiles.js';
import { integrationsHTML } from './html/integrations.js';
import { handleApiV1, createApiKey, listApiKeys, revokeApiKey, listInbox, getItem, setItemStatus,
  callConnector, connectorStatus } from './integrations.js';
import { listFolder, findFiles, readOwnFile, serveAs, addFile as addMyFile, renameFile as renameMyFile,
  moveFile as moveMyFile, removeFile as removeMyFile, makeFolder as makeMyFolder, removeFolder as removeMyFolder,
  usage as myUsage, maxFileBytes as myMaxBytes } from './myfiles.js';
import { signUp, passwordLogin, setPassword, hasPassword, isSelfServe, overLimit, clearHits,
  clientIp, LIMITS, ensureAccountTables, purgeThrottle } from './accounts.js';
import { adminHTML } from './html/admin.js';
import { portfolioHTML } from './html/portfolio.js';
import { principalHTML } from './html/principal.js';
import { pmHTML } from './html/pm.js';
import { appHTML } from './html/app.js';
import { legacyRole } from './functions.js';
import { FUNCTIONS, userFunctions, mayCreateRecord, mayApproveRecord, whoMayRaise, whoMayApprove, RECORD_CREATORS, RECORD_APPROVERS, ALLDASH, DASH_LABEL, DASH_WARN,
  STREAMS, STREAM_GROUPS, userStreams, onStream, cleanStreams } from './functions.js';
import { ensureRecordsTable, listRecords, getRecord, createRecord, advanceRecord, pendingStep, approverFunctions, RECORD_TYPES, RESPONSE_DEFAULTS, responseDays , closeIncomingByReply,
  importRecords, takeOverRecord, IMPORTED_REFUSAL } from './records.js';
import { REGISTERS, typesFor, registerWorkbook, scheduleWorkbook, drawingsWorkbook, boqWorkbook, correspondenceWorkbook, rfiWorkbook } from './register-xlsx.js';
// K10: the correspondence register (v5 A2).
import { readLetter, getLetterRead, markLogged, provenanceOf, correspondenceRegister, checkOutgoing, letterPdf, ensureLetterReads, actionLabels, LETTER_TYPES } from './correspondence.js';
import { correspondenceHTML } from './html/correspondence.js';
// K12: the material submittal package (v5 A7).
import { createPackage, getPackage, draftSections, editPackage, addCertificate, completePackage, packageRevs, packagePdf, materialLog, settleMaterialLadder,
  materialSteps, ensurePackageTables, checkSections, SECTIONS as PKG_SECTIONS, DEFAULT_FORM_FIELDS } from './material-package.js';
import { materialHTML } from './html/material.js';
// K13 (A10): RFI preparation.
import { draftRfi, rfiDuplicates, rfiLog, DEFAULT_RFI_FIELDS } from './rfi-prep.js';
import { rfiHTML } from './html/rfi.js';
import { pdfPage as onePdfPage } from './sheet-reader.js';
import { configured as gateConfigured, rulesOf, widenedRules, ensureGateColumns } from './gate.js';
import { listHeld, getHeld, decide, groupByReason, markFiled, heldByTenant, ensureQuarantineTable, hold } from './quarantine.js';
import { cleanRules, DEFAULT_RULES } from './drawing-classify.js';
import { CLASSES, addDocument, listLibrary, documentFile, librarySummary, ensureLibraryTable } from './library.js';
import { onboardProject, createProjectForCompany, setBranding, setCompanyLogo, LOGO_FIELDS } from './setup.js';
import { analyseUpdate, commitUpdate } from './programme-update.js';
import { extract as extractLogic, applyLogic } from './xer-logic.js';
import { p6ProgressWorkbook } from './p6-export.js';
import { programmeHTML } from './html/programme.js';
import { diaryChecks, diaryContext, diaryStatus, todaysProgress } from './diary-checks.js';
import { notifyTeam, myNotifications, markRead, projectTeam, mayNotify } from './notify.js';
import { MODULES, catalogue, getProjectModules, setProjectModules, moduleForPath, recordTypeOn, dashboardsOff, setupStepsOn, ensureModulesColumn, modulesOf, DEFAULT_ON } from './modules.js';
import { setupHTML } from './html/setup.js';
import { ensureBoqTable, listBOQ, setBilled } from './commercial.js';
import { ensureBomTable, listBOM, checkOrder, recordOrder, recordGRN, listMoves } from './bom.js';
import { stageBill, restageBill, acceptFlags, discardBill, commitBill, getImport, billState, approveBill, billIsPending,
  bomMatching, resolveBom, boqChoices, BOM_PENDING, KIND_LABEL, MAX_BILL_BYTES } from './bills.js';
import { billsHTML } from './html/bills.js';
import { toAED, SQL_SUM_FILS } from './money.js';
import { ensurePhotoColumns, storePhoto, photoBytes } from './photos.js';
import { capacity, planMove, runMove } from './file-move.js';
import { onNewHolds, runAdminAlerts, tellUploaders, runCertAlerts, runBatchAlerts } from './alerts.js';
// K11: delivery notes and certificates with the diary (v5 A5).
import { readDiaryDoc, getDiaryDoc, listDiaryDocs, decideDoc, settleDelivery, settleCert, applyDelivery, certExpiries, ensureDiaryDocs, CERT_TYPES } from './diary-docs.js';
import { ensurePastTables, readLog, remapLog, confirmLog, getLog, listLogs, LOG_TYPES, LOG_FIELDS, STATUS_CHOICES } from './past-registers.js';
import { S0_TYPES, CODES, isS0, ensureS0, afterAdvance, returnToDesign, resubmit, issueRecord, recordReply, listComments, openComments,
  answerComment, issueList, setIssueList, readReturnedSheet, keepReplyRead, confirmReplyRead, MAX_ISSUE_BYTES } from './s0.js';
import { s0HTML } from './html/s0.js';
import { readWordSheet, extractWordFields } from './template-word.js';
import { readSheet as readXlsxSheet } from './template-preview.js';
import { pastRegistersHTML } from './html/past-registers.js';
import { storageHTML } from './html/storage.js';
import { saveTemplate, listTemplates, getTemplateBytes, deleteTemplate, b64ToBytes, DOC_TYPES } from './templates-store.js';
import { fillTemplate, buildValues, STANDARD_TOKENS, FORMATS } from './template.js';
import { readSignMap, saveSignMap, extraFields, signaturesFor, drawTemplate, issueFile, saveFormTemplate, updateFields, readFields, inputFields, fieldValues, ensureFieldColumns } from './template-forms.js';
import { templatesHTML } from './html/templates.js';
import { PREVIEW_CSS } from './template-preview.js';
import { AUTHORITIES, emirateFor, seedAuthorities } from './authorities.js';
import { decodeXer, parseXER, buildProgramme, deriveDeliverables, saveProgramme, DEFAULT_LEADS } from './xer.js';
import { IPC_PACK, listIPC, getIPC, proposeValuation, checkIPC, createIPC, advanceIPC, mayIPC, paymentTerms, TERM_DEFAULTS, NEXT_ACTIONS } from './ipc.js';
import { buildIpcPack, ipcWorkbook, ipcDocumentWord } from './ipc-pack.js';
import { MEETING_TYPES, mayWriteMinutes, mayIssueMinutes, listMeetings, getMeeting, saveDraft, discardDraft, minutesChecks,
  issueMinutes, listActions, updateAction, SERIES as MEETING_SERIES, seriesOf,
  listContacts, rememberContacts, outsideRecipients, logSent, trackConsultantActions } from './meetings.js';
import { minutesWord, minutesHTML, actionsWorkbook, minutesValues } from './meetings-doc.js';
// K13 (A11): minutes from notes or a scan; the consultant's minutes read.
import { draftMinutes, readConsultantMinutes } from './minutes-ai.js';
import { minutesPageHTML } from './html/minutes.js';
import { attentionFor, attentionEmail } from './attention.js';
import { reportsHTML } from './html/reports.js';
import { ensureHseTable, saveHseLog, listHseLog, hseReport } from './hse.js';
import { aiEnabled, aiUsageSummary, callModel, AI_OFF_MESSAGE } from './ai.js';
import { reportNarrative } from './ai-tasks.js';
import { putFile, getFile, deleteFile, driverName, DRIVER_LABEL, bytesToB64, deleteProjectFiles } from './storage.js';
import {
  addAttachment, listAttachments, getAttachment, removeAttachment, attachmentCounts,
  MAX_ATTACHMENT, MAX_PER_RECORD,
} from './attachments.js';
import { issuesHTML, issueDocHTML } from './html/issues.js';
import { diaryHTML, diarySheetHTML } from './html/diary.js';
import { verifyHTML } from './html/verify.js';
import { termsHTML } from './html/terms.js';
import { intakeHistoryHTML } from './html/intake-history.js';
import { peopleHTML } from './html/people.js';
import { resourcesHTML } from './html/resources.js';
import { drawingsHTML } from './html/drawings.js';
import { scheduleHTML } from './html/schedule.js';
import { run as runCPM, impact as cpmImpact } from './cpm.js';
import { isoMinute, toDays, between, unpack as unpackCal, parseDate as parseCalDate } from './calendar.js';
import {
  KINDS as DWG_KINDS, KIND_LABEL as DWG_KIND_LABEL, MAX_BYTES as DWG_MAX,
  listDrawings, getDrawing, saveDrawing, removeDrawing, pin as pinDrawing,
  approveDrawing, rejectDrawing, applySheetToDrawing, ensureSheetAiColumns,
  forActivity as drawingsForActivity, countsFor as drawingCounts, reachFor, fromFileName,
} from './drawings.js';
import {
  buildResources, withoutMoney, saveRate, loadRates, projectMaterials, DEFAULT_MATERIALS,
} from './resources.js';
import {
  listQueue, photosFor, setVerdict, verifyCounts, verdictsFor, photoCounts, missingProof,
} from './verify.js';
import { loadDiary, saveDiary, listDiaries, shiftDay, listDiaryVersions, loadDiaryVersion, ensureManpowerSub } from './diary.js';
import { ensureDiaryA12, draftDiary, applyDraft, runDiaryReminders, preparersOf } from './diary-ai.js';
import { ensureTimesheetTables, readAndKeep, getRead, listReads, applyRead } from './timesheets.js';
import { timesheetsHTML } from './html/timesheets.js';
import {
  ROLES, readScope, isFullScope, describeScope, scopeSql, activitiesInScope,
  listCodes, getCode, findByHash, touchCode, saveCode, deleteCode, chunked,
  reviewDay, getReview, listReviews,
} from './access.js';
import { diaryHTML as diarySheet, photoPageHTML, diaryDocx, diaryFileName } from './diary-doc.js';
import {
  ISSUE_TYPES, createIssue, updateIssue, listIssues, getIssue, issueDocument, issueDocumentTitle,
  linkIssueRfi,
} from './issues.js';
import {
  createOrg, getOrg, listOrgs, updateOrg, orgBlocked,
  saveUser, getUser, listUsers, findUserByInvite, findUserByInviteAny, suspendUser, touchUser,
  userScope, userProjects, userInProject,
  startEmailSignIn, completeEmailSignIn, purgeSignInCodes, signInEmail, issueSignInCode,
  isPlatformEmail, platformEmails, startPlatformSignIn, completePlatformSignIn,
  audit, listAudit, adoptCodes, cleanEmail, setOrgEmailDomains, ensureOrgEmailColumns,
} from './org.js';
import { MANIFEST, SERVICE_WORKER, ICON_192, ICON_512, FAVICON, LOGO_PNG } from './html/pwa.js';
import { FONT_FILES } from './html/fonts.js';
import { icon } from './html/icons.js';
import { BUILDING_ART } from './html/art.js';
import { THEME_TOKENS } from './html/theme.js';
import { buildReport, reportHTML, reportDocument, reportSubject, reportWord, reportFileName } from './report.js';
import { acsConfig, sendViaAzure } from './email-azure.js';
import { openBatch, scanFile, getBatch, confirmItems, commitItems, readStamps, confirmStamps, ensureIntakeTables, abandonBatch, fileReport,
  learnFolders, saveFolderMap, listFolderMap, removeFolderMap, getItemOn, itemSheetValues, applySheetToItem } from './intake.js';
// K9: the AI readers (v5 A1, A3, A6) — the model reads, a person commits.
import { readSheetWithAI, settleSheet, getProposal, decide as decideProposal, readReplyWithAI, checkReply, findFieldsWithAI, ensureAiProposals } from './ai-readers.js';
import { isScanned } from './sheet-corner.js';
import { extractFields as extractXlsxFields } from './template-extract.js';
import { buildReport as buildIntakeReport, reportWorkbook, reportPdf } from './intake-report.js';
import { readList, compareList, saveList, getList, listLists, previousNumbers, confirmList, approveList } from './drawing-lists.js';
import { buildIndex, saveIndex, getIndex, listIndexes, confirmIndex, liveSections, sectionPdf } from './spec-index.js';
import { specHTML } from './html/spec.js';
import { buildSummary, proposeLinks, storeProposals, listLinks, decideLinks, getKb, issueKb, approveKb, kbChanges, reviewChanges,
  saveDrawingContents, listDrawingContents, CONTENTS_SYSTEM, CONTENTS_PROMPT, LINKS_SYSTEM, linksPrompt } from './knowledge.js';
import { knowledgeHTML } from './html/knowledge.js';
import { SCHEDULES, generateSchedules, readSchedule, coverageGates, resolveGate, editItem, addItem, approveSchedule,
  AI_SYSTEM as SCHED_AI_SYSTEM, aiPrompt as schedAiPrompt, RISK_SYSTEM, riskPrompt, ensureScheduleTables } from './schedules.js';
import { schedulesHTML } from './html/schedules.js';
import { findSources, usedToday, limitFor, logQuestion, ASK_SYSTEM, askPrompt } from './ask.js';
import { askHTML } from './html/ask.js';
import { prefilter as assistantPrefilter, hardRefusal, cleanHistory, findHelp as findAssistantHelp, helpOn as assistantHelpOn,
  chatSystem, chatMessages, checkAnswer, smallTalk, REFUSAL as ASSISTANT_REFUSAL, NOT_FOUND as ASSISTANT_NOT_FOUND } from './assistant.js';
import { fileCad, listCad } from './cad.js';
import { rebuildIndex, searchIndex, checkDraft, confirmLetter, linkFor } from './project-index.js';
import { letterCheckHTML } from './html/letter-check.js';
import { draftContext, skeleton as letterSkeleton, DRAFT_SYSTEM, draftPrompt, checkQuotes, checkRefs, saveRevision, listThreads, latest as latestDraft, ensureDraftTable } from './letters-ai.js';
import { scanDelays, listDelays, getDelay, delayContext, skeletonNotice, DELAY_SYSTEM, delayPrompt, saveDraft as saveDelayDraft, signDelay, markIssued, clockNote } from './delays.js';
import { lettersHTML } from './html/letters.js';
import { delaysHTML } from './html/delays.js';
import { heldHTML } from './html/held.js';
import { addColumns } from './db-cols.js';
import { launchCheck } from './launch-check.js';
import { launchHTML } from './html/launch.js';
import { diaryObligation, recipients as diaryRecipients, setRecipients as setDiaryRecipients, sentLog as diarySentLog, logSending as logDiarySending } from './diary-send.js';
import { obligationsHTML } from './html/obligations.js';
import { deviationsHTML } from './html/deviations.js';
import { runComparison, deviationsView, decideDeviation, ensureTifcTables } from './tender-ifc.js';
import { findObligations, listObligations, confirmObligation, approveObligations, KINDS as OBL_KINDS, BINDS as OBL_BINDS } from './obligations.js';
import { suggestPhotos, dayPhotos, confirmPhoto, ensurePhotoAiColumns } from './photo-ai.js';
import { probe as probeFile } from './intake-probe.js';
import { pdfPages } from './pdf-text.js';
import { buildXlsx } from './xlsx.js';
import { intakeHTML } from './html/intake.js';
import { projectHTML } from './html/project.js';
import { sectionTree, listSection, moveItems, SECTIONS } from './sections.js';
import { filesHTML } from './html/files.js';
import { orgHTML } from './html/org.js';
import { workflowsHTML } from './html/workflows.js';
import { homeHTML } from './html/home.js';
import { newProjectHTML } from './html/newproject.js';
import { handoverHTML } from './html/handover.js';
import { testdriveHTML } from './html/testdrive.js';
import { startTest, endTest, testState, isPersona, isTestProject, realIdOf } from './testdrive.js';
import { contractHTML } from './html/contract.js';
import { partiesHTML } from './html/parties.js';
import { modulesHTML } from './html/modules.js';
import {
  PARTIES, PARTY_IDS, isParty, partyLabel, listParties, setParties, setPartyModules,
  defaultModulesFor, selfPartyOf, syncProjectModules,
} from './parties.js';
import { verifyState, sign, unsign, lapseAll } from './signoff.js';
import {
  listRoles, saveRole, retireRole, restoreRole, seedRoles, accessFor, labelsFor,
  DISCIPLINES, DISCIPLINE_ROLES, GROUPS as ROLE_GROUPS, representativeFor,
} from './roles-store.js';
import {
  listWorkflow, saveWorkflow, setRoleOnStep, resetWorkflow, workflowFor,
  stepsForRole, stepsOnlyRole, TYPE_LABEL, TYPE_GROUP,
  listTemplates as listWfTemplates, saveTemplate as saveWfTemplate, useTemplate, seedTemplates,
  addSignatory,
} from './workflow-store.js';
import { proposeTerms, acceptedTerms, TERMS, proposeParties, termEvidence } from './contract-terms.js';
import { recordEvidence, markPending, approveTerms, termsStatus, ensureTermsTables, PENDING_MESSAGE } from './terms-approval.js';

const COOKIE = 'smsess';
const PROJ_COOKIE = 'smproj';

// The line under the project name on every dashboard: where the project is and
// this week (Monday to Sunday, UAE time). The design's own line ("Dubai, UAE ·
// Week 37 · 7–13 Sep 2026") stayed on screen because this was sent empty.
function projectSubLine(project) {
  const now = new Date(Date.now() + 4 * 3600000);
  const day = (now.getUTCDay() + 6) % 7;                         // 0 = Monday
  const mon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  const sun = new Date(mon.getTime() + 6 * 86400000);
  const thu = new Date(mon.getTime() + 3 * 86400000);
  const week = Math.ceil(((thu - Date.UTC(thu.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const range = mon.getUTCMonth() === sun.getUTCMonth()
    ? mon.getUTCDate() + '–' + sun.getUTCDate() + ' ' + M[sun.getUTCMonth()] + ' ' + sun.getUTCFullYear()
    : mon.getUTCDate() + ' ' + M[mon.getUTCMonth()] + ' – ' + sun.getUTCDate() + ' ' + M[sun.getUTCMonth()] + ' ' + sun.getUTCFullYear();
  return [String((project && project.location) || '').trim(), 'Week ' + week + ' · ' + range].filter(Boolean).join(' · ');
}
const escHtml = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Who may write (save, or have the AI prepare) a project's site diary: Document
// Control or the person the PM assigned (v5 A12; Ajay, 6 Oct 2026, decision 11).
// AETRAA, the owner code and the old shared site code (no person) as before.
function mayWriteDiary(me, role, proj) {
  if (!me) return role === 'owner' || role === 'site' || role === 'manager';
  if (proj && proj.diary_assignee && proj.diary_assignee === me.id) return true;
  return userFunctions(me).includes('dc');
}
const DAY = 86400;

/* ------------------------------------------------------------------ auth */

const enc = new TextEncoder();
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

// Access codes are stored hashed, so the database never holds a usable code.
async function sha256(value) {
  return b64url(await crypto.subtle.digest('SHA-256', enc.encode(String(value))));
}

// The token carries which access code signed in, not what it is allowed to do —
// so revoking a code or narrowing its scope takes effect on the next request
// rather than whenever the cookie happens to expire.
async function makeToken(role, pid, aid, secret, days = 90) {
  const body = `${role}.${pid || '-'}.${aid || '-'}.${Math.floor(Date.now() / 1000) + days * DAY}`;
  return `${body}.${await hmac(body, secret)}`;
}

// A named person's session. The cookie carries who they are, never what they may
// do — role, scope and whether their employer is still a customer are all read
// back on every request, so withdrawing somebody is immediate.
const USER_TOKEN = 'u2';

async function makeUserToken(uid, pid, secret, days = 60) {
  const body = `${USER_TOKEN}.${uid}.${pid || '-'}.${Math.floor(Date.now() / 1000) + days * DAY}`;
  return `${body}.${await hmac(body, secret)}`;
}

async function readToken(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts[0] === USER_TOKEN) {
    if (parts.length !== 5) return null;
    const [, uid, pid, exp, sig] = parts;
    if (await hmac(`${USER_TOKEN}.${uid}.${pid}.${exp}`, secret) !== sig) return null;
    if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
    return { uid, pid: pid === '-' ? null : pid, aid: null, role: null };
  }
  // Four parts is a cookie issued before per-discipline codes existed. It still
  // works, and simply carries no access-code id.
  if (parts.length === 4) {
    const [role, pid, exp, sig] = parts;
    if (await hmac(`${role}.${pid}.${exp}`, secret) !== sig) return null;
    if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
    return { role, pid: pid === '-' ? null : pid, aid: null };
  }
  if (parts.length !== 5) return null;
  const [role, pid, aid, exp, sig] = parts;
  if (await hmac(`${role}.${pid}.${aid}.${exp}`, secret) !== sig) return null;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  return { role, pid: pid === '-' ? null : pid, aid: aid === '-' ? null : aid };
}

function cookieValue(req, name) {
  const raw = req.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function sameCode(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// 'lead' is a discipline engineer: updates his own trades and sees a dashboard
// of his own scope, nothing else.
const can = {
  view: (r) => r === 'owner' || r === 'manager' || r === 'lead' || r === 'view' || r === 'site',
  submit: (r) => r === 'owner' || r === 'manager' || r === 'lead' || r === 'site',
  admin: (r) => r === 'owner',
  dashboard: (r) => r === 'owner' || r === 'manager' || r === 'lead' || r === 'view',
  export: (r) => r === 'owner' || r === 'manager',
  portfolio: (r) => r === 'owner',
  report: (r) => r === 'owner' || r === 'manager' || r === 'view',
  // Signing off the day, and checking a claim, belong to the office.
  reviewDay: (r) => r === 'owner' || r === 'manager',
  verify: (r) => r === 'owner' || r === 'manager',
  // Site raises an issue but never issues one; the office decides what goes out.
  raise: (r) => r === 'owner' || r === 'manager' || r === 'lead' || r === 'site',
  issueOut: (r) => r === 'owner' || r === 'manager',
  // Site keeps the diary; the office checks it and marks it submitted.
  diary: (r) => r === 'owner' || r === 'manager' || r === 'lead' || r === 'site' || r === 'view',
  diaryEdit: (r) => r === 'owner' || r === 'manager' || r === 'lead' || r === 'site',
  // Adding and withdrawing people belongs to the Principal and the PM
  // (owner + manager) — the access matrix's "Team & Access" holders.
  people: (r) => r === 'owner' || r === 'manager',
  // What the job has consumed. Quantities for the office; the money in it is a
  // separate permission, checked where the figures are built.
  resources: (r) => r === 'owner' || r === 'manager' || r === 'view',
  money: (r) => r === 'owner',
  // A drawing is read by whoever is building to it — everybody, and everybody
  // sees the whole register, pending sheets included.
  drawings: (r) => r === 'owner' || r === 'manager' || r === 'lead' || r === 'view' || r === 'site',
  // The discipline engineer uploads and submits drawings for approval; the PM
  // approves them and thereafter is the only one who can change a live sheet.
  drawingsUpload: (r) => r === 'owner' || r === 'manager' || r === 'lead',
  drawingsApprove: (r) => r === 'owner' || r === 'manager',
  // What the programme says about the end of the job. The office reads it; site
  // has no use for it and is not shown a contract date.
  schedule: (r) => r === 'owner' || r === 'manager' || r === 'view',
  drawingsEdit: (r) => r === 'owner' || r === 'manager',
  // And the organisations themselves belong to whoever runs the platform — the
  // owner code, which is a Worker secret, not anybody's account.
  platform: (r, me) => r === 'owner' && !me,
};

/* --------------------------------------------------------------- helpers */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

// The people of any demo company, in the order a demo is walked through.
const DEMO_ORDER = ['principal', 'pm', 'planning', 'site', 'design', 'dc', 'qaqc', 'hse',
  'commercial', 'procurement', 'finance', 'consultant'];
async function demoPeople(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT u.id, u.name, u.role, u.functions, u.scope_groups, o.name AS company
         FROM users u JOIN orgs o ON o.id = u.org_id
        WHERE LOWER(COALESCE(o.plan,'')) = 'demo'
          AND COALESCE(u.status,'active') != 'suspended'`
    ).all();
    const list = (results || []).map((r) => {
      let fns = [];
      try { fns = JSON.parse(r.functions || '[]'); } catch (e) { fns = []; }
      const groups = (() => { try { return JSON.parse(r.scope_groups || '[]'); } catch (e) { return []; } })();
      const label = fns.length
        ? fns.map((f) => (FUNCTIONS[f] || {}).label || f).join(' · ')
        : (r.role || '');
      return { id: r.id, name: r.name, company: r.company, role: r.role,
        functions: fns, label: label + (groups.length ? ' (' + groups.join(', ') + ')' : '') };
    });
    list.sort((a, b) => {
      const rank = (x) => {
        const i = DEMO_ORDER.indexOf((x.functions || [])[0]);
        return i < 0 ? 99 : i;
      };
      return rank(a) - rank(b) || String(a.name).localeCompare(String(b.name));
    });
    return list;
  } catch (err) {
    return [];
  }
}

// One page, no code to type: every seat in the demo project, one click each.
function demoPageHTML(people) {
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const company = (people[0] && people[0].company) || 'Demo';
  const cards = people.map((p) => `<button class="seat" data-id="${esc(p.id)}">
      <span class="who">${esc(p.name)}</span>
      <span class="what">${esc(p.label)}</span>
    </button>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AETRAA — demo</title>
<link rel="icon" href="/favicon.ico">
<style>
${THEME_TOKENS}
* { box-sizing: border-box; }
html { background: var(--void); }
body { margin:0; font-family:var(--font); font-size:var(--fs-body); line-height:1.5; font-synthesis:none;
  color:var(--text); background:linear-gradient(180deg,var(--frame-1),var(--frame-2)); display:grid; place-items:center; min-height:100dvh; padding:24px; }
.box { width:100%; max-width:820px; }
.mark { display:flex; justify-content:center; margin-bottom:18px; }
.mark img { height:56px; width:auto; filter:brightness(0) opacity(.86); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .mark img { filter:brightness(0) invert(.92); } }
:root[data-theme="dark"] .mark img { filter:brightness(0) invert(.92); }
h1 { font-family:var(--font-display); font-weight:400; font-size:var(--fs-d2); line-height:1; letter-spacing:.02em; margin:0 0 8px; text-align:center; }
.sub { text-align:center; color:var(--text-2); margin:0 0 28px; font-size:var(--fs-body); }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:12px; }
.seat { text-align:left; background:var(--card); color:var(--text); border:1px solid var(--line); border-radius:var(--r-frame);
  padding:16px 18px; cursor:pointer; font:inherit; display:flex; flex-direction:column; gap:4px; min-height:44px; }
.seat:hover { border-color:color-mix(in srgb,var(--accent) 55%,transparent); }
.seat:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.who { font-weight:600; color:var(--text); }
.what { font-size:var(--fs-secondary); color:var(--text-2); }
.foot { margin-top:28px; text-align:center; color:var(--text-2); font-size:var(--fs-secondary); }
.foot a { color:var(--accent-text); }
.busy { opacity:.5; pointer-events:none; }
</style></head><body>
<div class="box">
  <div class="mark"><img src="/brand-logo" alt="AETRAA"></div>
  <h1>${esc(company)} — demonstration</h1>
  <p class="sub">Pick a seat. No codes, no passwords: you are taken straight into that person's screens.</p>
  <div class="grid">${cards || '<p class="sub">No demo company is set up on this server.</p>'}</div>
  <p class="foot">This is invented data on an invented project.
    <a href="/">Sign in to a real account instead</a></p>
</div>
<script>
document.querySelectorAll('.seat').forEach(function (b) {
  b.addEventListener('click', function () {
    b.classList.add('busy');
    fetch('/api/demo/enter', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id: b.dataset.id }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) location.href = '/'; else { b.classList.remove('busy');
        alert((j && j.error) || 'that did not work'); } })
      .catch(function () { b.classList.remove('busy'); });
  });
});
</script></body></html>`;
}

// THE LIGHT / DARK SWITCH, ONE FOR EVERY PAGE. Many pages drew the ◐ button
// (#themeBtn) with nothing behind it, and the ones that had a handler cycled
// dark → light → "the computer's own setting", which on a dark computer looks
// like dark again — so the button seemed to do nothing. This is put into every
// page's <head>: it applies the saved choice before the page draws (no flash),
// and takes the button over everywhere: always to the opposite of what is on
// screen, remembered in the same 'sm-theme' the pages already read.
const THEME_BOOT = '<script>(function(){var K="sm-theme",d=document.documentElement;' +
  'function on(){var t=d.getAttribute("data-theme");if(t==="dark"||t==="light")return t;' +
  'return window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}' +
  'try{var s=JSON.parse(localStorage.getItem(K)||"null");if(s==="dark"||s==="light")d.setAttribute("data-theme",s);}catch(e){}' +
  'window.addEventListener("click",function(e){var b=e.target&&e.target.closest&&e.target.closest("#themeBtn");if(!b)return;' +
  'e.stopImmediatePropagation();e.preventDefault();var n=on()==="dark"?"light":"dark";d.setAttribute("data-theme",n);' +
  'try{localStorage.setItem(K,JSON.stringify(n));}catch(x){}},true);' +
  // The button itself: the line icon, wherever a page still drew the ◐ character.
  'var I=' + JSON.stringify(icon('contrast', 18)) + ';' +
  'document.addEventListener("DOMContentLoaded",function(){var b=document.getElementById("themeBtn");' +
  'if(b&&!b.querySelector("svg")){b.innerHTML=I;b.setAttribute("aria-label","Switch between light and dark");}});})();</script>';
// THE ASSISTANT'S CHAT BUTTON, ON EVERY PAGE. Put in here rather than into the
// dashboard (src/html/app.js is generated from dashboard-design.html, and a
// hand edit there is lost on the next generate). It asks the server first and
// shows itself only to someone signed in with a project open; it opens the
// /ask page in a panel over the page. Not inside that panel, not on /ask
// itself, not in print.
const CHAT_BOOT = '<script>(function(){' +
  'if(window.top!==window||location.pathname==="/ask"||document.getElementById("aetraa-chat-btn"))return;' +
  'fetch("/api/ask/chat",{cache:"no-store",credentials:"same-origin"}).then(function(r){return r.ok?r.json():null;}).then(function(d){if(d&&d.ok)build(d);}).catch(function(){});' +
  'function build(d){' +
  'var st=document.createElement("style");st.textContent=' + JSON.stringify(
    '#aetraa-chat-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;' +
      // The page's own tokens where it has them (src/html/theme.js); the old navy where it does not (app.js).
      'background:var(--glass,#212d51);-webkit-backdrop-filter:blur(18px) saturate(120%);backdrop-filter:blur(18px) saturate(120%);' +
      'color:var(--text,#fff);outline:1px solid var(--line-strong,transparent);outline-offset:-1px;' +
      'box-shadow:var(--shadow,0 6px 18px rgba(0,0,0,.28));display:flex;align-items:center;justify-content:center;padding:0}' +
    '#aetraa-chat-btn:hover{background:var(--surface-2,#2a3866)}#aetraa-chat-btn:focus-visible{outline:2px solid var(--accent,#c9a227);outline-offset:2px}' +
    '#aetraa-chat-panel{position:fixed;right:20px;bottom:88px;z-index:2147483000;width:400px;max-width:calc(100vw - 32px);height:min(640px,calc(100vh - 110px));' +
      'background:var(--surface,#fff);color:var(--ink,#1b1f24);border:1px solid var(--border,#d6dbe1);border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.3);' +
      'display:flex;flex-direction:column;overflow:hidden}' +
    '#aetraa-chat-panel[hidden]{display:none}' +
    '#aetraa-chat-panel .h{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface-2,#212d51);color:var(--text,#fff);' +
      'border-bottom:1px solid var(--line,transparent);font-family:var(--font,serif);font-size:15px;line-height:1.2;font-weight:500}' +
    '#aetraa-chat-panel .h b{flex:1;font-weight:500}#aetraa-chat-panel .h a{color:var(--text-2,#fff);font-weight:400;font-size:13px}' +
    '#aetraa-chat-panel .h button{background:none;border:0;color:var(--text,#fff);font-size:22px;line-height:1;cursor:pointer;min-width:44px;min-height:44px;padding:0}' +
    '#aetraa-chat-panel iframe{flex:1;width:100%;border:0;background:var(--plane,#fff)}' +
    '@media (max-width:600px){#aetraa-chat-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100%;border-radius:0}' +
      'body.aetraa-chat-open #aetraa-chat-btn{display:none}#aetraa-chat-btn{right:16px;bottom:16px}}' +
    '@media print{#aetraa-chat-btn,#aetraa-chat-panel{display:none!important}}') + ';' +
  'document.head.appendChild(st);' +
  'var b=document.createElement("button");b.id="aetraa-chat-btn";b.type="button";b.title="AETRAA Assistant";b.setAttribute("aria-label","Open the AETRAA Assistant");b.setAttribute("aria-expanded","false");' +
  'b.innerHTML=\'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>\';' +
  'var p=document.createElement("div");p.id="aetraa-chat-panel";p.hidden=true;p.setAttribute("role","dialog");p.setAttribute("aria-label","AETRAA Assistant");' +
  'p.innerHTML=\'<div class="h"><b>AETRAA Assistant</b><a href="/ask" target="_top">Full page</a><button type="button" aria-label="Close">\\u00d7</button></div>\';' +
  'var f=null;function show(o){if(o&&!f){f=document.createElement("iframe");f.src="/ask?embed=1";f.title="AETRAA Assistant";p.appendChild(f);}' +
  'p.hidden=!o;b.setAttribute("aria-expanded",o?"true":"false");document.body.classList.toggle("aetraa-chat-open",o);if(!o)b.focus();}' +
  'b.addEventListener("click",function(){show(p.hidden);});p.querySelector(".h button").addEventListener("click",function(){show(false);});' +
  'document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!p.hidden)show(false);});' +
  // Esc pressed inside the panel is heard by the /ask page, which says so.
  'window.addEventListener("message",function(e){if(e.origin===location.origin&&e.data==="aetraa-chat-close"&&!p.hidden)show(false);});' +
  'document.body.appendChild(p);document.body.appendChild(b);}' +
  '})();</script>';
// THE PAGE HEAD, ONE PLACE FOR EVERY PAGE. A page names itself in its top bar
// (<div class="brand"><h1>Title</h1><div class="sub">line</div></div>). Here
// that title and line are lifted out of the bar and set at the top of the page
// — the line as a small label, the title large, the line drawing beside it
// (src/html/theme.js .pagehead). The elements
// are moved, not copied, so their ids — which page scripts fill in — still work.
// A page with its own head (class "hero") or another shape is left as it is.
const BRAND_RE = /<div class="brand">(<h1([^>]*)>([\s\S]*?)<\/h1>)(?:<div class="sub"([^>]*)>([\s\S]*?)<\/div>)?<\/div>/;
function withPageHead(body) {
  if (!body.includes('class="topbar"') || body.includes('class="hero"') || body.includes('class="pagehead"')) return body;
  const m = BRAND_RE.exec(body);
  if (!m || /class=/.test(m[2]) || /class=/.test(m[4] || '')) return body;
  const wrapAt = body.indexOf('<div class="wrap"', m.index);
  if (wrapAt < 0) return body;
  const wrapEnd = body.indexOf('>', wrapAt) + 1;
  // The title exactly as the page wrote it (gold is kept for the brand and the main actions).
  const title = m[3];
  const head = '<header class="pagehead"><div class="pagehead-copy">' +
    (m[4] !== undefined ? '<p class="t-label pagehead-label"' + m[4] + '>' + m[5] + '</p>' : '') +
    '<h1 class="t-display"' + m[2] + '>' + title + '</h1></div>' +
    '<div class="pagehead-art" aria-hidden="true">' + BUILDING_ART + '</div></header>';
  return body.slice(0, m.index) + body.slice(m.index + m[0].length, wrapEnd) + head + body.slice(wrapEnd);
}

const withThemeBoot = (body) => {
  if (typeof body !== 'string') return body;
  body = withPageHead(body);
  let out = body.includes('<head') && !body.includes('sm-theme",d=') ? body.replace(/<head([^>]*)>/i, (m) => m + THEME_BOOT) : body;
  if (out.includes('</body>') && !out.includes('aetraa-chat-btn')) out = out.replace(/<\/body>(?![\s\S]*<\/body>)/i, () => CHAT_BOOT + '</body>');
  return out;
};
const html = (body) =>
  new Response(withThemeBoot(body), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });

// Turning somebody out: clear the cookie in the same breath as refusing them, so
// the next request does not arrive carrying a session that no longer means
// anything.
function signedOut(message) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  return new Response(JSON.stringify({ error: message }), { status: 401, headers });
}

// A named person signed in: the session cookie, and the project they open on.
async function signedIn(person, first, secret, body, days = 60) {
  const token = await makeUserToken(person.id, first, secret, days);
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', `${COOKIE}=${token}; Path=/; Max-Age=${days * DAY}; HttpOnly; Secure; SameSite=Lax`);
  if (first) headers.append('Set-Cookie', `${PROJ_COOKIE}=${first}; Path=/; Max-Age=${days * DAY}; Secure; SameSite=Lax`);
  return new Response(JSON.stringify(body), { headers });
}

// Too many attempts: said plainly, with when to try again.
const tooMany = (minutes) => json({ error: 'Too many attempts. Wait ' + minutes + ' minutes and try again.', throttled: true }, 429);

const today = () => new Date().toISOString().slice(0, 10);
// Today on site, in the UAE (UTC+4) — after 20:00 UTC it is already tomorrow there.
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();

const str = (v, max = 2000) => (v === undefined || v === null ? null : String(v).slice(0, max));

function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const date = (v) => (v && DATE_RE.test(String(v).trim()) ? String(v).trim() : null);
const slug = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

const STATUSES = ['not_started', 'in_progress', 'complete', 'at_risk', 'delayed', 'on_hold'];

/* ------------------------------------------------------- CSV for import */

function parseDelimited(text) {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = clean.split('\n')[0] || '';
  const delim = firstLine.split('\t').length > firstLine.split(',').length ? '\t' : ',';
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"') { if (clean[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function headerMap(headerRow, aliases) {
  const map = {};
  headerRow.forEach((h, i) => {
    const key = h.trim().toLowerCase().replace(/\s+/g, ' ');
    for (const [field, list] of Object.entries(aliases)) {
      if (list.includes(key) && map[field] === undefined) map[field] = i;
    }
  });
  return map;
}

const ACT_ALIASES = {
  id: ['id', 'activity id', 'activity_id', 'act id', 'task id', 'code', 'ref'],
  name: ['name', 'activity', 'activity name', 'description', 'task', 'task name'],
  wbs: ['wbs', 'section', 'wbs name', 'bill', 'element'],
  level: ['level', 'lvl', 'outline level', 'indent'],
  planned_start: ['planned start', 'planned_start', 'start', 'baseline start', 'early start', 'plan start'],
  planned_finish: ['planned finish', 'planned_finish', 'finish', 'baseline finish', 'early finish', 'end', 'plan finish'],
  weight: ['weight', 'weighting', 'value', 'amount', 'cost'],
  trade: ['trade', 'resource', 'tradewise'],
  trade_group: ['trade group', 'trade_group', 'tradegroup', 'group'],
  floor: ['floor', 'level name', 'zone', 'area'],
  discipline: ['discipline', 'decipline'],
  phase: ['phase', 'stage'],
  responsible: ['responsible', 'owner', 'subcontractor', 'contractor', 'party'],
};

function normaliseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (DATE_RE.test(s)) return s;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    return new Date(Date.UTC(1899, 11, 30) + Number(s) * 864e5).toISOString().slice(0, 10);
  }
  let m = s.match(/^(\d{1,2})[-/ ](\d{1,2})[-/ ](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    if (Number(mo) > 12 && Number(d) <= 12) [d, mo] = [mo, d];
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{2,4})$/);
  if (m) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const mi = months.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) {
      const y = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${y}-${String(mi + 1).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    }
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/* -------------------------------------------------------------- projects */

async function listProjects(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, ref, contract_completion, target_name, target_deadline, archived, sort_order
       FROM projects WHERE id NOT LIKE '%--test' ORDER BY archived, COALESCE(sort_order, 999), name`
  ).all();
  return results || [];
}

// SELECT * rather than a column list on purpose. getProject is called on almost
// every request, so naming a column the live database has not been migrated to
// yet would take the whole app down rather than just the feature that needs it.
async function getProject(env, pid) {
  return await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(pid).first();
}

// Which project is this request about? Non-owners are pinned to theirs by the token.
async function resolvePid(req, env, session) {
  if (!session) return null;
  if (session.role !== 'owner') return session.pid;
  const url = new URL(req.url);
  const asked = url.searchParams.get('p') || cookieValue(req, PROJ_COOKIE);
  if (asked && await getProject(env, asked)) return asked;
  const all = await listProjects(env);
  const live = all.filter((p) => !p.archived);
  return (live[0] || all[0] || {}).id || null;
}

// The owner code is the platform operator, not a member of any organisation, so
// it has to say which one it means. With only one on the system — which is every
// installation until the second customer signs up — saying so would be silly.
async function onlyOrg(env) {
  try {
    const { results } = await env.DB.prepare('SELECT id FROM orgs LIMIT 2').all();
    return (results || []).length === 1 ? results[0].id : null;
  } catch (err) {
    return null;
  }
}

// Every project this organisation owns. Projects created before organisations
// existed carry no org_id; they belong to whoever adopted them, which in practice
// is the first organisation on the system.
async function orgProjects(env, oid) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, ref, contract_completion, target_name, target_deadline, archived, sort_order
       FROM projects WHERE org_id = ? ORDER BY archived, COALESCE(sort_order, 999), name`
  ).bind(oid).all();
  return results || [];
}

// Which project a named person is looking at.
//
// Asking for one by name is treated differently from a cookie, on purpose. A
// cookie goes stale on its own — somebody is taken off a project, or it is
// archived — and being locked out over that would be absurd, so a cookie that
// no longer fits quietly falls back to a project they do have.
//
// ?p=something is a different act: somebody typed it. If it is not theirs they
// are refused, rather than quietly shown a different project's figures under the
// name they asked for. A report that says one project and shows another is worse
// than an error.
const DENIED = Symbol('denied');

async function resolveUserPid(req, env, me, session) {
  const url = new URL(req.url);
  let mine;
  try { mine = await orgProjects(env, me.org_id); }
  catch (e) { mine = await listProjects(env); }          // not migrated
  const allowed = mine.filter((p) => userInProject(me, p.id));
  const has = (v) => v && allowed.some((p) => p.id === v);

  const asked = url.searchParams.get('p');
  if (asked) return has(asked) ? asked : DENIED;

  const remembered = cookieValue(req, PROJ_COOKIE) || (session && session.pid);
  if (has(remembered)) return remembered;
  const live = allowed.filter((p) => !p.archived);
  return (live[0] || allowed[0] || {}).id || null;
}

/* ------------------------------------------------------------ API: read */

async function getData(env, pid, scope) {
  const db = env.DB;
  // One scope clause, applied to everything that hangs off an activity, so a
  // discipline engineer's dashboard cannot show him the other discipline.
  const s = scopeSql(scope, 'a');
  const full = isFullScope(scope);
  const inScope = full ? '' :
    ` AND activity_id IN (SELECT a.id FROM activities a WHERE a.project_id = ? AND ${s.sql})`;
  const scopeArgs = full ? [] : [pid, ...s.args];

  const [acts, latest, history, mp, photos, project, targets, recent] = await Promise.all([
    db.prepare(
      `SELECT a.id, a.wbs, a.name, a.level, a.planned_start, a.planned_finish, a.weight,
              a.trade, a.trade_group, a.floor, a.discipline, a.phase, a.responsible, a.sort_order
         FROM activities a WHERE a.project_id = ? AND ${s.sql}
        ORDER BY COALESCE(a.sort_order, 999999), a.id`
    ).bind(pid, ...s.args).all(),
    db.prepare(
      `SELECT u.* FROM updates u
        WHERE u.project_id = ?
          AND u.id = (SELECT MAX(id) FROM updates WHERE project_id = u.project_id AND activity_id = u.activity_id)
          ${inScope}`
    ).bind(pid, ...scopeArgs).all(),
    db.prepare(
      // The last update for each activity on each day. This used to be
      // "SELECT pct, MAX(id) … GROUP BY activity_id, report_date", which works
      // only because SQLite quietly hands back the pct belonging to the max
      // id. PostgreSQL refuses a bare column in a GROUP BY, and rightly — the
      // intent has to be said out loud.
      `SELECT u.activity_id, u.report_date, u.pct, u.id FROM updates u
        WHERE u.project_id = ?
          AND u.id = (SELECT MAX(id) FROM updates
                       WHERE project_id = u.project_id
                         AND activity_id = u.activity_id
                         AND report_date = u.report_date)
          ${inScope}
        ORDER BY u.report_date`
    ).bind(pid, ...scopeArgs).all(),
    db.prepare(
      `SELECT * FROM manpower WHERE project_id = ? ORDER BY report_date DESC, trade LIMIT 2000`
    ).bind(pid).all(),
    db.prepare(
      `SELECT id, activity_id, report_date, caption, submitted_by, created_at
         FROM photos WHERE project_id = ? ORDER BY created_at DESC LIMIT 500`
    ).bind(pid).all(),
    getProject(env, pid),
    db.prepare(
      `SELECT activity_id, target_group, work, level, days_left, target_start, target_finish, sort_order
         FROM targets WHERE project_id = ?
          ${full ? '' : ` AND activity_id IN (SELECT a.id FROM activities a WHERE a.project_id = ? AND ${s.sql})`}
        ORDER BY COALESCE(sort_order, 999999)`
    ).bind(pid, ...scopeArgs).all(),
    db.prepare(
      `SELECT * FROM updates WHERE project_id = ? AND source = 'site' ${inScope}
        ORDER BY id DESC LIMIT 40`
    ).bind(pid, ...scopeArgs).all(),
  ]);

  const current = {};
  for (const r of latest.results || []) current[r.activity_id] = r;

  const p = project || {};
  return {
    generated_at: nowISO(),
    project: { id: pid, name: p.name || 'Project', ref: p.ref || '' },
    scope: full ? null : { ...scope, text: describeScope(scope) },
    meta: {
      project_name: p.name || 'Project',
      project_ref: p.ref || '',
      contract_completion: p.contract_completion || '',
      target_name: p.target_name || '',
      target_deadline: p.target_deadline || '',
      report_emails: p.report_emails || '',
      report_daily: p.report_daily ? 1 : 0,
      report_weekly: p.report_weekly ? 1 : 0,
      report_monthly: p.report_monthly ? 1 : 0,
      report_digest: p.report_digest ? 1 : 0,
      engineer_name: p.engineer_name || '',
      contractor_name: p.contractor_name || '',
      plot_numbers: p.plot_numbers || '',
      contract_no: p.contract_no || '',
      programme_ids: p.programme_ids || '',
      aliases_text: (() => { try { const a = JSON.parse(p.aliases || '[]'); return Array.isArray(a) ? a.join(', ') : ''; } catch (e) { return ''; } })(),
      notice_clause: p.notice_clause || '',
      reply_days: p.reply_days || '',
      logo_consultant: p.logo_consultant || '',
      logo_consultant2: p.logo_consultant2 || '',
      logo_contractor: p.logo_contractor || '',
      proof_at_100: p.proof_at_100 === 0 ? 0 : 1,
      materials: projectMaterials(p),
      materials_set: !!p.materials,
      currency: p.currency || 'AED',
    },
    activities: acts.results || [],
    current,
    history: history.results || [],
    manpower: mp.results || [],
    photos: photos.results || [],
    targets: targets.results || [],
    recent: recent.results || [],
  };
}

// Initials for the sidebar avatar.
function initials(name) {
  const p = String(name || '').trim().split(/\s+/);
  return (((p[0] || '')[0] || '') + ((p[1] || '')[0] || '')).toUpperCase() || 'U';
}

// Uploading drawings belongs to Design and Document Control (and the Principal
// and PM, who hold every folder). The legacy 'lead' role covers HSE, Finance,
// Procurement and the rest as well, so for a named person it is not enough.
function mayUploadDrawings(role, me) {
  if (!can.drawingsUpload(role)) return false;
  if (!me) return true;                                  // code logins keep the old rule
  const f = userFunctions(me);
  return ['principal', 'pm', 'design', 'dc'].some((x) => f.includes(x));
}

// Names for each kind of record, for screens and messages.
const RECORD_LABEL = { rfi: 'RFI', submittal: 'Submittal', ms: 'Method statement', material: 'Material approval',
  authority: 'Authority NOC', letter: 'Letter', incoming: 'Incoming letter', variation: 'Variation', wir: 'Inspection (WIR)', mir: 'Material inspection (MIR)',
  ncr: 'NCR', obs: 'HSE observation', incident: 'Incident', ptw: 'Permit to work', mr: 'Material request' };

// Columns added after a project database was first made. Safe to try every time;
// tried once per running instance.
const PROJECT_COLS = {};
async function ensureProjectColumn(env, col) {
  if (PROJECT_COLS[col]) return;
  // addColumns (db-cols.js): looked up first. A failed SELECT-then-ALTER can
  // leave the column missing on PostgreSQL behind a connection pool.
  PROJECT_COLS[col] = await addColumns(env, 'projects', [[col, 'TEXT']]);
}

// The programme is the planner's: Planning, the PM and the Principal may update
// it and take progress out for P6. (Code logins: the office roles.)
function mayPlan(role, me) {
  if (!me) return role === 'owner' || role === 'manager';
  const f = userFunctions(me);
  return ['planning', 'pm', 'principal'].some((x) => f.includes(x));
}

// May this person act on the step a record is waiting on?
//   advance / reject — the owner of the pending step (or Principal / PM)
//   close            — closing out early is the Principal's or the PM's alone
function stepPermission(me, rec, isPlatformAdmin, action) {
  // K5: an imported record has no step to sign, for anybody — AETRAA included.
  if (rec && rec.imported) return { ok: false, error: IMPORTED_REFUSAL(rec) };
  if (isPlatformAdmin) return { ok: true };
  const fns = userFunctions(me);
  const boss = fns.includes('principal') || fns.includes('pm');
  const next = pendingStep(rec);
  if (!next) return { ok: false, error: 'This record is already closed.' };
  if (action === 'close') {
    return boss ? { ok: true } : { ok: false, error: 'Only the Project Manager or the Principal can close a record early.' };
  }
  if (boss) return { ok: true, step: next };
  const owners = next.by;
  if (!owners) {                       // an old record with no owners on its steps
    return mayApproveRecord(me, rec.type, false) ? { ok: true, step: next }
      : { ok: false, error: 'This is ' + whoMayApprove(rec.type) + "'s to approve, not yours." };
  }
  if (owners.some((f) => fns.includes(f))) return { ok: true, step: next };
  const names = owners.map((f) => (FUNCTIONS[f] || {}).label || f).join(' or ');
  return { ok: false, error: '“' + next.st + '” is for ' + names + ' — not part of your access.' };
}

// What the app shows on a record for the person looking at it.
function recordForViewer(me, rec, isPlatformAdmin) {
  const next = pendingStep(rec);
  // Where the Document Control "issue" step is in this record's ladder — once
  // it is signed and the record is still open, the ball is with the consultant.
  const wf = rec.workflow || [];
  let issueAt = wf.findIndex((s) => s && s.issue);
  if (issueAt < 0) {
    const t = RECORD_TYPES[rec.type];
    if (t && t.wf.length === wf.length) issueAt = t.wf.findIndex((s) => s.issue);
  }
  const withConsultant = !!(next && issueAt >= 0 && (rec.step || 0) >= issueAt);
  return Object.assign({}, rec, {
    next_step: next ? next.st : null,
    next_by_fns: next && next.by ? next.by : [],
    with_consultant: withConsultant,
    issued_on: withConsultant && wf[issueAt] ? String(wf[issueAt].when || '').slice(0, 10) : null,
    next_by: next && next.by ? next.by.map((f) => (FUNCTIONS[f] || {}).label || f) : [],
    next_is_issue: !!(next && next.issue),
    next_is_reply: !!(next && next.reply),
    can_act: !!(next && stepPermission(me, rec, isPlatformAdmin, 'advance').ok),
    // K5: Document Control (or the PM / Principal) may take an imported matter over.
    may_take_over: !!(rec.imported && !rec.continued_by && rec.type !== 'incoming' && mayTakeOver(me, isPlatformAdmin)),
  });
}
// K5: who may bring records in from the old system, and take one over:
// Document Control, the PM and the Principal of the project, and the AETRAA
// Admin while setting a project up.
function mayTakeOver(me, isPlatformAdmin) {
  return !!isPlatformAdmin || !!(me && userFunctions(me).some((f) => f === 'dc' || f === 'pm' || f === 'principal'));
}

// The identity + project context the live app shell boots with. Everything the
// design keyed on a demo account is supplied here from the real signed-in user.
async function buildMe(env, me, pid) {
  const fns = userFunctions(me);
  const primary = fns[0] || 'consultant';
  let sg = [];
  try { sg = JSON.parse(me.scope_groups || '[]'); } catch (e) { /* ignore */ }
  let projList = [];
  try {
    const all = await orgProjects(env, me.org_id);
    projList = all.filter((x) => userInProject(me, x.id)).map((x) => ({ id: x.id, name: x.name }));
  } catch (e) { /* ignore */ }
  const cur = projList.find((x) => x.id === pid) || projList[0] || {};
  const mods = (cur.id && await getProjectModules(env, cur.id).catch(() => null)) || DEFAULT_ON.slice();
  // The access this person really has, resolved from THIS project's own role
  // catalogue — which the Principal may have amended — rather than from the
  // matrix the platform ships with. Sent rather than recomputed in the page, so
  // the sidebar can never offer a dashboard the API will refuse.
  let access = null, roleLabels = null;
  if (cur.id) {
    access = await accessFor(env, cur.id, fns.length ? fns : [primary]).catch(() => null);
    roleLabels = await labelsFor(env, cur.id).catch(() => null);
  }
  return {
    email: me.email,
    name: me.name,
    av: initials(me.name),
    title: (roleLabels && roleLabels[primary]) || (FUNCTIONS[primary] && FUNCTIONS[primary].label) || '',
    access: access || null,
    roleLabels: roleLabels || null,
    roles: fns.length ? fns : [primary],
    siteDiscipline: sg[0] || '',
    projects: projList,
    projectId: cur.id || '',
    projectName: cur.name || '',
    projectSub: cur.id ? projectSubLine(await getProject(env, cur.id).catch(() => cur) || cur) : '',
    canAssign: primary === 'principal' || fns.indexOf('pm') >= 0 || primary === 'pm',
    // What this person may raise and approve, computed from the one matrix in
    // functions.js. Sent rather than re-derived in the page, so the buttons on
    // screen can never drift away from what the API will accept.
    mayRaise: Object.keys(RECORD_CREATORS).filter((t) => mayCreateRecord(me, t, false) && recordTypeOn(mods, t)),
    mayApprove: Object.keys(RECORD_APPROVERS).filter((t) => recordTypeOn(mods, t) &&
      (fns.includes('principal') || fns.includes('pm') || approverFunctions(t).some((f) => fns.includes(f)))),
    // The modules switched on for this project, and the dashboards to hide.
    modules: mods,
    dashOff: dashboardsOff(mods),
    mayNotify: mayNotify(me),
  };
}

// One row per project, cheap enough to run on every portfolio load.
async function getPortfolio(env, oid) {
  const projects = oid ? await orgProjects(env, oid) : await listProjects(env);
  const { results: rows } = await env.DB.prepare(
    `SELECT a.project_id AS pid,
            COUNT(*) AS total,
            SUM(CASE WHEN COALESCE(u.pct,0) >= 100 THEN 1 ELSE 0 END) AS done,
            SUM(CASE WHEN u.status IN ('delayed','at_risk','on_hold') THEN 1 ELSE 0 END) AS flagged,
            MIN(a.planned_start) AS first_start,
            MAX(a.planned_finish) AS last_finish,
            SUM(COALESCE(u.pct,0) * COALESCE(NULLIF(a.weight,0), 1)) AS earned,
            SUM(COALESCE(NULLIF(a.weight,0), 1)) AS weight
       FROM activities a
       LEFT JOIN updates u ON u.project_id = a.project_id AND u.id =
            (SELECT MAX(id) FROM updates WHERE project_id = a.project_id AND activity_id = a.id)
      WHERE COALESCE(a.level,1) >= 1
      GROUP BY a.project_id`
  ).all();
  const { results: tgt } = await env.DB.prepare(
    `SELECT t.project_id AS pid,
            COUNT(*) AS total,
            SUM(CASE WHEN COALESCE(u.pct,0) >= 100 THEN 1 ELSE 0 END) AS cleared,
            SUM(CASE WHEN COALESCE(u.pct,0) < 100 AND t.target_finish < ? THEN 1 ELSE 0 END) AS missed
       FROM targets t
       LEFT JOIN updates u ON u.project_id = t.project_id AND u.id =
            (SELECT MAX(id) FROM updates WHERE project_id = t.project_id AND activity_id = t.activity_id)
      GROUP BY t.project_id`
  // Dates are stored as ISO text. SQLite will compare text to a date and
  // PostgreSQL will not, so today's date is bound as text and the comparison
  // means the same thing on both.
  ).bind(today()).all();
  const { results: last } = await env.DB.prepare(
    `SELECT project_id AS pid, MAX(created_at) AS at, COUNT(*) AS n
       FROM updates WHERE source = 'site' GROUP BY project_id`
  ).all();

  const by = (list) => Object.fromEntries((list || []).map((r) => [r.pid, r]));
  const A = by(rows), T = by(tgt), L = by(last);
  return json({
    generated_at: nowISO(),
    projects: projects.map((p) => ({
      ...p,
      stats: {
        activities: (A[p.id] || {}).total || 0,
        complete: (A[p.id] || {}).done || 0,
        flagged: (A[p.id] || {}).flagged || 0,
        pct: (A[p.id] || {}).weight ? (A[p.id].earned / A[p.id].weight) : 0,
        first_start: (A[p.id] || {}).first_start || null,
        last_finish: (A[p.id] || {}).last_finish || null,
        target_total: (T[p.id] || {}).total || 0,
        target_cleared: (T[p.id] || {}).cleared || 0,
        target_missed: (T[p.id] || {}).missed || 0,
        last_update: (L[p.id] || {}).at || null,
        site_updates: (L[p.id] || {}).n || 0,
      },
    })),
  });
}

async function getTrades(env, pid, scope) {
  const s = scopeSql(scope, 'a');
  const { results } = await env.DB.prepare(
    `SELECT COALESCE(NULLIF(a.trade,''), '~other') AS trade,
            COALESCE(NULLIF(a.trade_group,''), '') AS trade_group,
            a.discipline AS discipline,
            COUNT(*) AS total,
            SUM(CASE WHEN COALESCE(u.pct,0) >= 100 THEN 0 ELSE 1 END) AS pending,
            SUM(CASE WHEN u.status IN ('delayed','at_risk','on_hold') THEN 1 ELSE 0 END) AS flagged
       FROM activities a
       LEFT JOIN updates u ON u.project_id = a.project_id AND u.id =
            (SELECT MAX(id) FROM updates WHERE project_id = a.project_id AND activity_id = a.id)
      WHERE a.project_id = ? AND COALESCE(a.level,1) >= 1 AND ${s.sql}
        AND (COALESCE(a.trade,'') <> '' OR COALESCE(a.discipline,'') IN ('','Construction'))
      GROUP BY trade, trade_group, a.discipline
      ORDER BY pending DESC, trade`
  ).bind(pid, ...s.args).all();

  const merged = {};
  for (const r of results || []) {
    const k = r.trade + '|' + r.trade_group;
    if (!merged[k]) merged[k] = { trade: r.trade, trade_group: r.trade_group, total: 0, pending: 0, flagged: 0 };
    merged[k].total += Number(r.total) || 0; merged[k].pending += Number(r.pending) || 0;
    merged[k].flagged += Number(r.flagged) || 0;
  }
  const p = (await getProject(env, pid)) || {};
  return json({
    meta: { project_name: p.name || 'Project', project_ref: p.ref || '' },
    scope: isFullScope(scope) ? null : { ...scope, text: describeScope(scope) },
    trades: Object.values(merged).sort((a, b) => b.pending - a.pending || a.trade.localeCompare(b.trade)),
  });
}

async function getSiteData(env, pid, trade, scope) {
  const other = trade === '~other';
  const s = scopeSql(scope, 'a');
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.name, a.wbs, a.floor, a.trade, a.planned_start, a.planned_finish, a.sort_order,
            u.pct, u.status, u.actual_start, u.actual_finish, u.delay_reason, u.remarks,
            u.report_date, u.submitted_by,
            t.target_finish AS target_finish, t.target_group AS target_group
       FROM activities a
       LEFT JOIN updates u ON u.project_id = a.project_id AND u.id =
            (SELECT MAX(id) FROM updates WHERE project_id = a.project_id AND activity_id = a.id)
       LEFT JOIN targets t ON t.project_id = a.project_id AND t.activity_id = a.id
      WHERE a.project_id = ? AND COALESCE(a.level,1) >= 1 AND ${s.sql}
        AND ${other
          ? `COALESCE(a.trade,'') = '' AND COALESCE(a.discipline,'') IN ('','Construction')`
          : `a.trade = ?`}
      ORDER BY COALESCE(a.floor,''), COALESCE(a.planned_start,'9999'), COALESCE(a.sort_order, 999999)
      LIMIT 1500`
  ).bind(pid, ...s.args, ...(other ? [] : [trade])).all();
  const rows = results || [];
  const ids = rows.map((r) => r.id);
  // The two things site needs on the card: whether it is evidenced, and whether
  // the office sent it back.
  const [pics, verdicts, dwgs] = await Promise.all([
    photoCounts(env, pid, ids).catch(() => ({})),
    verdictsFor(env, pid, ids),
    drawingCounts(env, pid, rows).catch(() => ({})),
  ]);
  for (const r of rows) {
    r.photos = pics[r.id] || 0;
    r.drawings = dwgs[r.id] || 0;
    const v = verdicts[r.id];
    if (v) { r.verdict = v.status; r.verdict_note = v.note; r.verdict_by = v.by; r.verdict_at = v.at; }
  }
  return json({ trade, activities: rows });
}

/* ----------------------------------------------------------- API: write */

async function postUpdate(req, env, role, pid, scope, proofAt100, whoName) {
  const b = await req.json();
  const ids = Array.isArray(b.activity_id) ? b.activity_id : [b.activity_id];

  // Scope is enforced here, not only in what the page offers. Someone holding
  // the MEP code cannot write to a civil activity by any route.
  if (!isFullScope(scope)) {
    const allowed = await activitiesInScope(env, pid, scope, ids.filter(Boolean).map(String));
    const refused = ids.filter((id) => id && !allowed.has(String(id)));
    if (refused.length) {
      return json({ error: `outside your trades: ${refused.slice(0, 3).join(', ')}` }, 403);
    }
  }

  // Claiming an activity complete needs a photograph of it. Enforced here, not
  // only in the page — a claim of 100% with no evidence is the one that matters.
  if (proofAt100 && role !== 'owner' && role !== 'manager') {
    const pctIn = num(b.pct);
    if (pctIn !== null && pctIn >= 100) {
      const bare = await missingProof(env, pid, ids.filter(Boolean).map(String));
      if (bare.length) {
        return json({
          error: 'A photograph is needed before an activity can be marked complete.',
          needs_photo: bare,
        }, 422);
      }
    }
  }

  const rd = date(b.report_date) || today();
  // A named person's name wins over whatever the page typed into the form. The
  // whole reason for accounts is that an update can be traced to one man.
  const by = whoName || str(b.submitted_by, 80) || (role === 'site' ? 'site' : 'office');
  const status = STATUSES.includes(b.status) ? b.status : null;
  const pct = num(b.pct);

  const rows = ids.filter(Boolean).map((id) =>
    env.DB.prepare(
      `INSERT INTO updates
         (project_id, activity_id, report_date, pct, actual_start, actual_finish, status,
          delay_reason, remarks, submitted_by, source, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,'site',?)`
    ).bind(
      pid, str(id, 60), rd,
      pct === null ? null : Math.max(0, Math.min(100, pct)),
      date(b.actual_start), date(b.actual_finish), status,
      str(b.delay_reason, 80), str(b.remarks, 2000), by, nowISO()
    )
  );
  if (!rows.length) return json({ error: 'no activity given' }, 400);
  await env.DB.batch(rows);
  return json({ ok: true, saved: rows.length });
}

async function postManpower(req, env, role, pid, whoName) {
  const b = await req.json();
  const rd = date(b.report_date) || today();
  const by = whoName || str(b.submitted_by, 80) || 'site';
  const lines = (Array.isArray(b.lines) ? b.lines : [])
    .filter((l) => l && str(l.trade) && num(l.headcount) !== null);
  if (!lines.length) return json({ error: 'no manpower lines' }, 400);

  // K8: the site's own count replaces only its own rows, never a subcontractor's gang.
  await ensureManpowerSub(env);
  const stmts = [
    ...lines.map((l) =>
      env.DB.prepare("DELETE FROM manpower WHERE project_id = ? AND report_date = ? AND trade = ? AND COALESCE(subcontractor, '') = ''")
        .bind(pid, rd, str(l.trade, 80))),
    ...lines.map((l) =>
      env.DB.prepare(
        `INSERT INTO manpower (project_id, report_date, trade, headcount, plant, submitted_by, created_at)
         VALUES (?,?,?,?,?,?,?)`
      ).bind(pid, rd, str(l.trade, 80), Math.max(0, Math.round(num(l.headcount))),
             str(l.plant, 500), by, nowISO())),
  ];
  await env.DB.batch(stmts);
  return json({ ok: true, saved: lines.length });
}

async function postPhoto(req, env, role, pid, whoName) {
  const b = await req.json();
  const data = String(b.data || '');
  if (!data.startsWith('data:image/')) return json({ error: 'expected a data:image URL' }, 400);
  if (data.length > 1_400_000) return json({ error: 'image too large after resize' }, 413);
  const id = crypto.randomUUID();
  // K2: the photo goes to the file store; the row keeps its key ('' in data,
  // which the schema holds NOT NULL).
  await ensurePhotoColumns(env);
  const put = await storePhoto(env, pid, id, data);
  if (put.error) return json({ error: 'the photo could not be stored: ' + put.error }, 500);
  await env.DB.prepare(
    `INSERT INTO photos (id, project_id, activity_id, report_date, caption, mime, data, submitted_by, created_at, file_key, size)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, pid, str(b.activity_id, 60), date(b.report_date) || today(), str(b.caption, 300),
    put.mime, '', whoName || str(b.submitted_by, 80) || 'site', nowISO(), put.key, put.size
  ).run();
  return json({ ok: true, id });
}

async function servePhoto(env, pid, id) {
  await ensurePhotoColumns(env);
  const row = await env.DB.prepare('SELECT mime, data, file_key FROM photos WHERE id = ? AND project_id = ?')
    .bind(id, pid).first();
  if (!row) return new Response('not found', { status: 404 });
  const ph = await photoBytes(env, row);
  if (!ph) return new Response('that photo is not in the file store', { status: 404 });
  return new Response(ph.bytes, {
    headers: { 'Content-Type': ph.mime || 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
}

// A drawing comes back inline rather than as a download: a man on a slab wants
// to look at it, not save it. A superseded sheet is still served — it has to be,
// for the record — but it is not reachable from any activity, only from the
// register, where it is stamped.
// HOW A FILE SOMEBODY UPLOADED IS SERVED BACK.
//
// THE BUG THIS CLOSES: a drawing or a library document was served inline with
// whatever type its uploader declared. An "drawing" sent as text/html came back
// as a web page on the platform's own address, and its script ran as whoever
// opened it — the AETRAA Admin included. Now only a PDF or a picture may open
// in the browser; anything else is a plain download, never sniffed, and even
// what does open is sandboxed except a PDF (the browser's viewer needs it).
const INLINE_OK = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']);
function uploadedFileHeaders(mime, filename, inlineWanted) {
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  const inline = inlineWanted && INLINE_OK.has(m);
  const safeName = String(filename || 'file').replace(/["\\\r\n]/g, '_');
  const h = {
    'Content-Type': inline ? m : 'application/octet-stream',
    'Content-Disposition': (inline ? 'inline' : 'attachment') + '; filename="' + safeName + '"',
    'X-Content-Type-Options': 'nosniff',
  };
  if (m !== 'application/pdf') h['Content-Security-Policy'] = "default-src 'none'; img-src 'self'; sandbox";
  return h;
}

async function serveDrawing(env, pid, id) {
  let row;
  try {
    row = await env.DB.prepare(
      'SELECT number, revision, mime, data, url, r2_key FROM drawings WHERE project_id = ? AND id = ?'
    ).bind(pid, String(id)).first();
  } catch (err) {
    return new Response('The drawing register is not set up on this database yet.', { status: 404 });
  }
  if (!row) return new Response('not found', { status: 404 });

  const mime = row.mime || 'application/pdf';
  const ext = mime === 'application/pdf' ? 'pdf' : (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '');
  const name = `${row.number}${row.revision ? ' Rev ' + row.revision : ''}`.replace(/[^\w .-]+/g, '-');
  const headers = { ...uploadedFileHeaders(mime, name + '.' + ext, true), 'Cache-Control': 'private, max-age=86400' };

  // The real set lives in the file store. The register row names the key; where
  // the bytes actually are — R2 here, Oracle's object storage after the move —
  // is the store's business and changes by configuration, not by code.
  if (row.r2_key) {
    const f = await getFile(env, row.r2_key);
    if (!f) return new Response('that drawing is not in the file store', { status: 404 });
    return new Response(f.bytes, { headers });
  }

  if (!row.data) {
    if (row.url) return Response.redirect(row.url, 302);
    return new Response('that drawing has no file against it', { status: 404 });
  }
  const bin = Uint8Array.from(atob(row.data.slice(row.data.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  return new Response(bin, { headers });
}

/* ------------------------------------------------ the programme, computed */

// Everything the engine needs, in three queries. The logic is a few thousand
// rows and D1 is single-threaded, so it is read in bulk and never per activity.
async function loadSchedule(env, pid) {
  let acts, links, cals, project;
  try {
    project = await getProject(env, pid);
    const a = await env.DB.prepare(
      `SELECT id, name, wbs, trade, trade_group, floor, calendar_id, act_type, status,
              orig_minutes, remain_minutes, phys_pct, actual_start, actual_finish,
              constraint_type, constraint_date, planned_start, planned_finish
         FROM activities WHERE project_id = ? AND COALESCE(level,1) >= 1`
    ).bind(pid).all();
    acts = a.results || [];
    const l = await env.DB.prepare(
      'SELECT from_id AS "from", to_id AS "to", type, lag_minutes FROM links WHERE project_id = ?'
    ).bind(pid).all();
    links = l.results || [];
    const c = await env.DB.prepare(
      'SELECT id, name, day_minutes, data FROM calendars WHERE project_id = ?'
    ).bind(pid).all();
    cals = c.results || [];
  } catch (err) {
    return { error: 'The programme logic is not set up on this database yet — ' +
                    'run upgrade-logic.sh.', migrated: false };
  }
  if (!links.length) {
    return { error: 'No logic has been imported for this project yet. Until it is, ' +
                    'the app can say an activity is late but not what that does to ' +
                    'the end of the job.', migrated: true, no_logic: true };
  }

  const calendars = {};
  for (const c of cals) calendars[c.id] = unpackCal(c.data, c.id);

  const byId = {};
  for (const a of acts) byId[a.id] = a;

  return {
    project, byId, acts,
    input: {
      // "2026-09-01 07:00" is not an ISO string, and Date.parse quietly returns
      // NaN for it, which turns every comparison in the forward pass false and
      // produces a date that looks plausible and is months wrong.
      data_date: parseCalDate(project && project.data_date),
      default_calendar: project && project.default_calendar,
      retained_logic: !project || project.retained_logic !== 0,
      float_against: parseCalDate(project && project.contract_finish),
      calendars,
      activities: acts.map((a) => ({
        id: a.id,
        calendar_id: a.calendar_id,
        act_type: a.act_type,
        status: a.status || 'not_started',
        orig_minutes: a.orig_minutes || 0,
        remain_minutes: a.remain_minutes === null ? a.orig_minutes : a.remain_minutes,
        actual_start: parseCalDate(a.actual_start),
        actual_finish: parseCalDate(a.actual_finish),
        constraint: a.constraint_type,
        constraint_date: parseCalDate(a.constraint_date),
      })),
      links,
    },
  };
}

const day10 = (t) => (t ? new Date(t).toISOString().slice(0, 10) : null);

// The three sentences somebody actually wants: when it now finishes, how that
// compares with the contract, and what is holding it.
function scheduleSummary(model) {
  const r = runCPM(model.input);
  const contract = model.input.float_against;
  const cal = Object.values(model.input.calendars)[0] || null;
  const over = contract ? between(cal || { empty: true }, contract, r.finish) : null;

  const name = (id) => (model.byId[id] ? model.byId[id].name : id);
  const driving = r.driving.map((id) => {
    const row = r.byActivity[id], a = model.byId[id] || {};
    return {
      id, name: a.name || id, trade: a.trade || '', floor: a.floor || '',
      status: row.status,
      start: day10(row.early_start), finish: day10(row.early_finish),
      float_days: row.float_days,
      driven_by: row.driven_by ? { id: row.driven_by.id, name: name(row.driven_by.id),
                                   type: row.driven_by.type } : null,
    };
  });

  const late = r.rows.filter((x) => x.status !== 'complete' && x.float_days !== null
    && x.float_days < 0).length;

  return {
    migrated: true,
    data_date: day10(r.data_date),
    contract_finish: day10(contract),
    forecast_finish: day10(r.finish),
    // Reported in working days, because that is what a recovery is bought in.
    over_contract_days: over === null ? null : Math.round(over / ((cal && cal.day_minutes) || 480)),
    finish_activity: r.finish_activity,
    finish_activity_name: name(r.finish_activity),
    driving,
    activities: r.rows.length,
    links: model.input.links.length,
    behind_activities: late,
    cycles: r.cycles.slice(0, 20),
    // A schedule with loops in its logic cannot be forecast, and the honest
    // answer is to say so rather than to publish a date anyway.
    trustworthy: r.cycles.length === 0,
  };
}

function dressImpact(out, model) {
  const name = (id) => (model.byId[id] ? model.byId[id].name : id);
  return {
    ...out,
    activity_name: name(out.activity),
    finish_before: day10(out.finish_before),
    finish_after: day10(out.finish_after),
    path: (out.path || []).slice(0, 40).map((p) => ({
      id: p.id, name: name(p.id), finish: day10(p.finish),
    })),
  };
}

async function postImport(req, env, pid) {
  const b = await req.json();
  const rows = parseDelimited(String(b.text || ''));
  if (rows.length < 2) return json({ error: 'need a header row and at least one activity' }, 400);

  const map = headerMap(rows[0], ACT_ALIASES);
  if (map.name === undefined) {
    return json({ error: 'could not find an activity-name column (try a header called "Activity" or "Name")' }, 400);
  }

  const seen = new Set();
  const stmts = [];
  if (b.replace) stmts.push(env.DB.prepare('DELETE FROM activities WHERE project_id = ?').bind(pid));

  let order = 0, skipped = 0;
  for (const r of rows.slice(1)) {
    const get = (f) => (map[f] === undefined ? '' : (r[map[f]] ?? '').trim());
    const name = get('name');
    if (!name) { skipped++; continue; }
    let id = get('id') || `A${String(++order).padStart(4, '0')}`;
    while (seen.has(id)) id = `${id}_`;
    seen.add(id);
    order++;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO activities
           (project_id, id, wbs, name, level, planned_start, planned_finish, weight,
            trade, trade_group, floor, discipline, phase, responsible, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(project_id, id) DO UPDATE SET
           wbs=excluded.wbs, name=excluded.name, level=excluded.level,
           planned_start=excluded.planned_start, planned_finish=excluded.planned_finish,
           weight=excluded.weight, trade=excluded.trade, trade_group=excluded.trade_group,
           floor=excluded.floor, discipline=excluded.discipline, phase=excluded.phase,
           responsible=excluded.responsible, sort_order=excluded.sort_order`
      ).bind(
        pid, id, get('wbs') || null, name,
        num(get('level')) === null ? 1 : Math.max(0, Math.round(num(get('level')))),
        normaliseDate(get('planned_start')), normaliseDate(get('planned_finish')),
        num(get('weight')), get('trade') || null, get('trade_group') || null,
        get('floor') || null, get('discipline') || null, get('phase') || null,
        get('responsible') || null, order
      )
    );
  }
  if (!stmts.length) return json({ error: 'no usable rows found' }, 400);
  for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));
  return json({ ok: true, imported: stmts.length - (b.replace ? 1 : 0), skipped });
}

const PROGRESS_ALIASES = {
  id: ['id', 'activity id', 'activity_id', 'code', 'ref'],
  report_date: ['report date', 'report_date', 'date', 'data date'],
  pct: ['%', 'pct', 'percent', '% complete', 'complete', 'progress'],
  actual_start: ['actual start', 'actual_start', 'act start'],
  actual_finish: ['actual finish', 'actual_finish', 'act finish'],
  status: ['status'],
  remarks: ['remarks', 'comment', 'note'],
};

async function postImportProgress(req, env, pid) {
  const b = await req.json();
  const rows = parseDelimited(String(b.text || ''));
  if (rows.length < 2) return json({ error: 'need a header row and at least one row' }, 400);
  const map = headerMap(rows[0], PROGRESS_ALIASES);
  if (map.id === undefined) return json({ error: 'could not find an activity ID column' }, 400);

  const by = str(b.submitted_by, 80) || 'programme import';
  const stamp = nowISO();
  const stmts = [];
  if (b.replace) stmts.push(env.DB.prepare("DELETE FROM updates WHERE project_id = ? AND source = 'import'").bind(pid));

  let skipped = 0;
  for (const r of rows.slice(1)) {
    const get = (f) => (map[f] === undefined ? '' : (r[map[f]] ?? '').trim());
    const id = get('id');
    if (!id) { skipped++; continue; }
    const pct = num(get('pct'));
    stmts.push(
      env.DB.prepare(
        `INSERT INTO updates
           (project_id, activity_id, report_date, pct, actual_start, actual_finish, status,
            delay_reason, remarks, submitted_by, source, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,'import',?)`
      ).bind(
        pid, id, normaliseDate(get('report_date')) || today(),
        pct === null ? null : Math.max(0, Math.min(100, pct)),
        normaliseDate(get('actual_start')), normaliseDate(get('actual_finish')),
        STATUSES.includes(get('status')) ? get('status') : null,
        null, str(get('remarks'), 2000) || null, by, stamp
      )
    );
  }
  if (!stmts.length) return json({ error: 'no usable rows found' }, 400);
  for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));
  return json({ ok: true, imported: stmts.length - (b.replace ? 1 : 0), skipped });
}

const TARGET_ALIASES = {
  id: ['id', 'activity id', 'activity_id', 'code', 'ref'],
  target_group: ['target group', 'group', 'trade', 'section', 'sheet'],
  work: ['work', 'work to be done', 'activity', 'description', 'name'],
  level: ['level', 'floor', 'area'],
  days_left: ['days left', 'days of work left', 'days', 'duration'],
  target_start: ['start', 'target start'],
  target_finish: ['finish by', 'finish', 'target finish', 'due', 'deadline'],
  sort_order: ['order', 'sort', 'seq'],
};

async function postImportTargets(req, env, pid) {
  const b = await req.json();
  const rows = parseDelimited(String(b.text || ''));
  if (rows.length < 2) return json({ error: 'need a header row and at least one row' }, 400);
  const map = headerMap(rows[0], TARGET_ALIASES);
  if (map.id === undefined) return json({ error: 'could not find an activity ID column' }, 400);

  const stmts = [env.DB.prepare('DELETE FROM targets WHERE project_id = ?').bind(pid)];
  let order = 0, skipped = 0;
  for (const r of rows.slice(1)) {
    const get = (f) => (map[f] === undefined ? '' : (r[map[f]] ?? '').trim());
    const id = get('id');
    if (!id) { skipped++; continue; }
    order++;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO targets (project_id, activity_id, target_group, work, level, days_left,
                              target_start, target_finish, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(project_id, activity_id) DO UPDATE SET
           target_group=excluded.target_group, work=excluded.work, level=excluded.level,
           days_left=excluded.days_left, target_start=excluded.target_start,
           target_finish=excluded.target_finish, sort_order=excluded.sort_order`
      ).bind(
        pid, str(id, 60), str(get('target_group'), 120) || null, str(get('work'), 500) || null,
        str(get('level'), 80) || null, num(get('days_left')),
        normaliseDate(get('target_start')), normaliseDate(get('target_finish')),
        num(get('sort_order')) === null ? order : Math.round(num(get('sort_order')))
      )
    );
  }
  if (stmts.length < 2) return json({ error: 'no usable rows found' }, 400);
  for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));

  const matched = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM targets t JOIN activities a
       ON a.project_id = t.project_id AND a.id = t.activity_id WHERE t.project_id = ?`
  ).bind(pid).first();

  if (b.target_name !== undefined || b.target_deadline !== undefined) {
    await env.DB.prepare('UPDATE projects SET target_name = ?, target_deadline = ? WHERE id = ?')
      .bind(str(b.target_name, 200) || null, normaliseDate(b.target_deadline), pid).run();
  }
  return json({ ok: true, imported: stmts.length - 1, matched: matched ? matched.n : 0, skipped });
}

async function exportCSV(env, pid) {
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.wbs, a.name, a.level, a.planned_start, a.planned_finish,
            a.trade, a.trade_group, a.floor, a.discipline, a.phase, a.responsible,
            t.target_finish, t.target_group,
            u.report_date, u.pct, u.actual_start, u.actual_finish, u.status, u.delay_reason,
            u.remarks, u.submitted_by
       FROM activities a
       LEFT JOIN updates u ON u.project_id = a.project_id AND u.id =
            (SELECT MAX(id) FROM updates WHERE project_id = a.project_id AND activity_id = a.id)
       LEFT JOIN targets t ON t.project_id = a.project_id AND t.activity_id = a.id
      WHERE a.project_id = ?
      ORDER BY COALESCE(a.sort_order, 999999)`
  ).bind(pid).all();
  const cols = ['id','wbs','name','level','planned_start','planned_finish','trade','trade_group',
                'floor','discipline','phase','responsible','target_finish','target_group',
                'report_date','pct','actual_start','actual_finish','status','delay_reason','remarks','submitted_by'];
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [cols.join(','), ...(results || []).map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${pid}-progress-${today()}.csv"`,
    },
  });
}

/* --------------------------------------------------------------- issues */

// The register, with the activities it points at, so the page can name them
// without a second round trip.
async function issuesPayload(env, pid, url) {
  const issues = await listIssues(env, pid, {
    status: url.searchParams.get('status') || null,
    type: url.searchParams.get('type') || null,
    open: url.searchParams.get('open') === '1',
    activity_id: url.searchParams.get('activity') || null,
  });
  const ids = [...new Set(issues.map((i) => i.activity_id).filter(Boolean))].slice(0, 400);
  const activities = {};
  for (const slice of chunked(ids)) {
    const { results } = await env.DB.prepare(
      `SELECT id, name, planned_start, planned_finish, trade, floor FROM activities
        WHERE project_id = ? AND id IN (${slice.map(() => '?').join(',')})`
    ).bind(pid, ...slice).all();
    for (const a of results || []) activities[a.id] = a;
  }

  // The summary counts the whole register, not the filtered view — otherwise the
  // tiles would change meaning every time you changed a filter.
  const all = await listIssues(env, pid, { limit: 1000 });
  const open = all.filter((i) => i.open);
  const summary = {
    total: all.length,
    draft: all.filter((i) => i.status === 'draft').length,
    issued: all.filter((i) => i.status === 'issued').length,
    answered: all.filter((i) => i.status === 'answered').length,
    closed: all.filter((i) => i.status === 'closed').length,
    overdue: all.filter((i) => i.overdue).length,
    oldest_open: open.length ? Math.max(...open.map((i) => i.age || 0)) : null,
    impact_days: Math.round(open.reduce((s, i) => s + (i.impact_days || 0), 0) * 10) / 10 || null,
  };
  return { types: ISSUE_TYPES, issues, activities, summary };
}

/* ---------------------------------------------------------------- email */

// Recipients are stored as free text so you can paste a list in; anything that
// isn't an address is quietly dropped rather than failing the whole send.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const parseRecipients = (raw) =>
  String(raw || '').split(/[\s,;]+/).map((s) => s.trim()).filter((s) => EMAIL_RE.test(s)).slice(0, 30);

// ONE DOOR, TWO DRIVERS — the same arrangement as storage.js.
//
//   azure     ACS_ENDPOINT + ACS_KEY (or ACS_CONNECTION_STRING)
//   resend    RESEND_KEY
//   none      neither is set: the app never emails, and everything else carries on
//
// Azure wins when both are set, because a platform already running in the
// customer's own Azure tenant should not be posting its sign-in codes through a
// second vendor nobody reviewed. Switching provider is a config line, not a
// rewrite, and nothing above sendEmail() knows which driver ran.
const FROM_DEFAULT = 'Site Progress <onboarding@resend.dev>';

export function emailDriver(env) {
  if (acsConfig(env)) return 'azure';
  if (env && env.RESEND_KEY) return 'resend';
  return 'none';
}

const EMAIL_DRIVER_LABEL = {
  azure: 'Azure Communication Services',
  resend: 'Resend',
  none: 'not configured',
};

// What the app can say about its own email without being signed in anywhere.
// The key itself never leaves the server; only whether there is one.
function emailStatus(env) {
  const driver = emailDriver(env);
  // Resend's shared sender is a sensible default only for Resend. On Azure
  // there is no shared sender at all, so falling back to it would guarantee a
  // refusal — better to report the sender as unset and say so.
  const from = env.REPORT_FROM || (driver === 'resend' ? FROM_DEFAULT : '');
  return {
    driver,
    driver_label: EMAIL_DRIVER_LABEL[driver],
    key: driver !== 'none',
    from,
    // Resend's shared sender only ever delivers to the address the Resend
    // account was opened with. Everything else is accepted by the form and
    // refused by Resend — which looks exactly like a code that never arrives.
    test_sender: driver === 'resend' && /onboarding@resend\.dev/.test(from),
    // Azure will not send until the sender's domain is provisioned on the Email
    // Communication Service AND linked to this resource.
    sender_set: !!from,
  };
}

// P1 step 2a: tell the AETRAA Admin that documents were parked, and warn when
// this tenant has had TENANT_WARN_AT or more parked in the last 90 days.
const escapeHtml = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/* THE WORDS OF A CONTRACT, PAGE BY PAGE.
 *
 * The terms used to be read from the probe's sample of the raw PDF bytes. Most
 * PDFs compress their text, so on a real contract that sample was empty and the
 * panel said nothing could be read; and each whole FILE was passed as one
 * "page", so the page shown beside a figure was really the file's position.
 *
 * A PDF is now read with pdf.js, one string per page. A Word contract has no
 * pages, so it is one entry and its hits carry no page number rather than a
 * wrong one. `labels` maps each entry back to its document and its own page. */
async function contractPages(env, docs) {
  const pages = [], labels = [], used = [];
  for (const d of docs) {
    const f = await getFile(env, d.file_key).catch(() => null);
    if (!f || !f.bytes) continue;
    const name = d.title || d.filename;
    const isPdf = /\.pdf$/i.test(String(d.filename || d.title || ''));
    let got = isPdf ? await pdfPages(f.bytes, { pages: 400 }) : [];
    if (!got.some((t) => t)) {
      const pr = probeFile(d.filename || d.title, f.bytes);
      got = pr && pr.text ? [pr.text] : [];
      got.forEach(() => labels.push({ document: name, page: null }));
    } else {
      got.forEach((t, i) => labels.push({ document: name, page: i + 1 }));
    }
    if (got.length) { pages.push(...got); used.push(name); }
  }
  return { text: pages.join('\n'), pages, labels, used };
}

// pageOf() counts across every document read; put each page back on its own
// document so "page 47" means page 47 of the contract that says it.
function onOwnPages(list, labels, many) {
  const fix = (o) => {
    if (!o || o.page == null) return o;
    const l = labels[o.page - 1];
    return { ...o, page: l ? l.page : null, ...(many && l ? { document: l.document } : {}) };
  };
  if (list && !Array.isArray(list)) {                 // proposeParties: { party: {...} }
    const out = {};
    for (const k of Object.keys(list)) out[k] = fix(list[k]);
    return out;
  }
  return (list || []).map((p) => ({ ...fix(p), ...(p.options ? { options: p.options.map(fix) } : {}) }));
}

/* X1: THE HEADER EVERY DOWNLOADED SCHEDULE, LOG AND TRACKER STARTS WITH.
 *
 * Built once here from the project row, so every workbook carries the same
 * lines: company logo, project, ref / plot, client, consultant, contractor,
 * contract no., title, as-at date and time (UAE), data date for dated
 * schedules, and who downloaded it. */
export async function xlsHeader(env, proj, who, title, opts = {}) {
  const p = proj || {};
  await ensureGateColumns(env).catch(() => {});
  let row = p;
  try { row = (await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(p.id).first()) || p; } catch (e) { /* use what we have */ }
  const fromData = (u) => {
    const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(String(u || ''));
    return m ? { ext: /png/i.test(m[1]) ? 'png' : 'jpeg', data: b64ToBytes(m[2]) } : null;
  };
  let logo = null;
  try {
    const org = row.org_id ? await env.DB.prepare('SELECT logo FROM orgs WHERE id = ?').bind(row.org_id).first() : null;
    logo = fromData(org && org.logo) || fromData(row.logo_contractor);
  } catch (e) { logo = fromData(row.logo_contractor); }
  const now = new Date(Date.now() + 4 * 3600000).toISOString();
  return {
    title, project: row.name, ref: row.ref,
    plot: String(row.plot_numbers || '').split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean).join(', '),
    client: row.client_name, consultant: row.engineer_name, contractor: row.contractor_name,
    contract_no: row.contract_no || row.contract_ref,
    as_at: now.slice(0, 10) + ' ' + now.slice(11, 16) + ' (UAE)',
    dated: !!opts.dated, data_date: row.data_date ? String(row.data_date).slice(0, 10) : '',
    downloaded_by: who || '', logo,
  };
}

const todayUAEString = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);

// opts (K7, S0 step 4 — issuing to the consultant):
//   cc: [addresses]   attachments: [{ filename, contentType, bytes }]
//   fromName: shown as the sender's name ("Dana — DC, via AETRAA")
//   replyTo: where the consultant's reply goes (Document Control's own address)
async function sendEmail(env, to, subject, htmlBody, opts = {}) {
  const driver = emailDriver(env);
  if (driver === 'none') {
    return { ok: false, error: 'no email key set', reason: 'no-key' };
  }
  // .invalid can never receive mail (RFC 2606) — the test drive's people live there.
  const real = (list) => (Array.isArray(list) ? list : list ? [list] : []).filter((a) => a && !/\.invalid>?\s*$/i.test(String(a || '')));
  to = real(to);
  const cc = real(opts.cc);
  if (!to.length) return { ok: false, error: 'no recipients', reason: 'no-recipients' };
  const atts = (opts.attachments || []).filter((a) => a && a.bytes && a.bytes.length);

  if (driver === 'azure') {
    const from = env.REPORT_FROM || '';
    if (!from) {
      return { ok: false, reason: 'no-sender',
        error: 'Azure email is configured but no sender address is set' };
    }
    return sendViaAzure(env, to, subject, htmlBody, from, { cc, attachments: atts, replyTo: opts.replyTo, fromName: opts.fromName });
  }

  const fromAddr = env.REPORT_FROM || FROM_DEFAULT;
  const bare = (String(fromAddr).match(/<([^>]+)>/) || [null, fromAddr])[1];
  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: opts.fromName ? String(opts.fromName).replace(/[<>"]/g, '') + ' <' + bare + '>' : fromAddr,
        to,
        ...(cc.length ? { cc } : {}),
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
        subject,
        html: htmlBody,
        ...(atts.length ? { attachments: atts.map((a) => ({ filename: a.filename, content: bytesToB64(a.bytes), content_type: a.contentType })) } : {}),
      }),
    });
  } catch (err) {
    console.log('email: could not reach Resend —', String((err && err.message) || err));
    return { ok: false, error: 'could not reach the email service', reason: 'network' };
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    // Printed so the server log shows the real reason. Resend's refusals are
    // specific and useful — an unverified domain, a sender that may only write to
    // one address — and swallowing them is what turns this into a mystery.
    console.log(`email: Resend refused ${res.status} — ${body}`);
    return { ok: false, status: res.status, error: `${res.status} ${body}`, reason: 'resend' };
  }
  return { ok: true, driver: 'resend' };
}

// The provider's own words, turned into something a person can act on. Each
// driver gets its own advice, because "set the key again" is useless when the
// real problem is a domain that was never linked to the Azure resource.
function emailAdvice(sent, env) {
  const st = emailStatus(env);

  if (sent.reason === 'no-key') {
    return 'No email is set up on this server, so it cannot send anything. ' +
           'For Azure: sudo aetraa-config ACS_CONNECTION_STRING "endpoint=...;accesskey=..." ' +
           'and sudo aetraa-config REPORT_FROM "AETRAA <no-reply@your-domain>".';
  }
  if (sent.reason === 'network') return 'The email service could not be reached. Try again in a minute.';
  if (sent.reason === 'no-recipients') return 'There was nobody to send it to.';

  if (sent.reason === 'no-sender') {
    return 'Azure email is configured but no sender address is set. Azure has no shared sender, ' +
           'so one must be given: sudo aetraa-config REPORT_FROM "AETRAA <no-reply@your-domain>" ' +
           '— using an address on a domain provisioned in your Email Communication Service.';
  }
  if (sent.reason === 'azure-key') {
    // This advice used to say "set ACS_CONNECTION_STRING instead", which was a
    // dead end: acsConfig() only falls back to the connection string when the
    // endpoint or key is MISSING, so a key that is present but wrong shadows it
    // and nothing changes. Name the setting actually in the way.
    return 'The Azure access key is not in the form Azure issues — it should be a long ' +
           'base64 string, not a connection string and not a placeholder. Copy the Key ' +
           '(not the Connection string) from the Communication Service → Keys blade: ' +
           'sudo aetraa-config ACS_KEY "the-key". If you would rather use the connection ' +
           'string, clear the key first: sudo aetraa-config ACS_KEY "" then ' +
           'sudo aetraa-config ACS_CONNECTION_STRING "endpoint=...;accesskey=..."';
  }

  const body = String(sent.error || '');

  if (sent.reason === 'azure') {
    if (sent.status === 401) {
      return 'Azure refused the key. Copy the connection string again from the Communication ' +
             'Service → Keys blade: sudo aetraa-config ACS_CONNECTION_STRING "endpoint=...;accesskey=..."';
    }
    if (sent.status === 403) {
      return `Azure refused the sender "${st.from}". The domain must be provisioned in an Email ` +
             'Communication Service (its DNS records verified) AND that domain connected to this ' +
             'Communication Service under Email → Domains.';
    }
    if (sent.status === 400) {
      if (/senderAddress|DomainNotLinked|sender/i.test(body)) {
        return `Azure would not accept the sender "${st.from}". It must be an address on a domain ` +
               'connected to this Communication Service, written as  Name <address@domain>.';
      }
      return 'Azure rejected the message: ' + body;
    }
    if (sent.status === 429) {
      return 'Azure is rate-limiting. New email resources start on a low sending quota — raise it ' +
             'through a support request in the portal before onboarding a company.';
    }
    return body || 'The email did not go.';
  }

  if (sent.status === 401 || sent.status === 403) {
    if (/testing emails to your own/i.test(body) || (st.test_sender && /403/.test(body))) {
      return 'Resend refused it: the shared sender onboarding@resend.dev may only write to the ' +
             'address your Resend account was opened with. Verify your own domain at resend.com ' +
             'and set the sender: sudo aetraa-config REPORT_FROM "AETRAA <no-reply@aetraa.ae>"';
    }
    if (/domain is not verified|not verified/i.test(body)) {
      return `Resend refused it: the domain in "${st.from}" is not verified on your Resend account. ` +
             'Verify it at resend.com → Domains, or switch the sender back to onboarding@resend.dev.';
    }
    return 'Resend refused the key. Set it again: sudo aetraa-config RESEND_KEY <key>';
  }
  if (sent.status === 422) {
    return `Resend would not accept the sender "${st.from}". It must be a verified domain, ` +
           'written as  Name <address@domain>.';
  }
  if (sent.status === 429) return 'Resend is rate-limiting. Wait a minute and try again.';
  return body || 'The email did not go.';
}

async function emailReport(env, pid, kind, key) {
  const project = await getProject(env, pid);
  if (!project) return { ok: false, error: 'unknown project' };
  const to = parseRecipients(project.report_emails);
  if (!to.length) return { ok: false, error: 'no recipients set for this project' };
  const d = await buildReport(env, pid, project, kind, key);
  const sent = await sendEmail(env, to, reportSubject(d), reportDocument(d));
  return sent.ok ? { ok: true, sent: to.length } : sent;
}

/* IS THE PROGRAMME CURRENT?
 *
 * The weekly update is a manual loop — progress out to P6, the updated .xer
 * back in — and nothing noticed when a week was skipped. The forecast finish on
 * every dashboard and every report is read from the programme, so a stale one
 * is not a missing feature: it is every date on the platform quietly drifting.
 *
 * "Current" is judged on the DATA DATE, the date the programme was statused
 * to, because that is what the dates on screen are true as of. A weekly update
 * puts it within a week of today; allowing the working days an update takes,
 * more than ten days old is stale. Where no data date was ever recorded, the
 * last upload stands in for it. */
export const STALE_AFTER_DAYS = 10;
export async function programmeFreshness(env, proj) {
  const out = { activities: 0, data_date: null, days_old: null, stale: false, last: null,
                logic: null, no_logic: false };
  if (!proj) return out;
  try {
    const n = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM activities WHERE project_id = ? AND COALESCE(source,'programme') <> 'derived'"
    ).bind(proj.id).first();
    out.activities = Number((n && n.n) || 0);
  } catch (e) { /* no programme table yet */ }

  /* A PROGRAMME WITH NO LOGIC IS NOT A PROGRAMME.
   *
   * Without predecessors and successors there is no critical path, so every
   * forecast is a straight read of the planned dates and nothing moves when
   * something slips. A .xer loaded through a folder drop used to arrive in
   * exactly this state and looked completely normal — the right number of
   * activities, on the right dates.
   *
   * This is a different fault from a programme that is merely overdue, and
   * saying "out of date" about it would send somebody to re-run an update that
   * cannot fix it. So it is counted and named separately. */
  if (out.activities) {
    try {
      const l = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM links WHERE project_id = ?'
      ).bind(proj.id).first();
      out.logic = Number((l && l.n) || 0);
      out.no_logic = out.logic === 0;
    } catch (e) { out.logic = null; }          // no links table on this database
  }
  try {
    const last = await env.DB.prepare(
      "SELECT who, detail, at FROM audit WHERE project_id = ? AND action IN ('programme.update','programme.import') ORDER BY at DESC LIMIT 1"
    ).bind(proj.id).first();
    if (last) out.last = { who: last.who || '', at: last.at || '', detail: last.detail || '' };
  } catch (e) { /* no audit yet */ }
  out.data_date = proj.data_date || null;
  const basis = out.data_date || (out.last && String(out.last.at).slice(0, 10)) || null;
  if (basis && /^\d{4}-\d{2}-\d{2}/.test(basis)) {
    const ms = Date.now() - Date.parse(String(basis).slice(0, 10) + 'T00:00:00Z');
    out.days_old = Math.max(0, Math.floor(ms / 86400000));
  }
  // A project with no programme is not stale; it has a different problem, and
  // the Overview says that one separately.
  out.stale = out.activities > 0 && (out.days_old == null || out.days_old > STALE_AFTER_DAYS);
  return out;
}

// Runs on the cron trigger. One project at a time, and a failure on one never
// stops the rest — a bad address on project A must not silence project B.
async function runScheduledReports(env) {
  let results;
  try {
    ({ results } = await env.DB.prepare(
      `SELECT id FROM projects
        WHERE COALESCE(archived,0) = 0 AND COALESCE(report_daily,0) = 1
          AND COALESCE(report_emails,'') <> ''`
    ).all());
  } catch (err) {
    // The report columns are not there yet — nothing is set up to email.
    return [{ ok: false, error: 'report settings not migrated: ' + String((err && err.message) || err) }];
  }
  const day = today();
  const out = [];
  for (const row of results || []) {
    try {
      out.push({ project: row.id, ...(await emailReport(env, row.id, 'daily', day)) });
    } catch (err) {
      out.push({ project: row.id, ok: false, error: String((err && err.message) || err) });
    }
  }
  return out;
}

// The weekly send. Same shape as the daily, gated on report_weekly, and keyed on
// yesterday so a Monday-morning run covers the week that has just closed.
async function runScheduledWeekly(env) {
  let results;
  try {
    ({ results } = await env.DB.prepare(
      `SELECT id FROM projects
        WHERE COALESCE(archived,0) = 0 AND COALESCE(report_weekly,0) = 1
          AND COALESCE(report_emails,'') <> ''`
    ).all());
  } catch (err) {
    return [{ ok: false, error: 'weekly report settings not migrated: ' + String((err && err.message) || err) }];
  }
  // Any day inside the week just ended resolves to that Monday–Sunday window.
  const lastWeekDay = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const out = [];
  for (const row of results || []) {
    try {
      out.push({ project: row.id, ...(await emailReport(env, row.id, 'weekly', lastWeekDay)) });
    } catch (err) {
      out.push({ project: row.id, ok: false, error: String((err && err.message) || err) });
    }
  }
  return out;
}

// The monthly send, on the morning of the 1st: the month that has just closed.
let monthlyColOk = false;
async function ensureReportMonthly(env) {
  if (monthlyColOk) return;
  monthlyColOk = await addColumns(env, 'projects', [['report_monthly', 'INTEGER DEFAULT 0']]);
}
async function runScheduledMonthly(env) {
  await ensureReportMonthly(env);
  let results;
  try {
    ({ results } = await env.DB.prepare(
      `SELECT id FROM projects
        WHERE COALESCE(archived,0) = 0 AND COALESCE(report_monthly,0) = 1
          AND COALESCE(report_emails,'') <> ''`
    ).all());
  } catch (err) {
    return [{ ok: false, error: 'monthly report settings not migrated: ' + String((err && err.message) || err) }];
  }
  // Yesterday in the UAE is the last day of the month just closed.
  const lastMonth = new Date(Date.now() + 4 * 3600000 - 86400000).toISOString().slice(0, 7);
  const out = [];
  for (const row of results || []) {
    try {
      out.push({ project: row.id, ...(await emailReport(env, row.id, 'monthly', lastMonth)) });
    } catch (err) {
      out.push({ project: row.id, ok: false, error: String((err && err.message) || err) });
    }
  }
  return out;
}

// STEP 10: every morning, each person on a project that has it switched on gets
// their own "needs your attention" list — only if there is something on it.
let digestColOk = false;
async function ensureReportDigest(env) {
  if (digestColOk) return;
  digestColOk = await addColumns(env, 'projects', [['report_digest', 'INTEGER DEFAULT 0']]);
}
// K11: who is told a certificate is expiring — the project's HSE and PM.
// K13 (A12): what the diary reminders need from the router.
export function diaryReminderDeps(env) {
  return {
    teamOf: (project) => projectTeam(env, project.org_id, project.id),
    modsOf: (project) => getProjectModules(env, project.id),
    mailer: (to, s, h) => sendEmail(env, to, s, h),
    publicUrl: env.PUBLIC_URL || '',
  };
}

export function certAlertPeople(env) {
  return async (project) => ((await projectTeam(env, project.org_id, project.id)) || [])
    .filter((u) => u.email && (u.functions || []).some((f) => f === 'hse' || f === 'pm')).map((u) => u.email);
}

async function runScheduledDigest(env) {
  await ensureReportDigest(env);
  let results;
  try {
    ({ results } = await env.DB.prepare(
      `SELECT id FROM projects WHERE COALESCE(archived,0) = 0 AND COALESCE(report_digest,0) = 1`).all());
  } catch (err) { return [{ ok: false, error: String((err && err.message) || err) }]; }
  const out = [];
  for (const row of results || []) {
    try {
      const project = await getProject(env, row.id);
      const team = await projectTeam(env, project.org_id, row.id);
      let sent = 0;
      for (const u of team) {
        if (!u.email) continue;
        const a = await attentionFor(env, row.id, project, { id: u.id, name: u.name }, u.functions, null);
        if (!a.total) continue;
        const r = await sendEmail(env, [u.email], (project.name || 'Project') + ' — ' + a.total + ' thing' + (a.total === 1 ? '' : 's') +
          ' need' + (a.total === 1 ? 's' : '') + ' you' + (a.overdue ? ' (' + a.overdue + ' overdue)' : ''), attentionEmail(a, project, env.PUBLIC_URL || ''));
        if (r.ok) sent++;
      }
      out.push({ project: row.id, ok: true, sent });
    } catch (err) { out.push({ project: row.id, ok: false, error: String((err && err.message) || err) }); }
  }
  return out;
}

// Who may read and send the progress reports: the office roles, and by function
// the Principal, PM, Planning, Document Control and Commercial.
function mayReport(role, me) {
  if (can.report(role)) return true;
  if (!me) return false;
  const f = userFunctions(me);
  return ['principal', 'pm', 'planning', 'dc', 'commercial', 'hse'].some((x) => f.includes(x));
}

// The importers intake files through — the same code the manual screens
// call, so a fix to an importer fixes both paths at once. Built per request
// (moved here from the commit route for K3, so approving a held intake item
// files it through exactly the same code).
function intakeRoutes(env, proj, who, me, role) {
  return {
  getBytes: async (key) => (key ? await getFile(env, key).then((f) => f && f.bytes).catch(() => null) : null),
  /* A .xer IS NOT A FILE TO BE STORED. IT IS A PROGRAMME TO BE READ.
   *
   * This saved the activities and stopped there — it never called
   * applyLogic. So a programme loaded through a folder drop arrived
   * with its dates and nothing else: no data date, no predecessors or
   * successors, no calendars, no float, and none of P6's actual dates
   * or percentages. No logic means no critical path, which means every
   * forecast on the platform is a straight read of the planned dates.
   *
   * Nothing said so. The programme page showed 1,095 activities and
   * looked loaded. WARQAA is in exactly this state, which is why its
   * data date is blank.
   *
   * The setup route has always done this properly. Both paths now do
   * the same thing, because there is no reason for a .xer to mean two
   * different things depending on which screen it was dropped on. */
  programme: async (ppid, bytes) => {
    if (!bytes) return { error: 'the programme file could not be read back' };
    let tables;
    try { tables = parseXER(decodeXer(bytes)); }
    catch (e) { return { error: 'that .xer could not be read: ' + String(e && e.message || e).slice(0, 120) }; }
    let built;
    try { built = buildProgramme(tables, {}); }
    catch (e) { return { error: 'that .xer could not be read: ' + String(e && e.message || e).slice(0, 120) }; }
    if (built.error) return { error: built.error };
    const saved = await saveProgramme(env, ppid, built.activities || built, {});
    if (saved && saved.error) return saved;
    // The logic, calendars, data date, status and float. Without this
    // the programme is a list of dates, not a programme.
    let logic = null;
    try { logic = await applyLogic(env, ppid, extractLogic(tables)); }
    catch (e) { console.error('programme logic not loaded:', e && e.message); }
    await audit(env, { org_id: proj.org_id, project_id: ppid, who: (me && me.name) || role,
      action: 'programme.import',
      detail: (saved.saved || 0) + ' activities \u00b7 data date ' + (built.dataDate || 'not stated')
        + (logic ? ' \u00b7 ' + logic.links + ' links, ' + logic.calendars + ' calendars'
                 : ' \u00b7 LOGIC DID NOT LOAD') }).catch(() => {});
    return { ...saved, data_date: built.dataDate || null, logic: !!logic,
      // Said out loud rather than left for somebody to notice: a folder
      // drop cannot ask which discipline each WBS branch belongs to, so
      // the activities are on nobody's site screen until it is set.
      where: 'the programme \u2014 ' + (saved.saved || 0) + ' activities, data date '
           + (built.dataDate ? String(built.dataDate).slice(0, 10) : 'not stated')
           + (logic ? ', ' + logic.links + ' links' : ', NO LOGIC')
           + '. Set the WBS disciplines on Documents \u2192 Programme, or the activities '
           + 'appear on no site engineer\u2019s screen' };
  },
  // K1: a priced BOQ or a BOM in a folder drop is read and checked
  // exactly as an upload on /bills is (src/bills.js), every sheet and
  // every row. A clean bill is imported and waits for the PM; a bill
  // with flagged lines waits for the QS on /bills, and nothing of it is
  // imported until each flag is fixed or accepted.
  bill: async (ppid, kind, filename, bytes, ref) => {
    if (!bytes) return { error: 'the workbook could not be read back' };
    const whoB = (me && me.name) || (can.platform(role, me) ? 'AETRAA Admin' : role);
    const st = await stageBill(env, ppid, { kind, source: 'intake', filename, bytes,
      file_key: ref.file_key, batch_id: ref.batch_id, item_id: ref.item_id }, { who: whoB });
    if (st.error) return st;
    const noun = KIND_LABEL[kind];
    if (st.flags_open) {
      return { import_id: st.id, checking: true,
        where: 'the ' + noun + ' check — ' + st.line_count + ' lines read, ' + st.flags_open + ' flagged line'
          + (st.flags_open === 1 ? '' : 's') + ' wait for ' + (kind === 'bom' ? 'Procurement' : 'the QS')
          + ' to fix or accept on BOQ & BOM (/bills); nothing is imported until then' };
    }
    const c = await commitBill(env, ppid, st.id, whoB);
    if (c.error) return c;
    return { import_id: st.id, lines: c.lines,
      where: 'the ' + noun + ' (' + c.lines + ' lines, ' + c.total + '), waiting for the PM’s approval' };
  },
  template: async (ppid, docType, filename, bytes) =>
    bytes ? saveTemplate(env, ppid, docType, filename, bytes, who)
          : { error: 'the template file could not be read back' },
  branding: async (ppid, party, bytes, filename) =>
    bytes ? setBranding(env, ppid, { [party + '_logo']: 'data:image/png;base64,' + bytesToB64(bytes) })
          : { error: 'the logo could not be read back' },
  // K3: an item the AETRAA Admin has just approved is filed past the gate.
  // K9 (A1): what the AI read and DC confirmed travels with the sheet, which
  // then waits for the PM; a scan is marked; the sheet's own date is kept.
  drawing: async (ppid, body, w, o) =>
    saveDrawing(env, ppid, body, (w && w.name) || role,
      { canApprove: can.drawingsApprove(role), project: proj, ...(o && o.gate === false ? { gate: false } : {}),
        aiRead: body.ai_read && typeof body.ai_read === 'object' ? body.ai_read : null, scanned: !!body.scanned, sheetDate: body.sheet_date || null }),
  // G15: CAD files packaged with their sheet, or filed as the sheet.
  cad: async (ppid, item, bytes, fileKey, others) =>
    fileCad(env, ppid, item, bytes, fileKey, others, who.name || role,
      (body) => saveDrawing(env, ppid, body, who.name || role, { canApprove: can.drawingsApprove(role), project: proj })),
};
}

// Create / rename / re-code / archive a project. Owner only.
async function postProject(req, env, isPlatformAdmin) {
  const b = await req.json();
  const action = String(b.action || 'save');

  if (action === 'create') {
    if (!isPlatformAdmin) {
      return json({ error: 'projects are set up by AETRAA, not from inside the app' }, 403);
    }
    const name = str(b.name, 200);
    if (!name) return json({ error: 'a project needs a name' }, 400);
    let id = slug(b.id || name) || 'p';
    const taken = await env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(id).first();
    if (taken) {
      let n = 2;
      while (await env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(id + n).first()) n++;
      id = id + n;
    }
    await env.DB.prepare(
      `INSERT INTO projects (id, name, ref, contract_completion, sort_order, created_at)
       VALUES (?,?,?,?,(SELECT COALESCE(MAX(sort_order),0)+1 FROM projects),?)`
    ).bind(id, name, str(b.ref, 200), date(b.contract_completion), nowISO()).run();
    return json({ ok: true, id });
  }

  const pid = str(b.id, 24);
  if (!pid || !(await getProject(env, pid))) return json({ error: 'unknown project' }, 404);

  if (action === 'archive') {
    await env.DB.prepare('UPDATE projects SET archived = ? WHERE id = ?')
      .bind(b.archived ? 1 : 0, pid).run();
    return json({ ok: true });
  }

  /* CLEARING THE DOCUMENTS, AND DELETING A PROJECT OUTRIGHT.
   *
   * Both are irreversible and both are AETRAA's alone. Two guards stand in front
   * of them, and neither is decoration:
   *
   *   THE NAME MUST BE TYPED. `confirm_name` has to match the project's own name
   *   exactly. An id is four characters of slug and the wrong one is one keypress
   *   away; a name has to be read off the screen deliberately. This is the
   *   pattern GitHub uses before deleting a repository, for the same reason.
   *
   *   THE AUDIT IS WRITTEN FIRST. If the deletion half-completes, the line saying
   *   it was attempted is already there. An append-only record of a destruction
   *   is worth more than a tidy one written afterwards that may never arrive.
   *
   * WHAT SURVIVES A DELETE: the audit. Those lines say the project existed and
   * what happened to it, which is the one thing a deletion must not be able to
   * erase. Everything else that carries the project id goes.
   */
  if (action === 'clear-documents' || action === 'delete') {
    if (!isPlatformAdmin) {
      return json({ error: 'only AETRAA can delete a project or its documents' }, 403);
    }
    const proj = await getProject(env, pid);
    if (String(b.confirm_name || '').trim() !== String(proj.name || '').trim()) {
      return json({ error: 'type the project name exactly as it appears to confirm: ' + (proj.name || '') }, 400);
    }

    const wipe = async (table, where, ...args) => {
      try {
        await env.DB.prepare('DELETE FROM ' + table + ' WHERE ' + where).bind(...args).run();
        return true;
      } catch (e) { return false; }      // a table this deployment never created
    };

    // The documents themselves, and — this is the part that is easy to miss —
    // the intake rows that remember them. Intake recognises a file it has
    // already filed by its sha256 and skips it. Clearing the register without
    // clearing that memory means the re-drop silently files NOTHING, and the
    // operator is left staring at an empty register wondering what he did wrong.
    // project_signoff goes with them: every handover check was taken against
    // documents that are about to stop existing.
    const DOC_TABLES = ['drawings', 'drawing_links', 'library', 'attachments',
                        'intake_item', 'intake_batch', 'quarantine', 'project_signoff'];
    const cleared = [];
    for (const t of DOC_TABLES) {
      if (await wipe(t, 'project_id = ?', pid)) cleared.push(t);
    }
    // K2: the stored files go with their rows. Until now they were left in the
    // file store (and in PostgreSQL's files table) with nothing pointing at
    // them — invisible, counted against the database, and never deleted.
    const DOC_AREAS = ['drawings', 'library', 'attachments', 'intake'];
    const gone = await deleteProjectFiles(env, pid, action === 'delete' ? DOC_AREAS.concat(['photos', 'templates', 'bills']) : DOC_AREAS);

    if (action === 'clear-documents') {
      await audit(env, { org_id: proj.org_id, project_id: pid, who: 'AETRAA Admin',
        action: 'project.documents.cleared',
        detail: (proj.name || pid) + ' — drawings, library and intake history removed, ' + gone.deleted + ' stored files deleted' });
      return json({ ok: true, cleared, files_deleted: gone.deleted, kept: 'the project, its terms, BOQ, programme, gate and branding' });
    }

    // A full delete takes everything else the project id reaches, then the row.
    const REST = ['activities', 'updates', 'manpower', 'photos', 'targets', 'issues',
                  'access_codes', 'verifications', 'day_review', 'diary', 'links',
                  'calendars', 'rates', 'actions', 'ai_usage', 'bom', 'bom_moves', 'boq',
                  'hse_log', 'ipc', 'meetings', 'notifications', 'records', 'templates',
                  'project_roles', 'project_workflow', 'bill_imports', 'bom_links'];
    for (const t of REST) {
      if (await wipe(t, 'project_id = ?', pid)) cleared.push(t);
    }
    // People are scoped to a project by a list on the user, not a column, so
    // they are left alone: a person may sit on more than one project, and
    // deleting one must not remove them from the other.
    await audit(env, { org_id: proj.org_id, project_id: pid, who: 'AETRAA Admin',
      action: 'project.deleted', detail: (proj.name || pid) + ' deleted outright' });
    await wipe('projects', 'id = ?', pid);
    return json({ ok: true, deleted: pid, cleared, files_deleted: gone.deleted });
  }

  if (action === 'proof') {
    await env.DB.prepare('UPDATE projects SET proof_at_100 = ? WHERE id = ?')
      .bind(b.proof_at_100 ? 1 : 0, pid).run();
    return json({ ok: true });
  }

  if (action === 'logos') {
    const img = (v) => {
      const s = String(v || '');
      if (!s.startsWith('data:image/')) return null;
      if (s.length > 400_000) return null;       // already shrunk in the browser
      return s;
    };
    await env.DB.prepare(
      'UPDATE projects SET logo_consultant = ?, logo_consultant2 = ?, logo_contractor = ? WHERE id = ?'
    ).bind(
      b.clear ? null : img(b.logo_consultant),
      b.clear ? null : img(b.logo_consultant2),
      b.clear ? null : img(b.logo_contractor),
      pid
    ).run();
    return json({ ok: true });
  }

  // P1 step 2a: what identifies this project to the project check (gate.js).
  if (action === 'identity') {
    await ensureGateColumns(env);
    const list = (v) => String(v == null ? '' : v).split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean).slice(0, 20);
    await env.DB.prepare(
      `UPDATE projects SET plot_numbers = ?, contract_no = ?, programme_ids = ?, aliases = ? WHERE id = ?`
    ).bind(
      list(b.plot_numbers).join(', ') || null, list(b.contract_no).join(', ') || null,
      list(b.programme_ids).join(', ') || null,
      list(b.aliases).length ? JSON.stringify(list(b.aliases).map((x) => x.slice(0, 80))) : null, pid
    ).run();
    return json({ ok: true });
  }

  if (action === 'letter') {
    const days = num(b.reply_days);
    await env.DB.prepare(
      `UPDATE projects SET engineer_name = ?, contractor_name = ?, notice_clause = ?, reply_days = ?
        WHERE id = ?`
    ).bind(
      str(b.engineer_name, 200), str(b.contractor_name, 200), str(b.notice_clause, 120),
      days === null ? null : Math.max(1, Math.min(60, Math.round(days))), pid
    ).run();
    return json({ ok: true });
  }

  // The project's material list. Fixing the unit with the material is the whole
  // point: a delivery booked in tonnes against a material measured in cubic
  // metres is worse than no figure at all.
  if (action === 'materials') {
    const list = (Array.isArray(b.materials) ? b.materials : [])
      .map((r) => ({ m: str(r.m, 160) || '', u: str(r.u, 24) || '' }))
      .filter((r) => r.m)
      .slice(0, 300);
    await env.DB.prepare('UPDATE projects SET materials = ?, currency = ? WHERE id = ?')
      .bind(list.length ? JSON.stringify(list) : null,
            str(b.currency, 8) || 'AED', pid).run();
    return json({ ok: true, materials: list.length });
  }

  if (action === 'report') {
    const list = parseRecipients(b.report_emails);
    // report_weekly is added by a later migration; write it only if the column
    // is there, so an un-migrated database still saves the recipients.
    await ensureReportMonthly(env);
    await ensureReportDigest(env);
    try {
      await env.DB.prepare('UPDATE projects SET report_emails = ?, report_daily = ?, report_weekly = ?, report_monthly = ?, report_digest = ? WHERE id = ?')
        .bind(list.join(', ') || null, b.report_daily ? 1 : 0, b.report_weekly ? 1 : 0, b.report_monthly ? 1 : 0, b.report_digest ? 1 : 0, pid).run();
    } catch (err) {
      await env.DB.prepare('UPDATE projects SET report_emails = ?, report_daily = ? WHERE id = ?')
        .bind(list.join(', ') || null, b.report_daily ? 1 : 0, pid).run();
    }
    return json({ ok: true, recipients: list });
  }

  if (action === 'codes') {
    const set = [], vals = [];
    for (const [field, col] of [['manager_code', 'manager_code_hash'],
                                ['site_code', 'site_code_hash'],
                                ['view_code', 'view_code_hash']]) {
      if (b[field] === undefined) continue;
      const code = String(b[field] || '').trim();
      if (code && code.length < 8) return json({ error: 'codes need to be at least 8 characters' }, 400);
      set.push(`${col} = ?`);
      vals.push(code ? await sha256(code) : null);
    }
    if (!set.length) return json({ error: 'no codes given' }, 400);
    await env.DB.prepare(`UPDATE projects SET ${set.join(', ')} WHERE id = ?`).bind(...vals, pid).run();
    return json({ ok: true });
  }

  await env.DB.prepare(
    'UPDATE projects SET name = ?, ref = ?, contract_completion = ?, target_name = ?, target_deadline = ? WHERE id = ?'
  ).bind(
    str(b.name, 200) || 'Project', str(b.ref, 200), date(b.contract_completion),
    str(b.target_name, 200), date(b.target_deadline), pid
  ).run();
  return json({ ok: true });
}


/* What a project needs next, named as the screen that does it.
 *
 * The order is the order the work actually has to happen in: nobody can be
 * given a role before there are roles, no document can be routed before
 * somebody is there to route it to, and no screen can be checked before it has
 * anything on it. So this returns the FIRST thing outstanding, not a list. */
function nextStep(proj, people, docs, checks) {
  if ((proj.setup_state || 'live') !== 'draft') return { done: true, what: 'Live', where: '/project' };
  if (!people) return { what: 'Set the organisation \u2014 nobody is on it yet', where: '/org' };
  if (!docs) return { what: 'Load the documents', where: '/files' };
  if (checks && !checks.nobody && !checks.ready) {
    return { what: (checks.total - checks.done) + ' of ' + checks.total + ' dashboards still to check',
             where: '/handover' };
  }
  return { ready: true, what: 'Ready to go live', where: '/handover' };
}

// WHICH CONSULTANT FORM A DOCUMENT IS ISSUED ON. Its own, if the project has
// one; otherwise the form a consultant sends that kind of document under — a
// shop-drawing submittal goes under the Transmittal of drawings, a method
// statement under the Transmittal of documents. A test-drive copy uses the
// real project's forms, so forms loaded after the test started are used at once.
const FORM_FALLBACK = { submittal: ['transmittal_dwg', 'transmittal'], ms: ['transmittal'], material: ['transmittal'] };
// K7 (S0): what issuing and recording a reply need from the platform.
async function s0Context(env, pid, me, whoName, rec) {
  const project = await getProject(env, pid);
  const ladder = await workflowFor(env, pid, rec.type).catch(() => null);
  const labels = await labelsFor(env, pid).catch(() => null);
  let pmEmails = [];
  try {
    pmEmails = ((await projectTeam(env, project && project.org_id, pid)) || [])
      .filter((u) => (u.functions || []).includes('pm') && u.email).map((u) => u.email);
  } catch (e) { /* nobody named */ }
  return {
    who: whoName, me, project, workflow: ladder, labels, pmEmails,
    emailOn: emailDriver(env) !== 'none',
    mailer: (to, s, h, o) => sendEmail(env, to, s, h, o),
    formFor: (r) => filledFormFor(env, pid, r),
    // Only the record's own attachments go out with it.
    attachment: async (id) => { const a = await getAttachment(env, pid, id); return a && a.row && a.row.ref === rec.ref ? a : null; },
  };
}

// K7: the consultant's form for a record, filled and signed so far — what
// "Generate document" downloads and what an issue email carries.
async function filledFormFor(env, pid, rec) {
  const tpl = await templateFor(env, pid, rec.type);
  if (!tpl) return null;
  const project = await getProject(env, pid);
  const sig = signaturesFor(rec, rec.workflow || [], readSignMap(tpl.row), {});
  const filled = await issueFile(tpl.bytes, { ...buildValues(rec, project), ...fieldValues(readFields(tpl.row), rec.data), ...sig.word }, sig.cells);
  if (filled.error) return null;
  const fmt = FORMATS[filled.format] || FORMATS.docx;
  return { filename: String(rec.ref || 'document').replace(/[^\w.\- ]+/g, '_') + '.' + fmt.ext, contentType: fmt.mime, bytes: filled.bytes };
}

async function templateFor(env, pid, type) {
  const types = [type].concat(FORM_FALLBACK[type] || []);
  const pids = [pid].concat(isTestProject(pid) ? [realIdOf(pid)] : []);
  for (const p0 of pids) for (const t of types) {
    const tpl = await getTemplateBytes(env, p0, t);
    if (tpl) return tpl;
  }
  return null;
}

/* ---------------------------------------------------------------- router */

const APP = {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname.replace(/\/+$/, '') || '/';
    const secret = env.AUTH_SECRET || 'dev-secret';
    const session = await readToken(cookieValue(req, COOKIE), secret);

    // A named person: who they are is in the cookie, what they may do is not.
    // Their role, their scope and whether their employer is still a paying
    // customer are all read here, on every request, so withdrawing somebody or
    // suspending an account takes effect on their next tap rather than whenever
    // the cookie happens to run out.
    let me = null, myOrg = null;
    if (session && session.uid) {
      me = await getUser(env, session.uid);
      if (!me || me.status === 'suspended') return signedOut('That account has been withdrawn.');
      myOrg = await getOrg(env, me.org_id);
      const blocked = orgBlocked(myOrg);
      if (blocked) return signedOut(blocked);
      // The platform owner code still exists and still outranks everything; a
      // person whose role is 'owner' owns their own organisation, not the app.
    }
    const role = me ? me.role : (session ? session.role : null);

    /* ---- TEST DRIVE: every role, for real, on a throwaway copy (src/testdrive.js).
     *
     * The AETRAA Admin's own session is kept in a second cookie while they act
     * as the test people, so the setup screens come straight back to them. */
    const OWN_COOKIE = 'smown';
    const ownTok = await readToken(cookieValue(req, OWN_COOKIE), secret);
    const ownerHere = can.platform(role, me) || !!(ownTok && ownTok.role === 'owner' && !ownTok.uid && me && isPersona(me));
    // Every AETRAA-only screen, the Test tab included: none of them is ever a test person's.
    const ADMIN_PAGES = ['/home', '/setup', '/handover', '/new', '/contract', '/parties', '/modules', '/intake',
      '/project', '/workflows', '/files', '/org', '/testdrive'];
    if (me && isPersona(me) && ownTok && ownTok.role === 'owner' && ADMIN_PAGES.includes(p) && req.method === 'GET') {
      const h = new Headers({ Location: url.pathname + url.search });
      h.append('Set-Cookie', `${COOKIE}=${cookieValue(req, OWN_COOKIE)}; Path=/; Max-Age=${DAY}; HttpOnly; Secure; SameSite=Lax`);
      h.append('Set-Cookie', `${OWN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
      return new Response(null, { status: 302, headers: h });
    }

    /* ---- THE PREVIEW IS READ-ONLY, AND THIS IS WHERE THAT IS TRUE ----------
     *
     * /preview boots the real application as somebody else so an Admin can see
     * a dashboard the way the person who will use it sees it. Every request the
     * preview shell makes carries this stamp, and every write carrying it is
     * refused here — before any route, before any permission check, before
     * anything can be created, approved, issued or deleted.
     *
     * The shell also hides the buttons, but a hidden button is a courtesy. An
     * Admin checking the QA/QC screen before handover must not be able to close
     * an NCR in the client's name, on a real project, from a screen whose whole
     * purpose was to look at it. So the refusal lives at the front door, where
     * no route can forget it.
     */
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS'
        && req.headers.get('X-AETRAA-Preview') === '1') {
      return json({
        error: 'This is a preview. You are looking at the project as ' +
               (url.searchParams.get('as') || 'another role') +
               ' would see it, and nothing can be changed from here. ' +
               'Leave the preview to act on this project.',
        preview: true,
      }, 403);
    }

    /* ---- things anyone may fetch: the home-screen app files */
    if (p === '/manifest.webmanifest') {
      return new Response(MANIFEST, {
        headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
      });
    }
    if (p === '/sw.js') {
      return new Response(SERVICE_WORKER, {
        headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' },
      });
    }
    if (p === '/icon-192.png' || p === '/icon-512.png' || p === '/favicon.ico') {
      const b64 = p === '/icon-512.png' ? ICON_512 : p === '/icon-192.png' ? ICON_192 : FAVICON;
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return new Response(bin, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800' },
      });
    }
    // The typefaces (Roboto Slab, Bebas Neue). Served from here so nobody's
    // browser has to ask Google for them; the theme names fonts.gstatic.com only
    // as the fallback.
    if (p.startsWith('/fonts/') && FONT_FILES[p.slice(7)]) {
      const bin = Uint8Array.from(atob(FONT_FILES[p.slice(7)]), (c) => c.charCodeAt(0));
      return new Response(bin, {
        headers: { 'Content-Type': p.endsWith('.woff') ? 'font/woff' : 'font/woff2', 'Cache-Control': 'public, max-age=31536000, immutable' },
      });
    }

    // The API for other programs (Revit and the others): API keys only, never
    // a browser session (src/integrations.js, docs/INTEGRATION.md).
    if (p.startsWith('/api/v1/') || p === '/api/v1') {
      return handleApiV1(req, env, url, { overLimit, getOrg, orgBlocked, audit, putFile });
    }

    // The mark at the top of every page. A company that has uploaded its own
    // logo sees its own; everyone else sees AETRAA. It is per-person, so it is
    // never cached by anything in between.
    if (p === '/brand-logo') {
      const own = myOrg && typeof myOrg.logo === 'string' ? myOrg.logo.trim() : '';
      const m = /^data:(image\/(?:png|jpeg|gif|webp|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/.exec(own);
      const [type, b64] = m ? [m[1], m[2].replace(/\s+/g, '')] : ['image/png', LOGO_PNG];
      let bin;
      try { bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); }
      catch (e) { bin = Uint8Array.from(atob(LOGO_PNG), (c) => c.charCodeAt(0)); }
      return new Response(bin, {
        headers: { 'Content-Type': m ? type : 'image/png', 'Cache-Control': 'private, max-age=300' },
      });
    }

    /* ---- the demo: no codes, because a demo is watched, not operated -----
     *
     * A company on the 'demo' plan is invented data put there to be shown. Its
     * people are therefore listed at /demo and entered with one click: in front
     * of a client, typing a code for the eighth time is the thing they remember.
     *
     * It reaches nothing else. Only a user whose organisation is on the demo
     * plan can be entered this way, so no real customer's account is openable
     * here however the request is dressed up.
     */
    // Off unless DEMO_MODE=on: on a live server nobody walks into an account
    // with one click, demo or not. (Girish, 27 Oct 2026: no sample data at launch.)
    const demoOn = String(env.DEMO_MODE || '').toLowerCase() === 'on';
    if (!demoOn && (p === '/demo' || p.startsWith('/api/demo/'))) {
      return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
    }
    if (p === '/demo' || p === '/api/demo/people') {
      const people = await demoPeople(env);
      if (p === '/api/demo/people') return json({ people });
      return html(demoPageHTML(people));
    }
    if (p === '/api/demo/enter' && req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const people = await demoPeople(env);
      const pick = people.find((x) => x.id === String(b.id || ''));
      if (!pick) return json({ error: 'that is not a demo account' }, 403);
      const person = await getUser(env, pick.id);
      if (!person || person.status === 'suspended') return json({ error: 'that is not a demo account' }, 403);
      const org = await getOrg(env, person.org_id);
      const blocked = orgBlocked(org);
      if (blocked) return json({ error: blocked }, 403);
      await touchUser(env, person.id);
      const list = userProjects(person);
      const first = list.length ? list[0] : null;
      const token = await makeUserToken(person.id, first, secret);
      const headers = new Headers({ 'Content-Type': 'application/json' });
      headers.append('Set-Cookie',
        `${COOKIE}=${token}; Path=/; Max-Age=${DAY}; HttpOnly; Secure; SameSite=Lax`);
      if (first) headers.append('Set-Cookie',
        `${PROJ_COOKIE}=${first}; Path=/; Max-Age=${DAY}; Secure; SameSite=Lax`);
      return new Response(JSON.stringify({ ok: true, role: person.role, project: first, name: person.name }), { headers });
    }

    /* ---- login / logout */
    if (p === '/api/login' && req.method === 'POST') {
      // Codes are short enough to guess at speed, so guessing is counted per address.
      if (await overLimit(env, 'code-login:ip:' + clientIp(req), LIMITS.loginPerIp)) return tooMany(15);
      const { code } = await req.json().catch(() => ({}));
      const given = String(code || '').trim();
      let got = null, pid = null;

      let aid = null;
      if (sameCode(given, env.OWNER_CODE)) {
        got = 'owner';
      } else if (given) {
        const h = await sha256(given);

        // A personal code belongs to one named man. Tried first, because this is
        // what everybody on site will be carrying once their code is reissued.
        //
        // Looked up regardless of whether he is still with us: once a code belongs
        // to somebody, that person decides whether it works. The shared codes were
        // adopted from the projects table, so without this a withdrawn man would
        // fall through to the old project code his was taken from and walk back in.
        const holder = await findUserByInviteAny(env, h);
        if (holder && holder.status === 'suspended') {
          await new Promise((r) => setTimeout(r, 400));
          return json({ error: 'That access has been withdrawn.' }, 401);
        }
        const person = holder;
        if (person) {
          const org = await getOrg(env, person.org_id);
          const blocked = orgBlocked(org);
          if (blocked) return json({ error: blocked }, 403);
          await touchUser(env, person.id);
          const list = userProjects(person);
          const first = list.length ? list[0] : null;
          const token = await makeUserToken(person.id, first, secret);
          await audit(env, { org_id: person.org_id, user_id: person.id, who: person.name,
            action: 'signin', detail: 'personal code' });
          const headers = new Headers({ 'Content-Type': 'application/json' });
          headers.append('Set-Cookie',
            `${COOKIE}=${token}; Path=/; Max-Age=${60 * DAY}; HttpOnly; Secure; SameSite=Lax`);
          if (first) headers.append('Set-Cookie',
            `${PROJ_COOKIE}=${first}; Path=/; Max-Age=${60 * DAY}; Secure; SameSite=Lax`);
          return new Response(JSON.stringify({
            ok: true, role: person.role, project: first, name: person.name,
          }), { headers });
        }

        // Per-discipline codes first: they are the ones handed out now.
        const ac = await findByHash(env, h);
        if (ac) {
          got = ROLES[ac.role] ? ac.role : 'site';
          pid = ac.project_id;
          aid = ac.id;
          await touchCode(env, ac.id, nowISO());
        }
        const row = got ? null : await env.DB.prepare(
          `SELECT id, CASE WHEN manager_code_hash = ?1 THEN 'manager'
                           WHEN site_code_hash = ?1 THEN 'site'
                           WHEN view_code_hash = ?1 THEN 'view' END AS role
             FROM projects
            WHERE manager_code_hash = ?1 OR site_code_hash = ?1 OR view_code_hash = ?1
            LIMIT 1`
        ).bind(h).first();
        if (row && row.role) { got = row.role; pid = row.id; }
        else if (!got) {
          // Codes set as Worker secrets before projects existed still open the first project.
          const legacy = sameCode(given, env.MANAGER_CODE) ? 'manager'
            : sameCode(given, env.SITE_CODE) ? 'site'
            : sameCode(given, env.VIEW_CODE) ? 'view' : null;
          if (legacy) {
            const first = (await listProjects(env)).filter((x) => !x.archived)[0];
            if (first) { got = legacy; pid = first.id; }
          }
        }
      }

      if (!got) {
        await new Promise((r) => setTimeout(r, 400));
        return json({ error: 'Access code not recognised' }, 401);
      }
      // A shared code opens a seat, not a person — so the audit could not say who
      // walked in, only that somebody did. It says at least that now: a line
      // reading "manager · shared code" beside a named sign-in is how you tell
      // that the seat you are testing is a code seat and not an account.
      const proj = pid ? await getProject(env, pid) : null;
      await audit(env, {
        org_id: proj ? proj.org_id : null, project_id: pid, user_id: null,
        who: `(${got} code)`, action: 'signin', detail: 'shared code — nobody named',
      });
      const token = await makeToken(got, pid, aid, secret);
      const cookies = [`${COOKIE}=${token}; Path=/; Max-Age=${90 * DAY}; HttpOnly; Secure; SameSite=Lax`];
      if (pid) cookies.push(`${PROJ_COOKIE}=${pid}; Path=/; Max-Age=${90 * DAY}; Secure; SameSite=Lax`);
      const headers = new Headers({ 'Content-Type': 'application/json' });
      for (const c of cookies) headers.append('Set-Cookie', c);
      return new Response(JSON.stringify({ ok: true, role: got, project: pid }), { headers });
    }
    /* ---- signing in by email: no password is ever set, stored or reset */
    if (p === '/api/signin/start' && req.method === 'POST') {
      const { email } = await req.json().catch(() => ({}));
      // Asking for codes over and over is how a six-digit code is brute-forced
      // (five guesses each), and how an inbox is flooded.
      if (await overLimit(env, 'code-send:ip:' + clientIp(req), LIMITS.codePerIp) ||
          await overLimit(env, 'code-send:email:' + String(email || '').trim().toLowerCase(), LIMITS.codePerEmail)) return tooMany(15);
      // Testing phase: with LOGIN_TEST_CODE set, there is no email to send — the
      // person just types the fixed code. Answered the same for any address, so
      // the form still never reveals who is on the system.
      if (env.LOGIN_TEST_CODE) return json({ ok: true, sent: true });

      // AETRAA's own staff sign in here too, on the same form. They are not user
      // records (can.platform needs `!me`), so they are matched against
      // PLATFORM_EMAILS before the user lookup and given the same one-time code.
      if (isPlatformEmail(env, email)) {
        const pstart = await startPlatformSignIn(env, email, sha256);
        if (pstart.error) {
          await new Promise((r) => setTimeout(r, 500));
          return json({ ok: true, sent: true });
        }
        const psent = await sendEmail(env, [pstart.email],
          `${pstart.code} — your AETRAA Admin sign-in code`,
          signInEmail(pstart.code, { name: 'AETRAA Admin' }, pstart.minutes));
        if (!psent.ok) {
          return json({
            error: psent.reason === 'no-key'
              ? 'Email sign-in is not switched on for this app yet — no email key is set on the server. ' +
                'Use the owner code instead.'
              : 'The email service refused to send it. Use the owner code instead.',
            email_fault: true,
          }, 502);
        }
        return json({ ok: true, sent: true });
      }

      const start = await startEmailSignIn(env, email, sha256);
      if (start.error === 'blocked') return json({ error: start.message }, 403);
      // An unknown address is answered exactly like a known one. Otherwise this
      // form tells a stranger which of your people are on the system.
      if (start.error) {
        await new Promise((r) => setTimeout(r, 500));
        return json({ ok: true, sent: true });
      }
      const sent = await sendEmail(env, [start.user.email],
        `${start.code} — your sign-in code`, signInEmail(start.code, start.org, start.minutes));
      if (!sent.ok) {
        // A sending failure is a fault in this app, not a wrong answer by the
        // person at the form, so it is said plainly rather than hidden behind
        // "check your email". Nothing here reveals who is on the system.
        return json({
          error: sent.reason === 'no-key'
            ? 'Email sign-in is not switched on for this app yet — no email key is set on the ' +
              'server. Use the personal code you were given, and tell the office.'
            : 'The email service refused to send it. Nothing is wrong with your address — ' +
              'tell the office, and use your personal code meanwhile.',
          email_fault: true,
        }, 502);
      }
      return json({ ok: true, sent: true });
    }
    if (p === '/api/signin/code' && req.method === 'POST') {
      if (await overLimit(env, 'code-check:ip:' + clientIp(req), LIMITS.loginPerIp)) return tooMany(15);
      const body = await req.json().catch(() => ({}));

      // An AETRAA address gets the OWNER token, not a user session. This is the
      // whole point of the platform branch: makeUserToken would set `me`, and
      // can.platform() reads `role === 'owner' && !me` — so a user session would
      // sign the Admin in and strip his rights in the same breath. The audit
      // line names him, which the shared owner code never could.
      if (isPlatformEmail(env, body.email)) {
        const pout = await completePlatformSignIn(env, body.email, body.code, sha256);
        if (pout.error) {
          await new Promise((r) => setTimeout(r, 300));
          return json({ error: pout.error, left: pout.left }, 401);
        }
        const ptoken = await makeToken('owner', null, null, secret);
        await audit(env, { org_id: null, project_id: null, user_id: null,
          who: pout.email, action: 'signin', detail: 'AETRAA Admin — email code' });
        const pheaders = new Headers({ 'Content-Type': 'application/json' });
        pheaders.append('Set-Cookie',
          `${COOKIE}=${ptoken}; Path=/; Max-Age=${90 * DAY}; HttpOnly; Secure; SameSite=Lax`);
        return new Response(JSON.stringify({ ok: true, role: 'owner', project: null, name: pout.email }),
          { headers: pheaders });
      }

      const out = await completeEmailSignIn(env, body.email, body.code, sha256);
      if (out.error) {
        await new Promise((r) => setTimeout(r, 300));
        return json({ error: out.error, left: out.left }, 401);
      }
      const list = userProjects(out.user);
      let first = list.length ? list[0] : null;
      if (!first) {
        const mine = await orgProjects(env, out.user.org_id).catch(() => []);
        const live = mine.filter((x) => !x.archived);
        first = (live[0] || mine[0] || {}).id || null;
      }
      const token = await makeUserToken(out.user.id, first, secret);
      await audit(env, { org_id: out.user.org_id, user_id: out.user.id, who: out.user.name,
        action: 'signin', detail: 'email' });
      const headers = new Headers({ 'Content-Type': 'application/json' });
      headers.append('Set-Cookie',
        `${COOKIE}=${token}; Path=/; Max-Age=${60 * DAY}; HttpOnly; Secure; SameSite=Lax`);
      if (first) headers.append('Set-Cookie',
        `${PROJ_COOKIE}=${first}; Path=/; Max-Age=${60 * DAY}; Secure; SameSite=Lax`);
      return new Response(JSON.stringify({
        ok: true, role: out.user.role, project: first, name: out.user.name,
      }), { headers });
    }

    if (p === '/api/logout') {
      const headers = new Headers({ Location: '/' });
      headers.append('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
      headers.append('Set-Cookie', `${PROJ_COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=Lax`);
      return new Response(null, { status: 302, headers });
    }

    /* ---- ACCOUNTS: sign up, log in with a password, reset it, change it
     * (src/accounts.js). The six-digit email code and the personal site code
     * above both still work; this adds what a person expects of a website. */
    if (p === '/signup') return me ? Response.redirect(url.origin + '/', 302) : html(signupHTML());
    if (p === '/forgot') return html(forgotHTML());
    if (p === '/account') return me ? html(accountHTML()) : html(loginHTML('your account'));
    // The new-project form (a self-serve company), or "you will be added to one".
    if (p === '/welcome') return me ? html(welcomeHTML()) : html(loginHTML('your account'));

    if (p === '/api/signup' && req.method === 'POST') {
      if (String(env.SIGNUP_ENABLED || 'on').toLowerCase() === 'off') {
        return json({ error: 'New accounts are not being taken here. Ask the person who runs your company’s account to invite you.' }, 403);
      }
      if (await overLimit(env, 'signup:ip:' + clientIp(req), LIMITS.signupPerIp)) return tooMany(60);
      const b = await req.json().catch(() => ({}));
      const r = await signUp(env, b, sha256);
      if (r.error) return json(r, r.exists ? 409 : 400);
      const person = await getUser(env, r.user_id);
      await audit(env, { org_id: r.org_id, user_id: person.id, who: person.name, action: 'signup', detail: 'account created with a password' });
      return signedIn(person, null, secret, { ok: true, role: person.role, project: null, name: person.name });
    }

    if (p === '/api/login/password' && req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const email = String(b.email || '').trim().toLowerCase();
      if (await overLimit(env, 'login:ip:' + clientIp(req), LIMITS.loginPerIp) ||
          await overLimit(env, 'login:email:' + email, LIMITS.loginPerEmail)) return tooMany(15);
      const out = await passwordLogin(env, email, b.password);
      if (out.error) return json({ error: out.error }, 401);
      await clearHits(env, 'login:email:' + email);
      const list = userProjects(out.user);
      let first = list.length ? list[0] : null;
      if (!first) {
        const mine = await orgProjects(env, out.user.org_id).catch(() => []);
        first = ((mine.filter((x) => !x.archived)[0]) || mine[0] || {}).id || null;
      }
      await audit(env, { org_id: out.user.org_id, user_id: out.user.id, who: out.user.name, action: 'signin', detail: 'password' });
      return signedIn(out.user, first, secret, { ok: true, role: out.user.role, project: first, name: out.user.name });
    }

    // Forgotten password: the same six-digit email code proves the inbox is
    // theirs, and then they choose a new password. Answered the same whether
    // or not the address has an account.
    if (p === '/api/password/reset/start' && req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const email = String(b.email || '').trim().toLowerCase();
      if (await overLimit(env, 'code-send:ip:' + clientIp(req), LIMITS.codePerIp) ||
          await overLimit(env, 'code-send:email:' + email, LIMITS.codePerEmail)) return tooMany(15);
      const start = await startEmailSignIn(env, email, sha256);
      if (start.error) { await new Promise((r) => setTimeout(r, 500)); return json({ ok: true, sent: true }); }
      const sent = await sendEmail(env, [start.user.email], `${start.code} — reset your AETRAA password`,
        signInEmail(start.code, start.org, start.minutes));
      if (!sent.ok) {
        return json({ error: 'The email could not be sent, so the password cannot be reset from here yet. ' +
          'Ask the person who runs your company’s account.', email_fault: true }, 502);
      }
      return json({ ok: true, sent: true });
    }
    if (p === '/api/password/reset/complete' && req.method === 'POST') {
      if (await overLimit(env, 'code-check:ip:' + clientIp(req), LIMITS.loginPerIp)) return tooMany(15);
      const b = await req.json().catch(() => ({}));
      const out = await completeEmailSignIn(env, b.email, b.code, sha256);
      if (out.error) return json({ error: out.error, left: out.left }, 401);
      const set = await setPassword(env, out.user.id, b.password);
      if (set.error) return json(set, 400);
      await audit(env, { org_id: out.user.org_id, user_id: out.user.id, who: out.user.name, action: 'password.reset', detail: 'by email code' });
      const list = userProjects(out.user);
      const first = list.length ? list[0] : null;
      return signedIn(out.user, first, secret, { ok: true, role: out.user.role, project: first, name: out.user.name });
    }

    if (p === '/api/account' && req.method === 'GET') {
      if (!me) return json({ error: 'auth' }, 401);
      await ensureAccountTables(env);
      return json({ name: me.name, email: me.email, company: myOrg ? myOrg.name : null,
        has_password: await hasPassword(env, me.id), self_serve: await isSelfServe(env, me.org_id),
        may_create_project: await isSelfServe(env, me.org_id) && userFunctions(me).includes('principal') });
    }
    if (p === '/api/password/change' && req.method === 'POST') {
      if (!me) return json({ error: 'auth' }, 401);
      if (await overLimit(env, 'login:email:' + String(me.email || me.id).toLowerCase(), LIMITS.loginPerEmail)) return tooMany(15);
      const b = await req.json().catch(() => ({}));
      // Changing a password you already have needs the one you have.
      if (await hasPassword(env, me.id)) {
        const chk = await passwordLogin(env, me.email, b.current);
        if (chk.error) return json({ error: 'Your current password is not right.', field: 'current' }, 401);
      }
      const r = await setPassword(env, me.id, b.password);
      if (r.error) return json(r, 400);
      await audit(env, { org_id: me.org_id, user_id: me.id, who: me.name, action: 'password.change', detail: 'from the account page' });
      return json({ ok: true });
    }

    // A company that signed itself up creates its own projects. Companies that
    // AETRAA set up keep the rule that AETRAA sets their projects up.
    if (p === '/api/self/project' && req.method === 'POST') {
      if (!me) return json({ error: 'auth' }, 401);
      if (!(await isSelfServe(env, me.org_id)) || !userFunctions(me).includes('principal')) {
        return json({ error: 'Projects on this account are set up by AETRAA. Ask them for a new one.' }, 403);
      }
      const b = await req.json().catch(() => ({}));
      const name = str(b.name, 200);
      if (!name || !name.trim()) return json({ error: 'Give the project a name.', field: 'name' }, 400);
      const r = await createProjectForCompany(env, me.org_id, {
        name: name.trim(), ref: str(b.ref, 60), location: str(b.location, 200), client_name: str(b.client_name, 200),
        contract_completion: date(b.contract_completion), currency: str(b.currency || 'AED', 8),
      });
      if (r.error) return json(r, 400);
      await audit(env, { org_id: me.org_id, project_id: r.id, user_id: me.id, who: me.name, action: 'project.create', detail: name.trim() });
      const h = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      h.append('Set-Cookie', `${PROJ_COOKIE}=${r.id}; Path=/; Max-Age=${60 * DAY}; Secure; SameSite=Lax`);
      return new Response(JSON.stringify({ ok: true, id: r.id }), { headers: h });
    }

    // Owner switching project
    if (p === '/api/project' && req.method === 'GET') {
      if (!can.portfolio(role)) return json({ error: 'auth' }, 401);
      const want = url.searchParams.get('p');
      if (!want || !(await getProject(env, want))) return json({ error: 'unknown project' }, 404);
      return new Response(JSON.stringify({ ok: true, project: want }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `${PROJ_COOKIE}=${want}; Path=/; Max-Age=${90 * DAY}; Secure; SameSite=Lax`,
        },
      });
    }

    // The cookie says which code signed in; what that code may touch is read
    // here, so revoking or re-scoping it takes effect on the next request.
    let scope = null, codeRow = null;
    if (me) {
      scope = userScope(me);
    } else if (session && session.aid) {
      codeRow = await getCode(env, session.aid);
      if (!codeRow) return signedOut('That access code has been withdrawn.');
      scope = readScope(codeRow);
    }

    let pid = me
      ? await resolveUserPid(req, env, me, session)
      : session && session.aid && codeRow
        ? codeRow.project_id
        : await resolvePid(req, env, session);

    // The tenant wall. A person may only ever be in a project their organisation
    // owns, and only one they have been put on. Guessing an id gets nowhere.
    if (pid === DENIED) {
      return json({ error: 'That project is not yours to open.' }, 403);
    }
    if (me && pid) {
      const proj = await getProject(env, pid);
      if (!proj || (proj.org_id && proj.org_id !== me.org_id) || !userInProject(me, pid)) {
        return json({ error: 'That project is not yours to open.' }, 403);
      }
    }

    // The module wall. A module switched off for this project is refused here,
    // on the server — hiding its screens is not enough, because anyone can type
    // an address. The AETRAA Admin is not gated: they set projects up.
    let mods = null;
    if (pid && !can.platform(role, me)) {
      mods = await getProjectModules(env, pid).catch(() => null);
      const owner = moduleForPath(p);
      if (mods && owner && !mods.includes(owner)) {
        const m = MODULES.find((x) => x.id === owner);
        return json({ error: 'The ' + (m ? m.label : owner) + ' module is not switched on for this project.', module: owner }, 403);
      }
    }

    if (p === '/templates') {
      const okT = can.platform(role, me) || !!(me && userFunctions(me).some((f) => ['dc', 'pm', 'principal'].includes(f)));
      return okT ? html(templatesHTML()) : html(loginHTML('the project templates'));
    }
    if (p === '/testdrive') {
      return ownerHere ? html(testdriveHTML()) : html(loginHTML('the test drive'));
    }
    if (p.startsWith('/api/testdrive')) {
      if (!ownerHere) return json({ error: 'The test drive is for the AETRAA Admin.' }, 403);
      const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      const realPid = String(b.project_id || url.searchParams.get('project') || '');
      const proj = await getProject(env, realPid);
      if (!proj || isTestProject(realPid)) return json({ error: 'no such project' }, 404);
      if (p === '/api/testdrive' && req.method === 'GET') {
        return json({ project: { id: proj.id, name: proj.name, state: proj.setup_state }, ...(await testState(env, proj.id)),
          acting_as: me && isPersona(me) ? { id: me.id, name: me.name } : null });
      }
      if (p === '/api/testdrive/start' && req.method === 'POST') {
        const r = await startTest(env, proj.id, { name: 'AETRAA Admin' }, {
          getProject, listRoles, legacyRole,
          uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          teamFunctions: async (e, oid, pid0) => (await listUsers(e, oid).catch(() => []))
            .filter((u) => userInProject(u, pid0)).flatMap((u) => userFunctions(u)),
        });
        if (!r.error) await audit(env, { org_id: proj.org_id, project_id: proj.id, who: 'AETRAA Admin',
          action: 'testdrive.start', detail: (r.personas || []).length + ' test people, ' + r.rows_copied + ' rows copied' });
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/testdrive/as' && req.method === 'POST') {
        const st = await testState(env, proj.id);
        if (!st.running) return json({ error: 'Start the test drive first.' }, 400);
        const who = st.personas.find((x) => x.role === String(b.role || ''));
        if (!who) return json({ error: 'There is no test person for that role.' }, 404);
        const token = await makeUserToken(who.user_id, st.test_id, secret, 1);
        const h = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        // The Admin's own session is set aside once, the first time they switch.
        if (!ownTok && can.platform(role, me)) {
          h.append('Set-Cookie', `${OWN_COOKIE}=${cookieValue(req, COOKIE)}; Path=/; Max-Age=${DAY}; HttpOnly; Secure; SameSite=Lax`);
        }
        h.append('Set-Cookie', `${COOKIE}=${token}; Path=/; Max-Age=${DAY}; HttpOnly; Secure; SameSite=Lax`);
        h.append('Set-Cookie', `${PROJ_COOKIE}=${st.test_id}; Path=/; Max-Age=${DAY}; Secure; SameSite=Lax`);
        return new Response(JSON.stringify({ ok: true, as: who }), { headers: h });
      }
      if ((p === '/api/testdrive/back' || p === '/api/testdrive/end') && req.method === 'POST') {
        const h = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        if (ownTok) {
          h.append('Set-Cookie', `${COOKIE}=${cookieValue(req, OWN_COOKIE)}; Path=/; Max-Age=${DAY}; HttpOnly; Secure; SameSite=Lax`);
          h.append('Set-Cookie', `${OWN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
        }
        h.append('Set-Cookie', `${PROJ_COOKIE}=${proj.id}; Path=/; Max-Age=${DAY}; Secure; SameSite=Lax`);
        let out = { ok: true };
        if (p === '/api/testdrive/end') {
          out = await endTest(env, proj.id);
          await audit(env, { org_id: proj.org_id, project_id: proj.id, who: 'AETRAA Admin',
            action: 'testdrive.end', detail: 'test copy deleted — ' + out.removed + ' rows, ' + out.people + ' test people' });
        }
        return new Response(JSON.stringify(out), { headers: h });
      }
      return json({ error: 'unknown test drive action' }, 404);
    }

    /* ---- MY FILES: each person's own private files (src/myfiles.js) ---- */
    if (p === '/myfiles') return me ? html(myfilesHTML()) : html(loginHTML('your files'));
    if (p === '/api/myfiles' || p.startsWith('/api/myfiles/')) {
      if (!me) return json({ error: 'Log in with your own account to use your files.' }, 401);
      const qs = url.searchParams;
      if (p === '/api/myfiles' && req.method === 'GET') {
        const r = await listFolder(env, me.id, qs.get('folder') || '/');
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/myfiles/search' && req.method === 'GET') {
        return json({ files: await findFiles(env, me.id, qs.get('q') || ''), usage: await myUsage(env, me.id) });
      }
      if (p === '/api/myfiles/file' && req.method === 'GET') {
        const f = await readOwnFile(env, me.id, qs.get('id'));
        if (!f) return json({ error: 'No such file.' }, 404);
        if (!f.bytes) return json({ error: 'The file itself could not be read from storage.' }, 502);
        const as = serveAs(f.row.name);
        const inline = as.inline && qs.get('download') !== '1';
        const h = {
          'Content-Type': as.mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store',
          'Content-Disposition': (inline ? 'inline' : 'attachment') + '; filename="' + f.row.name.replace(/["\\\r\n]/g, '_') +
            '"; filename*=UTF-8\'\'' + encodeURIComponent(f.row.name),
        };
        // A picture shown in a tab can run nothing, whatever is inside it.
        if (inline && as.mime !== 'application/pdf') h['Content-Security-Policy'] = "default-src 'none'; img-src 'self'; sandbox";
        return new Response(f.bytes, { headers: h });
      }
      if (p === '/api/myfiles/upload' && req.method === 'POST') {
        const declared = Number(req.headers.get('content-length') || 0);
        if (declared > myMaxBytes(env)) return json({ error: 'That file is larger than ' + Math.round(myMaxBytes(env) / 1048576) + ' MB.' }, 413);
        const bytes = new Uint8Array(await req.arrayBuffer());
        const r = await addMyFile(env, me, qs.get('folder') || '/', qs.get('name') || '', bytes);
        if (!r.error) await audit(env, { org_id: me.org_id, user_id: me.id, who: me.name, action: 'myfiles.upload', detail: r.folder + '/' + r.name });
        return json(r, r.error ? (r.quota ? 413 : 400) : 200);
      }
      if (req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        let r;
        if (p === '/api/myfiles/rename') r = await renameMyFile(env, me.id, b.id, b.name);
        else if (p === '/api/myfiles/move') r = await moveMyFile(env, me.id, b.id, b.folder);
        else if (p === '/api/myfiles/delete') r = await removeMyFile(env, me.id, b.id);
        else if (p === '/api/myfiles/folder') r = await makeMyFolder(env, me.id, b.path);
        else if (p === '/api/myfiles/folder/delete') r = await removeMyFolder(env, me.id, b.path);
        else if (p === '/api/myfiles/attach') {
          // A copy onto a record on the project open now, under the same rule
          // as any other attachment: the record's checks, types and size.
          if (!pid) return json({ error: 'Open a project first.' }, 400);
          if (!can.submit(role)) return json({ error: 'Attaching files is not part of your access on this project.' }, 403);
          const f = await readOwnFile(env, me.id, b.id);
          if (!f || !f.bytes) return json({ error: 'No such file.' }, 404);
          r = await addAttachment(env, pid, String(b.ref || ''), f.row.name, f.row.mime || '', f.bytes, me.name);
          if (!r.error) await audit(env, { org_id: me.org_id, project_id: pid, user_id: me.id, who: me.name, action: 'attachment.add', detail: r.ref + ' · ' + r.filename + ' (from My files)' });
        } else return json({ error: 'unknown action' }, 404);
        return json(r, r.error ? 400 : 200);
      }
      return json({ error: 'unknown action' }, 404);
    }

    /* ---- INTEGRATIONS, the team's side: API keys, the inbox of what other
     * programs sent, and the connectors that call them (src/integrations.js). */
    if (p === '/integrations' || p.startsWith('/api/integrations')) {
      const plat = can.platform(role, me);
      const fns = me ? userFunctions(me) : [];
      const mayUse = plat || fns.includes('principal') || fns.includes('pm');
      const mayKeys = plat || fns.includes('principal');
      if (p === '/integrations') return mayUse ? html(integrationsHTML()) : html(loginHTML('integrations'));
      if (!mayUse) return json({ error: 'Integrations are for the Principal and the Project Manager.' }, 403);
      const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      const orgId = me ? me.org_id : String(url.searchParams.get('org') || b.org || '');
      if (!orgId) return json({ error: 'Which company? (?org=…)' }, 400);
      // The project the inbox is about: the one open, or one asked for that this person may open.
      const wantP = String(url.searchParams.get('project') || b.project_id || pid || '');
      const projRow = wantP ? await getProject(env, wantP) : null;
      const projOk = projRow && projRow.org_id === orgId && (!me || userInProject(me, projRow.id));
      if (p === '/api/integrations' && req.method === 'GET') {
        const mine = (await orgProjects(env, orgId).catch(() => [])).filter((x) => !me || userInProject(me, x.id));
        return json({
          may_manage_keys: mayKeys,
          keys: mayKeys ? await listApiKeys(env, orgId) : [],
          connectors: await connectorStatus(env, orgId),
          projects: mine.map((x) => ({ id: x.id, name: x.name })),
          project: projOk ? { id: projRow.id, name: projRow.name } : null,
          inbox: projOk ? await listInbox(env, orgId, projRow.id) : [],
          api_base: url.origin + '/api/v1',
        });
      }
      if (p === '/api/integrations/keys' && req.method === 'POST') {
        if (!mayKeys) return json({ error: 'API keys are made by the Principal.' }, 403);
        const r = await createApiKey(env, orgId, b.name, b.scopes, (me && me.name) || 'AETRAA Admin');
        if (!r.error) await audit(env, { org_id: orgId, user_id: me ? me.id : null, who: (me && me.name) || 'AETRAA Admin', action: 'apikey.create', detail: r.name + ' (' + r.prefix + ')' });
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/integrations/keys/revoke' && req.method === 'POST') {
        if (!mayKeys) return json({ error: 'API keys are managed by the Principal.' }, 403);
        const r = await revokeApiKey(env, orgId, b.id);
        if (!r.error) await audit(env, { org_id: orgId, user_id: me ? me.id : null, who: (me && me.name) || 'AETRAA Admin', action: 'apikey.revoke', detail: String(b.id || '') });
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/integrations/item' && req.method === 'GET') {
        const it = await getItem(env, orgId, url.searchParams.get('id'));
        if (!it || (me && !userInProject(me, it.project_id))) return json({ error: 'No such item.' }, 404);
        const { file_key, key_id, ...pub } = it;
        return json({ item: pub });
      }
      if (p === '/api/integrations/item/file' && req.method === 'GET') {
        const it = await getItem(env, orgId, url.searchParams.get('id'));
        if (!it || !it.file_key || (me && !userInProject(me, it.project_id))) return json({ error: 'No such file.' }, 404);
        const f = await getFile(env, it.file_key).catch(() => null);
        const bytes = f && (f.bytes || f);
        if (!bytes || !bytes.length) return json({ error: 'The file could not be read from storage.' }, 502);
        return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream', 'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-store', 'Content-Disposition': 'attachment; filename="' + String(it.file_name || 'file').replace(/["\\\r\n]/g, '_') + '"' } });
      }
      if (p === '/api/integrations/item/status' && req.method === 'POST') {
        const it = await getItem(env, orgId, b.id);
        if (!it || (me && !userInProject(me, it.project_id))) return json({ error: 'No such item.' }, 404);
        return json(await setItemStatus(env, orgId, b.id, String(b.status || ''), b.note));
      }
      if (p === '/api/integrations/call' && req.method === 'POST') {
        const r = await callConnector(env, b.connector, b.action, b.payload, {
          org_id: orgId, who: (me && me.name) || 'AETRAA Admin',
          project: projOk ? { id: projRow.id, name: projRow.name, ref: projRow.ref || null } : null,
          reply_to: projOk ? url.origin + '/api/v1/projects/' + encodeURIComponent(projRow.id) + '/inbox' : null,
        });
        await audit(env, { org_id: orgId, project_id: projOk ? projRow.id : null, user_id: me ? me.id : null, who: (me && me.name) || 'AETRAA Admin',
          action: 'integration.out', detail: String(b.connector || '') + ' · ' + String(b.action || '') + (r.error ? ' · failed' : '') });
        return json(r, r.error ? 502 : 200);
      }
      return json({ error: 'unknown action' }, 404);
    }

    /* ---- pages */
    if (p === '/') {
      // A real signed-in person gets the live application shell: the signed-off
      // dashboard design, their sidebar, their windows, booted as themselves.
      // A new account has no project yet: the welcome page (create one, or wait
      // to be added to one), not a dashboard of nothing.
      if (me && !pid) return html(welcomeHTML());
      if (me) {
        const meObj = await buildMe(env, me, pid);
        return html(appHTML(JSON.stringify(meObj)));
      }
      // The AETRAA Admin (master owner-code login, not a company user) lands on
      // the project setup console.
      if (can.platform(role, me)) return html(homeHTML());
      // The platform owner (global code login, not a user) keeps the classic flow.
      if (role === 'site') return Response.redirect(url.origin + '/site', 302);
      if (!can.dashboard(role)) return html(loginHTML('dashboard'));
      if (role === 'owner' && can.portfolio(role)) return html(principalHTML());
      if (!pid) return html(adminHTML(true));           // signed in, but no project exists yet
      return html(dashboardHTML(role));
    }
    if (p === '/portfolio') {
      return can.portfolio(role) ? html(portfolioHTML()) : html(loginHTML('portfolio'));
    }
    if (p === '/site') {
      if (!can.submit(role)) return html(loginHTML('site update'));
      return html(siteHTML(role));
    }
    if (p === '/setup') {
      // AETRAA Admin only (the master owner-code login, not a company Principal).
      // With a project in the address it is that project's setup, carrying its
      // bar; without one it is the platform console.
      return can.platform(role, me)
        ? html(setupHTML(String(url.searchParams.get('p') || '').slice(0, 60)))
        : html(loginHTML('AETRAA Admin setup'));
    }
    if (p === '/intake') {
      if (can.platform(role, me)) return html(intakeHTML());
      // Spec D2, §25: Document Control loads drawings into their own project
      // where AETRAA has switched bulk loading on (the server keeps the drop
      // drawings-only and on this project, whatever the page sends).
      const bulkOk = pid && can.drawingsUpload(role) && ((await getProjectModules(env, pid).catch(() => null)) || []).includes('bulkload');
      return bulkOk ? html(intakeHTML()) : html(loginHTML('project intake'));
    }
    // What a project holds, what is missing, and the way out of setup.
    if (p === '/project') {
      return can.platform(role, me) ? html(projectHTML()) : html(loginHTML('the project page'));
    }
    if (p === '/workflows') {
      return can.platform(role, me) ? html(workflowsHTML()) : html(loginHTML('the workflows'));
    }
    if (p === '/files') {
      return can.platform(role, me) ? html(filesHTML()) : html(loginHTML('document control'));
    }
    // The project organisation: roles, what each carries, and who holds it.
    if (p === '/org') {
      return can.platform(role, me) ? html(orgHTML()) : html(loginHTML('the project organisation'));
    }

    /* THE PREVIEW — the real application, booted as somebody else, read-only.
     *
     * This is the one thing the platform could not do: look at a dashboard the
     * way the person who will use it sees it. It is not a mock-up and not a
     * separate screen; it is the same shell, the same windows and the same data,
     * with a `me` assembled from a role on this project rather than from whoever
     * signed in.
     *
     * READ-ONLY IS ENFORCED IN THREE PLACES, and only the third is a guarantee:
     *   1. the shell shows a banner and disables what it can,
     *   2. it stamps every request with X-AETRAA-Preview,
     *   3. the API refuses EVERY write carrying that stamp.
     *
     * The third is what matters. Without it, an Admin checking the QA/QC screen
     * before handover could close an NCR in the client's name — a real act, on a
     * real project, from a screen whose whole purpose was to look.
     */
    // THE ADMIN'S HOME. Every project, chosen by clicking the thing itself.
    if (p === '/home') {
      return can.platform(role, me) ? html(homeHTML()) : html(loginHTML('AETRAA Admin'));
    }
    if (p === '/new') {
      return can.platform(role, me) ? html(newProjectHTML()) : html(loginHTML('AETRAA Admin'));
    }
    if (p === '/handover') {
      return can.platform(role, me) ? html(handoverHTML()) : html(loginHTML('the handover checks'));
    }
    // Setting a project up, in the order the questions can actually be answered:
    // the contract names the parties, the parties own the modules, and a role
    // can only be given to somebody once you know which side they are on.
    if (p === '/contract') {
      return can.platform(role, me) ? html(contractHTML()) : html(loginHTML('the contract'));
    }
    if (p === '/parties') {
      return can.platform(role, me) ? html(partiesHTML()) : html(loginHTML('the parties'));
    }
    if (p === '/modules') {
      return can.platform(role, me) ? html(modulesHTML()) : html(loginHTML('the modules'));
    }
    if (p === '/preview') {
      if (!can.platform(role, me)) return html(loginHTML('the dashboard preview'));
      const wantPid = url.searchParams.get('p') || pid || '';
      const proj = await getProject(env, wantPid);
      if (!proj) return html(loginHTML('the dashboard preview'));

      const asRole = String(url.searchParams.get('as') || 'principal');
      const roles = await listRoles(env, proj.id, { all: true });
      const r = roles.find((x) => x.id === asRole) || roles.find((x) => x.id === 'principal');
      if (!r) return html(loginHTML('the dashboard preview'));

      const mods = await getProjectModules(env, proj.id).catch(() => null) || DEFAULT_ON.slice();
      const access = await accessFor(env, proj.id, [r.id]);
      const labels = await labelsFor(env, proj.id);

      const previewMe = {
        email: 'preview@aetraa',
        name: r.label + ' (preview)',
        av: 'PV',
        title: r.label,
        preview: true,
        previewAs: r.id,
        previewProject: proj.name,
        access,
        roleLabels: labels,
        roles: [r.id],
        siteDiscipline: (r.disciplines || [])[0] || '',
        projects: [{ id: proj.id, name: proj.name }],
        projectId: proj.id,
        projectName: proj.name,
        projectSub: projectSubLine(proj),
        canAssign: false,
        // Nothing may be raised or approved from a preview. The lists are sent
        // empty rather than filtered later, so the buttons never appear at all.
        mayRaise: [],
        mayApprove: [],
        modules: mods,
        dashOff: dashboardsOff(mods),
        mayNotify: false,
      };
      return html(appHTML(JSON.stringify(previewMe)));
    }
    if (p === '/admin') {
      return can.admin(role) ? html(adminHTML(false)) : html(loginHTML('admin'));
    }
    if (p === '/people') {
      return can.people(role) ? html(peopleHTML()) : html(loginHTML('the people on this account'));
    }
    if (p === '/resources') {
      if (!can.resources(role)) return html(loginHTML('resources and cost'));
      if (!pid) return html(adminHTML(true));
      return html(resourcesHTML(role, can.money(role)));
    }
    if (p === '/drawings' || p === '/design') {
      if (!can.drawings(role)) return html(loginHTML('the design register'));
      if (!pid) return html(adminHTML(true));
      return html(drawingsHTML(role, mayUploadDrawings(role, me), can.drawingsApprove(role),
        { can: !!(me && mayNotify(me)), dc: !!(me && userFunctions(me).includes('dc')) }));
    }
    if (p === '/minutes') {
      if (!can.view(role)) return html(loginHTML('meeting minutes'));
      if (!pid) return html(adminHTML(true));
      return html(minutesPageHTML());
    }
    if (p === '/programme') {
      if (!mayPlan(role, me)) return html(loginHTML('the programme update'));
      if (!pid) return html(adminHTML(true));
      return html(programmeHTML());
    }
    if (p === '/schedule') {
      if (!can.schedule(role)) return html(loginHTML('the programme forecast'));
      if (!pid) return html(adminHTML(true));
      return html(scheduleHTML(role));
    }
    if (p === '/reports') {
      if (!mayReport(role, me)) return html(loginHTML('reports'));
      if (!pid) return html(adminHTML(true));
      return html(reportsHTML(role));
    }
    if (p === '/issues') {
      if (!can.report(role)) return html(loginHTML('the issues register'));
      if (!pid) return html(adminHTML(true));
      return html(issuesHTML(role));
    }
    if (p === '/letters') {
      if (!can.view(role)) return html(loginHTML('letters'));
      if (!pid) return html(adminHTML(true));
      return html(lettersHTML());
    }
    // What this server has been given and still needs before launch (AETRAA only).
    if (p === '/launch-check') return can.platform(role, me) ? html(launchHTML()) : html(loginHTML('the launch check'));
    if (p === '/api/launch-check') {
      if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
      return json(await launchCheck(env, { emailDriver }));
    }
    if (p === '/deviations') {
      if (!can.view(role)) return html(loginHTML('the tender and IFC deviations'));
      if (!pid) return html(adminHTML(true));
      return html(deviationsHTML());
    }
    if (p === '/obligations') {
      if (!can.view(role)) return html(loginHTML('the contract obligations'));
      if (!pid) return html(adminHTML(true));
      return html(obligationsHTML());
    }
    if (p === '/held') {
      if (!can.view(role)) return html(loginHTML('the held documents'));
      if (!pid && !can.platform(role, me)) return html(adminHTML(true));
      return html(heldHTML());
    }
    if (p === '/delays') {
      if (!can.view(role)) return html(loginHTML('the delay register'));
      if (!pid) return html(adminHTML(true));
      return html(delaysHTML());
    }
    if (p === '/letter-check') {
      if (!can.view(role)) return html(loginHTML('Check and complete'));
      if (!pid) return html(adminHTML(true));
      return html(letterCheckHTML());
    }
    if (p === '/ask') {
      if (!can.view(role)) return html(loginHTML('Ask the project'));
      if (!pid) return html(adminHTML(true));
      return html(askHTML());
    }
    if (p === '/schedules') {
      if (!can.view(role)) return html(loginHTML('the schedules'));
      if (!pid) return html(adminHTML(true));
      return html(schedulesHTML());
    }
    if (p === '/knowledge') {
      if (!can.view(role)) return html(loginHTML('the knowledge base'));
      if (!pid) return html(adminHTML(true));
      return html(knowledgeHTML());
    }
    if (p === '/spec') {
      if (!can.view(role)) return html(loginHTML('the specification index'));
      if (!pid) return html(adminHTML(true));
      return html(specHTML());
    }
    if (p === '/intake-history') {
      if (!can.view(role)) return html(loginHTML('the intake history'));
      if (!pid) return html(adminHTML(true));
      return html(intakeHistoryHTML());
    }
    if (p === '/terms') {
      if (!can.view(role)) return html(loginHTML('the payment terms'));
      if (!pid) return html(adminHTML(true));
      return html(termsHTML());
    }
    // K8: subcontractors' timesheets into the diary.
    // K13 (A10): prepare an RFI from a note and a photo; the RFI log.
    if (p === '/rfi') {
      if (!can.view(role)) return html(loginHTML('RFIs'));
      if (!pid) return html(adminHTML(true));
      return html(rfiHTML());
    }
    // K12: the material submittal package and its log.
    if (p === '/material') {
      if (!can.view(role)) return html(loginHTML('material submittals'));
      if (!pid) return html(adminHTML(true));
      return html(materialHTML());
    }
    // K10: the correspondence register — every letter in and out.
    if (p === '/correspondence') {
      if (!can.view(role)) return html(loginHTML('the correspondence register'));
      if (!pid) return html(adminHTML(true));
      return html(correspondenceHTML());
    }
    if (p === '/timesheets') {
      if (!can.diary(role)) return html(loginHTML('timesheets'));
      if (!pid) return html(adminHTML(true));
      return html(timesheetsHTML());
    }
    // K7: the submittal desk — one record's road to the consultant and back.
    if (p === '/s0') {
      if (!can.view(role)) return html(loginHTML('the submittal desk'));
      if (!pid) return html(adminHTML(true));
      return html(s0HTML());
    }
    // K6: Document Control brings the old system's registers in.
    if (p === '/past-registers') {
      if (!mayTakeOver(me, can.platform(role, me))) return html(loginHTML('past registers'));
      if (!pid) return html(adminHTML(true));
      return html(pastRegistersHTML());
    }
    // K2: what each project holds, and the move of files out of the database.
    if (p === '/storage') {
      if (!can.platform(role, me)) return html(loginHTML('storage'));
      return html(storageHTML());
    }
    // K1: the priced BOQ and the BOM — checked, accepted, imported, approved.
    // The page is a shell; /api/bills decides what each person may do.
    if (p === '/bills') {
      const bf = me ? userFunctions(me) : [];
      const ok = can.platform(role, me) || role === 'owner' || role === 'manager'
        || ['commercial', 'procurement', 'pm', 'principal', 'finance', 'dc'].some((f) => bf.includes(f));
      if (!ok) return html(loginHTML('the BOQ and BOM'));
      if (!pid && !can.platform(role, me)) return html(adminHTML(true));
      return html(billsHTML());
    }
    if (p === '/verify') {
      if (!can.verify(role)) return html(loginHTML('verification'));
      if (!pid) return html(adminHTML(true));
      return html(verifyHTML(role));
    }
    if (p === '/diary') {
      if (!can.diary(role)) return html(loginHTML('the daily diary'));
      if (!pid) return html(adminHTML(true));
      return html(diaryHTML(role));
    }
    if (p === '/diary/doc' || p === '/diary/docx') {
      if (!can.diary(role)) return html(loginHTML('the daily diary'));
      if (!pid) return json({ error: 'no project' }, 400);
      const day = date(url.searchParams.get('date')) || today();
      const project = await getProject(env, pid);
      // ?v=N prints a kept version — the diary exactly as it stood before it
      // was changed — rather than as it reads today.
      const wantV = Number(url.searchParams.get('v')) || 0;
      const d = wantV ? await loadDiaryVersion(env, pid, day, wantV, project)
                      : await loadDiary(env, pid, day, project);
      if (!d) return new Response('No such version of that diary.', { status: 404 });
      if (d.missing) return new Response('The diary is not set up yet — run upgrade-diary.sh', { status: 404 });

      if (p === '/diary/docx') {
        const bytes = diaryDocx(project, d);
        return new Response(bytes, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            // A kept version says so in its name, so it is never mistaken for
            // the diary as it reads now.
            'Content-Disposition': `attachment; filename="${wantV
              ? diaryFileName(project, day, 'docx').replace(/\.docx$/, '') + '-version-' + wantV + '.docx'
              : diaryFileName(project, day, 'docx')}"`,
          },
        });
      }
      await ensurePhotoAiColumns(env);
      const { results: pics } = await env.DB.prepare(
        `SELECT p.id, p.caption, p.created_at, p.location, a.name AS activity_name FROM photos p
           LEFT JOIN activities a ON a.project_id = p.project_id AND a.id = p.activity_id
          WHERE p.project_id = ? AND p.report_date = ? ORDER BY p.created_at LIMIT 24`
      ).bind(pid, day).all();
      const sheets = `<div class="sheet">${diarySheet(project, d)}</div>` +
        (pics && pics.length ? `<div class="sheet">${photoPageHTML(project, day, pics)}</div>` : '');
      return html(diarySheetHTML(diaryFileName(project, day, ''), sheets));
    }
    if (p === '/issues/doc') {
      if (!can.report(role)) return html(loginHTML('the issues register'));
      const issue = pid ? await getIssue(env, pid, url.searchParams.get('ref') || '') : null;
      if (!issue) return new Response('No such issue', { status: 404 });
      const project = await getProject(env, pid);
      const activity = issue.activity_id
        ? await env.DB.prepare(
            'SELECT id, name, planned_start, planned_finish FROM activities WHERE project_id = ? AND id = ?'
          ).bind(pid, issue.activity_id).first()
        : null;
      return html(issueDocHTML(issueDocumentTitle(issue), issueDocument(project, issue, activity)));
    }

    /* ---- api */
    try {
      if (p === '/api/projects') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        // A named person sees their own organisation's projects and no others,
        // and within those, only the ones they have been put on.
        const all = me ? (await orgProjects(env, me.org_id)).filter((x) => userInProject(me, x.id))
                       : await listProjects(env);
        return json({
          current: pid,
          role,
          org: myOrg ? { id: myOrg.id, name: myOrg.name, status: myOrg.status,
                         trial_ends: myOrg.trial_ends, plan: myOrg.plan } : null,
          me: me ? { id: me.id, name: me.name, email: me.email } : null,
          projects: (role === 'owner' || me) ? all : all.filter((x) => x.id === pid),
        });
      }
      if (p === '/api/portfolio') {
        if (!can.portfolio(role)) return json({ error: 'auth' }, 401);
        return await getPortfolio(env, me ? me.org_id : null);
      }
      if (p === '/api/project' && req.method === 'POST') {
        if (!can.admin(role)) return json({ error: 'auth' }, 401);
        // Creating a project is the AETRAA Admin's alone. A company Principal
        // carries the legacy 'owner' role, so can.admin() is not enough here —
        // without this they could add projects to their own company.
        return await postProject(req, env, can.platform(role, me));
      }

      /* ---- people. Managing them needs no project: a person can exist before
              they are put on one, which is the whole point of an invitation. */
      if (p === '/api/people') {
        if (!can.people(role)) return json({ error: 'auth' }, 401);
        // The platform owner is not in an organisation, so with more than one on
        // the system he has to say which. The page offers him a picker rather
        // than an error.
        const all = me ? null : await listOrgs(env);
        const oid = me ? me.org_id
          : (url.searchParams.get('org') || (all && all.length === 1 ? all[0].id : null));
        if (!oid) {
          return json({ people: [], migrated: all !== null, roles: ROLES, orgs: all || [] });
        }
        // Test-drive people are seen only from inside the test drive, and only there.
        const listed = await listUsers(env, oid);
        const people = listed ? listed.filter((u) => isPersona(u) === !!(me && isPersona(me))) : listed;
        let projects = [];
        try { projects = await orgProjects(env, oid); } catch (e) { projects = []; }
        const { results } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(trade_group,''),'(no group)') AS grp, COUNT(*) AS n
             FROM activities WHERE COALESCE(level,1) >= 1
              AND project_id IN (SELECT id FROM projects WHERE COALESCE(org_id,?) = ?)
            GROUP BY grp ORDER BY grp`
        ).bind(oid, oid).all().catch(() => ({ results: [] }));
        return json({
          people: people || [], migrated: people !== null, roles: ROLES,
          projects, groups: (results || []).map((r) => r.grp),
          org: await getOrg(env, oid), orgs: (all && all.length > 1) ? all : undefined,
        });
      }
      if (p === '/api/person' && req.method === 'POST') {
        if (!can.people(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const oid = me ? me.org_id : (String(b.org || '') || await onlyOrg(env));
        if (!oid) return json({ error: 'which organisation?' }, 400);
        // Nobody may withdraw themselves and lock the organisation out of itself.
        if (b.suspend !== undefined && me && String(b.id) === me.id) {
          return json({ error: 'you cannot withdraw your own access' }, 400);
        }
        const suspending = b.suspend !== undefined;
        // Read the name before changing anything, so the audit line says who was
        // withdrawn rather than an id nobody can read.
        const subject = suspending ? await getUser(env, b.id) : null;
        const r = suspending
          ? await suspendUser(env, oid, b.id, !!b.suspend)
          : await saveUser(env, oid, { ...b, invited_by: me ? me.name : 'owner' }, sha256);
        if (!r.error) {
          await audit(env, { org_id: oid, user_id: me ? me.id : null, who: me ? me.name : 'owner',
            action: suspending ? (b.suspend ? 'person.withdrawn' : 'person.restored') : 'person.save',
            detail: String((subject && subject.name) || b.name || b.id || '') });
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/audit') {
        if (!can.people(role)) return json({ error: 'auth' }, 401);
        const oid = me ? me.org_id : (url.searchParams.get('org') || await onlyOrg(env));
        const rows = oid ? await listAudit(env, oid, {
          project_id: url.searchParams.get('p') || null,
          action: url.searchParams.get('action') || null,
        }) : [];
        return json({ entries: rows || [], migrated: rows !== null });
      }

      /* ---- the platform: organisations. The owner code, not an org owner. */
      if (p === '/api/orgs') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const orgs = await listOrgs(env);
        return json({ orgs: orgs || [], migrated: orgs !== null });
      }
      if (p === '/api/org' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        if (b.id && me && b.id === me.org_id && can.people(role)) {
          // An org owner may rename their own organisation, nothing more.
          const r = await updateOrg(env, me.org_id, { name: b.name });
          return json(r, r.error ? 400 : 200);
        }
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        if (b.adopt) {
          const r = await adoptCodes(env, String(b.adopt));
          return json(r, r.error ? 400 : 200);
        }
        const r = b.id ? await updateOrg(env, b.id, b) : await createOrg(env, b);
        return json(r, r.error ? 400 : 200);
      }

      /* ---- AETRAA Admin: project onboarding (Company → Project → Principal) */
      // Modules — the catalogue, and what one project has switched on.
      if (p === '/api/setup/modules' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const want = url.searchParams.get('project') || '';
        const out = catalogue();
        if (want) {
          const m = await getProjectModules(env, want);
          if (!m) return json({ error: 'no such project' }, 404);
          out.project_id = want; out.enabled = m; out.setup_steps = setupStepsOn(m);
        }
        return json(out);
      }
      if (p === '/api/setup/modules' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const r = await setProjectModules(env, String(b.project_id || ''), b.modules);
        if (!r.error) {
          await audit(env, { org_id: null, project_id: r.project_id, who: 'AETRAA Admin', action: 'modules',
            detail: r.modules.join(', ') || '(base platform only)' }).catch(() => {});
        }
        return json(r, r.error ? 400 : 200);
      }
      // Response periods per document type, per project (calendar days).
      if (p === '/api/setup/response-days' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        await ensureProjectColumn(env, 'response_days');
        const proj = await getProject(env, url.searchParams.get('project') || '');
        if (!proj) return json({ error: 'no such project' }, 404);
        const out = {};
        for (const t of Object.keys(RESPONSE_DEFAULTS)) {
          const r = responseDays(proj, t);
          out[t] = { days: r.days, default: RESPONSE_DEFAULTS[t].days, from: r.from, what: r.what,
                     label: (RECORD_LABEL[t] || t) };
        }
        return json({ project_id: proj.id, periods: out });
      }
      if (p === '/api/setup/response-days' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        await ensureProjectColumn(env, 'response_days');
        const b = await req.json().catch(() => ({}));
        const proj = await getProject(env, String(b.project_id || ''));
        if (!proj) return json({ error: 'no such project' }, 400);
        const clean = {};
        for (const [t, v] of Object.entries(b.periods || {})) {
          if (!RESPONSE_DEFAULTS[t]) continue;
          const n = Math.round(Number(v));
          if (!(n >= 1 && n <= 365)) return json({ error: (RECORD_LABEL[t] || t) + ': enter 1 to 365 days' }, 400);
          if (n !== RESPONSE_DEFAULTS[t].days) clean[t] = n;
        }
        await env.DB.prepare('UPDATE projects SET response_days = ? WHERE id = ?').bind(JSON.stringify(clean), proj.id).run();
        await audit(env, { org_id: proj.org_id, project_id: proj.id, who: 'AETRAA Admin', action: 'response-days',
          detail: Object.entries(clean).map(([k, v]) => k + ' ' + v + 'd').join(', ') || 'defaults' });
        return json({ ok: true, periods: clean });
      }
      // Payment terms — what the IPC valuation follows. AETRAA Admin only.
      if (p === '/api/setup/payment-terms' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        await ensureProjectColumn(env, 'payment_terms');
        const proj = await getProject(env, url.searchParams.get('project') || '');
        if (!proj) return json({ error: 'no such project' }, 404);
        let contract = 0;
        // Summed in whole fils, so the contract sum is the bill's own total to the fil.
        try { contract = toAED(Number((await env.DB.prepare(`SELECT ${SQL_SUM_FILS('amount')} AS n FROM boq WHERE project_id = ?`).bind(proj.id).first() || {}).n) || 0); } catch (e) {}
        let raw = {}; try { raw = JSON.parse(proj.payment_terms || '{}') || {}; } catch (e) {}
        return json({ project_id: proj.id, terms: paymentTerms(proj, contract), raw, contract, defaults: TERM_DEFAULTS });
      }
      if (p === '/api/setup/payment-terms' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        await ensureProjectColumn(env, 'payment_terms');
        const b = await req.json().catch(() => ({}));
        const proj = await getProject(env, String(b.project_id || ''));
        if (!proj) return json({ error: 'no such project' }, 400);
        const t = b.terms || {};
        const LABEL = { retention_pct: 'Retention %', retention_cap_pct: 'Retention cap %', advance_pct: 'Advance %',
          recovery_pct: 'Recovery %', recovery_start_pct: 'Recovery starts at %', recovery_full_pct: 'Fully recovered by %',
          mos_pct: 'Materials on site paid at %', vat_pct: 'VAT %', certify_days: 'Days for the Engineer to certify', payment_days: 'Days for the client to pay',
          advance_amount: 'Advance amount', hse_hours_per_day: 'Hours in a standard site day' };
        const v = {};
        for (const k of Object.keys(LABEL)) {
          if (t[k] === undefined || t[k] === '' || t[k] === null) continue;
          const n = Number(t[k]);
          const days = k.endsWith('_days');
          if (k === 'hse_hours_per_day' && (!Number.isFinite(n) || n < 1 || n > 24)) return json({ error: LABEL[k] + ': enter 1 to 24' }, 400);
          if (!Number.isFinite(n) || n < 0 || (k === 'advance_amount' || k === 'hse_hours_per_day' ? false : days ? (n < 1 || n > 365) : n > 100)) {
            return json({ error: LABEL[k] + ': ' + (days ? 'enter 1 to 365 days' : k === 'advance_amount' ? 'enter an amount' : 'enter 0 to 100') }, 400);
          }
          v[k] = n;
        }
        if (v.recovery_start_pct != null && v.recovery_full_pct != null && v.recovery_full_pct <= v.recovery_start_pct) {
          return json({ error: 'The advance must be fully recovered at a later point than recovery starts.' }, 400);
        }
        const json_ = {};
        for (const k of ['recovery_pct', 'recovery_start_pct', 'recovery_full_pct', 'mos_pct', 'vat_pct', 'certify_days', 'advance_amount', 'hse_hours_per_day']) if (v[k] != null) json_[k] = v[k];
        json_.advance_received = !!t.advance_received;
        await env.DB.prepare(`UPDATE projects SET retention_pct = ?, retention_limit_pct = ?, advance_pct = ?, payment_days = ?, payment_terms = ? WHERE id = ?`)
          .bind(v.retention_pct != null ? v.retention_pct : (proj.retention_pct || 0), v.retention_cap_pct != null ? v.retention_cap_pct : (proj.retention_limit_pct || 0),
            v.advance_pct != null ? v.advance_pct : (proj.advance_pct || 0), v.payment_days != null ? Math.round(v.payment_days) : (proj.payment_days || 56),
            JSON.stringify(json_), proj.id).run();
        await audit(env, { org_id: proj.org_id, project_id: proj.id, who: 'AETRAA Admin', action: 'payment-terms', detail: JSON.stringify(v).slice(0, 300) });
        return json({ ok: true, terms: paymentTerms(await getProject(env, proj.id), 0) });
      }
      // Contract reference — bond, insurance, liquidated damages, DLP, the
      // dates in the Appendix to Tender that nothing else on the platform has
      // a field for. Kept for the record only: unlike Payment Terms, nothing
      // here is ever read back into a certificate or a calculation — it is
      // the same "never auto-applied" rule contract-terms.js follows, just
      // with no computation on the other end of it to accidentally trigger.
      /* THE PROJECT PAGE — what is actually loaded, and what is missing.
       *
       * Until now a project's contents were spread across five screens and no
       * screen said what a project HELD. The Admin who loaded 226 documents had
       * no way to confirm they had landed: the drawing register opens on a stage
       * that was empty, the library is elsewhere, the BOQ elsewhere again. The
       * first time anyone counted was when a customer asked where his drawings
       * had gone — and they were there all along, on a tab he had not clicked.
       *
       * So this answers one question in one call: is this project ready to hand
       * over, and if not, what is missing. The gaps are the point. Anything that
       * would embarrass AETRAA at handover — no people, no BOQ, no gate, logos
       * missing — is named here rather than discovered by the client.
       *
       * Counts only. It never returns a document, a figure or a person's
       * details, so it stays safe to show beside the go-live button.
       */
      /* THE LAST THING BEFORE HANDOVER: look at each screen as its people will.
       *
       * The list is only the dashboards somebody on this project actually
       * reaches — a tick against Finance on a job with no Finance role held is
       * a tick with nothing behind it, and a checklist with filler in it stops
       * being read.
       */
      if (p === '/api/handover' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const proj = await getProject(env, url.searchParams.get('project') || '');
        if (!proj) return json({ error: 'no such project' }, 404);
        const users = (await listUsers(env, proj.org_id).catch(() => []))
          .filter((u) => userInProject(u, proj.id))
          .map((u) => ({ name: u.name, email: u.email, status: u.status, functions: userFunctions(u) }));
        return json({
          ok: true,
          project: { id: proj.id, name: proj.name, state: proj.setup_state },
          ...(await verifyState(env, proj.id, users)),
        });
      }

      if (p === '/api/handover' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const proj = await getProject(env, String(b.project_id || ''));
        if (!proj) return json({ error: 'no such project' }, 404);
        const who = me || { name: 'AETRAA Admin' };

        let r;
        if (b.action === 'sign') {
          r = await sign(env, proj.id, String(b.dash || ''), String(b.as || ''), who, b.note);
        } else if (b.action === 'unsign') {
          r = await unsign(env, proj.id, String(b.dash || ''));
        } else {
          return json({ error: 'unknown action' }, 400);
        }
        if (r.error) return json(r, 400);
        await audit(env, { org_id: proj.org_id, project_id: proj.id, who: who.name,
          action: 'project.verify.' + b.action, detail: String(b.dash || '') });
        const users = (await listUsers(env, proj.org_id).catch(() => []))
          .filter((u) => userInProject(u, proj.id))
          .map((u) => ({ name: u.name, email: u.email, status: u.status, functions: userFunctions(u) }));
        return json({ ...r, ...(await verifyState(env, proj.id, users)) });
      }

      /* THE PROJECT ORGANISATION — roles, what each carries, and who holds it.
       *
       * A role on this project is three things, and all three are the
       * Principal's to set: the disciplines it may be scoped to, the dashboards
       * it opens, and the workflow steps it signs. The catalogue is seeded from
       * what the platform ships with and belongs to the project after that,
       * because no two contractors have the same org chart.
       *
       * Everything here is AETRAA-only during setup. After go-live the
       * Principal holds it, which is why every refusal below explains itself:
       * there will be nobody outside the project to ask.
       */
      if (p === '/api/org-roles' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const proj = await getProject(env, url.searchParams.get('project') || '');
        if (!proj) return json({ error: 'no such project' }, 404);
        await seedRoles(env, proj.id);

        const roles = await listRoles(env, proj.id, { all: url.searchParams.get('all') === '1' });
        const people = await listUsers(env, proj.org_id).catch(() => []);
        const mine = (people || []).filter((u) => userInProject(u, proj.id));

        // Who holds each role, so the screen can show it and a retire can
        // refuse by name rather than by count.
        const holders = {};
        for (const u of mine) {
          for (const f of userFunctions(u)) (holders[f] = holders[f] || []).push(u.name || u.email);
        }
        return json({
          ok: true,
          project: { id: proj.id, name: proj.name, state: proj.setup_state },
          roles, holders,
          groups: ROLE_GROUPS,
          disciplines: DISCIPLINES,
          discipline_roles: DISCIPLINE_ROLES,
          dashboards: ALLDASH.map((d) => ({ id: d, label: DASH_LABEL[d] || d, warn: DASH_WARN[d] || '' })),
          streams: STREAMS, stream_groups: STREAM_GROUPS,
          people: mine.map((u) => ({
            id: u.id, name: u.name, email: u.email, phone: u.phone || '', status: u.status,
            functions: userFunctions(u),
            disciplines: (() => { try { return JSON.parse(u.scope_groups || '[]'); } catch (e) { return []; } })(),
            // null means "everything their roles cover" — the state everybody
            // already on the platform is in, and not the same as "nothing".
            streams: userStreams(u),
          })),
        });
      }

      if (p === '/api/org-roles' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const proj = await getProject(env, String(b.project_id || ''));
        if (!proj) return json({ error: 'no such project' }, 404);
        const who = me || { name: 'AETRAA Admin' };

        if (b.action === 'save') {
          const r = await saveRole(env, proj.id, b.role || {}, who);
          if (r.error) return json(r, 400);
          await audit(env, { org_id: proj.org_id, project_id: proj.id, who: who.name,
            action: 'org.role.' + (r.created ? 'added' : 'changed'),
            detail: (b.role && b.role.label) || r.id });
          return json(r);
        }

        if (b.action === 'retire') {
          // The two dependencies that make a retire unsafe, gathered here so
          // the store can name them rather than refuse blankly.
          const people = await listUsers(env, proj.org_id).catch(() => []);
          const holders = (people || [])
            .filter((u) => userInProject(u, proj.id) && userFunctions(u).includes(String(b.id)))
            .map((u) => u.name || u.email);
          const steps = await stepsOnlyRole(env, proj.id, String(b.id)).catch(() => []);
          const r = await retireRole(env, proj.id, String(b.id), who, { holders, steps });
          if (r.error) return json(r, 400);
          await audit(env, { org_id: proj.org_id, project_id: proj.id, who: who.name,
            action: 'org.role.retired', detail: String(b.id) });
          return json(r);
        }

        if (b.action === 'restore') {
          const r = await restoreRole(env, proj.id, String(b.id), who);
          return json(r, r.error ? 400 : 200);
        }

        /* ADDING SOMEBODY, WITH WHAT THEY ARE ON.
         *
         * People used to be added on a different screen, from the old coarse
         * role list — so the roles, disciplines and ladders set up here reached
         * nobody. A person is added where the organisation is, with the three
         * things that decide what they see and do: their roles, their
         * disciplines, and the workflows they are actually on.
         */
        if (b.action === 'save-person') {
          const per = b.person || {};
          const r = await saveUser(env, proj.org_id, {
            id: per.id || undefined,
            name: per.name, email: per.email || null, phone: per.phone || '',
            functions: Array.isArray(per.functions) ? per.functions : [],
            groups: Array.isArray(per.disciplines) ? per.disciplines : [],
            // An empty list is stored as empty, which reads as "everything their
            // roles cover". Ticking none is not a way to lock somebody out —
            // removing their role is.
            record_types: Array.isArray(per.streams) ? per.streams : [],
            projects: [proj.id],
            new_code: !!per.new_code,
            invited_by: who.name,
          }, sha256);
          if (r.error) return json(r, 400);
          await audit(env, { org_id: proj.org_id, project_id: proj.id, who: who.name,
            action: 'org.person.' + (per.id ? 'changed' : 'added'),
            detail: (per.name || '') + ' — ' + ((per.functions || []).join(', ') || 'no role') });
          return json(r);
        }

        if (b.action === 'suspend-person' || b.action === 'restore-person') {
          const r = await suspendUser(env, proj.org_id, String(b.id),
            b.action === 'suspend-person');
          if (r && r.error) return json(r, 400);
          await audit(env, { org_id: proj.org_id, project_id: proj.id, who: who.name,
            action: 'org.person.' + (b.action === 'suspend-person' ? 'suspended' : 'restored'),
            detail: String(b.id) });
          return json(r || { ok: true });
        }

        return json({ error: 'unknown action' }, 400);
      }

      /* THE LADDERS. The same screen, seen from the other side: every record
       * type, its steps, and which roles sign each one. */
      if (p === '/api/org-workflow' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const proj = await getProject(env, url.searchParams.get('project') || '');
        if (!proj) return json({ error: 'no such project' }, 404);
        const forRole = url.searchParams.get('role') || '';
        await seedTemplates(env, proj.id);
        await seedRoles(env, proj.id);

        // WHO HOLDS EACH ROLE. The drag screen shows a person's role as a chip;
        // a chip nobody holds is a step nobody can sign, and the screen says so
        // on the chip rather than leaving it to be discovered at go-live.
        const people = await listUsers(env, proj.org_id).catch(() => []);
        const holders = {};
        for (const u of (people || []).filter((x) => userInProject(x, proj.id))) {
          for (const f of userFunctions(u)) (holders[f] = holders[f] || []).push(u.name || u.email);
        }
        const selfParty = await selfPartyOf(env, proj.id, proj);
        const repId = representativeFor(selfParty);
        const roles = await listRoles(env, proj.id);
        const rep = roles.find((r) => r.id === repId);

        return json({
          ok: true,
          project: { id: proj.id, name: proj.name, state: proj.setup_state },
          // The document types, each with the named workflow it is on — which is
          // the question a document controller actually asks.
          workflow: await listWorkflow(env, proj.id),
          templates: await listWfTemplates(env, proj.id),
          roles: roles.map((r) => ({ id: r.id, label: r.label, grp: r.grp, party: r.party,
                                     signatory: !!r.signatory })),
          holders,
          // The person who signs for this side. Everything this screen does with
          // the signature starts from here.
          representative: rep ? { id: rep.id, label: rep.label, party: selfParty,
                                  held_by: holders[rep.id] || [] } : null,
          labels: await labelsFor(env, proj.id),
          groups: [...new Set(Object.values(TYPE_GROUP))],
          ...(forRole ? { steps: await stepsForRole(env, proj.id, forRole) } : {}),
        });
      }

      if (p === '/api/org-workflow' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const proj = await getProject(env, String(b.project_id || ''));
        if (!proj) return json({ error: 'no such project' }, 404);
        const who = me || { name: 'AETRAA Admin' };
        const valid = (await listRoles(env, proj.id, { all: true })).map((r) => r.id);

        let r;
        if (b.action === 'use-template') {
          // PICK A DOCUMENT TYPE'S ROUTE FROM THE LIBRARY. The one act this
          // screen exists for.
          r = await useTemplate(env, proj.id, String(b.type || ''), String(b.template || ''), who);
        } else if (b.action === 'save-template') {
          r = await saveWfTemplate(env, proj.id, b.template || {}, who, valid);
        } else if (b.action === 'step') {
          r = await setRoleOnStep(env, proj.id,
            { type: String(b.type || ''), step: b.step, role: String(b.role || ''), on: !!b.on },
            who, valid);
        } else if (b.action === 'save') {
          r = await saveWorkflow(env, proj.id, String(b.type || ''), b, who, valid);
        } else if (b.action === 'reset') {
          r = await resetWorkflow(env, proj.id, String(b.type || ''), who);
        } else if (b.action === 'add-signatory') {
          /* THE REPRESENTATIVE'S SIGNATURE, IN FRONT OF EVERYTHING THAT GOES OUT.
           *
           * Refused on a live project while nobody holds the role. The step
           * would go in, and the next submittal anybody raised would stop at a
           * signature nobody on the project can give — a live job, stranded by
           * a setting, with nothing on any screen to say why. During setup it is
           * allowed, because the handover checks will not let the project go
           * live with a step nobody holds. */
          const party = await selfPartyOf(env, proj.id, proj);
          const repId = String(b.role || representativeFor(party));
          const roles = await listRoles(env, proj.id, { all: true });
          const rep = roles.find((x) => x.id === repId);
          if (!rep) return json({ error: 'That role is not on this project.' }, 400);
          if (proj.setup_state !== 'draft') {
            const people = await listUsers(env, proj.org_id).catch(() => []);
            const held = (people || []).filter((u) => userInProject(u, proj.id))
              .some((u) => userFunctions(u).includes(repId));
            if (!held) {
              return json({ error: 'Nobody on this project holds ' + rep.label + ' yet. This project is '
                + 'live, so every submittal raised after this would stop at a signature nobody can give. '
                + 'Give somebody the role on the Organisation screen first, then come back.' }, 400);
            }
          }
          r = await addSignatory(env, proj.id, repId, rep.label, who, roles.map((x) => x.id),
                                 { types: Array.isArray(b.types) ? b.types : null });
        } else {
          return json({ error: 'unknown action' }, 400);
        }
        if (r.error) return json(r, 400);
        await audit(env, { org_id: proj.org_id, project_id: proj.id, who: who.name,
          action: 'org.workflow.' + (b.action === 'reset' ? 'reset'
                    : b.action === 'save-template' ? 'template' : 'changed'),
          detail: b.action === 'save-template'
            ? ((b.template && b.template.name) || '')
            : (TYPE_LABEL[String(b.type || '')] || String(b.type || '')) +
              (r && r.name ? ' \u2192 ' + r.name : '') });
        return json(r);
      }

      /* THE CONTRACT TERMS, READ FROM THE CONTRACT — at any time, not only in
       * the ninety seconds after a drop.
       *
       * The terms panel used to live on the review screen and read the BATCH.
       * Once the batch was committed the panel was gone, and with it the only
       * way to have the seven figures read off the contract. If the contract
       * had also been mis-classified on the way in — which is what happened —
       * the panel never appeared at all, and nothing on the platform said why.
       *
       * So this reads the CONTRACT SECTION of the library, which is where the
       * contract lives for the whole life of the job. GET proposes; the
       * existing POST applies only what was ticked. Nothing is ever written
       * without a person: every certificate is computed from these numbers,
       * and a wrong one is silent and expensive.
       */
      if (p === '/api/terms/read' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const proj = await getProject(env, url.searchParams.get('project') || '');
        if (!proj) return json({ error: 'no such project' }, 404);
        await ensureLibraryTable(env);

        const { results } = await env.DB.prepare(
          `SELECT id, title, filename, file_key FROM library
            WHERE project_id = ? AND class IN ('contract','bond','insurance')
              AND file_key IS NOT NULL ORDER BY added_at DESC`
        ).bind(proj.id).all().catch(() => ({ results: [] }));

        const docs = results || [];
        if (!docs.length) {
          return json({ read: false, terms: [], documents: [],
            why: 'Nothing is filed in the Contract section yet. Drop the contract on that ' +
                 'section and the terms can be read from it.' });
        }

        const { text, pages, labels, used } = await contractPages(env, docs.slice(0, 4));
        if (!text.trim()) {
          return json({ read: false, terms: [],
            documents: docs.map((d) => d.title || d.filename),
            why: 'The contract is filed, but no text could be read from it — a scanned ' +
                 'contract carries no searchable words. The figures have to be typed in on Setup.' });
        }

        const current = {
          retention_pct: proj.retention_pct, retention_cap_pct: proj.retention_limit_pct,
          advance_pct: proj.advance_pct, payment_days: proj.payment_days,
          rfi_reply_days: proj.reply_days, notice_clause: proj.notice_clause,
          completion_date: proj.contract_finish,
        };
        return json({ read: true, documents: used,
          terms: onOwnPages(proposeTerms(text, pages, current), labels, used.length > 1),
          // The other half of what is on the first page. Proposed only — the
          // parties screen confirms them, and nothing here writes anything.
          parties: onOwnPages(proposeParties(text, pages), labels, used.length > 1) });
      }

      /* WHO IS ON THE PROJECT.
       *
       * Two questions, deliberately kept apart: which parties are on the job,
       * and which one is the organisation holding the screen. Conflating them
       * is how one admin ends up staffing three companies' internal teams. */
      if (p === '/api/parties' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const proj = await getProject(env, url.searchParams.get('project') || '');
        if (!proj) return json({ error: 'no such project' }, 404);
        const rows = await listParties(env, proj.id, proj);
        // What the contract said, so the screen can offer it rather than making
        // somebody type the Engineer's name from memory. Read from what is
        // already filed; nothing is uploaded or written here.
        let proposed = {};
        try {
          const { results } = await env.DB.prepare(
            `SELECT filename, title, file_key FROM library
              WHERE project_id = ? AND class = 'contract' AND file_key IS NOT NULL
              ORDER BY added_at DESC`
          ).bind(proj.id).all();
          const { text, pages, labels, used } = await contractPages(env, (results || []).slice(0, 3));
          if (text.trim()) proposed = onOwnPages(proposeParties(text, pages), labels, used.length > 1);
        } catch (e) { /* no contract filed, or nothing readable in it */ }

        const defaults = {};
        for (const id of PARTY_IDS) defaults[id] = defaultModulesFor(id);
        return json({ project_id: proj.id, parties: rows, proposed, defaults,
          catalogue: PARTIES, self: await selfPartyOf(env, proj.id, proj) });
      }

      if (p === '/api/parties' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const proj = await getProject(env, String(b.project_id || ''));
        if (!proj) return json({ error: 'no such project' }, 400);

        /* A PARTY IS NOT UN-TICKED ONCE ITS PEOPLE ARE ON THE PROJECT.
         *
         * Removing it would leave their records at steps nobody owns, and
         * nothing on any screen would say why a submittal had stopped moving.
         * parties.js cannot check this — it does not know about users — so it
         * is checked here, where the roles and the people are. */
        const keep = (Array.isArray(b.parties) ? b.parties : [])
          .map((r) => r && String(r.party)).filter(isParty);
        const before = await listParties(env, proj.id, proj);
        const dropping = before.filter((x) => !keep.includes(x.party)).map((x) => x.party);
        if (dropping.length) {
          const roles = await listRoles(env, proj.id, { all: true });
          const byParty = {};
          for (const r of roles) (byParty[r.party] = byParty[r.party] || []).push(r.id);
          const all = await listUsers(env, proj.org_id).catch(() => []);
          const people = all.filter((u) => (u.projects || []).includes(proj.id));
          for (const party of dropping) {
            const ids = byParty[party] || [];
            const held = people.filter((u) => (u.functions || []).some((f) => ids.includes(f)));
            if (held.length) {
              return json({ error: partyLabel(party) + ' cannot be taken off the project — '
                + held.slice(0, 3).map((u) => u.name || u.email).join(', ')
                + (held.length > 3 ? ' and ' + (held.length - 3) + ' more' : '')
                + ' hold roles on that side. Move them first.' }, 400);
            }
          }
        }

        const r = await setParties(env, proj.id, b.parties, me);
        if (r.error) return json(r, 400);
        // The roles for a party that has just joined, added without anybody
        // running a migration. Existing roles, including edited ones, are left
        // exactly as they are.
        await seedRoles(env, proj.id, { parties: keep }).catch(() => false);
        await audit(env, { org_id: proj.org_id, project_id: proj.id, who: 'AETRAA Admin',
          action: 'project.parties', detail: keep.join(', ') });
        return json(r);
      }

      if (p === '/api/party-modules' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const proj = await getProject(env, String(b.project_id || ''));
        if (!proj) return json({ error: 'no such project' }, 400);
        const list = Array.isArray(b.modules) ? b.modules : [];
        if (!list.length) return json({ error: 'nothing was sent' }, 400);
        for (const row of list) {
          if (!row || !isParty(row.party)) return json({ error: 'which party?' }, 400);
          // A party with nothing on would sign in to the base platform and
          // nothing else, which looks exactly like a broken account.
          if (!Array.isArray(row.modules) || !row.modules.length) {
            return json({ error: partyLabel(row.party) + ' has no module ticked. Everyone on that '
              + 'side would sign in to the base platform and nothing else.' }, 400);
          }
          const r = await setPartyModules(env, proj.id, row.party, row.modules);
          if (r.error) return json(r, 400);
        }
        const union = await syncProjectModules(env, proj.id);
        await audit(env, { org_id: proj.org_id, project_id: proj.id, who: 'AETRAA Admin',
          action: 'project.party-modules', detail: (union || []).join(', ') });
        return json({ ok: true, project_id: proj.id, project_modules: union || [],
          parties: await listParties(env, proj.id, proj) });
      }

      /* THE FILING CABINET.
       *
       * The sections a document controller works in, each with its count; what
       * is inside one; and the move between them. This is the navigation the
       * admin page was missing — a drop used to be reviewable for five minutes
       * and then unreachable, because the only view of it was grouped by how
       * confident the engine had been rather than by what the documents were.
       */
      if (p === '/api/sections' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const proj = await getProject(env, url.searchParams.get('project') || '');
        if (!proj) return json({ error: 'no such project' }, 404);
        return json({ ok: true, project: { id: proj.id, name: proj.name, state: proj.setup_state },
                      ...(await sectionTree(env, proj.id)) });
      }

      if (p === '/api/section' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const proj = await getProject(env, url.searchParams.get('project') || '');
        if (!proj) return json({ error: 'no such project' }, 404);
        const r = await listSection(env, proj.id, url.searchParams.get('id') || '');
        return json(r, r.error ? 404 : 200);
      }

      /* MOVE. Allowed while the project is in setup, and after go-live too:
       * a document in the wrong section is a filing error, not a withdrawal,
       * and refusing to correct it would leave the client's own register
       * wrong for the life of the job. Deleting is what go-live closes. */
      if (p === '/api/section' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const proj = await getProject(env, String(b.project_id || ''));
        if (!proj) return json({ error: 'no such project' }, 404);
        if (b.action !== 'move') return json({ error: 'unknown action' }, 400);
        const r = await moveItems(env, proj.id, b.items, String(b.to || ''), me || { name: role });
        if (r.error) return json(r, 400);
        await audit(env, { org_id: proj.org_id, project_id: proj.id, who: (me && me.name) || role,
          action: 'section.move',
          detail: r.moved + ' moved to ' + String(b.to || '') +
                  (r.results.some((x) => !x.ok) ? ', ' + r.results.filter((x) => !x.ok).length + ' refused' : '') });
        if (r.moved) await lapseAll(env, proj.id, 'documents moved').catch(() => {});
        return json(r);
      }

      if (p === '/api/project-check' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const wantPid = url.searchParams.get('project') || '';
        await ensureProjectColumn(env, 'contract_ref');
        const proj = await getProject(env, wantPid);
        if (!proj) return json({ error: 'no such project' }, 404);

        const one = async (sql, ...args) => {
          try { return await env.DB.prepare(sql).bind(...args).first(); }
          catch (e) { return null; }                    // table not migrated yet
        };
        const many = async (sql, ...args) => {
          try { const { results } = await env.DB.prepare(sql).bind(...args).all(); return results || []; }
          catch (e) { return []; }
        };

        const dw = await many(
          `SELECT COALESCE(NULLIF(kind,''),'other') AS kind,
                  COUNT(*) AS n,
                  SUM(CASE WHEN COALESCE(status,'current') = 'current' THEN 1 ELSE 0 END) AS live
             FROM drawings WHERE project_id = ? GROUP BY kind`, wantPid);
        const drawings = { total: 0, live: 0, by_kind: {} };
        for (const r of dw) {
          drawings.total += Number(r.n) || 0;
          drawings.live += Number(r.live) || 0;
          drawings.by_kind[r.kind] = { total: Number(r.n) || 0, live: Number(r.live) || 0 };
        }

        await ensureLibraryTable(env);
        const lb = await many(
          `SELECT COALESCE(NULLIF(class,''),'other') AS class, COUNT(*) AS n, SUM(COALESCE(bytes,0)) AS b
             FROM library WHERE project_id = ? GROUP BY class`, wantPid);
        const library = { total: 0, bytes: 0, by_class: {} };
        for (const r of lb) {
          library.total += Number(r.n) || 0;
          library.bytes += Number(r.b) || 0;
          library.by_class[r.class] = Number(r.n) || 0;
        }

        await ensureBoqTable(env);
        const boqRow = await one(
          `SELECT COUNT(*) AS n, ${SQL_SUM_FILS('amount')} / 100.0 AS total FROM boq WHERE project_id = ?`, wantPid);
        const actRow = await one(
          `SELECT COUNT(*) AS n FROM activities WHERE project_id = ? AND COALESCE(level,1) >= 1`, wantPid);

        const team = await projectTeam(env, proj.org_id, wantPid).catch(() => []);
        const people = (team || []).map((u) => ({
          name: u.name, role: u.role, status: u.status || 'active', has_email: !!u.email,
        }));

        let pterms = {}; try { pterms = JSON.parse(proj.payment_terms || '{}') || {}; } catch (e) {}
        let cref = {}; try { cref = JSON.parse(proj.contract_ref || '{}') || {}; } catch (e) {}
        const logos = LOGO_FIELDS.filter((k) => proj[k]);

        // What would embarrass us at handover, in the order it would be noticed.
        const gaps = [];
        if (!people.length) gaps.push('Nobody is on this project — no one can sign in');
        else if (!people.some((p2) => p2.status === 'active')) {
          gaps.push('Nobody has accepted their invitation yet');
        }

        /* THE ORGANISATION GAP, which is the one that used not to exist.
         *
         * A ladder step assigned to a role nobody on this project holds is a
         * record that will be raised and then stop. It is not an error anybody
         * sees — the register simply fills with records nobody can move, and
         * after go-live there is nobody outside the project to notice.
         *
         * So every step of every record type is checked against who is
         * actually here, and the gap names the record type rather than the
         * step id, because that is what somebody has to go and fix. */
        try {
          const held = {};
          for (const u of people) for (const f of userFunctions(u)) held[f] = 1;
          const ladders = await listWorkflow(env, proj.id);
          const stuck = [];
          for (const w of ladders) {
            const dead = w.steps.filter((st) => !(st.by || []).some((r) => held[r]));
            if (dead.length) stuck.push(w.label);
          }
          if (people.length && stuck.length) {
            gaps.push('Nobody holds a role that can sign ' +
              stuck.slice(0, 3).join(', ') +
              (stuck.length > 3 ? ' and ' + (stuck.length - 3) + ' more' : '') +
              ' — records of those kinds would be raised and then stop');
          }
        } catch (e) { /* the ladders are not available; the other gaps still stand */ }
        if (!drawings.total && !library.total) gaps.push('No documents have been loaded');
        if (!(Number(boqRow && boqRow.n) || 0)) gaps.push('No BOQ imported');
        if (!(Number(actRow && actRow.n) || 0)) gaps.push('No programme loaded');
        if (!gateConfigured(proj)) gaps.push('The drawing gate is not configured');
        if (!proj.retention_pct && !Object.keys(pterms).length) gaps.push('Payment terms are not set');
        if (!Object.keys(cref).length) gaps.push('Contract reference is not filled in');
        try {
          const v = await verifyState(env, proj.id, people);
          if (!v.nobody && !v.ready) {
            gaps.push((v.total - v.done) + ' of ' + v.total +
              ' dashboards have not been checked as the people who will use them see them');
          }
        } catch (e) { /* the checks are unavailable; the rest still stands */ }
        if (!logos.length) gaps.push('No logos set — documents will print unbranded');
        else if (logos.length < LOGO_FIELDS.length) {
          gaps.push('Some logos are missing: ' +
            LOGO_FIELDS.filter((k) => !proj[k]).map((k) => k.replace('logo_', '')).join(', '));
        }

        return json({
          project: {
            id: proj.id, name: proj.name, ref: proj.ref || null,
            org_id: proj.org_id, state: proj.setup_state || 'live',
            archived: !!proj.archived,
            // The contract sum is the priced bill's total, the same figure the
            // payment terms read. There is no contract_value column and inventing
            // one here would let two numbers disagree.
            contract: Number(boqRow && boqRow.total) || null,
            modules: (modulesOf(proj) || []).length,
          },
          drawings,
          library,
          boq: { lines: Number(boqRow && boqRow.n) || 0, total: Number(boqRow && boqRow.total) || 0 },
          programme: { activities: Number(actRow && actRow.n) || 0,
                       fresh: await programmeFreshness(env, proj).catch(() => null) },
          terms: { payment: Object.keys(pterms).length > 0 || !!proj.retention_pct,
                   contract_ref: Object.keys(cref).length > 0 },
          gate: { configured: gateConfigured(proj), rules: (rulesOf(proj) || []).length },
          branding: { set: logos.length, of: LOGO_FIELDS.length,
                      missing: LOGO_FIELDS.filter((k) => !proj[k]).map((k) => k.replace('logo_', '')) },
          people,
          gaps,
          ready: gaps.length === 0,
        });
      }
      if (p === '/api/setup/contract-terms' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        await ensureProjectColumn(env, 'contract_ref');
        const proj = await getProject(env, url.searchParams.get('project') || '');
        if (!proj) return json({ error: 'no such project' }, 404);
        let terms = {}; try { terms = JSON.parse(proj.contract_ref || '{}') || {}; } catch (e) {}
        return json({ project_id: proj.id, terms });
      }
      if (p === '/api/setup/contract-terms' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        await ensureProjectColumn(env, 'contract_ref');
        const b = await req.json().catch(() => ({}));
        const proj = await getProject(env, String(b.project_id || ''));
        if (!proj) return json({ error: 'no such project' }, 400);
        const t = b.terms || {};
        const LABEL = { performance_bond_pct: 'Performance bond %', all_risk_insurance_aed: 'All-risk insurance (AED)',
          commencement_days: 'Commencement period (days)', mobilization_days: 'Mobilization (calendar days)',
          construction_months: 'Construction (calendar months)', testing_handover_days: 'Testing, commissioning & handover (calendar days)',
          dlp_months: 'Defects liability period (months)', ld_owner_aed_per_day: 'Liquidated damages to Owner (AED/day)',
          ld_owner_cap_pct: 'Liquidated damages to Owner — cap % of contract', ld_engineer_aed_per_day: 'Liquidated damages to Engineer (AED/day)' };
        const v = {};
        for (const k of Object.keys(LABEL)) {
          if (t[k] === undefined || t[k] === '' || t[k] === null) continue;
          const n = Number(t[k]);
          if (!Number.isFinite(n) || n < 0) return json({ error: LABEL[k] + ': enter a number of 0 or more' }, 400);
          if (k.endsWith('_pct') && n > 100) return json({ error: LABEL[k] + ': enter 0 to 100' }, 400);
          v[k] = n;
        }
        await env.DB.prepare(`UPDATE projects SET contract_ref = ? WHERE id = ?`).bind(JSON.stringify(v), proj.id).run();
        await audit(env, { org_id: proj.org_id, project_id: proj.id, who: 'AETRAA Admin', action: 'contract-terms', detail: JSON.stringify(v).slice(0, 300) });
        return json({ ok: true, terms: v });
      }
      // Company email domains — who may be added to a company.
      if (p === '/api/setup/company-email' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const r = await setOrgEmailDomains(env, String(b.company_id || ''), b.email_domains, b.email_allowed);
        if (!r.error) await audit(env, { org_id: String(b.company_id), who: 'AETRAA Admin', action: 'company.email',
          detail: (r.email_domains.join(', ') || '(not locked)') + (r.email_allowed.length ? ' + ' + r.email_allowed.join(', ') : '') });
        return json(r, r.error ? 400 : 200);
      }
      /* THE ADMIN'S HOME — every project on the platform, in one call.
       *
       * Until now an Admin arrived at a setup console with a project dropdown
       * on it, and every other admin screen had a dropdown of its own. Five
       * screens, five pickers, no way to see the estate at once and no way
       * home. This is the one place a project is chosen, and after that it is
       * carried in the address rather than re-picked on each screen.
       *
       * One pass over each table rather than a per-project query, because this
       * is the first thing loaded on every visit and it has to be quick even
       * when there are eighty projects.
       */
      if (p === '/api/admin-home') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        await ensureModulesColumn(env).catch(() => {});
        await ensureProjectColumn(env, 'contract_ref').catch(() => {});

        const orgs = (await listOrgs(env)) || [];
        const orgName = {};
        for (const o of orgs) orgName[o.id] = o.name;

        const projs = (await env.DB.prepare(
          `SELECT id, org_id, name, ref, setup_state, archived, retention_pct, contract_ref, created_at
             FROM projects WHERE id NOT LIKE '%--test' ORDER BY sort_order`).all().catch(() => ({ results: [] }))).results || [];

        // COUNT(*) and SUM() arrive as STRINGS from PostgreSQL — bigint and
        // numeric do not fit a JavaScript number, so the driver hands them over
        // as text. Coerced here rather than at each use, because one missed use
        // is a screen printing "0210109".
        const tally = async (sql, key) => {
          const out = {};
          try {
            const { results } = await env.DB.prepare(sql).all();
            for (const r of results || []) {
              const n = Number(r[key]);
              out[r.project_id] = Number.isFinite(n) ? n : 0;
            }
          } catch (e) { /* the table may not exist yet */ }
          return out;
        };
        const dwg  = await tally(`SELECT project_id, COUNT(*) AS n FROM drawings GROUP BY project_id`, 'n');
        const live = await tally(`SELECT project_id, COUNT(*) AS n FROM drawings WHERE status='current' GROUP BY project_id`, 'n');
        const lib  = await tally(`SELECT project_id, COUNT(*) AS n FROM library GROUP BY project_id`, 'n');
        const boqN = await tally(`SELECT project_id, COUNT(*) AS n FROM boq GROUP BY project_id`, 'n');
        const boqT = await tally(`SELECT project_id, ${SQL_SUM_FILS('amount')} / 100.0 AS t FROM boq GROUP BY project_id`, 't');
        const acts = await tally(`SELECT project_id, COUNT(*) AS n FROM activities GROUP BY project_id`, 'n');
        const sign = await tally(`SELECT project_id, COUNT(*) AS n FROM project_signoff GROUP BY project_id`, 'n');

        // People, per project. users.project_ids is a JSON list, so this is the
        // one thing that cannot be a GROUP BY.
        const allUsers = [];
        for (const o of orgs) {
          const us = await listUsers(env, o.id).catch(() => []);
          for (const u of us || []) allUsers.push(u);
        }

        const out = [];
        for (const pr of projs) {
          const mine = allUsers.filter((u) => u.org_id === pr.org_id && userInProject(u, pr.id));
          const people = mine.map((u) => ({ name: u.name, email: u.email, status: u.status, functions: userFunctions(u) }));
          let checks = { total: 0, done: 0, ready: false, nobody: true };
          try { checks = await verifyState(env, pr.id, people); } catch (e) { /* not available */ }

          out.push({
            id: pr.id, name: pr.name, ref: pr.ref || '', company: orgName[pr.org_id] || '',
            org_id: pr.org_id, state: pr.setup_state || 'live', archived: !!pr.archived,
            created_at: pr.created_at || '',
            drawings: dwg[pr.id] || 0, drawings_live: live[pr.id] || 0,
            documents: lib[pr.id] || 0,
            boq_lines: boqN[pr.id] || 0, boq_total: boqT[pr.id] || 0,
            activities: acts[pr.id] || 0,
            people: people.length,
            people_active: people.filter((u) => u.status === 'active').length,
            checks: { total: checks.total, done: checks.done, ready: checks.ready, nobody: checks.nobody },
            // WHAT TO DO NEXT, in the order it has to be done. A card that says
            // "3 of 9" tells an Admin nothing about which screen to open; this
            // names the screen.
            next: nextStep(pr, people.length, (dwg[pr.id] || 0) + (lib[pr.id] || 0), checks),
          });
        }
        return json({ ok: true, projects: out, companies: orgs });
      }

      if (p === '/api/setup/companies') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        await ensureModulesColumn(env);
        await ensureOrgEmailColumns(env);
        const orgs = (await listOrgs(env)) || [];
        const projs = await env.DB.prepare(
          `SELECT id, org_id, name, ref, setup_state, archived, modules FROM projects WHERE id NOT LIKE '%--test' ORDER BY sort_order`
        ).all().catch(() => ({ results: [] }));
        return json({ companies: orgs, projects: projs.results || [] });
      }
      /* REPORTS & DISTRIBUTION, for one project, from its own Setup.
       *
       * The recipients and the daily / weekly / monthly switches existed, but
       * only on the client's own admin page — not on the Setup of the project
       * being handed over, where they are set before anybody on the client
       * side has signed in. The same columns, the same sender, the same times;
       * the setting has simply moved to where it is decided. */
      if (p === '/api/setup/reports' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const proj = await getProject(env, url.searchParams.get('project') || '');
        if (!proj) return json({ error: 'no such project' }, 404);
        const driver = emailDriver(env);
        const ready = driver !== 'none' && !(driver === 'azure' && !env.REPORT_FROM);
        const hour = (k, d) => String(Number(env[k] || d)).padStart(2, '0') + ':00';
        return json({
          ok: true, project_id: proj.id,
          recipients: parseRecipients(proj.report_emails),
          daily: !!Number(proj.report_daily), weekly: !!Number(proj.report_weekly),
          monthly: !!Number(proj.report_monthly), digest: !!Number(proj.report_digest),
          // Said plainly, because "reports are switched on" means nothing if
          // the server has no way to send them.
          email: { driver, ready, label: EMAIL_DRIVER_LABEL[driver] || 'not configured',
                   why: driver === 'none' ? 'No email sender is configured on the server.'
                      : !ready ? 'The sender address (REPORT_FROM) is not set on the server.' : '' },
          schedule: { daily: hour('DAILY_HOUR', 18), weekly: 'Monday ' + hour('WEEKLY_HOUR', 7),
                      monthly: '1st of the month ' + hour('MONTHLY_HOUR', 8), digest: hour('DIGEST_HOUR', 6) },
          programme: await programmeFreshness(env, proj),
        });
      }
      if (p === '/api/setup/reports' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const proj = await getProject(env, String(b.project_id || ''));
        if (!proj) return json({ error: 'no such project' }, 400);
        if (b.action === 'test') {
          // A test goes to the project's own list and nowhere else — never to
          // an address typed into this request.
          const kind = ['daily', 'weekly', 'monthly'].includes(b.kind) ? b.kind : 'daily';
          const r = await emailReport(env, proj.id, kind, '');
          await audit(env, { org_id: proj.org_id, project_id: proj.id, who: 'AETRAA Admin',
            action: 'report.test', detail: kind + ' \u2014 ' + (r.ok ? 'sent to ' + r.sent : (r.error || 'failed')) });
          return json(r, r.ok ? 200 : 400);
        }
        const list = parseRecipients(b.recipients);
        if (String(b.recipients || '').trim() && !list.length) {
          return json({ error: 'None of those is an email address, so nothing would be sent.' }, 400);
        }
        const anyOn = b.daily || b.weekly || b.monthly || b.digest;
        if (anyOn && !list.length && !b.digest) {
          return json({ error: 'Add at least one recipient \u2014 a report switched on with nobody to send it to '
                             + 'looks set up and never arrives.' }, 400);
        }
        // The switch columns arrived in separate migrations. Each is made sure
        // of first, or a database that missed one would refuse the whole save.
        await ensureReportMonthly(env).catch(() => {});
        await ensureReportDigest(env).catch(() => {});
        await addColumns(env, 'projects', [['report_weekly', 'INTEGER DEFAULT 0']]);
        await env.DB.prepare(
          'UPDATE projects SET report_emails = ?, report_daily = ?, report_weekly = ?, report_monthly = ?, report_digest = ? WHERE id = ?'
        ).bind(list.join(', ') || null, b.daily ? 1 : 0, b.weekly ? 1 : 0, b.monthly ? 1 : 0, b.digest ? 1 : 0,
               proj.id).run();
        await audit(env, { org_id: proj.org_id, project_id: proj.id, who: 'AETRAA Admin', action: 'report.settings',
          detail: list.length + ' recipients \u00b7 ' + ['daily', 'weekly', 'monthly', 'digest'].filter((k) => b[k]).join(', ') });
        return json({ ok: true, recipients: list });
      }
      if (p === '/api/setup/onboard' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const r = await onboardProject(env, b, sha256);
        if (!r.error) {
          await audit(env, { org_id: r.company_id, project_id: r.project_id, who: 'AETRAA Admin',
            action: 'project.onboard', detail: (b.project && b.project.name) || '' });
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/setup/project' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        if (!b.company_id) return json({ error: 'which company?' }, 400);
        const r = await createProjectForCompany(env, b.company_id, b.project || b);
        return json(r, r.error ? 400 : 200);
      }
      // The programme — a Primavera .xer becomes the project's spine.
      if ((p === '/api/setup/xer/preview' || p === '/api/setup/xer/commit') && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const wantPid = String(b.project_id || '');
        if (!wantPid) return json({ error: 'which project?' }, 400);
        // Needed for the audit row below: an entry with no org never shows in
        // the trail, which is how the last import went unrecorded.
        const xerProj = await getProject(env, wantPid);
        if (!xerProj) return json({ error: 'no such project' }, 404);
        let bytes;
        try { bytes = b64ToBytes(b.file_b64 || ''); }
        catch (e) { return json({ error: 'could not read that upload' }, 400); }
        if (!bytes || !bytes.length) return json({ error: 'no file received' }, 400);
        if (bytes.length > 20 * 1024 * 1024) return json({ error: 'that .xer is too large (20 MB limit)' }, 400);

        const tables = parseXER(decodeXer(bytes));
        const built = buildProgramme(tables, { disciplineByBranch: b.discipline_by_branch || {} });
        if (built.error) return json({ error: built.error }, 400);

        const leads = Object.assign({}, DEFAULT_LEADS, b.leads || {});
        const derived = deriveDeliverables(built.activities, leads);

        if (p === '/api/setup/xer/preview') {
          return json({
            ok: true, data_date: built.dataDate, total: built.activities.length,
            branches: built.branches, counts: built.counts, unassigned: built.unassigned,
            will_derive: derived.length,
            derive_breakdown: derived.reduce((m, d) => { m[d.kind] = (m[d.kind] || 0) + 1; return m; }, {}),
            sample: built.activities.slice(0, 8).map((a) => ({
              id: a.id, name: a.name, wbs: a.wbs, branch: a.branch,
              start: a.planned_start, kind: a.kind, discipline: a.discipline,
            })),
            leads,
          });
        }
        const saved = await saveProgramme(env, wantPid, built.activities.concat(derived),
          { replace: b.replace !== false });
        if (saved.error) return json({ error: saved.error }, 500);
        // The logic, calendars, durations, status and float too — so forecasts
        // work from the first import, not only after a separate logic load.
        try { await applyLogic(env, wantPid, extractLogic(tables)); }
        catch (e) { console.error('programme logic not loaded:', e && e.message); }
        // With the org, or listAudit — which filters by org — never shows it.
        await audit(env, { org_id: xerProj.org_id, project_id: wantPid, who: 'AETRAA Admin',
          action: 'programme.import',
          detail: saved.saved + ' lines (' + derived.length + ' derived) \u00b7 data date '
                + (built.dataDate || 'not stated') });
        return json({ ok: true, saved: saved.saved, from_programme: built.activities.length,
          derived: derived.length, counts: built.counts });
      }
      // Authorities — which NOCs this project has to clear.
      if (p === '/api/setup/authorities' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const wantPid = url.searchParams.get('project') || '';
        const proj = wantPid ? await getProject(env, wantPid) : null;
        await ensureRecordsTable(env);
        const already = wantPid ? await listRecords(env, wantPid, 'authority') : [];
        return json({
          library: AUTHORITIES,
          suggested: emirateFor(proj && (proj.location || proj.name)),
          existing: (already || []).map((r) => ({ ref: r.ref, name: r.title, status: r.status })),
        });
      }
      if (p === '/api/setup/authorities' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        await ensureRecordsTable(env);
        const r = await seedAuthorities(env, String(b.project_id || ''), b.authorities || [],
          createRecord, 'AETRAA Admin');
        return json(r, r.error ? 400 : 200);
      }
      // Consultant document templates — one Word form per document type.
      if (p === '/api/setup/templates' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const wantPid = url.searchParams.get('project') || '';
        return json({
          templates: wantPid ? await listTemplates(env, wantPid) : [],
          doc_types: DOC_TYPES, standard_tokens: STANDARD_TOKENS,
          storage: { driver: driverName(env), label: DRIVER_LABEL[driverName(env)] },
        });
      }
      // Where files are actually going, proven rather than reported. After the
      // move to Oracle this is the one call that says whether object storage is
      // really working — a misconfigured store does not fail loudly, it quietly
      // keeps everything in the database instead.
      if (p === '/api/storage') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const configured = driverName(env);
        const key = '_selftest/' + Date.now().toString(36) + '.bin';
        const probe = new Uint8Array([65, 69, 84, 82, 65, 65]);        // "AETRAA"
        const put = await putFile(env, key, probe, 'application/octet-stream');
        const got = put.ok ? await getFile(env, key) : null;
        const same = !!(got && got.bytes && got.bytes.length === probe.length &&
          got.bytes.every((v, i) => v === probe[i]));
        if (put.ok) { try { await deleteFile(env, key); } catch (e) {} }
        const gone = put.ok ? !(await getFile(env, key)) : false;
        // "Working" means the files are going where this deployment was
        // configured to put them. A file that round-trips to the wrong store is
        // not working — that is the failure this call exists to catch.
        const asConfigured = !!(put.ok && put.driver === configured);
        const working = !!(asConfigured && same && gone);
        return json({
          configured, label: DRIVER_LABEL[configured],
          wrote_to: put.driver || null,
          working,
          round_trip: { stored: !!put.ok, read_back: same, removed: gone, as_configured: asConfigured },
          note: put.ok && put.driver !== configured
            ? `Configured for ${DRIVER_LABEL[configured]}, but the file went to ${DRIVER_LABEL[put.driver]} — the object store refused it or could not be reached. Files are being kept, but not where you intended.`
            : null,
        }, working ? 200 : 500);
      }
      /* ---- K2: what each project holds (spec §8, §12), and moving the files
       * already in PostgreSQL to the object store — a dry run first, then the
       * move a batch at a time, each file read back before the database copy
       * goes. AETRAA Admin only. */
      if (p === '/api/storage/capacity' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        return json(await capacity(env));
      }
      if (p === '/api/storage/move' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        return json(await planMove(env));
      }
      if (p === '/api/storage/move' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        if (b.confirm !== 'move') return json({ error: 'Run the dry run first (GET), then send confirm: "move".' }, 400);
        const r = await runMove(env, { limit: b.limit, max_bytes: b.max_bytes });
        if (!r.error) await audit(env, { who: 'AETRAA Admin', action: 'storage.move',
          detail: r.moved + ' files (' + Math.round(r.bytes / 1024) + ' KB) to ' + r.target + (r.failed.length ? ', ' + r.failed.length + ' failed' : '') + ', ' + r.remaining.count + ' left' });
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/setup/template' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        if (b.remove) {
          const r = await deleteTemplate(env, String(b.project_id || ''), String(b.doc_type || ''));
          return json(r, r.error ? 400 : 200);
        }
        let bytes;
        try { bytes = b64ToBytes(b.file_b64 || ''); }
        catch (e) { return json({ error: 'could not read that upload' }, 400); }
        const r = await saveFormTemplate(env, String(b.project_id || ''), String(b.doc_type || ''),
          String(b.filename || 'template.docx'), bytes, 'AETRAA Admin');
        return json(r, r.error ? 400 : 200);
      }
      // Branding — the company mark and each project's logos.
      if (p === '/api/setup/branding' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        if (b.company_id) {
          const r = await setCompanyLogo(env, String(b.company_id), b.logo);
          return json(r, r.error ? 400 : 200);
        }
        const r = await setBranding(env, String(b.project_id || ''), b);
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/setup/branding' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const wantPid = url.searchParams.get('project') || '';
        const row = wantPid ? await env.DB.prepare(
          `SELECT logo_client, logo_consultant, logo_consultant2, logo_contractor FROM projects WHERE id = ?`
        ).bind(wantPid).first() : null;
        return json({ branding: row || {} });
      }
      /* ---- K1 · the priced BOQ and the BOM (v5 E7, E8).
       *
       * Nothing reaches either bill without being read and checked first
       * (src/bills.js): every line with no rate or a wrong sum is flagged, the
       * QS fixes it in the file or accepts it with a reason, the bill is
       * imported, and the PM approves it before an IPC is valued against it
       * (E7) or an order or a delivery is recorded against it (E8).
       *
       * Who: the QS (Contracts & Commercial) imports the BOQ; Procurement, or
       * the QS, imports the BOM — each on their own project only. The AETRAA
       * Admin can do both for any project while setting one up. The PM (or the
       * Principal, who holds everything the PM holds) approves, by name.
       *
       * A project id in a request is only a claim. For everybody but the Admin
       * the project is the one the router resolved and checked against the
       * person's company and projects; naming another one is refused. */
      const billAdmin = can.platform(role, me);
      const billFns = me ? userFunctions(me) : [];
      const billPidOf = (claimed) => {
        const c = String(claimed || '');
        if (billAdmin) return c || pid || '';
        if (c && c !== pid) return DENIED;
        return pid || '';
      };
      const mayImportBill = (k) => billAdmin || (k === 'bom'
        ? billFns.some((f) => f === 'procurement' || f === 'commercial')
        : billFns.includes('commercial'));
      const mayApproveBill = !!(me && billFns.some((f) => f === 'pm' || f === 'principal'));
      const mayViewBills = billAdmin || mayImportBill('boq') || mayImportBill('bom') || mayApproveBill
        || role === 'owner' || role === 'manager' || billFns.some((f) => f === 'finance' || f === 'dc');
      const billWho = (me && me.name) || (billAdmin ? 'AETRAA Admin' : role);
      const billAudit = (bpid, action, detail) => audit(env, { org_id: me ? me.org_id : null, project_id: bpid,
        user_id: me ? me.id : null, who: billWho, action, detail }).catch(() => {});

      // The older rows API (the setup console's first version, the demo seed,
      // scripts). The rows are checked exactly as a file is; a bill with flags
      // is imported only when the caller accepts them with a reason
      // ({ accept: { note } }), and otherwise comes back with the flags.
      if ((p === '/api/boq/import' || p === '/api/bom/import') && req.method === 'POST') {
        const kind = p === '/api/bom/import' ? 'bom' : 'boq';
        const b = await req.json().catch(() => ({}));
        const bpid = billPidOf(b.project_id);
        if (bpid === DENIED) return json({ error: 'That project is not yours to open.' }, 403);
        if (!mayImportBill(kind)) return json({ error: kind === 'bom'
          ? 'Procurement or the QS imports the bill of materials.' : 'The QS (Contracts & Commercial) imports the priced BOQ.' }, 403);
        if (!bpid) return json({ error: 'which project?' }, 400);
        const st = await stageBill(env, bpid, { kind, source: 'api', rows: Array.isArray(b.rows) ? b.rows : [] }, { who: billWho });
        if (st.error) return json(st, 400);
        if (st.flags_open && b.accept && String(b.accept.note || '').trim()) {
          await acceptFlags(env, bpid, st.id, { all: true, note: b.accept.note }, billWho);
        }
        const c = await commitBill(env, bpid, st.id, billWho);
        if (c.error) return json({ ...c, check: st }, 409);
        await billAudit(bpid, kind + '.import', c.lines + ' lines · ' + c.total + ' · waiting for the PM');
        return json(c);
      }

      if (p.startsWith('/api/bills')) {
        if (!mayViewBills) return json({ error: 'the BOQ and BOM are not part of your access' }, 403);
        const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        const bpid = billPidOf(url.searchParams.get('project') || b.project_id);
        if (bpid === DENIED) return json({ error: 'That project is not yours to open.' }, 403);
        if (!bpid) return json({ error: 'which project?' }, 400);
        const out = (r) => json(r, r && r.error ? 400 : 200);

        if (p === '/api/bills' && req.method === 'GET') {
          const st = await billState(env, bpid);
          if (!st) return json({ error: 'no such project' }, 404);
          const proj = await getProject(env, bpid);
          return json({ ...st, project: { id: bpid, name: proj && proj.name },
            modules: { boq: !mods || mods.includes('commercial'), bom: !mods || mods.includes('procurement') },
            may: { import_boq: mayImportBill('boq'), import_bom: mayImportBill('bom'), approve: mayApproveBill } });
        }
        if (p === '/api/bills/check' && req.method === 'GET') {
          const imp = await getImport(env, bpid, url.searchParams.get('id'));
          if (!imp) return json({ error: 'no such bill check' }, 404);
          const lines = imp._lines;
          delete imp._lines;
          return json({ ...imp, lines: lines.slice(0, 3000), lines_shown: Math.min(lines.length, 3000) });
        }
        if (p === '/api/bills/file' && req.method === 'GET') {
          const row = await env.DB.prepare('SELECT filename, file_key FROM bill_imports WHERE project_id = ? AND id = ?')
            .bind(bpid, String(url.searchParams.get('id') || '')).first().catch(() => null);
          const f = row && row.file_key ? await getFile(env, row.file_key) : null;
          if (!f) return json({ error: 'that file is not kept' }, 404);
          return new Response(f.bytes, { headers: { 'Content-Type': f.mime || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff',
            'Content-Disposition': 'attachment; filename="' + String(row.filename || 'bill').replace(/["\\\r\n]/g, '') + '"', 'Cache-Control': 'no-store' } });
        }
        if (p === '/api/bills/match' && req.method === 'GET') {
          return json({ matching: await bomMatching(env, bpid), boq: await boqChoices(env, bpid) });
        }
        const moduleOff = (k) => mods && !mods.includes(k === 'bom' ? 'procurement' : 'commercial');
        if (p === '/api/bills/approve' && req.method === 'POST') {
          const kind = b.kind === 'bom' ? 'bom' : 'boq';
          if (moduleOff(kind)) return json({ error: 'That module is not switched on for this project.' }, 403);
          if (!mayApproveBill) return json({ error: 'The PM approves the ' + KIND_LABEL[kind] + ', by name.' }, 403);
          const r = await approveBill(env, bpid, kind, billWho);
          if (r.ok && !r.already) await billAudit(bpid, kind + '.approve', KIND_LABEL[kind] + ' approved');
          return out(r);
        }
        if (req.method !== 'POST') return json({ error: 'not found' }, 404);

        // Everything below changes a bill: the importer of that kind only.
        let kind = b.kind === 'bom' ? 'bom' : 'boq';
        if (b.id) {
          const imp = await getImport(env, bpid, b.id);
          if (!imp) return json({ error: 'no such bill check' }, 404);
          kind = imp.kind;
        }
        if (p === '/api/bills/match') kind = 'bom';
        if (moduleOff(kind)) return json({ error: 'That module is not switched on for this project.' }, 403);
        if (!mayImportBill(kind)) return json({ error: kind === 'bom'
          ? 'Procurement or the QS works on the bill of materials.' : 'The QS (Contracts & Commercial) works on the priced BOQ.' }, 403);

        if (p === '/api/bills/upload') {
          const bytes = b.data ? b64ToBytes(String(b.data)) : null;
          if (!bytes || !bytes.length) return json({ error: 'no file received' }, 400);
          if (bytes.length > MAX_BILL_BYTES) return json({ error: 'that file is larger than 25 MB — a bill is far smaller; check it is the right file' }, 400);
          const r = await stageBill(env, bpid, { kind, source: 'upload', filename: String(b.filename || 'bill.xlsx').slice(0, 200), bytes,
            include_sheets: Array.isArray(b.include_sheets) ? b.include_sheets.map(String) : null }, { who: billWho });
          if (!r.error) await billAudit(bpid, kind + '.check', (r.filename || '') + ' · ' + r.line_count + ' lines · ' + r.flags_total + ' flagged');
          return out(r);
        }
        if (p === '/api/bills/sheets') {
          return out(await restageBill(env, bpid, b.id, Array.isArray(b.include_sheets) ? b.include_sheets.map(String) : [], { who: billWho }));
        }
        if (p === '/api/bills/accept') {
          const r = await acceptFlags(env, bpid, b.id, b, billWho);
          if (!r.error) await billAudit(bpid, kind + '.accept', r.accepted_now + ' flagged line(s) accepted: ' + String(b.note || '').slice(0, 200));
          return out(r);
        }
        if (p === '/api/bills/commit') {
          const r = await commitBill(env, bpid, b.id, billWho);
          if (!r.error) await billAudit(bpid, kind + '.import', r.lines + ' lines · ' + r.total + ' · waiting for the PM');
          return json(r, r.error ? (r.flags_open ? 409 : 400) : 200);
        }
        if (p === '/api/bills/discard') {
          const r = await discardBill(env, bpid, b.id, billWho);
          if (!r.error) await billAudit(bpid, kind + '.discard', String(b.id || ''));
          return out(r);
        }
        if (p === '/api/bills/match') {
          const r = await resolveBom(env, bpid, b, billWho);
          if (!r.error) await billAudit(bpid, 'bom.match', b.confirm_all ? 'all proposed matches confirmed'
            : (b.mkey || '') + (b.not_in_boq != null ? ' — not in the BOQ: ' + String(b.not_in_boq).slice(0, 120) : ''));
          return out(r);
        }
        return json({ error: 'not found' }, 404);
      }

      if (p === '/api/boq' && req.method === 'GET') {
        // The AETRAA Admin (any project) or a signed-in user's own project —
        // never another company's by naming it.
        const wantPid = billPidOf(url.searchParams.get('project'));
        if (wantPid === DENIED) return json({ error: 'That project is not yours to open.' }, 403);
        if (!billAdmin && !(me && wantPid)) return json({ error: 'auth' }, 401);
        await ensureBoqTable(env);
        const d = await listBOQ(env, wantPid);
        const st = d && d.lines.length ? await billState(env, wantPid) : null;
        return json(d === null ? { migrated: false, lines: [], sections: [], totals: {} }
          : { migrated: true, ...d, state: st ? st.boq.state : 'none', approved_by: st ? st.boq.approved_by : null });
      }
      // BOM — budget quantities, orders and GRN. The BOM belongs to the PM and
      // the commercial team: a site engineer raises a request but never sees the
      // budget, so 'site' is excluded here by design.
      if (p.startsWith('/api/bom')) {
        const fns = billFns;
        const bomOk = billAdmin || role === 'owner' || role === 'manager'
          || fns.includes('commercial') || fns.includes('procurement') || fns.includes('finance');
        if (!bomOk) return json({ error: 'the BOM is not part of your access' }, 403);
        const bomPid = billPidOf(url.searchParams.get('project'));
        if (bomPid === DENIED) return json({ error: 'That project is not yours to open.' }, 403);
        if (!bomPid) return json({ error: 'no project' }, 400);
        await ensureBomTable(env);
        if (p === '/api/bom' && req.method === 'GET') {
          const d = await listBOM(env, bomPid);
          const moves = await listMoves(env, bomPid, 50);
          const pending = d && d.lines.length ? await billIsPending(env, bomPid, 'bom') : false;
          return json(d === null ? { migrated: false, lines: [], totals: {} } : { migrated: true, ...d, moves, pending });
        }
        const bb = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        const whoName = (me && me.name) || role;
        if (p === '/api/bom/check' && req.method === 'POST') {
          return json(await checkOrder(env, bomPid, bb.material, bb.qty));
        }
        // E8 step 4: the approved BOM drives orders and deliveries.
        if ((p === '/api/bom/order' || p === '/api/bom/grn') && req.method === 'POST' && await billIsPending(env, bomPid, 'bom')) {
          return json({ error: BOM_PENDING, bom_pending: true }, 409);
        }
        if (p === '/api/bom/order' && req.method === 'POST') {
          return json(await recordOrder(env, bomPid, bb, whoName));
        }
        if (p === '/api/bom/grn' && req.method === 'POST') {
          return json(await recordGRN(env, bomPid, bb, whoName));
        }
      }
      if (p === '/api/boq/bill' && req.method === 'POST') {
        if (!can.money(role) && !billAdmin) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const wantPid = billPidOf(b.project_id);
        if (wantPid === DENIED) return json({ error: 'That project is not yours to open.' }, 403);
        return json(await setBilled(env, wantPid, b));
      }

      if (!pid && p.startsWith('/api/')) return json({ error: 'no project' }, 400);

      if (p === '/api/data') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        return json(await getData(env, pid, scope));
      }
      if (p === '/api/trades') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        return await getTrades(env, pid, scope);
      }
      if (p === '/api/site-data') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const trade = url.searchParams.get('trade');
        if (!trade) return json({ error: 'trade required' }, 400);
        return await getSiteData(env, pid, trade, scope);
      }
      if (p === '/api/update' && req.method === 'POST') {
        if (!can.submit(role)) return json({ error: 'auth' }, 401);
        return await postUpdate(req, env, role, pid, scope,
          (await getProject(env, pid) || {}).proof_at_100 !== 0, me ? me.name : null);
      }
      if (p === '/api/manpower' && req.method === 'POST') {
        if (!can.submit(role)) return json({ error: 'auth' }, 401);
        return await postManpower(req, env, role, pid, me ? me.name : null);
      }
      if (p === '/api/photo' && req.method === 'POST') {
        if (!can.submit(role)) return json({ error: 'auth' }, 401);
        return await postPhoto(req, env, role, pid, me ? me.name : null);
      }
      if (p.startsWith('/photo/')) {
        if (!can.view(role)) return new Response('auth', { status: 401 });
        return await servePhoto(env, pid, p.slice(7));
      }
      if (p === '/api/import' && req.method === 'POST') {
        if (!can.admin(role)) return json({ error: 'auth' }, 401);
        return await postImport(req, env, pid);
      }
      if (p === '/api/import-progress' && req.method === 'POST') {
        if (!can.admin(role)) return json({ error: 'auth' }, 401);
        return await postImportProgress(req, env, pid);
      }
      if (p === '/api/import-targets' && req.method === 'POST') {
        if (!can.admin(role)) return json({ error: 'auth' }, 401);
        return await postImportTargets(req, env, pid);
      }
      if (p === '/api/export') {
        if (!can.export(role)) return json({ error: 'auth' }, 401);
        return await exportCSV(env, pid);
      }
      if (p === '/api/report') {
        if (!mayReport(role, me)) return json({ error: 'auth' }, 401);
        const project = await getProject(env, pid);
        const d = await buildReport(env, pid, project, url.searchParams.get('kind'), url.searchParams.get('key'));
        // format=doc: the same report as a file Word opens and edits.
        if (url.searchParams.get('format') === 'doc') {
          return new Response(reportWord(d), {
            headers: { 'Content-Type': 'application/msword; charset=utf-8', 'Cache-Control': 'no-store',
              'Content-Disposition': 'attachment; filename="' + reportFileName(d) + '.doc"' },
          });
        }
        return new Response(reportHTML(d), {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
      /* ---- AI drafting. One door (src/ai.js), Claude today and a self-hosted
              open model later, chosen by configuration. Off until a key is set;
              every output is a draft a person signs. */
      if (p === '/api/ai/report-narrative' && req.method === 'POST') {
        if (!can.report(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const project = await getProject(env, pid);
        const r = await reportNarrative(env, pid, project,
          b.kind === 'monthly' ? 'monthly' : 'weekly', str(b.key, 20),
          (me && me.name) || role);
        if (!r.error) {
          await audit(env, { org_id: me ? me.org_id : null, project_id: pid,
            user_id: me ? me.id : null, who: (me && me.name) || role,
            action: 'ai.report-narrative', detail: r.period ? r.period.from + '..' + r.period.to : '' });
        }
        return json(r, r.error ? (r.disabled ? 200 : 400) : 200);
      }
      if (p === '/api/ai/status' && req.method === 'GET') {
        // So a screen can show or hide the AI buttons honestly, and the AETRAA
        // Admin can see what has been spent.
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        return json({
          enabled: aiEnabled(env),
          usage: can.platform(role, me) ? await aiUsageSummary(env, pid) : undefined,
        });
      }

      if (p === '/api/verify' && req.method === 'GET') {
        if (!can.verify(role)) return json({ error: 'auth' }, 401);
        const counts = await verifyCounts(env, pid, scopeSql(scope, 'a'));
        if (counts === null) return json({ migrated: false, claims: [], counts: {} });
        const claims = await listQueue(env, pid, {
          state: url.searchParams.get('state') || 'awaiting',
          complete: url.searchParams.get('complete') === '1',
          scopeSql: scopeSql(scope, 'a'),
        });
        const photos = await photosFor(env, pid, claims.map((c) => c.id));
        return json({ migrated: true, counts, claims, photos });
      }
      if (p === '/api/verify' && req.method === 'POST') {
        if (!can.verify(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        if (!isFullScope(scope)) {
          const ok = await activitiesInScope(env, pid, scope, [String(b.activity_id || '')]);
          if (!ok.has(String(b.activity_id || ''))) return json({ error: 'outside your trades' }, 403);
        }
        const r = await setVerdict(env, pid, b, (me && me.name) || str(b.by, 120) || role);
        return json(r, r.error ? 400 : 200);
      }

      if (p === '/api/resources') {
        if (!can.resources(role)) return json({ error: 'auth' }, 401);
        const project = await getProject(env, pid);
        const d = await buildResources(env, pid, project, {
          from: url.searchParams.get('from'), to: url.searchParams.get('to'),
        });
        // Stripped here rather than hidden in the page, so the figures never
        // travel to somebody not entitled to them.
        return json(can.money(role) ? d : withoutMoney(d));
      }
      if (p === '/api/rate' && req.method === 'POST') {
        if (!can.money(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const r = await saveRate(env, pid, b);
        if (!r.error) {
          await audit(env, { org_id: me ? me.org_id : null, project_id: pid,
            user_id: me ? me.id : null, who: (me && me.name) || 'owner',
            action: 'rate', detail: `${b.kind} ${b.name}` });
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/rates') {
        if (!can.money(role)) return json({ error: 'auth' }, 401);
        const project = await getProject(env, pid);
        return json({
          rates: await loadRates(env, pid),
          materials: projectMaterials(project),
        });
      }

      /* ---- the programme, and what a delay costs */
      if (p === '/api/schedule') {
        if (!can.schedule(role)) return json({ error: 'auth' }, 401);
        const model = await loadSchedule(env, pid);
        if (model.error) return json(model, 400);
        return json(scheduleSummary(model));
      }
      if (p === '/api/impact') {
        if (!can.schedule(role)) return json({ error: 'auth' }, 401);
        const model = await loadSchedule(env, pid);
        if (model.error) return json(model, 400);
        const id = str(url.searchParams.get('activity'), 60);
        const days = Number(url.searchParams.get('days'));
        if (!id) return json({ error: 'which activity?' }, 400);
        if (!Number.isFinite(days) || days === 0) return json({ error: 'how many days?' }, 400);
        const out = cpmImpact(model.input, id, days);
        if (out.error) return json(out, 400);
        return json(dressImpact(out, model));
      }

      /* ---- the drawing register */
      if (p === '/api/drawings') {
        if (!can.drawings(role)) return json({ error: 'auth' }, 401);
        const drawings = await listDrawings(env, pid);
        if (drawings === null) return json({ migrated: false, drawings: [] });
        // Whether this person may drop a folder of drawings here (D2, §25).
        const bulkLoad = !!(pid && can.drawingsUpload(role) && (can.platform(role, me) || ((mods || (await getProjectModules(env, pid).catch(() => null)) || []).includes('bulkload'))));
        // The trades and floors to tag against come from the programme itself,
        // so a tag can only ever be something the programme actually says.
        const { results } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(trade,''),'') AS trade,
                  COALESCE(NULLIF(trade_group,''),'') AS trade_group,
                  COALESCE(NULLIF(floor,''),'') AS floor, COUNT(*) AS n
             FROM activities WHERE project_id = ? AND COALESCE(level,1) >= 1
            GROUP BY trade, trade_group, floor`
        ).bind(pid).all();
        const trades = {}, floors = new Set();
        for (const r of results || []) {
          if (r.trade) {
            (trades[r.trade] || (trades[r.trade] = { trade: r.trade, trade_group: r.trade_group, n: 0 })).n += Number(r.n) || 0;
          }
          if (r.floor) floors.add(r.floor);
        }
        return json({
          migrated: true,
          drawings,
          bulk_load: bulkLoad,
          reach: await reachFor(env, pid, drawings),
          kinds: DWG_KINDS.map((k) => [k, DWG_KIND_LABEL[k]]),
          trades: Object.values(trades).sort((a, b) => a.trade.localeCompare(b.trade)),
          floors: [...floors].sort(),
          max_bytes: DWG_MAX,
          can_edit: can.drawingsEdit(role),
          can_upload: mayUploadDrawings(role, me),
          can_approve: can.drawingsApprove(role),
          me: (me && me.name) || null,
          // K9 (A1): Document Control may read a scanned sheet awaiting
          // approval with AI — when AI is on, and the project's AI module is.
          ai_read: !!((can.platform(role, me) || (me && userFunctions(me).includes('dc'))) && aiEnabled(env) && (!mods || mods.includes('ai'))),
        });
      }
      if (p === '/api/drawing' && req.method === 'POST') {
        if (!mayUploadDrawings(role, me)) return json({ error: 'Uploading drawings is for Design and Document Control.' }, 403);
        const b = await req.json().catch(() => ({}));
        const who = (me && me.name) || str(b.by, 120) || role;
        const canApprove = can.drawingsApprove(role);
        let r;
        if (b.remove) {
          // The lock applies to removal too: an engineer can pull back only their
          // own sheet, and only while it is still pending or rejected.
          if (!canApprove) {
            const cur = await getDrawing(env, pid, str(b.id, 60));
            if (!cur) r = { error: 'unknown drawing' };
            else if (cur.status === 'current' || cur.status === 'superseded') {
              r = { error: 'that drawing is approved — only the project manager can remove it' };
            } else if (cur.uploaded_by && who !== cur.uploaded_by) {
              r = { error: 'that drawing was uploaded by someone else' };
            }
          }
          if (!r) r = await removeDrawing(env, pid, str(b.id, 60));
        } else {
          // The project row carries the gate's rules, so it is passed in. A
          // caller that omits it gets no gate, which is why the API never does.
          await ensureGateColumns(env);
          const gproj = await getProject(env, pid);
          r = await saveDrawing(env, pid, b, who, { canApprove, project: gproj, person: me || null });
          // K3: a held single upload tells AETRAA too (it told nobody).
          if (r && r.held && r.quarantine_id) await onNewHolds(env, gproj, [r.quarantine_id], (to, s, h) => sendEmail(env, to, s, h)).catch(() => {});
        }
        if (!r.error) {
          await audit(env, { org_id: me ? me.org_id : null, project_id: pid,
            user_id: me ? me.id : null, who,
            action: b.remove ? 'drawing-remove' : (r.held ? 'drawing-held' : r.pending ? 'drawing-submit' : 'drawing'),
            detail: `${str(b.number, 60) || str(b.id, 60)}${b.revision ? ' Rev ' + str(b.revision, 12) : ''}` });
        }
        return json(r, r.error ? 400 : 200);
      }
      // The PM approving, or sending back, a sheet an engineer submitted.
      if (p === '/api/drawing/approve' && req.method === 'POST') {
        if (!can.drawingsApprove(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const who = (me && me.name) || role;
        const did = str(b.id, 60);
        const before = await getDrawing(env, pid, did);
        const r = b.reject
          ? await rejectDrawing(env, pid, did, who, str(b.note, 600))
          : await approveDrawing(env, pid, did, who);
        if (!r.error) {
          await audit(env, { org_id: me ? me.org_id : null, project_id: pid,
            user_id: me ? me.id : null, who,
            action: b.reject ? 'drawing-reject' : 'drawing-approve',
            detail: before ? `${before.number}${before.revision ? ' Rev ' + before.revision : ''}` : did });
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/drawing/pin' && req.method === 'POST') {
        if (!can.drawingsEdit(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const r = await pinDrawing(env, pid, str(b.drawing_id, 60), str(b.activity_id, 60),
                                   (me && me.name) || role, !!b.off);
        return json(r, r.error ? 400 : 200);
      }
      // What one activity is built from. Answered per activity rather than sent
      // with the whole site payload: a man opens one card at a time, and the
      // register is not worth carrying on his phone to look at one sheet.
      if (p === '/api/drawings/for') {
        if (!can.drawings(role)) return json({ error: 'auth' }, 401);
        const aid = str(url.searchParams.get('activity'), 60);
        if (!aid) return json({ error: 'which activity?' }, 400);
        const act = await env.DB.prepare(
          'SELECT id, name, trade, trade_group, floor FROM activities WHERE project_id = ? AND id = ?'
        ).bind(pid, aid).first();
        if (!act) return json({ error: 'unknown activity' }, 404);
        if (!isFullScope(scope)) {
          const ok = await activitiesInScope(env, pid, scope, [aid]);
          if (!ok.has(aid)) return json({ error: 'outside your trades' }, 403);
        }
        return json({
          activity: act,
          drawings: await drawingsForActivity(env, pid, act),
          can_edit: can.drawingsEdit(role),
        });
      }
      if (p.startsWith('/dwg/')) {
        if (!can.drawings(role)) return new Response('auth', { status: 401 });
        return await serveDrawing(env, pid, decodeURIComponent(p.slice(5)));
      }

      if (p === '/api/codes') {
        if (!can.admin(role)) return json({ error: 'auth' }, 401);
        const codes = await listCodes(env, pid);
        // The groups and trades to scope against come from the programme itself.
        const { results } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(trade_group,''),'(no group)') AS grp,
                  COALESCE(NULLIF(trade,''),'(no trade)') AS trade, COUNT(*) AS n
             FROM activities WHERE project_id = ? AND COALESCE(level,1) >= 1
            GROUP BY grp, trade ORDER BY grp, trade`
        ).bind(pid).all();
        const groups = {};
        for (const r of results || []) {
          (groups[r.grp] || (groups[r.grp] = { group: r.grp, activities: 0, trades: [] }));
          groups[r.grp].activities += Number(r.n) || 0;
          groups[r.grp].trades.push({ trade: r.trade, n: r.n });
        }
        return json({ codes: codes || [], migrated: codes !== null, roles: ROLES,
                      groups: Object.values(groups) });
      }
      if (p === '/api/code' && req.method === 'POST') {
        if (!can.admin(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const r = b.remove ? await deleteCode(env, pid, b.id) : await saveCode(env, pid, b, sha256);
        return json(r, r.error ? 400 : 200);
      }

      if (p === '/api/review' && req.method === 'POST') {
        if (!can.reviewDay(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const day = date(b.date);
        if (!day) return json({ error: 'which day?' }, 400);
        return json(await reviewDay(env, pid, day, (me && me.name) || b.by || role, b.note, b.undo));
      }
      if (p === '/api/review') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const to = date(url.searchParams.get('to')) || today();
        const from = date(url.searchParams.get('from')) || shiftDay(to, -60);
        const rows = await listReviews(env, pid, from, to);
        return json({ from, to, reviews: rows || [], migrated: rows !== null });
      }

      /* ---- the records engine: submittals, RFIs, WIR/MIR, NCR, variations,
              letters, permits, observations, incidents, material requests,
              authority approvals. One table behind every register window. */
      /* ---- The programme loop with Primavera P6. */
      if ((p === '/api/programme/preview' || p === '/api/programme/commit') && req.method === 'POST') {
        if (!mayPlan(role, me)) return json({ error: 'Updating the programme is for Planning and the Project Manager.' }, 403);
        if (!pid) return json({ error: 'which project?' }, 400);
        const b = await req.json().catch(() => ({}));
        let bytes;
        try { bytes = b64ToBytes(b.file_b64 || ''); } catch (e) { return json({ error: 'could not read that upload' }, 400); }
        if (!bytes || !bytes.length) return json({ error: 'no file received' }, 400);
        if (bytes.length > 20 * 1024 * 1024) return json({ error: 'that .xer is too large (20 MB limit)' }, 400);
        const tables = parseXER(decodeXer(bytes));
        if (p === '/api/programme/preview') {
          const a = await analyseUpdate(env, pid, tables);
          return json(a.error ? a : { ok: true, summary: a.summary }, a.error ? 400 : 200);
        }
        const r = await commitUpdate(env, pid, tables);
        if (!r.error) {
          await audit(env, { org_id: me && me.org_id, project_id: pid, user_id: me && me.id, who: (me && me.name) || role,
            action: 'programme.update', detail: 'data date ' + (r.summary.data_date.to || '?') + ' · ' +
              r.summary.activities.total + ' activities · forecast finish ' + (r.summary.forecast_finish.to || '?') });
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/programme/p6-progress' || p === '/api/programme/p6-review') {
        if (!mayPlan(role, me)) return json({ error: 'auth' }, 403);
        if (!pid) return json({ error: 'which project?' }, 400);
        const w = await p6ProgressWorkbook(env, pid);
        const proj = await getProject(env, pid);
        const tag = String((proj && (proj.ref || proj.id)) || pid).replace(/[^A-Za-z0-9_-]+/g, '-');
        const review = p === '/api/programme/p6-review';
        return new Response(review ? w.reviewBytes : w.bytes, { headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="' + tag + (review ? '-progress-review-' : '-progress-for-P6-') + today() + '.xlsx"',
          'Cache-Control': 'no-store', 'X-Rows': String(review ? w.review : w.count) } });
      }
      if (p === '/api/programme/status') {
        if (!mayPlan(role, me)) return json({ error: 'auth' }, 403);
        const proj = await getProject(env, pid);
        const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM activities WHERE project_id = ? AND COALESCE(source,'programme') <> 'derived'").bind(pid).first();
        const last = await env.DB.prepare("SELECT who, detail, at FROM audit WHERE project_id = ? AND action IN ('programme.update','programme.import') ORDER BY at DESC LIMIT 5").bind(pid).all().catch(() => ({ results: [] }));
        return json({ project: proj && proj.name, data_date: proj && proj.data_date, contract_finish: proj && proj.contract_finish,
          activities: Number((n && n.n) || 0), history: last.results || [] });
      }

      /* ---- Notifications. Document Control (and the PM / Principal) tell the
              team something has arrived; everybody reads theirs under the bell. */
      if (p === '/api/notifications' && req.method === 'GET') {
        if (!me) return json({ unread: 0, items: [] });
        return json(await myNotifications(env, me.id, url.searchParams.get('limit')));
      }
      if (p === '/api/notifications/read' && req.method === 'POST') {
        if (!me) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        return json(await markRead(env, me.id, b.all ? 'all' : b.ids));
      }
      if (p === '/api/notify/team' && req.method === 'GET') {
        if (!me || !mayNotify(me)) return json({ error: 'auth' }, 403);
        const team = (await projectTeam(env, me.org_id, pid)).filter((u) => u.id !== me.id)
          .map((u) => ({ id: u.id, name: u.name, functions: u.functions,
                         labels: u.functions.map((f) => (FUNCTIONS[f] || {}).label || f) }));
        return json({ team, email: emailDriver(env) !== 'none',
                      functions: Object.keys(FUNCTIONS).map((k) => ({ id: k, label: FUNCTIONS[k].label })) });
      }
      if (p === '/api/notify' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        const proj = pid ? await getProject(env, pid) : null;
        const r = await notifyTeam(env, {
          me, pid, projectName: proj && proj.name, to: { people: b.people, functions: b.functions, all: b.all === true },
          title: b.title, message: b.message, ref: b.ref, link: b.link, kind: b.kind, email: b.email === true,
        }, (to, subject, htmlBody) => sendEmail(env, to, subject, htmlBody));
        if (!r.error) {
          await audit(env, { org_id: me.org_id, project_id: pid, user_id: me.id, who: me.name, action: 'notify',
            detail: String(b.title || '').slice(0, 120) + ' → ' + r.to.join(', ') });
        }
        return json(r, r.error ? (r.error.startsWith('Notifying') ? 403 : 400) : 200);
      }
      if (p === '/api/records' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        await ensureRecordsTable(env);
        const type = url.searchParams.get('type') || null;
        const records = await listRecords(env, pid, type);
        if (records === null) return json({ migrated: false, records: [] });
        // Registers of a switched-off module are kept, but not handed out.
        const plat = can.platform(role, me);
        return json({ migrated: true, records: (mods ? records.filter((x) => recordTypeOn(mods, x.type)) : records)
          .map((x) => recordForViewer(me, x, plat)) });
      }
      /* ---- THE GATE: what it held, and what the AETRAA Admin decides.
       *
       * The Admin sees every project's held items; anyone else sees their own
       * project's, so a document controller can tell the difference between a
       * document that is lost and one that is with AETRAA. Only the Admin may
       * decide — a contractor approving their own way past the gate is the one
       * thing it exists to prevent. */
      if (p === '/api/quarantine' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const plat = can.platform(role, me);
        const wantAll = plat && url.searchParams.get('all') === '1';
        const items = await listHeld(env, wantAll ? {} : { project_id: pid });
        // The project each one is on, by name, for the Admin's list.
        const projects = {};
        for (const id of [...new Set(items.map((x) => x.project_id))]) {
          const pr = await env.DB.prepare('SELECT name FROM projects WHERE id = ?').bind(id).first().catch(() => null);
          projects[id] = (pr && pr.name) || id;
        }
        return json({
          items: items.map((x) => ({ ...x, payload: undefined })), groups: groupByReason(items), projects,
          may_decide: plat,
          tenant_warnings: plat ? (await heldByTenant(env, 90)).filter((t) => t.warn) : [],
          gate_configured: gateConfigured(await getProject(env, pid)),
        });
      }
      // A held file, opened to be judged: the Admin's, or its own project's.
      if (p === '/api/quarantine/file' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        await ensureQuarantineTable(env);
        const q = await env.DB.prepare('SELECT project_id, filename, file_key FROM quarantine WHERE id = ?').bind(str(url.searchParams.get('id'), 60)).first().catch(() => null);
        if (!q || (!can.platform(role, me) && q.project_id !== pid)) return json({ error: 'no such held item' }, 404);
        const f = q.file_key ? await getFile(env, q.file_key).catch(() => null) : null;
        const bytes = f && (f.bytes || f);
        if (!bytes || !bytes.length) return json({ error: 'The file itself was not kept — only its details.' }, 404);
        const name = String(q.filename || 'held-file').replace(/["\\\r\n]/g, '');
        const ct = /\.pdf$/i.test(name) ? 'application/pdf' : /\.(png)$/i.test(name) ? 'image/png' : /\.(jpe?g)$/i.test(name) ? 'image/jpeg' : 'application/octet-stream';
        return new Response(bytes, { headers: { 'Content-Type': ct, 'Content-Disposition': (ct === 'application/octet-stream' ? 'attachment' : 'inline') + '; filename="' + name + '"', 'Cache-Control': 'no-store' } });
      }
      if (p === '/api/quarantine/decide' && req.method === 'POST') {
        // Deliberately the platform login and nothing else.
        if (!can.platform(role, me)) {
          return json({ error: 'Only AETRAA can release a held document.' }, 403);
        }
        const b = await req.json().catch(() => ({}));
        const ids = Array.isArray(b.ids) ? b.ids.slice(0, 500) : (b.id ? [String(b.id)] : []);
        if (!ids.length) return json({ error: 'nothing chosen' }, 400);
        const action = String(b.action || '');
        const out = { decided: [], filed: [], errors: [] };
        const told = [];                       // K3: what each uploader is told
        let widened = null;
        for (const qid of ids) {
          const item = await getHeld(env, qid);
          if (!item) { out.errors.push({ id: qid, error: 'no such held item' }); continue; }
          const proj = await getProject(env, item.project_id);
          // Widening once per call: the whole point is that a hundred sheets of
          // the same shape become one decision and never recur.
          if (action === 'approve_widen' && !widened && proj) {
            widened = widenedRules(proj, item.prefix, b.discipline, b.trade_group);
            if (widened) {
              await env.DB.prepare('UPDATE projects SET drawing_rules = ? WHERE id = ?')
                .bind(JSON.stringify(widened), item.project_id).run().catch(() => {});
            }
          }
          const d = await decide(env, qid, action, { name: 'AETRAA Admin' }, b.note, widened);
          if (d.error) { out.errors.push({ id: qid, error: d.error }); continue; }
          out.decided.push(qid);
          let filedTo = null;
          if (item.payload && item.payload.held_drawing_id) {
            // Decision 3: a scanned sheet held on its AI reading. Released, it
            // goes back to the PM for approval; rejected, it is sent back.
            if (action === 'reject') await env.DB.prepare("UPDATE drawings SET status = 'rejected', reject_note = ? WHERE project_id = ? AND id = ? AND status = 'held'").bind(String(b.note || '').slice(0, 300), item.project_id, item.payload.held_drawing_id).run();
            else { await env.DB.prepare("UPDATE drawings SET status = 'pending' WHERE project_id = ? AND id = ? AND status = 'held'").bind(item.project_id, item.payload.held_drawing_id).run(); filedTo = 'the drawing register, for the PM to approve'; }
            await markFiled(env, qid, item.payload.held_drawing_id);
          } else if (action !== 'reject' && item.kind === 'drawing' && item.payload) {
            // Replay exactly what the importer would have written, with the
            // gate switched off for this one item — it has just been judged.
            const fresh = await getProject(env, item.project_id);
            const r = await saveDrawing(env, item.project_id, item.payload,
              (me && me.name) || 'AETRAA Admin', { canApprove: true, project: fresh, gate: false });
            if (r && r.id) { await markFiled(env, qid, r.id); out.filed.push({ id: qid, drawing: r.id }); filedTo = 'the drawing register'; }
            else out.errors.push({ id: qid, error: (r && r.error) || 'could not file it' });
          } else if (action !== 'reject' && proj) {
            // K3: a document held by a folder drop is filed NOW, through the
            // same intake code, past the gate — so "approved" means filed, and
            // the person who loaded it can be told where it went. (Until now
            // it was filed only if somebody pressed Commit again, and then the
            // gate held it a second time.)
            const it = await env.DB.prepare('SELECT id, batch_id FROM intake_item WHERE target_id = ?').bind(qid).first().catch(() => null);
            if (it) {
              const adminWho = { name: 'AETRAA Admin' };
              const c = await commitItems(env, it.batch_id, [it.id], proj, adminWho, intakeRoutes(env, proj, adminWho, me, role));
              const res = c && c.results && c.results[0];
              if (res && res.ok && res.state === 'filed') { filedTo = res.where || null; out.filed.push({ id: qid, intake_item: it.id, where: res.where || null }); }
              else if (res && !res.ok) out.errors.push({ id: qid, error: res.error || 'approved, but it could not be filed' });
            }
          }
          told.push({ ...item, status: action === 'reject' ? 'rejected' : 'approved', note: b.note ? String(b.note).slice(0, 600) : null, filed_to: filedTo });
          await audit(env, { org_id: item.org_id, project_id: item.project_id,
            who: 'AETRAA Admin', action: 'quarantine.' + action,
            detail: item.filename + (b.note ? ' — ' + String(b.note).slice(0, 120) : '') });
        }
        // K3 (spec §22): whoever loaded each one is told — on the bell and by
        // email — what was decided, in the Admin's own words, and where it went.
        if (told.length) out.told = await tellUploaders(env, told, (to, s, h) => sendEmail(env, to, s, h)).catch(() => []);
        const failedAll = out.errors.length && !out.decided.length;
        return json(Object.assign({ ok: !out.errors.length, widened_rule: widened },
          // One item, one problem: put it where a caller looks for an error.
          failedAll && out.errors.length === 1 ? { error: out.errors[0].error } : {}, out),
          failedAll ? 400 : 200);
      }
      /* ---- The project's drawing numbering scheme: the gate's one strong
       * signal, and nothing without it. */
      /* ---------------------------------------------------------- intake
       *
       * Drop a folder, and the project sets itself up. Four steps, and only
       * the last writes anything — see src/intake.js for the guarantee and
       * why it is worth protecting.
       *
       * Permission is checked here, on the server, on every path. A DC's batch
       * is drawings-only and is refused at SCAN time with an explanation, not
       * by hiding a button: a hidden button is not a permission. */
      // Whether a batch belongs to this project. A batch id arriving in a body
      // is as much a claim as a project id, and is checked the same way.
      const batchIn = async (id, want) => {
        if (!id || !want) return false;
        await ensureIntakeTables(env);
        const row = await env.DB.prepare('SELECT project_id FROM intake_batch WHERE id = ?')
          .bind(id).first().catch(() => null);
        return !!row && row.project_id === want;
      };

      if (p === '/api/intake/batch' && req.method === 'POST') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const wantPid = String(b.project_id || pid || '');
        // The tenant wall, again: a project id in the body is a claim, not a
        // permission. Anyone who is not AETRAA loads into their own project only.
        if (!can.platform(role, me) && wantPid !== pid) return json({ error: 'That project is not yours to open.' }, 403);
        const proj = await getProject(env, wantPid);
        if (!proj) return json({ error: 'no such project' }, 404);
        // Spec §25: a DC's bulk loading is switched on per project by AETRAA.
        if (!can.platform(role, me) && !((await getProjectModules(env, wantPid).catch(() => null)) || []).includes('bulkload')) {
          return json({ error: 'Bulk drawing loading is not switched on for this project. AETRAA switches it on (Modules); until then upload drawings one at a time.', module: 'bulkload' }, 403);
        }
        // Anyone who is not AETRAA gets a drawings-only batch, whatever they ask for.
        const scope = can.platform(role, me) ? (b.scope === 'drawings' ? 'drawings' : 'full') : 'drawings';
        // A batch opened ON a section files everything into that section. Only
        // AETRAA can do that, because it is the one way to overrule what the
        // engine read, and it must be a deliberate act by someone who knows.
        const section = can.platform(role, me) && SECTIONS.some((x) => x.id === b.section && x.store !== 'figures')
          ? String(b.section) : null;
        const r = await openBatch(env, wantPid, me || { name: role }, { org_id: proj.org_id, scope, section,
          expect_files: b.expect_files, expect_bytes: b.expect_bytes });
        if (r.error) return json(r, r.code === 'batch_open' ? 409 : 400);
        await audit(env, { org_id: proj.org_id, project_id: wantPid, who: (me && me.name) || role,
          action: 'intake.batch', detail: 'scope ' + scope + (section ? ', into ' + section : '') });
        return json(r);
      }

      if (p === '/api/intake/scan' && req.method === 'POST') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const wantPid = String(b.project_id || pid || '');
        if (!can.platform(role, me) && wantPid !== pid) return json({ error: 'That project is not yours to open.' }, 403);
        const proj = await getProject(env, wantPid);
        if (!proj) return json({ error: 'no such project' }, 404);
        // The batch must be this project's: otherwise a file could be scanned
        // against one project's checks and recorded in another project's batch.
        if (!(await batchIn(String(b.batch_id || ''), wantPid))) return json({ error: 'no such batch' }, 404);
        const bytes = typeof b.data === 'string' && b.data ? b64ToBytes(b.data) : null;
        // The server reads the file itself. The browser may send hints, but it
        // is never trusted to decide what a file is — a classification posted
        // from a page is a classification an attacker can choose.
        const read = bytes ? probeFile(b.filename, bytes) : {};
        const num = bytes ? (fromFileName(String(b.filename || '')) || {}).number : null;
        // The one thing the page may say about a file: which document a template
        // is for, when the admin picked it in the templates section. It is
        // checked against the template store before it is used.
        const r = await scanFile(env, String(b.batch_id || ''), proj,
          { filename: b.filename, path: b.path, mime: b.mime, bytes,
            template_type: typeof b.template_type === 'string' ? b.template_type : null },
          { ...read, ...(num ? { drawingNumber: num } : {}) }, me || { name: role });
        // Spec §14: what each file was taken to be, and which test decided —
        // one audit row per file, including every sheet of a set and every
        // file inside a zip.
        if (!r.error) {
          const flat = (x) => (x && x.items ? x.items.flatMap(flat) : x && x.id ? [x] : []);
          for (const it of flat(r)) {
            await audit(env, { org_id: proj.org_id, project_id: wantPid, who: (me && me.name) || role,
              action: 'intake.classified',
              detail: String(b.filename || '') + (it.id ? ' [' + it.id + ']' : '') + ' → ' + (it.family_label || it.family) +
                (it.state && it.state !== 'proposed' ? ' (' + it.state + ')' : '') + ' — ' + String(it.reason || '').slice(0, 160) }).catch(() => {});
          }
        }
        return json(r, r.error ? 400 : 200);
      }

      // P1: AI reads the approval stamps of a batch's authority sheets, a few
      // at a time; the intake page calls this until nothing remains.
      if (p === '/api/intake/stamps' && req.method === 'POST') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        if (!can.platform(role, me) && !(await batchIn(String(b.batch_id || ''), pid))) return json({ error: 'no such batch' }, 404);
        const r = await readStamps(env, String(b.batch_id || ''), { limit: b.limit, who: me || { name: role } });
        return json(r, r.error ? 400 : 200);
      }
      // The AI's stamp readings, confirmed, corrected or rejected by a person.
      if (p === '/api/intake/stamps/confirm' && req.method === 'POST') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        if (!can.platform(role, me) && !(await batchIn(String(b.batch_id || ''), pid))) return json({ error: 'no such batch' }, 404);
        const r = await confirmStamps(env, String(b.batch_id || ''), b.items, me || { name: can.platform(role, me) ? 'AETRAA Admin' : role });
        if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: (me && me.name) || role, action: 'intake.stamps.confirm',
          detail: r.applied + ' stamp readings confirmed, ' + r.rejected + ' rejected' });
        return json(r, r.error ? 400 : 200);
      }

      /* ---- K9 · v5 A1: a scanned sheet, read by AI off its title-block
       * corner (only the corner is sent — sheet-corner.js). Document Control
       * (or the AETRAA Admin) reads it and confirms or corrects each value;
       * nothing reaches the sheet until then, a value read by rule is never
       * replaced by the AI's, and the PM approves the sheet into the register.
       * A sheet in a drop (an intake item) or one on the register still
       * awaiting approval. Under /api/ai, so the project's AI switch covers it. */
      if (p === '/api/ai/sheet' || p === '/api/ai/sheet/confirm' || p === '/api/ai/corner') {
        const plat = can.platform(role, me);
        const fnsA = me ? userFunctions(me) : [];
        const whoName = (me && me.name) || (plat ? 'AETRAA Admin' : role);
        await ensureAiProposals(env);
        // A reading, on a project this person may open (the Admin: any).
        const proposalOf = async (id) => {
          if (!plat) return getProposal(env, pid, id);
          const x = await env.DB.prepare('SELECT project_id FROM ai_proposals WHERE id = ?').bind(String(id || '')).first().catch(() => null);
          return x ? getProposal(env, x.project_id, id) : null;
        };
        // The sheet a request names, and what it says now.
        const sheetOf = async (t) => {
          if (t.item_id) {
            const row = plat ? await env.DB.prepare('SELECT * FROM intake_item WHERE id = ?').bind(String(t.item_id)).first().catch(() => null)
              : await getItemOn(env, pid, t.item_id);
            if (!row || row.family !== 'drawing') return { error: 'There is no such sheet in a drop on this project.', status: 404 };
            const f = row.file_key ? await getFile(env, row.file_key).catch(() => null) : null;
            let ex = {}; try { ex = JSON.parse(row.extracted || '{}') || {}; } catch (e) { ex = {}; }
            return { kind: 'item', id: row.id, pid: row.project_id, row, bytes: f && f.bytes, filename: row.filename, mime: '',
              scanned: !!ex.scanned, done: ['filed', 'held', 'archived', 'abandoned', 'skipped'].includes(row.state) ? row.state : null, ...itemSheetValues(row) };
          }
          if (t.drawing_id) {
            await ensureSheetAiColumns(env);
            const d = await getDrawing(env, pid, t.drawing_id);
            if (!d) return { error: 'There is no such drawing on this project.', status: 404 };
            let bytes = null;
            if (d.r2_key) { const f = await getFile(env, d.r2_key).catch(() => null); bytes = f && f.bytes; }
            else if (d.data) { try { bytes = b64ToBytes(String(d.data).split(',')[1] || ''); } catch (e) { bytes = null; } }
            const typed = 'typed on upload by ' + (d.uploaded_by || 'the uploader');
            return { kind: 'drawing', id: d.id, pid, row: d, bytes, filename: d.number + (/pdf/i.test(d.mime || '') ? '.pdf' : /png/i.test(d.mime || '') ? '.png' : /jpe?g/i.test(d.mime || '') ? '.jpg' : ''),
              mime: d.mime || '', scanned: Number(d.scanned) === 1,
              done: d.status === 'pending' || d.status === 'rejected' ? null : d.status === 'held' ? 'held' : 'approved',
              current: { number: d.number || '', revision: d.revision || '', title: d.title || '', date: d.sheet_date || '', discipline: d.discipline || '' },
              sources: { number: typed, revision: typed, title: typed, date: typed, discipline: typed } };
          }
          return { error: 'Say which sheet.', status: 400 };
        };
        // The revisions already in the register, by number (A1 step 2's revision order).
        const revisionsOn = async (ppid, notId) => {
          const { results } = await env.DB.prepare(
            `SELECT number, revision, status FROM drawings WHERE project_id = ? AND id <> ?
               AND status IN ('current', 'superseded', 'pending') AND COALESCE(kind, '') <> 'authority'`).bind(ppid, String(notId || '')).all();
          const by = {};
          for (const r of results || []) { const k = String(r.number || '').toUpperCase(); (by[k] || (by[k] = [])).push({ revision: r.revision, status: r.status }); }
          return by;
        };
        if (p === '/api/ai/corner' && req.method === 'GET') {
          // What was sent to the model, for the person checking its reading.
          if (!can.view(role)) return json({ error: 'auth' }, 401);
          const prop = await proposalOf(url.searchParams.get('id'));
          if (!prop || !prop.sent_key) return json({ error: 'no such reading' }, 404);
          const f = await getFile(env, prop.sent_key).catch(() => null);
          if (!f) return json({ error: 'the image sent could not be read back' }, 404);
          return new Response(f.bytes, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=600' } });
        }
        if (!(plat || fnsA.includes('dc'))) return json({ error: 'Document Control reads scanned sheets with AI and confirms what it read.' }, 403);
        const b = await req.json().catch(() => ({}));
        if (p === '/api/ai/sheet' && req.method === 'POST') {
          const s = await sheetOf(b);
          if (s.error) return json({ error: s.error }, s.status);
          if (s.done) return json({ error: s.kind === 'item' ? 'That sheet is already ' + s.done + ' — the AI reads a sheet before it is filed.'
            : s.done === 'held' ? s.current.number + ' is held for AETRAA to check.' : s.current.number + ' is approved — the AI reads a sheet before the PM approves it.' }, 400);
          if (!s.bytes || !s.bytes.length) return json({ error: 'The sheet could not be read back.' }, 400);
          if (!s.scanned && !(await isScanned(s.bytes, s.filename, s.mime))) {
            return json({ error: 'This sheet has text the title-block reader reads (E4) — the AI reads scans only.' }, 400);
          }
          const project = await getProject(env, s.pid);
          const r = await readSheetWithAI(env, s.pid, { kind: s.kind, id: s.id }, { bytes: s.bytes, filename: s.filename, mime: s.mime },
            { current: s.current, sources: s.sources, project, revisionsByNumber: await revisionsOn(s.pid, s.kind === 'drawing' ? s.id : ''), today: todayUAE(), who: whoName });
          if (!r.error) await audit(env, { project_id: s.pid, user_id: me ? me.id : null, who: whoName, action: 'ai.sheet.read',
            detail: (s.current.number || s.filename) + ' — read by ' + r.model + ' from the title-block corner only' });
          // Decision 3: a scan whose title block states another project is held
          // for AETRAA, as the gate holds a readable one. AETRAA releases it
          // (back to where it was) or rejects it on the held list.
          if (!r.error && r.project_check && r.project_check.holds) {
            const q = await hold(env, s.pid, { org_id: project && project.org_id, kind: 'drawing', filename: s.filename,
              number: (r.fields.number && r.fields.number.ai) || s.current.number || '', reason: r.project_check.reason, evidence: r.project_check.evidence,
              file_key: s.kind === 'item' ? s.row.file_key : (s.row.r2_key || null), payload: s.kind === 'drawing' ? { held_drawing_id: s.id } : null },
              { name: whoName, id: me ? me.id : '' });
            if (q && q.id) {
              if (s.kind === 'item') await env.DB.prepare("UPDATE intake_item SET state = 'held', target_id = ? WHERE id = ?").bind(q.id, s.id).run();
              else await env.DB.prepare("UPDATE drawings SET status = 'held' WHERE project_id = ? AND id = ?").bind(s.pid, s.id).run();
              r.held = { id: q.id, reason: r.project_check.reason };
              await audit(env, { project_id: s.pid, user_id: me ? me.id : null, who: whoName, action: 'quarantine.hold', detail: (s.current.number || s.filename) + ' — ' + r.project_check.reason.slice(0, 160) });
              await onNewHolds(env, project, [q.id], (to, sj, h) => sendEmail(env, to, sj, h)).catch(() => null);
            }
          }
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/ai/sheet/confirm' && req.method === 'POST') {
          const prop = await proposalOf(b.id);
          if (!prop || prop.reader !== 'A1') return json({ error: 'There is no such reading.' }, 404);
          if (prop.state !== 'proposed') return json({ error: 'That reading was already ' + prop.state + ' by ' + (prop.decided_by || 'someone') + '.' }, 409);
          if (b.discard) {
            await decideProposal(env, prop.project_id, prop.id, whoName, null, 'discarded');
            return json({ ok: true, discarded: true });
          }
          const s = await sheetOf(prop.target_kind === 'item' ? { item_id: prop.target_id } : { drawing_id: prop.target_id });
          if (s.error) return json({ error: s.error }, s.status);
          if (s.done) return json({ error: 'That sheet is already ' + s.done + '; nothing was changed.' }, 400);
          const project = await getProject(env, s.pid);
          const st = settleSheet(prop, b.fields || {}, { current: s.current, sources: s.sources, project,
            revisionsByNumber: await revisionsOn(s.pid, s.kind === 'drawing' ? s.id : ''), today: todayUAE() });
          if (st.refused.length) return json({ error: 'Nothing was saved: ' + st.refused.join('; ') + '.', refused: st.refused }, 400);
          if (!Object.keys(st.values).length) return json({ error: 'Choose a value to keep or type one — or discard the reading.' }, 400);
          const prov = { fields: st.how, model: prop.model, read_at: prop.at, confirmed_by: whoName, confirmed_at: new Date().toISOString(), proposal: prop.id };
          const r = s.kind === 'item' ? await applySheetToItem(env, s.row, st.values, st.how, prov, me || { name: whoName })
            : await applySheetToDrawing(env, s.pid, s.id, st.values, prov);
          if (r.error) return json(r, 400);
          await decideProposal(env, s.pid, prop.id, whoName, { values: st.values, how: st.how });
          await audit(env, { project_id: s.pid, user_id: me ? me.id : null, who: whoName, action: 'ai.sheet.confirm',
            detail: (st.values.number || s.current.number || s.filename) + ' — ' + Object.keys(st.values).map((f) => f + (st.how[f] === 'ai' ? ' (AI)' : ' (typed)')).join(', ') });
          return json({ ok: true, values: st.values, how: st.how, state: r.state || r.status });
        }
        return json({ error: 'not found' }, 404);
      }

      if (p === '/api/intake/batch' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const batch = await getBatch(env, url.searchParams.get('id') || '');
        if (!batch) return json({ error: 'no such batch' }, 404);
        if (!can.platform(role, me) && batch.project_id !== pid) return json({ error: 'auth' }, 403);
        // Ajay, 6 Oct 2026 (decision 13): whoever ran a drop may continue it.
        return json({ ...batch, mine: !!(me && batch.started_by_id === me.id) || can.platform(role, me) });
      }

      if (p === '/api/intake/confirm' && req.method === 'POST') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        if (!can.platform(role, me) && !(await batchIn(String(b.batch_id || ''), pid))) return json({ error: 'no such batch' }, 404);
        const r = await confirmItems(env, String(b.batch_id || ''),
          Array.isArray(b.items) ? b.items : [], me || { name: role });
        return json(r, r.error ? 400 : 200);
      }

      if (p === '/api/intake/commit' && req.method === 'POST') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const batch = await getBatch(env, String(b.batch_id || ''));
        if (!batch) return json({ error: 'no such batch' }, 404);
        const proj = await getProject(env, batch.project_id);
        if (!proj) return json({ error: 'no such project' }, 404);
        if (!can.platform(role, me) && batch.project_id !== pid) return json({ error: 'auth' }, 403);

        // The importers already exist and are already tested. Intake finds
        // files and proposes; it calls the same code the manual screens call,
        // so a fix to an importer fixes both paths at once.
        const who = me || { name: role };
        const routes = intakeRoutes(env, proj, who, me, role);

        const r = await commitItems(env, String(b.batch_id || ''),
          Array.isArray(b.ids) ? b.ids : [], proj, who, routes);
        if (r.error) return json(r, 400);
        const filed = r.results.filter((x) => x.ok && x.state === 'filed').length;
        const held = r.results.filter((x) => x.held).length;
        await audit(env, { org_id: proj.org_id, project_id: proj.id, who: (me && me.name) || role,
          action: 'intake.commit', detail: filed + ' filed, ' + held + ' held' });
        // Spec §14: one row per item filed or held, with where it went.
        for (const x of r.results) {
          if (!(x.held || (x.ok && x.state === 'filed'))) continue;
          await audit(env, { org_id: proj.org_id, project_id: proj.id, who: (me && me.name) || role,
            action: x.held ? 'intake.held' : 'intake.filed',
            detail: x.id + ' → ' + (x.held ? 'held: ' + String(x.reason || '').slice(0, 200) : String(x.where || '')) }).catch(() => {});
        }
        // Past 500 held items the project is flagged and AETRAA told (spec §12).
        if (r.results.some((x) => x.held_limit)) {
          const to = platformEmails(env);
          if (to.length) await sendEmail(env, to, 'AETRAA: 500 held items on ' + (proj.name || proj.id),
            '<p>' + escapeHtml(proj.name || proj.id) + ' has reached 500 held items, so nothing more is being held. ' +
            'Something is wrong — check the numbering scheme and the held queue before anything else is loaded.</p>').catch(() => {});
        }
        // Spec §30: the report is issued when the commit settles — partial
        // commits included — and filed to the library.
        try {
          const st = await env.DB.prepare('SELECT status FROM intake_batch WHERE id = ?').bind(String(b.batch_id || '')).first();
          if (st && (st.status === 'done' || st.status === 'partly_committed')) {
            const rep = await fileReport(env, String(b.batch_id || ''), proj, who,
              await xlsHeader(env, proj, who.name || role, 'Intake report'));
            if (rep && rep.id) r.report_id = rep.id;
          }
        } catch (e) { /* the commit stands; the report can be downloaded from the batch */ }
        // A held document is the AETRAA Admin's to decide, so the Admin hears
        // about it — with a warning when this tenant has had three or more held.
        // K3 (spec §22): the first item held on a project at once; further
        // holds in the daily digest; an item already in the queue is not news.
        const fresh = r.results.filter((x) => x.held && !x.already).map((x) => x.quarantine_id);
        if (fresh.length) await onNewHolds(env, proj, fresh, (to, s, h) => sendEmail(env, to, s, h)).catch(() => {});
        // The screens that were checked are not the screens being handed over
        // any more. A tick that survives the thing it was ticking is worse than
        // no tick, because it is believed.
        if (filed) await lapseAll(env, proj.id, 'documents loaded').catch(() => {});
        return json(r);
      }

      /* The seven figures, read from whatever contract the batch found.
       *
       * GET proposes; POST applies only what was ticked. Nothing here is ever
       * applied without a person: every certificate for the life of the job is
       * computed from these numbers, and a wrong one is silent and expensive. */
      /* ---- A9: letters and replies. The AI drafts from the facts; the author
       * edits and completes (a revision each time); the letter record's own
       * workflow does the rest — PM / Director signs, DC issues and logs, and
       * the incoming letter it answers is closed. AI never signs or sends. */
      const fnsOf = () => (me ? userFunctions(me) : []);
      const mayDraftLetter = () => can.platform(role, me) || ['pm', 'commercial', 'principal', 'design'].some((f) => fnsOf().includes(f));
      const parseJsonAnswer = (t) => { try { return JSON.parse(String(t || '').replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) { return null; } };
      if (p === '/api/letters/draft' && req.method === 'POST') {
        if (!mayDraftLetter()) return json({ error: 'The PM or QS drafts letters.' }, 403);
        const b = await req.json().catch(() => ({}));
        const inc = b.incoming_ref ? String(b.incoming_ref) : null;
        if (!inc && !String(b.subject || '').trim()) return json({ error: 'Pick the incoming letter to reply to, or give the letter a subject.' }, 400);
        const ctx = await draftContext(env, pid, inc, String(b.subject || ''));
        if (inc && !ctx.incoming) return json({ error: 'There is no incoming letter ' + inc + ' on this project.' }, 404);
        let fields = letterSkeleton(ctx, String(b.subject || '')), ai = false, note = 'AI is off, so this is a skeleton from the facts. Write the letter in it.';
        const ans = await callModel(env, { task: 'letter-draft', system: DRAFT_SYSTEM, prompt: draftPrompt(ctx, String(b.subject || ''), String(b.note || '')), max_tokens: 2500,
          project_id: pid, who: (me && me.name) || role });
        if (!ans.error) { const j = parseJsonAnswer(ans.text); if (j) { fields = { ...fields, ...j }; ai = true; note = 'Drafted by AI from the facts below. It is yours to edit; nothing is sent.'; } }
        else if (!ans.disabled) note = 'The AI could not draft it (' + ans.error + '), so this is a skeleton from the facts.';
        const warnings = checkQuotes(fields, ctx.clauses).concat(await checkRefs(env, pid, fields));
        const sv = await saveRevision(env, pid, null, inc, fields, warnings, ai ? 'ai' : 'skeleton', (me && me.name) || role);
        await audit(env, { project_id: pid, user_id: me ? me.id : null, who: (me && me.name) || role, action: 'letter.draft', detail: (inc || b.subject) + (ai ? ' (AI)' : ' (skeleton)') });
        return json({ ok: true, ...sv, fields, warnings, ai, note, facts: { incoming: ctx.incoming, clauses: ctx.clauses.map((c) => ({ key: c.key, heading: c.heading, page: c.page })), related: ctx.related.map((r) => r.key) } });
      }
      if (p === '/api/letters/draft/save' && req.method === 'POST') {
        if (!mayDraftLetter()) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const cur = await latestDraft(env, pid, String(b.thread || ''));
        if (!cur) return json({ error: 'no such draft' }, 404);
        if (cur.record_ref) return json({ error: 'this letter has been raised as ' + cur.record_ref + '; change it there' }, 400);
        const ctx = await draftContext(env, pid, cur.incoming_ref, (b.fields && b.fields.Subject) || '');
        const warnings = checkQuotes(b.fields, ctx.clauses).concat(await checkRefs(env, pid, b.fields));
        const sv = await saveRevision(env, pid, cur.thread, cur.incoming_ref, b.fields, warnings, 'author', (me && me.name) || role);
        return json({ ok: true, ...sv, warnings });
      }
      if (p === '/api/letters/drafts' && req.method === 'GET') {
        if (!mayDraftLetter()) return json({ error: 'auth' }, 403);
        const inc = ((await env.DB.prepare("SELECT ref, title, status FROM records WHERE project_id = ? AND type = 'incoming' ORDER BY ref DESC").bind(pid).all().catch(() => ({ results: [] }))).results) || [];
        return json({ drafts: await listThreads(env, pid), incoming: inc });
      }
      if (p === '/api/letters/draft/raise' && req.method === 'POST') {
        if (!me || !mayCreateRecord(me, 'letter')) return json({ error: 'You cannot raise a letter on this project.' }, 403);
        const b = await req.json().catch(() => ({}));
        const cur = await latestDraft(env, pid, String(b.thread || ''));
        if (!cur) return json({ error: 'no such draft' }, 404);
        if (cur.record_ref) return json({ ok: true, already: true, ref: cur.record_ref });
        if ((cur.warnings || []).length && !b.accept_warnings) return json({ error: 'Clear the warnings first (or confirm you have checked them).', warnings: cur.warnings }, 400);
        await ensureRecordsTable(env);
        const f = cur.fields || {};
        const rec = await createRecord(env, pid, { type: 'letter', title: f.Subject || 'Letter',
          data: { Subject: f.Subject || '', References: f.References || '', Body: f.Body || '', 'Clause cited': f['Clause cited'] || '', Enclosures: f.Enclosures || '',
                  ...(cur.incoming_ref ? { 'In reply to': cur.incoming_ref } : {}), 'Draft revision': String(cur.rev) } }, me.name,
          { project: await getProject(env, pid), workflow: await workflowFor(env, pid, 'letter').catch(() => null), labels: await labelsFor(env, pid).catch(() => null) });
        if (!rec || rec.error) return json({ error: (rec && rec.error) || 'could not raise the letter' }, 400);
        await ensureDraftTable(env);
        await env.DB.prepare('UPDATE letter_draft SET record_ref = ? WHERE project_id = ? AND thread = ?').bind(rec.ref, pid, cur.thread).run();
        await audit(env, { org_id: me.org_id, project_id: pid, user_id: me.id, who: me.name, action: 'letter.raise', detail: rec.ref + ' from draft rev ' + cur.rev });
        return json({ ok: true, ref: rec.ref, note: 'Raised as ' + rec.ref + '. The PM or Director signs it; Document Control issues and logs it.' });
      }

      /* ---- A13: delay and EOT. Flags, the notice and narrative drafted from
       * the facts, completed by Planning / PM, signed by the Director, issued
       * by DC. AI never claims time or money, signs or sends; no conclusion
       * about validity or time bars is ever shown. */
      const mayPlanDelay = () => can.platform(role, me) || ['planning', 'pm'].some((f) => fnsOf().includes(f));
      if (p === '/api/delays/scan' && req.method === 'POST') {
        if (!mayPlanDelay()) return json({ error: 'Planning or the PM scans for delays.' }, 403);
        const r = await scanDelays(env, pid);
        await audit(env, { project_id: pid, who: (me && me.name) || role, action: 'delay.scan', detail: r.found + ' found, ' + r.added + ' new' });
        return json(r);
      }
      if (p === '/api/delays' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const f = fnsOf();
        if (!can.platform(role, me) && (!f.length || f.every((x) => x === 'consultant'))) return json({ error: 'The delay register is the contractor’s own.' }, 403);
        return json({ delays: await listDelays(env, pid), may: { plan: mayPlanDelay(), sign: f.includes('principal'), issue: f.includes('dc') } });
      }
      if (p === '/api/delays/prepare' && req.method === 'POST') {
        if (!mayPlanDelay()) return json({ error: 'Planning prepares the delay notice.' }, 403);
        const b = await req.json().catch(() => ({}));
        const ev = await getDelay(env, pid, String(b.id || ''));
        if (!ev) return json({ error: 'no such delay event' }, 404);
        if (['signed', 'issued', 'closed'].includes(ev.status)) return json({ error: 'this notice is already ' + ev.status }, 400);
        const ctx = await delayContext(env, pid, ev);
        const proj = await getProject(env, pid);
        let drafts = skeletonNotice(ev, ctx, proj), ai = false;
        const ans = await callModel(env, { task: 'delay-notice', system: DELAY_SYSTEM, prompt: delayPrompt(ev, ctx, proj), max_tokens: 3000, project_id: pid, who: (me && me.name) || role });
        if (!ans.error) { const j = parseJsonAnswer(ans.text); if (j && j.notice) { drafts = { notice: String(j.notice), narrative: String(j.narrative || drafts.narrative) }; ai = true; } }
        await saveDelayDraft(env, pid, ev.id, { notice: drafts.notice, narrative: drafts.narrative, days_claimed: ev.days_claimed }, (me && me.name) || role);
        await audit(env, { project_id: pid, who: (me && me.name) || role, action: 'delay.prepare', detail: ev.ref + (ai ? ' (AI)' : ' (skeleton)') });
        return json({ ok: true, ...drafts, ai, clock: clockNote(ev), records: ctx.linked.map((r) => r.ref), clause: ctx.notice.clause ? ctx.notice.clause.key : null });
      }
      if (p === '/api/delays/save' && req.method === 'POST') {
        if (!mayPlanDelay()) return json({ error: 'Planning or the PM edit the notice.' }, 403);
        const b = await req.json().catch(() => ({}));
        const r = await saveDelayDraft(env, pid, String(b.id || ''), b, (me && me.name) || role);
        if (!r.error && b.complete) await audit(env, { project_id: pid, who: (me && me.name) || role, action: 'delay.complete', detail: String(b.id) });
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/delays/sign' && req.method === 'POST') {
        if (!me || !fnsOf().includes('principal')) return json({ error: 'The Director (Principal) signs the notice.' }, 403);
        const b = await req.json().catch(() => ({}));
        const r = await signDelay(env, pid, String(b.id || ''), me.name);
        if (!r.error) await audit(env, { org_id: me.org_id, project_id: pid, user_id: me.id, who: me.name, action: 'delay.sign', detail: String(b.id) });
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/delays/issue' && req.method === 'POST') {
        if (!me || !fnsOf().includes('dc')) return json({ error: 'Document Control issues the notice.' }, 403);
        const b = await req.json().catch(() => ({}));
        const ev = await getDelay(env, pid, String(b.id || ''));
        if (!ev) return json({ error: 'no such delay event' }, 404);
        if (ev.status !== 'signed') return json({ error: 'The notice is issued only once the Director has signed it.' }, 400);
        await ensureRecordsTable(env);
        const rec = await createRecord(env, pid, { type: 'letter', title: 'Notice of delay — ' + String(ev.description).slice(0, 120),
          data: { Subject: 'Notice of delay', Body: ev.notice_draft || '', 'EOT narrative': ev.eot_narrative || '', 'Days claimed': ev.days_claimed == null ? '' : String(ev.days_claimed),
                  'Signed by': ev.signed_by || '', 'Delay event': ev.ref } }, me.name,
          { project: await getProject(env, pid), workflow: await workflowFor(env, pid, 'letter').catch(() => null), labels: await labelsFor(env, pid).catch(() => null) });
        if (!rec || rec.error) return json({ error: (rec && rec.error) || 'could not log the notice' }, 400);
        await markIssued(env, pid, ev.id, rec.ref);
        if (ev.source === 'issue') await env.DB.prepare('UPDATE issues SET notice_ref = ? WHERE project_id = ? AND ref = ?').bind(rec.ref, pid, ev.ref).run().catch(() => {});
        await audit(env, { org_id: me.org_id, project_id: pid, user_id: me.id, who: me.name, action: 'delay.issue', detail: ev.ref + ' → ' + rec.ref });
        return json({ ok: true, ref: rec.ref, notice_date: todayUAEString(), clock: clockNote(ev) });
      }
      if (p === '/api/delays/xlsx' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const proj = await getProject(env, pid);
        const rows0 = await listDelays(env, pid);
        const c = (v, st) => ({ v, s: st });
        const d = (v) => (v ? c({ date: v }, 'dateBox') : c('', 'text'));
        const rows = [[c('Delay / EOT register', 'title')], [], ['Event', 'Source', 'Event date', 'Notice period', 'End of notice period', 'Notice date', 'Notice', 'Days claimed', 'Status'].map((h) => c(h, 'head'))]
          .concat(rows0.map((x) => [c(x.description, 'text'), c(x.source + ' ' + x.ref, 'text'), d(x.event_date), c(x.notice_days == null ? 'not found' : x.notice_days + ' days', 'text'),
            d(x.time_bar_date), d(x.notice_date), c(x.letter_ref || '', 'text'), x.days_claimed == null ? c('', 'text') : c(x.days_claimed, 'num'), c(x.status, 'text')]));
        const whoName = me ? me.name : (can.platform(role, me) ? 'AETRAA Admin' : role);
        const bytes = buildXlsx([{ name: 'Delay register', rows, freeze: 4, landscape: true, cols: [60, 18, 12, 14, 16, 12, 12, 12, 12] }], { header: await xlsHeader(env, proj, whoName, 'Delay / EOT register', { dated: true }) });
        return new Response(bytes, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control': 'no-store',
          'Content-Disposition': 'attachment; filename="' + (((proj && proj.name) || 'Project') + ' - Delay register.xlsx').replace(/[^A-Za-z0-9 ._-]+/g, '-') + '"' } });
      }

      /* ---- G15: CAD packages (spec §6, phase 7) and the project index with
       * "Check and complete" on a draft letter (spec §29, phase 9). The index
       * is the contractor's own material: no consultant access (D15). */
      if (p === '/api/cad-packages' && req.method === 'GET') {
        if (!can.drawings(role) && !can.platform(role, me)) return json({ error: 'auth' }, 401);
        const want = String((can.platform(role, me) ? (url.searchParams.get('project') || pid) : pid) || '');
        return json({ packages: await listCad(env, want) });
      }
      const teamOnly = () => {
        if (can.platform(role, me)) return null;
        if (!me) return json({ error: 'auth' }, 401);
        const f = userFunctions(me);
        if (!f.length || f.every((x) => x === 'consultant')) return json({ error: 'The project index is the contractor’s own team’s.' }, 403);
        return null;
      };
      if (p === '/api/index/rebuild' && req.method === 'POST') {
        const no = teamOnly(); if (no) return no;
        const b = await req.json().catch(() => ({}));
        const want = can.platform(role, me) ? String(b.project_id || pid || '') : pid;
        const r = await rebuildIndex(env, want);
        await audit(env, { project_id: want, who: (me && me.name) || 'AETRAA Admin', action: 'index.rebuild', detail: r.entries + ' entries, ' + r.clauses + ' clauses, ' + r.links + ' stated links' });
        return json(r);
      }
      if (p === '/api/index' && req.method === 'GET') {
        const no = teamOnly(); if (no) return no;
        const want = String((can.platform(role, me) ? (url.searchParams.get('project') || pid) : pid) || '');
        const rows = await searchIndex(env, want, url.searchParams.get('q') || '', url.searchParams.get('kind') || '');
        return json({ entries: rows.slice(0, 200).map((e) => ({ ...e, link: linkFor(e.doc_source) })), total: rows.length });
      }
      if (p === '/api/index/check' && req.method === 'POST') {
        const no = teamOnly(); if (no) return no;
        const b = await req.json().catch(() => ({}));
        const want = can.platform(role, me) ? String(b.project_id || pid || '') : pid;
        if (String(b.draft || '').trim().length < 10) return json({ error: 'Write the draft first, in your own words.' }, 400);
        return json(await checkDraft(env, want, String(b.draft).slice(0, 20000)));
      }
      if (p === '/api/index/confirm' && req.method === 'POST') {
        const no = teamOnly(); if (no) return no;
        const b = await req.json().catch(() => ({}));
        const want = can.platform(role, me) ? String(b.project_id || pid || '') : pid;
        const whoName = (me && me.name) || 'AETRAA Admin';
        const r = await confirmLetter(env, want, b.draft, Array.isArray(b.proposals) ? b.proposals : [], Array.isArray(b.decisions) ? b.decisions : [], b.final_text, whoName);
        await audit(env, { project_id: want, who: whoName, action: 'index.letter.confirm', detail: r.accepted + ' accepted, ' + r.edited + ' edited, ' + r.refused + ' refused' });
        return json({ ...r, note: 'The content is confirmed. The letter now goes through its own workflow: drafted, signed by the PM or Director, issued and logged by Document Control.' });
      }

      /* ---- G14 / A14: ask the project. Read-only; only what the person may
       * see; links to the records used; PM 30 a day, others 20; logged with cost. */
      if (p === '/api/ask' && req.method === 'POST') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        if (!pid) return json({ error: 'Open a project first.' }, 400);
        const admin = can.platform(role, me);
        if (!me && !admin) return json({ error: 'Sign in as yourself to ask the project.' }, 403);
        const b = await req.json().catch(() => ({}));
        const q = String(b.question || '').trim().slice(0, 600);
        if (q.length < 4) return json({ error: 'Type a question.' }, 400);
        const key = me ? me.id : 'aetraa-admin';
        const limit = limitFor(me, admin);
        const used = await usedToday(env, pid, key);
        if (used >= limit) return json({ error: 'That is today’s ' + limit + ' questions. Ask again tomorrow.', limit, used }, 429);
        const sources = await findSources(env, pid, me, admin, q);
        let answer = null, cited = [], cost = null, ai = false, note = '';
        if (!sources.length) note = 'Nothing you have access to on this project matches that question.';
        else {
          const ans = await callModel(env, { task: 'ask-the-project', system: ASK_SYSTEM, prompt: askPrompt(q, sources), max_tokens: 900, project_id: pid, who: (me && me.name) || 'AETRAA Admin' });
          if (ans.error) note = ans.disabled ? 'AI is off on this platform, so here are the records that match. Open them to read the answer.' : 'The answer could not be written (' + ans.error + '). Here are the records that match.';
          else {
            ai = true; answer = String(ans.text || '').slice(0, 4000); cost = ans.cost_usd == null ? null : ans.cost_usd;
            const refs = new Set((answer.match(/\[([^\]]{1,40})\]/g) || []).map((x) => x.slice(1, -1)));
            cited = sources.filter((x) => refs.has(x.ref));
          }
        }
        await logQuestion(env, pid, key, (me && me.name) || 'AETRAA Admin', q, sources.length, ai, cost);
        // Not stored: the answer goes back to the person and nowhere else.
        return json({ answer, note, sources: (cited.length ? cited : sources).map((x) => ({ kind: x.kind, ref: x.ref, label: x.label, link: x.link })),
                      used: used + 1, limit });
      }

      /* ---- AETRAA Assistant: A14 as a conversation (assistant.js). The same
       * sources, access and daily limit as /api/ask, re-checked on every
       * message; refused in three layers outside AETRAA and the project.
       * Read-only; the conversation is kept by the page, not here. */
      // The chat button (CHAT_BOOT) asks this before it shows itself.
      if (p === '/api/ask/chat' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        if (!pid) return json({ error: 'Open a project first.' }, 400);
        const admin = can.platform(role, me);
        if (!me && !admin) return json({ error: 'Sign in as yourself to use the assistant.' }, 403);
        const limit = limitFor(me, admin);
        return json({ ok: true, used: await usedToday(env, pid, me ? me.id : 'aetraa-admin'), limit });
      }
      if (p === '/api/ask/chat' && req.method === 'POST') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        if (!pid) return json({ error: 'Open a project first.' }, 400);
        const admin = can.platform(role, me);
        if (!me && !admin) return json({ error: 'Sign in as yourself to use the assistant.' }, 403);
        const b = await req.json().catch(() => ({}));
        const q = String(b.question || '').trim().slice(0, 600);
        if (!q) return json({ error: 'Type a question.' }, 400);
        const key = me ? me.id : 'aetraa-admin';
        const whoName = (me && me.name) || 'AETRAA Admin';
        const limit = limitFor(me, admin);
        const used = await usedToday(env, pid, key);
        // "hi", "thanks", "what can you do": answered as they are, for nothing,
        // and not one of the day's questions (logged, but not counted).
        const chit = smallTalk(q, assistantHelpOn(env));
        if (chit) {
          await logQuestion(env, pid, key, whoName, q, 0, false, null, { outcome: 'small-talk', task: 'a14-chat' });
          return json({ reply: chit, refused: false, note: '', sources: [], ai: false, used, limit });
        }
        if (used >= limit) return json({ error: 'That is today’s ' + limit + ' questions. Ask again tomorrow.', limit, used }, 429);
        const help = assistantHelpOn(env);
        const out = (o, outcome, n, ai, tok) => logQuestion(env, pid, key, whoName, q, n, ai, tok && tok.cost, { outcome, task: 'a14-chat', input_tokens: tok && tok.in, output_tokens: tok && tok.out })
          .then(() => json({ reply: null, refused: false, note: '', sources: [], ai: false, help, ...o, used: used + 1, limit }));
        const refuse = (outcome, n, tok) => out({ reply: ASSISTANT_REFUSAL, refused: true }, outcome, n || 0, !!tok, tok);
        // Layer 1, before anything is read: what is never about this project.
        if (hardRefusal(q)) return refuse('prefilter-refused');
        const history = cleanHistory(b.history);
        const lastQ = [...history].reverse().find((t) => t.role === 'user');
        const prior = !!lastQ && !hardRefusal(lastQ.text);
        // A short follow-up is searched with the question before it.
        const searchText = prior && q.split(/\s+/).length <= 14 ? q + ' ' + lastQ.text : q;
        const sources = (await findSources(env, pid, me, admin, searchText)).concat(findAssistantHelp(env, me, admin, searchText));
        if (!assistantPrefilter(q, { help, prior, hasSources: sources.length > 0 }).ok) return refuse('prefilter-refused');
        const pub = (list) => list.map((x) => ({ kind: x.kind, ref: x.ref, label: x.label, link: x.link }));
        if (!sources.length) return out({ reply: ASSISTANT_NOT_FOUND }, 'no-sources', 0, false);
        const ans = await callModel(env, { task: 'a14-chat', system: chatSystem(help), messages: chatMessages(history, q, sources),
          max_tokens: 900, temperature: 0, project_id: pid, who: whoName });
        if (ans.error) {
          // Help topics are fixed text, so for a "how do I / where is" question
          // the best one can be shown as it is; anything else lists the records.
          const howTo = /\b(how|where)\b/i.test(q) || !sources.some((x) => x.kind !== 'help');
          const topHelp = howTo ? sources.filter((x) => x.kind === 'help').sort((a, c) => c.score - a.score)[0] : null;
          return out({ reply: topHelp ? topHelp.text + ' [' + topHelp.ref + ']' : null,
            note: ans.disabled ? AI_OFF_MESSAGE + ' Here is what matches — open it to read more.'
              : 'The answer could not be written (' + ans.error + '). Here is what matches.', sources: pub(sources) }, ans.disabled ? 'ai-off' : 'ai-error', sources.length, false);
        }
        const tok = { cost: ans.cost_usd, in: ans.usage && ans.usage.input_tokens, out: ans.usage && ans.usage.output_tokens };
        // Layer 3: an answer that does not stand on the sources is not shown.
        const chk = checkAnswer(ans.text, sources);
        if (!chk.ok) return refuse('output-refused', sources.length, tok);
        return out({ reply: chk.text, notFound: !!chk.notFound, sources: pub(chk.cited), ai: true }, chk.notFound ? 'not-found' : 'answered', sources.length, true, tok);
      }

      /* ---- G12 / P2-P5: the four schedules. Generated after the knowledge
       * base is approved, reviewed by the owning team, approved by the PM as
       * the baseline, tracked live through the records raised from them. */
      const schedWho = () => (me && me.name) || (can.platform(role, me) ? 'AETRAA Admin' : role);
      const mayReview = (sch) => can.platform(role, me) || (me && SCHEDULES[sch] && SCHEDULES[sch].reviewers.some((f) => userFunctions(me).includes(f)));
      if (p === '/api/schedules' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const want = String((can.platform(role, me) ? (url.searchParams.get('project') || pid) : pid) || '');
        const sch = url.searchParams.get('s');
        if (sch) {
          const r = await readSchedule(env, want, sch);
          if (!r) return json({ error: 'no such schedule' }, 404);
          const g = sch === 'material' ? await coverageGates(env, want) : null;
          return json({ ...r, gates: g, may: { review: !!mayReview(sch), approve: !!(me && userFunctions(me).includes('pm')) } });
        }
        const out = [];
        for (const k of Object.keys(SCHEDULES)) { const r = await readSchedule(env, want, k); out.push({ schedule: k, code: r.code, label: r.label, state: r.state, items: r.items.length, late: r.items.filter((i) => i.late).length }); }
        return json({ schedules: out });
      }
      if (p === '/api/schedules/generate' && req.method === 'POST') {
        if (!can.platform(role, me) && !(me && ['design', 'pm', 'qaqc', 'procurement', 'site', 'hse'].some((f) => userFunctions(me).includes(f)))) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const want = can.platform(role, me) ? String(b.project_id || pid || '') : pid;
        const r = await generateSchedules(env, want, schedWho());
        if (!r.error) await audit(env, { project_id: want, who: schedWho(), action: 'schedules.generate', detail: JSON.stringify(r.added) });
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/schedules/item' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        const want = can.platform(role, me) ? String(b.project_id || pid || '') : pid;
        const sch = String(b.schedule || '');
        if (!mayReview(sch)) return json({ error: 'This schedule is reviewed by ' + ((SCHEDULES[sch] || {}).reviewers || []).join(' / ') + '.' }, 403);
        const r = b.id ? await editItem(env, want, String(b.id), b, schedWho()) : await addItem(env, want, sch, b, schedWho());
        if (!r.error) await audit(env, { project_id: want, who: schedWho(), action: 'schedules.item', detail: sch + ' ' + (b.id || r.id) + (b.remove ? ' removed' : '') });
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/schedules/gate' && req.method === 'POST') {
        if (!mayReview('material')) return json({ error: 'Design or Procurement clears the coverage gaps.' }, 403);
        const b = await req.json().catch(() => ({}));
        const want = can.platform(role, me) ? String(b.project_id || pid || '') : pid;
        const r = await resolveGate(env, want, String(b.key || ''), b.resolution, schedWho());
        if (!r.error) await audit(env, { project_id: want, who: schedWho(), action: 'schedules.gate', detail: String(b.key || '') + ': ' + String(b.resolution || '').slice(0, 120) });
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/schedules/approve' && req.method === 'POST') {
        if (!me || !userFunctions(me).includes('pm')) return json({ error: 'The PM approves the schedule.' }, 403);
        const b = await req.json().catch(() => ({}));
        const r = await approveSchedule(env, pid, String(b.schedule || ''), me.name);
        if (!r.error) await audit(env, { org_id: me.org_id, project_id: pid, user_id: me.id, who: me.name, action: 'schedules.approve', detail: String(b.schedule) + ': ' + r.items + ' items baselined' });
        return json(r, r.error ? 400 : 200);
      }
      // S0 starts from the schedule: the item raises its record, and the
      // schedule then follows that record (submitted, code, status).
      if (p === '/api/schedules/raise' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        const it = await env.DB.prepare('SELECT * FROM schedule_item WHERE id = ? AND project_id = ?').bind(String(b.id || ''), pid).first().catch(() => null);
        if (!it) return json({ error: 'no such item' }, 404);
        if (it.record_ref) return json({ ok: true, already: true, ref: it.record_ref });
        const type = SCHEDULES[it.schedule].record;
        if (!me || !mayCreateRecord(me, type)) return json({ error: 'You cannot raise this kind of document on this project.' }, 403);
        await ensureRecordsTable(env);
        const rec = await createRecord(env, pid, { type, title: it.description,
          data: { Discipline: it.discipline || '', 'Spec section': it.spec_code || '', Schedule: SCHEDULES[it.schedule].code + ' item ' + it.sr } }, me.name,
          { project: await getProject(env, pid), workflow: await workflowFor(env, pid, type).catch(() => null), labels: await labelsFor(env, pid).catch(() => null) });
        if (!rec || rec.error) return json({ error: (rec && rec.error) || 'could not raise it' }, 400);
        await env.DB.prepare('UPDATE schedule_item SET record_ref = ? WHERE id = ?').bind(rec.ref, it.id).run();
        await audit(env, { org_id: me.org_id, project_id: pid, user_id: me.id, who: me.name, action: 'schedules.raise', detail: it.schedule + ' ' + it.sr + ' → ' + rec.ref });
        return json({ ok: true, ref: rec.ref });
      }
      // AI proposes items the rules missed (P2-P5 step 1), and drafts a
      // method statement's risk assessment for HSE to check (P4). Proposals only.
      if (p === '/api/schedules/ai-propose' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        const sch = String(b.schedule || '');
        if (!mayReview(sch)) return json({ error: 'auth' }, 403);
        const want = can.platform(role, me) ? String(b.project_id || pid || '') : pid;
        const secs = await liveSections(env, want);
        const cur = (await readSchedule(env, want, sch)).items;
        const ans = await callModel(env, { task: 'schedule-' + sch, system: SCHED_AI_SYSTEM, prompt: schedAiPrompt(sch, secs, cur), max_tokens: 2500, project_id: want, who: schedWho() });
        if (ans.error) return json({ error: ans.error, disabled: !!ans.disabled }, ans.disabled ? 200 : 502);
        let got = [];
        try { got = (JSON.parse(String(ans.text).replace(/^[^{]*/, '').replace(/[^}]*$/, '')).items) || []; } catch (e) { got = []; }
        const codes = new Set(secs.map((x) => x.code));
        let added = 0;
        for (const g of got) {
          if (!g || !codes.has(g.spec_code) || !String(g.description || '').trim()) continue;
          const r = await addItem(env, want, sch, { description: String(g.description).slice(0, 300), spec_code: g.spec_code }, 'AI (proposed)');
          if (r.ok) { await env.DB.prepare("UPDATE schedule_item SET state = 'proposed', source = 'ai', basis = 'proposed by AI — Design to review' WHERE id = ?").bind(r.id).run(); added++; }
        }
        return json({ ok: true, proposed: added, discarded: got.length - added });
      }
      if (p === '/api/schedules/risk' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        if (!mayReview('ms')) return json({ error: 'auth' }, 403);
        const it = await env.DB.prepare("SELECT * FROM schedule_item WHERE id = ? AND project_id = ? AND schedule = 'ms'").bind(String(b.id || ''), pid).first().catch(() => null);
        if (!it) return json({ error: 'no such method statement' }, 404);
        const ans = await callModel(env, { task: 'risk-assessment', system: RISK_SYSTEM, prompt: riskPrompt(it), max_tokens: 1500, project_id: pid, who: schedWho() });
        if (ans.error) return json({ error: ans.error, disabled: !!ans.disabled }, ans.disabled ? 200 : 502);
        await env.DB.prepare('UPDATE schedule_item SET risk_draft = ? WHERE id = ?').bind(String(ans.text).slice(0, 6000), it.id).run();
        return json({ ok: true, draft: String(ans.text).slice(0, 6000), note: 'A draft for HSE to check — not an approved risk assessment.' });
      }
      if (p === '/api/schedules/xlsx' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const want = String((can.platform(role, me) ? (url.searchParams.get('project') || pid) : pid) || '');
        const sch = url.searchParams.get('s') || '';
        const r = await readSchedule(env, want, sch);
        if (!r) return json({ error: 'no such schedule' }, 404);
        const proj = await getProject(env, want);
        const c = (v, st) => ({ v, s: st });
        const d = (v) => (v ? c({ date: v }, 'dateBox') : c('', 'text'));
        const row = (i) => {
          const status = i.late ? 'LATE — ' + i.status : i.status;
          if (sch === 'shop') return [c(i.sr, 'num'), c(i.discipline || '', 'text'), c(i.description, 'text'), c(i.based_on.join(', '), 'text'), c(i.spec_code || '', 'text'), d(i.planned_submit), d(i.actual_submit), c(i.rev || '', 'text'), c(i.code || '', 'text'), c(status, i.late ? 'totalLabel' : 'text')];
          if (sch === 'material') return [c(i.sr, 'num'), c(i.discipline || '', 'text'), c(i.description, 'text'), c(i.spec_code || '', 'text'), c(i.supplier || '', 'text'), c(i.brand || '', 'text'), d(i.planned_submit), d(i.actual_submit), c(i.rev || '', 'text'), c(i.code || '', 'text'), c(status, i.late ? 'totalLabel' : 'text')];
          if (sch === 'ms') return [c(i.sr, 'num'), c(i.discipline || '', 'text'), c(i.description + (i.activity_name ? ' — ' + i.activity_name : ''), 'text'), c(i.spec_code || '', 'text'), d(i.planned_submit), d(i.actual_submit), c(i.rev || '', 'text'), c(i.code || '', 'text'), c(status, i.late ? 'totalLabel' : 'text')];
          return [c(i.sr, 'num'), c(i.discipline || '', 'text'), c(i.description, 'text'), c(i.spec_code || '', 'text'), c(i.hold_points.map((h) => 'p.' + h.page + ' ' + h.quote).join(' | '), 'text'), d(i.planned_submit), d(i.actual_submit), c(i.rev || '', 'text'), c(i.code || '', 'text'), c(status, i.late ? 'totalLabel' : 'text')];
        };
        const rows = [[c(r.label, 'title')], [], r.columns.concat(['Date source']).map((h) => c(h, 'head'))]
          .concat(r.items.map((i) => row(i).concat([c(i.date_source + (i.date_note ? ' (' + i.date_note + ')' : ''), 'text')])));
        const sheets = [{ name: r.code, rows, freeze: 4, landscape: true, cols: r.columns.map((h) => (/Description|Shop drawing|ITP|Work package|Hold/.test(h) ? 44 : /Based on/.test(h) ? 24 : 13)).concat([34]) }];
        if (sch === 'itp') {
          const pr = [[c('Planned inspections (WIR)', 'title')], [], ['ITP', 'Activity', 'Name', 'Planned'].map((h) => c(h, 'head'))];
          for (const i of r.items) for (const x of i.inspections) pr.push([c(i.description, 'text'), c(x.activity, 'text'), c(x.name, 'text'), d(x.planned)]);
          sheets.push({ name: 'Inspections', rows: pr, freeze: 4, cols: [40, 14, 50, 13] });
        }
        const whoName = me ? me.name : (can.platform(role, me) ? 'AETRAA Admin' : role);
        const bytes = buildXlsx(sheets, { header: await xlsHeader(env, proj, whoName, r.label, { dated: true }) });
        return new Response(bytes, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control': 'no-store',
          'Content-Disposition': 'attachment; filename="' + (((proj && proj.name) || 'Project') + ' - ' + r.label + '.xlsx').replace(/[^A-Za-z0-9 ._-]+/g, '-') + '"' } });
      }

      /* ---- G11 / P1: the project knowledge base. AETRAA reviews the summary
       * and the proposed links and issues it; the PM approves it; later
       * reissues are compared with what was approved and flagged to the PM. */
      if (p === '/api/knowledge' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const want = String((can.platform(role, me) ? (url.searchParams.get('project') || pid) : pid) || '');
        const kb = await getKb(env, want);
        const f = me ? userFunctions(me) : [];
        return json({
          project_id: want, state: kb.state, version: kb.version || 0,
          issued_by: kb.issued_by || null, issued_at: kb.issued_at || null, approved_by: kb.approved_by || null, approved_at: kb.approved_at || null,
          issued_summary: kb.summary || null, summary: await buildSummary(env, want),
          links: await listLinks(env, want), changes: (await kbChanges(env, want)).changes,
          drawing_contents: await listDrawingContents(env, want),
          may: { issue: can.platform(role, me), approve: f.includes('pm'), decide: can.platform(role, me), review: f.includes('pm') },
        });
      }
      if (p === '/api/knowledge/links/propose' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const want = String(b.project_id || pid || '');
        const r = await proposeLinks(env, want);
        await audit(env, { project_id: want, who: 'AETRAA Admin', action: 'kb.links.propose', detail: r.proposed + ' new links proposed' });
        return json({ ok: true, ...r });
      }
      if (p === '/api/knowledge/links/decide' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const want = String(b.project_id || pid || '');
        const r = await decideLinks(env, want, Array.isArray(b.ids) ? b.ids : [], b.decision, 'AETRAA Admin');
        await audit(env, { project_id: want, who: 'AETRAA Admin', action: 'kb.links.' + r.state, detail: r.decided + ' links' });
        return json(r);
      }
      if (p === '/api/knowledge/issue' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'Only AETRAA issues the knowledge base.' }, 403);
        const b = await req.json().catch(() => ({}));
        const want = String(b.project_id || pid || '');
        const r = await issueKb(env, want, 'AETRAA Admin');
        await audit(env, { project_id: want, who: 'AETRAA Admin', action: 'kb.issue', detail: 'version ' + r.version });
        return json(r);
      }
      if (p === '/api/knowledge/approve' && req.method === 'POST') {
        if (!me || !userFunctions(me).includes('pm')) return json({ error: 'The PM approves the knowledge base.' }, 403);
        const r = await approveKb(env, pid, me.name);
        if (!r.error && !r.already) {
          await audit(env, { org_id: me.org_id, project_id: pid, user_id: me.id, who: me.name, action: 'kb.approve', detail: 'knowledge base approved' });
          // P1 step 6: the four schedules are generated now; each goes live
          // when the PM approves it.
          const g = await generateSchedules(env, pid, me.name).catch(() => null);
          if (g && g.added) r.schedules = g.added;
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/knowledge/review-changes' && req.method === 'POST') {
        if (!me || !userFunctions(me).includes('pm')) return json({ error: 'The PM reviews the changes.' }, 403);
        const before = (await kbChanges(env, pid)).changes;
        const r = await reviewChanges(env, pid, me.name);
        if (!r.error) await audit(env, { org_id: me.org_id, project_id: pid, user_id: me.id, who: me.name, action: 'kb.changes.reviewed', detail: before.length + ' changes' });
        return json(r, r.error ? 400 : 200);
      }
      // P1 step 3: an AI pass proposes links the rules could not make. Every
      // proposed ref must be one of the refs it was given — nothing invented.
      if (p === '/api/knowledge/ai-links' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const want = String(b.project_id || pid || '');
        const links = await listLinks(env, want);
        const linked = new Set(links.filter((l) => l.state !== 'rejected').flatMap((l) => [l.from_kind + '|' + l.from_ref, l.to_kind + '|' + l.to_ref]));
        const drawings = ((await listDrawings(env, want, {})) || []).filter((d) => d.status === 'current' && d.kind !== 'tender');
        const secs = await liveSections(env, want);
        const boq = ((await env.DB.prepare('SELECT ref, id, description FROM boq WHERE project_id = ?').bind(want).all().catch(() => ({ results: [] }))).results) || [];
        const items = [].concat(
          drawings.map((d) => ({ kind: 'drawing', ref: d.number, label: d.title || '' })),
          secs.map((x) => ({ kind: 'spec', ref: x.code, label: x.title })),
          boq.map((l) => ({ kind: 'boq', ref: String(l.ref || l.id), label: l.description || '' })));
        const unlinked = items.filter((i) => !linked.has(i.kind + '|' + i.ref)).slice(0, 120);
        if (!unlinked.length) return json({ ok: true, proposed: 0, note: 'everything already has a link' });
        const ans = await callModel(env, { task: 'kb-links', system: LINKS_SYSTEM, prompt: linksPrompt(unlinked, items.slice(0, 400)), max_tokens: 3000,
          project_id: want, who: (me && me.name) || 'AETRAA Admin' });
        if (ans.error) return json({ error: ans.error, disabled: !!ans.disabled }, ans.disabled ? 200 : 502);
        let got = [];
        try { got = (JSON.parse(String(ans.text).replace(/^[^{]*/, '').replace(/[^}]*$/, '')).links) || []; } catch (e) { got = []; }
        const known = new Set(items.map((i) => i.kind + '|' + i.ref));
        const label = Object.fromEntries(items.map((i) => [i.kind + '|' + i.ref, i.ref + ' ' + i.label]));
        const ok = got.filter((g) => g && known.has(g.from_kind + '|' + g.from_ref) && known.has(g.to_kind + '|' + g.to_ref) && (g.from_kind + g.from_ref) !== (g.to_kind + g.to_ref))
          .map((g) => ({ from_kind: g.from_kind, from_ref: g.from_ref, from_label: label[g.from_kind + '|' + g.from_ref], to_kind: g.to_kind, to_ref: g.to_ref,
                         to_label: label[g.to_kind + '|' + g.to_ref], basis: 'proposed by AI: ' + String(g.why || '').slice(0, 200) }));
        const r = await storeProposals(env, want, ok);
        await audit(env, { project_id: want, who: 'AETRAA Admin', action: 'kb.links.ai', detail: r.proposed + ' links proposed by AI, ' + (got.length - ok.length) + ' discarded (refs not in the lists)' });
        return json({ ok: true, proposed: r.proposed, discarded: got.length - ok.length });
      }
      // P1 step 2: what an IFC drawing shows, read by AI and kept as a proposal.
      if (p === '/api/knowledge/ai-contents' && req.method === 'POST') {
        const f = me ? userFunctions(me) : [];
        if (!can.platform(role, me) && !f.includes('dc')) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const want = can.platform(role, me) ? String(b.project_id || pid || '') : pid;
        const d = await getDrawing(env, want, String(b.drawing_id || ''));
        if (!d) return json({ error: 'no such drawing' }, 404);
        let bytes = null;
        if (d.r2_key) bytes = await getFile(env, d.r2_key).then((x) => x && x.bytes).catch(() => null);
        else if (d.data && /^data:application\/pdf;base64,/.test(d.data)) bytes = b64ToBytes(d.data);
        if (!bytes) return json({ error: 'the sheet has no PDF to read' }, 400);
        const ans = await callModel(env, { task: 'kb-ifc-contents', system: CONTENTS_SYSTEM, prompt: CONTENTS_PROMPT, max_tokens: 1200,
          documents: [{ bytes: new Uint8Array(bytes), media_type: 'application/pdf' }], project_id: want, who: (me && me.name) || 'AETRAA Admin' });
        if (ans.error) return json({ error: ans.error, disabled: !!ans.disabled }, ans.disabled ? 200 : 502);
        let c = {};
        try { c = JSON.parse(String(ans.text).replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) { c = {}; }
        const clean = (a) => (Array.isArray(a) ? a : []).map((x) => String(x).slice(0, 80)).slice(0, 15);
        const contents = { elements: clean(c.elements), systems: clean(c.systems), materials: clean(c.materials) };
        await saveDrawingContents(env, want, d, contents);
        return json({ ok: true, number: d.number, contents });
      }
      if (p === '/api/knowledge/xlsx' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const want = String((can.platform(role, me) ? (url.searchParams.get('project') || pid) : pid) || '');
        const proj = await getProject(env, want);
        const sm = await buildSummary(env, want);
        const links = await listLinks(env, want);
        const c = (v, st) => ({ v, s: st });
        const sum = [[c('Knowledge base summary', 'title')], [], [c('What was read', 'head')]];
        sum.push([c('Drawings: ' + sm.read.drawings.current + ' current (' + Object.entries(sm.read.drawings.by_kind).map((x) => x[1] + ' ' + x[0]).join(', ') + '), ' + sm.read.drawings.awaited + ' awaited', 'text')]);
        sum.push([c('BOQ: ' + sm.read.boq.lines + ' lines, total ' + sm.read.boq.total, 'text')]);
        sum.push([c('Programme: ' + sm.read.programme.activities + ' activities, data date ' + (sm.read.programme.data_date || '—'), 'text')]);
        sum.push([c('Specification: ' + sm.read.specification.sections + ' sections', 'text')]);
        sum.push([], [c('What is missing', 'head')]); for (const m of sm.missing) sum.push([c(m, 'text')]);
        sum.push([], [c('What was flagged', 'head')]); for (const m of sm.flagged) sum.push([c(m, 'text')]);
        const lk = [[c('Links', 'title')], [], ['From', 'Item', 'To', 'Item', 'Basis', 'State', 'Decided by'].map((h) => c(h, 'head'))];
        for (const l of links) lk.push([l.from_kind, l.from_label, l.to_kind, l.to_label, l.basis, l.state, l.decided_by || ''].map((v) => c(v || '', 'text')));
        const tv = [[c('Tender vs IFC', 'title')], [c(sm.tender_vs_ifc.note, 'muted')], ['Number', 'Change', 'Tender', 'IFC'].map((h) => c(h, 'head'))];
        for (const x of sm.tender_vs_ifc.changed) tv.push([x.number, x.title_changed ? 'revision and/or title changed' : 'revision changed', x.tender_revision + ' ' + x.tender_title, x.ifc_revision + ' ' + x.ifc_title].map((v) => c(v, 'text')));
        for (const x of sm.tender_vs_ifc.ifc_only) tv.push([x.number, 'new at IFC', '', x.revision + ' ' + x.title].map((v) => c(v, 'text')));
        for (const x of sm.tender_vs_ifc.tender_only) tv.push([x.number, 'no IFC issued', x.revision + ' ' + x.title, ''].map((v) => c(v, 'text')));
        const whoName = me ? me.name : (can.platform(role, me) ? 'AETRAA Admin' : role);
        const bytes = buildXlsx([{ name: 'Summary', rows: sum, cols: [110] }, { name: 'Links', rows: lk, freeze: 4, landscape: true, cols: [10, 40, 10, 40, 50, 12, 20] },
          { name: 'Tender vs IFC', rows: tv, freeze: 4, cols: [18, 30, 40, 40] }], { header: await xlsHeader(env, proj, whoName, 'Knowledge base summary') });
        return new Response(bytes, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control': 'no-store',
          'Content-Disposition': 'attachment; filename="' + (((proj && proj.name) || 'Project') + ' - Knowledge base.xlsx').replace(/[^A-Za-z0-9 ._-]+/g, '-') + '"' } });
      }

      /* ---- G10 / E13: the specification index. Built from a specification in
       * the library (or uploaded here, which files it there first), split by
       * section only where the structure can be read; Design confirms it. */
      if (p === '/api/spec-index' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const want = can.platform(role, me) ? (url.searchParams.get('project') || pid) : pid;
        const id = url.searchParams.get('id');
        if (id) {
          const ix = await getIndex(env, String(want || ''), id);
          return ix ? json(ix) : json({ error: 'no such index' }, 404);
        }
        const specs = ((await listLibrary(env, String(want || ''))) || []).filter((d) => d.class === 'specification');
        return json({ indexes: await listIndexes(env, String(want || '')), specifications: specs.map((d) => ({ id: d.id, title: d.title, filename: d.filename })),
          may_confirm: !!(me && userFunctions(me).includes('design')) });
      }
      if (p === '/api/spec-index' && req.method === 'POST') {
        const f = me ? userFunctions(me) : [];
        if (!can.platform(role, me) && !f.includes('design') && !f.includes('dc')) return json({ error: 'Document Control or Design builds the specification index.' }, 403);
        const b = await req.json().catch(() => ({}));
        const want = can.platform(role, me) ? String(b.project_id || pid || '') : pid;
        const proj = await getProject(env, want);
        if (!proj) return json({ error: 'no such project' }, 404);
        const whoName = (me && me.name) || (can.platform(role, me) ? 'AETRAA Admin' : role);
        let bytes = null, filename = '', libraryId = null;
        if (b.library_id) {
          const doc = await documentFile(env, want, String(b.library_id));
          if (!doc) return json({ error: 'that specification is not in this project’s library' }, 404);
          bytes = doc.bytes; filename = doc.filename; libraryId = String(b.library_id);
        } else if (typeof b.data === 'string' && b.data) {
          filename = String(b.filename || 'specification.pdf');
          if (!/\.pdf$/i.test(filename)) return json({ error: 'A specification is indexed from a PDF.' }, 400);
          bytes = b64ToBytes(b.data);
          const added = await addDocument(env, want, { class: 'specification', title: filename.replace(/\.pdf$/i, ''), filename, bytes, source: 'upload' }, { name: whoName });
          if (added.error) return json(added, 400);
          libraryId = added.id;
        } else return json({ error: 'choose a specification from the library, or upload one' }, 400);
        const pages = await pdfPages(bytes, { pages: 1000 });
        const result = buildIndex(pages);
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const sha = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
        const id = await saveIndex(env, want, { library_id: libraryId, filename, sha256: sha }, result, whoName);
        await audit(env, { org_id: proj.org_id, project_id: want, who: whoName, action: 'spec_index.read',
          detail: filename + ': ' + (result.split ? result.sections.length + ' sections (' + result.method + ')' : 'not split — ' + result.reason) +
            ', ' + result.unread_pages.length + ' pages with no text' });
        return json({ ok: true, id, result });
      }
      if (p === '/api/spec-index/confirm' && req.method === 'POST') {
        if (!me || !userFunctions(me).includes('design')) return json({ error: 'Design confirms the specification index.' }, 403);
        const b = await req.json().catch(() => ({}));
        const r = await confirmIndex(env, pid, String(b.id || ''), me.name, Array.isArray(b.edits) ? b.edits : []);
        if (!r.error) await audit(env, { org_id: me.org_id, project_id: pid, user_id: me.id, who: me.name, action: 'spec_index.confirm', detail: String(b.id || '') + ': ' + r.sections + ' sections live' });
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/spec-sections' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const want = can.platform(role, me) ? (url.searchParams.get('project') || pid) : pid;
        return json({ sections: await liveSections(env, String(want || ''), url.searchParams.get('q') || '') });
      }
      if (p === '/api/spec-sections/file' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const want = can.platform(role, me) ? (url.searchParams.get('project') || pid) : pid;
        const sec = (await liveSections(env, String(want || ''))).find((x) => x.id === url.searchParams.get('id'));
        if (!sec || !sec.library_id || !sec.page_from) return json({ error: 'no such section' }, 404);
        const doc = await documentFile(env, String(want || ''), sec.library_id);
        if (!doc) return json({ error: 'the specification file is not available' }, 404);
        const out = await sectionPdf(doc.bytes, sec.page_from, sec.page_to || sec.page_from);
        return new Response(out, { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store',
          'Content-Disposition': 'attachment; filename="' + (sec.code + ' ' + sec.title).replace(/[^A-Za-z0-9 ._-]+/g, '-').slice(0, 120) + '.pdf"' } });
      }
      if (p === '/api/spec-sections/xlsx' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const want = can.platform(role, me) ? (url.searchParams.get('project') || pid) : pid;
        const proj = await getProject(env, String(want || ''));
        const secs = await liveSections(env, String(want || ''));
        const c = (v, st) => ({ v, s: st });
        const rows = [[c('Specification index', 'title')], [],
          ['Section', 'Title', 'Discipline', 'Pages', 'Named manufacturers', 'Or equal', 'Shop drawings', 'Product data', 'Samples', 'Method statement', 'Testing', 'Inspection'].map((h) => c(h, 'head'))];
        for (const x of secs) {
          const rq = x.requirements || {};
          const yn = (k) => ((rq[k] || []).length ? 'yes (p.' + rq[k].map((h) => h.page).join(', ') + ')' : '');
          rows.push([x.code, x.title, x.discipline, x.page_from ? x.page_from + '–' + x.page_to : 'not located', (x.manufacturers || []).join(', '),
            x.or_equal ? 'yes' : '', yn('shop_drawings'), yn('product_data'), yn('samples'), yn('method_statement'), yn('testing'), yn('inspection')].map((v) => c(v, 'text')));
        }
        const whoName = me ? me.name : (can.platform(role, me) ? 'AETRAA Admin' : role);
        const bytes = buildXlsx([{ name: 'Specification index', rows, freeze: 4, landscape: true, cols: [12, 40, 16, 10, 40, 8, 16, 16, 12, 16, 16, 16] }],
          { header: await xlsHeader(env, proj, whoName, 'Specification index') });
        return new Response(bytes, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control': 'no-store',
          'Content-Disposition': 'attachment; filename="' + (((proj && proj.name) || 'Project') + ' - Specification index.xlsx').replace(/[^A-Za-z0-9 ._-]+/g, '-') + '"' } });
      }

      /* ---- G9 / E11: the designer's drawing list against the register.
       * DC drops the list and reviews new / changed / missing; DC confirms;
       * the PM approves, and missing sheets become "awaited". No AI. */
      if (p === '/api/drawing-lists' && req.method === 'GET') {
        if (!can.drawings(role) && !can.platform(role, me)) return json({ error: 'auth' }, 401);
        const want = can.platform(role, me) ? (url.searchParams.get('project') || pid) : pid;
        const id = url.searchParams.get('id');
        if (id) {
          const l = await getList(env, String(want || ''), id);
          return l ? json(l) : json({ error: 'no such drawing list' }, 404);
        }
        return json({ lists: await listLists(env, String(want || '')) });
      }
      if (p === '/api/drawing-lists' && req.method === 'POST') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const want = can.platform(role, me) ? String(b.project_id || pid || '') : pid;
        const proj = await getProject(env, want);
        if (!proj) return json({ error: 'no such project' }, 404);
        const name = String(b.filename || '');
        if (!/\.(xlsx|xlsm|csv)$/i.test(name)) return json({ error: 'A drawing list is read from an Excel (.xlsx) or .csv file.' }, 400);
        const bytes = typeof b.data === 'string' && b.data ? b64ToBytes(b.data) : null;
        if (!bytes || !bytes.length) return json({ error: 'that file is empty' }, 400);
        const pr = probeFile(name, bytes, { maxRows: 20000 });
        if (!pr || pr.unreadable || !pr.header || !pr.header.length) return json({ error: 'No header row could be read from that workbook.' }, 400);
        const read = readList(pr.header, pr.rows || []);
        if (read.error) return json(read, 400);
        const register = (await listDrawings(env, want, {})) || [];
        const comparison = compareList(read.rows, register, await previousNumbers(env, want));
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const sha = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
        const whoName = (me && me.name) || (can.platform(role, me) ? 'AETRAA Admin' : role);
        const id = await saveList(env, want, name, sha, read, comparison, whoName);
        await audit(env, { org_id: proj.org_id, project_id: want, who: whoName, action: 'drawing_list.read',
          detail: name + ': ' + read.rows.filter((x) => x.read).length + ' read, ' + read.rows.filter((x) => !x.read).length + ' not read · ' +
            comparison.counts.missing + ' missing, ' + comparison.counts.changed + ' changed' });
        return json({ ok: true, id, columns: read.columns, rows: read.rows, comparison, truncated: !!pr.truncated });
      }
      if (p === '/api/drawing-lists/confirm' && req.method === 'POST') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const want = can.platform(role, me) ? String(b.project_id || pid || '') : pid;
        const whoName = (me && me.name) || role;
        const r = await confirmList(env, want, String(b.id || ''), Array.isArray(b.exclude) ? b.exclude : [], whoName);
        if (!r.error) await audit(env, { project_id: want, who: whoName, action: 'drawing_list.confirm', detail: String(b.id || '') + ', ' + r.excluded + ' left out' });
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/drawing-lists/approve' && req.method === 'POST') {
        if (!can.drawingsApprove(role)) return json({ error: 'Only the PM approves the drawing list into the register.' }, 403);
        const b = await req.json().catch(() => ({}));
        const whoName = (me && me.name) || role;
        const r = await approveList(env, pid, String(b.id || ''), whoName);
        if (!r.error && !r.already) await audit(env, { project_id: pid, who: whoName, action: 'drawing_list.approve',
          detail: String(b.id || '') + ': ' + r.result.awaited + ' sheets now awaited' });
        return json(r, r.error ? 400 : 200);
      }

      /* ---- G2: abandon a drop before it is committed (spec §13). The files
       * uploaded for scanning are deleted; anything filed or held stays. */
      if (p === '/api/intake/abandon' && req.method === 'POST') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const bid = String(b.batch_id || '');
        if (!can.platform(role, me) && !(await batchIn(bid, pid))) return json({ error: 'no such batch' }, 404);
        const bat = await env.DB.prepare('SELECT project_id, org_id FROM intake_batch WHERE id = ?').bind(bid).first().catch(() => null);
        const r = await abandonBatch(env, bid, me || { name: role });
        if (r.error) return json(r, 404);
        if (!r.already && bat) await audit(env, { org_id: bat.org_id, project_id: bat.project_id, who: (me && me.name) || role,
          action: 'intake.abandon', detail: bid + ': ' + r.items + ' items left out, ' + r.files_deleted + ' stored files deleted' });
        return json(r);
      }

      /* ---- G6: the intake report (spec §30), on screen, as Excel or as the PDF.
       * The contractor sees their own project's; AETRAA sees any. */
      if (p === '/api/intake/report' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const bid = url.searchParams.get('batch') || '';
        const bat = await getBatch(env, bid);
        if (!bat) return json({ error: 'no such batch' }, 404);
        if (!can.platform(role, me) && bat.project_id !== pid) return json({ error: 'auth' }, 403);
        const proj = await getProject(env, bat.project_id);
        const rep = buildIntakeReport(bat, bat.items, proj);
        const form = url.searchParams.get('format') || 'json';
        const whoName = me ? me.name : (can.platform(role, me) ? 'AETRAA Admin' : role);
        const base = (((proj && proj.name) || 'Project') + ' - Intake report - ' + String(bat.started_at || '').slice(0, 10))
          .replace(/[^A-Za-z0-9 ._-]+/g, '-');
        const send = (bytes, type, name) => new Response(bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store',
          'Content-Disposition': 'attachment; filename="' + name + '"', 'X-Content-Type-Options': 'nosniff' } });
        if (form === 'xlsx') {
          return send(reportWorkbook(rep, { header: await xlsHeader(env, proj, whoName, 'Intake report') }),
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base + '.xlsx');
        }
        if (form === 'pdf') {
          return send(await reportPdf(rep, await xlsHeader(env, proj, whoName, 'Intake report')), 'application/pdf', base + '.pdf');
        }
        return json(rep);
      }

      /* ---- G8: the project's intake history, visible to the contractor
       * (spec §14): what was loaded, when, by whom, and what was held. */
      if (p === '/api/intake/history' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const want = can.platform(role, me) ? (url.searchParams.get('project') || pid) : pid;
        await ensureIntakeTables(env);
        const got = await env.DB.prepare(
          `SELECT id, started_by, started_at, finished_at, status, file_count, summary, scope, report_id
             FROM intake_batch WHERE project_id = ? ORDER BY started_at DESC LIMIT 200`
        ).bind(String(want || '')).all().catch(() => ({ results: [] }));
        return json({ project_id: want, batches: (got.results || []).map((r) => {
          let by = {}; try { by = JSON.parse(r.summary || '{}') || {}; } catch (e) { by = {}; }
          return { ...r, summary: by };
        }) });
      }

      /* ---- G4: the company's folder map (spec §4). Proposed after a commit,
       * remembered only when someone confirms it, visible and removable. */
      if (p === '/api/intake/folders' && req.method === 'GET') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const bid = url.searchParams.get('batch') || '';
        const bat = await env.DB.prepare('SELECT project_id, org_id FROM intake_batch WHERE id = ?').bind(bid).first().catch(() => null);
        if (!bat) return json({ error: 'no such batch' }, 404);
        if (!can.platform(role, me) && bat.project_id !== pid) return json({ error: 'auth' }, 403);
        const proj = await getProject(env, bat.project_id);
        const oid = (proj && proj.org_id) || bat.org_id;
        return json({ proposals: await learnFolders(env, bid, oid), remembered: await listFolderMap(env, oid) });
      }
      if (p === '/api/intake/folder-map' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const proj = await getProject(env, can.platform(role, me) ? (url.searchParams.get('project') || pid) : pid);
        if (!proj) return json({ error: 'no such project' }, 404);
        return json({ org_id: proj.org_id, remembered: await listFolderMap(env, proj.org_id) });
      }
      if (p === '/api/intake/folder-map' && req.method === 'POST') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const proj = await getProject(env, can.platform(role, me) ? String(b.project_id || pid || '') : pid);
        if (!proj || !proj.org_id) return json({ error: 'no such project' }, 404);
        const whoName = (me && me.name) || role;
        if (b.remove) {
          const r = await removeFolderMap(env, proj.org_id, String(b.remove));
          if (!r.error) await audit(env, { org_id: proj.org_id, project_id: proj.id, who: whoName, action: 'intake.folder_map.remove', detail: String(b.remove) });
          return json(r, r.error ? 400 : 200);
        }
        const entries = (Array.isArray(b.entries) ? b.entries : []).filter((e) => e && e.pattern && e.family && e.family !== 'unsupported');
        if (!entries.length) return json({ error: 'nothing was chosen to remember' }, 400);
        const r = await saveFolderMap(env, proj.org_id, entries, { name: whoName });
        await audit(env, { org_id: proj.org_id, project_id: proj.id, who: whoName, action: 'intake.folder_map',
          detail: entries.map((e) => e.pattern + ' → ' + e.family).join(', ') });
        return json(r, r.error ? 400 : 200);
      }

      /* E9 step 3: the Principal approves the payment terms read from the
       * contract. Only a Principal of this project can — not AETRAA, and not
       * the QS who accepted them: the approval is the company's own sign-off. */
      if (p === '/api/terms/status' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const want = can.platform(role, me) ? (url.searchParams.get('project') || pid) : pid;
        const st = await termsStatus(env, String(want || ''));
        if (!st) return json({ error: 'no such project' }, 404);
        return json({ ...st, may_approve: !!(me && userFunctions(me).includes('principal')) });
      }
      if (p === '/api/terms/approve' && req.method === 'POST') {
        if (!me || !userFunctions(me).includes('principal')) {
          return json({ error: 'Only the Principal approves the payment terms.' }, 403);
        }
        const r = await approveTerms(env, pid, me.name);
        if (r.error) return json(r, 404);
        if (!r.already) await audit(env, { org_id: me.org_id, project_id: pid, user_id: me.id, who: me.name,
          action: 'terms.approve', detail: 'payment terms approved' });
        return json(r);
      }

      if (p === '/api/intake/terms' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 403);
        const batch = await getBatch(env, url.searchParams.get('batch') || '');
        if (!batch) return json({ error: 'no such batch' }, 404);
        const proj = await getProject(env, batch.project_id);
        if (!proj) return json({ error: 'no such project' }, 404);

        const contracts = batch.items.filter((i) => i.family === 'contract' && i.file_key !== null);
        const docs = [];
        for (const it of contracts.slice(0, 3)) {
          const row = await env.DB.prepare('SELECT file_key FROM intake_item WHERE id = ?')
            .bind(it.id).first().catch(() => null);
          if (row && row.file_key) docs.push({ file_key: row.file_key, filename: it.filename });
        }
        const { text, pages, labels, used } = await contractPages(env, docs);
        if (!text.trim()) return json({ terms: [], read: false });

        const current = {
          retention_pct: proj.retention_pct, retention_cap_pct: proj.retention_limit_pct,
          advance_pct: proj.advance_pct, payment_days: proj.payment_days,
          rfi_reply_days: proj.reply_days, notice_clause: proj.notice_clause,
          completion_date: proj.contract_finish,
        };
        return json({ read: true, terms: onOwnPages(proposeTerms(text, pages, current), labels, used.length > 1) });
      }

      if (p === '/api/intake/terms' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const wantPid = String(b.project_id || '');
        const proj = await getProject(env, wantPid);
        if (!proj) return json({ error: 'no such project' }, 404);
        const vals = acceptedTerms(Array.isArray(b.terms) ? b.terms : []);
        const keys = Object.keys(vals);
        // Every proposal shown is kept with what the person did with it —
        // accepted, corrected or refused (spec §14) — before anything is written.
        await recordEvidence(env, proj, termEvidence(Array.isArray(b.terms) ? b.terms : [], vals),
          (me && me.name) || role, b.batch_id).catch(() => 0);
        if (!keys.length) return json({ error: 'nothing was ticked, so nothing was changed' }, 400);

        // The platform's own column names, which are NOT the term keys. Getting
        // one wrong here fails silently — the UPDATE throws, the catch swallows
        // it, and the screen says the term was applied when nothing was written.
        // Every name below is the one in schema.sql, and test-intake-terms.mjs
        // reads them back out of the row to prove it.
        const COLUMN = {
          retention_pct: 'retention_pct', retention_cap_pct: 'retention_limit_pct',
          advance_pct: 'advance_pct', payment_days: 'payment_days',
          rfi_reply_days: 'reply_days', notice_clause: 'notice_clause',
          completion_date: 'contract_finish',
        };
        const applied = [], refused = [];
        for (const k of keys) {
          const col = COLUMN[k];
          if (!col) continue;
          try {
            await env.DB.prepare(`UPDATE projects SET ${col} = ? WHERE id = ?`)
              .bind(vals[k], wantPid).run();
            applied.push((TERMS[k] || {}).label || k);
          } catch (e) {
            // Never report a term as applied when the write failed: the whole
            // point of the panel is that the person knows what was changed.
            refused.push((TERMS[k] || {}).label || k);
          }
        }
        await audit(env, { org_id: proj.org_id, project_id: wantPid, who: (me && me.name) || role,
          action: 'intake.terms', detail: applied.join(', ') });
        // E9 step 3: terms read from the contract wait for the Principal.
        if (applied.length) await markPending(env, wantPid, (me && me.name) || role);
        return json({ ok: true, applied, refused,
          error: refused.length && !applied.length ? 'none of those could be saved' : undefined });
      }

      /* DRAFT → LIVE, and it is a deliberate act.
       *
       * A draft project is invisible to the customer: nobody signs in to it and
       * nothing can be raised on it. That is what lets the terms be READ from
       * the contract instead of typed before intake ever runs — create the
       * project fully and you have typed the seven figures by hand, which
       * defeats the point of intake.
       *
       * Going live is its own action rather than a side effect of committing a
       * batch, because the moment it happens the client's people can sign in. */
      if (p === '/api/setup/golive' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const wantPid = String(b.project_id || '');
        const proj = await getProject(env, wantPid);
        if (!proj) return json({ error: 'no such project' }, 404);
        if (proj.setup_state !== 'draft') return json({ ok: true, already: true, state: 'live' });

        // What is missing is reported rather than blocking: a project can go
        // live with no BOQ and pick it up the week the first application is
        // due. Only the things that make it unusable are refused.
        const missing = [];
        if (!proj.name) missing.push('a project name');
        const team = await projectTeam(env, proj.org_id, wantPid).catch(() => []);
        if (!team.length) missing.push('somebody to sign in — no people are on this project');

        /* THE CHECKS. Not a count of what exists — a person having opened each
         * screen the client's people will open, on this project's real data,
         * and said it is right.
         *
         * This is refused rather than warned about, because go-live is the one
         * irreversible act here: from that moment the client's people sign in,
         * deletion closes for good, and AETRAA's reach over the project ends.
         * A screen nobody has looked at is found by the client. */
        try {
          const users = (await listUsers(env, proj.org_id).catch(() => []))
            .filter((u) => userInProject(u, wantPid))
            .map((u) => ({ name: u.name, email: u.email, status: u.status, functions: userFunctions(u) }));
          const v = await verifyState(env, wantPid, users);
          if (!v.nobody && !v.ready) {
            const left = v.rows.filter((x) => !x.signed).map((x) => x.label);
            missing.push((v.total - v.done) + ' of ' + v.total + ' dashboards still unchecked — ' +
              left.slice(0, 3).join(', ') + (left.length > 3 ? ' and ' + (left.length - 3) + ' more' : '') +
              '. Open each one as the role that will use it, and sign it off.');
          }
        } catch (e) { /* the checks are unavailable; the rest still stands */ }

        if (missing.length) return json({ error: 'not ready: ' + missing.join('; ') }, 400);

        await env.DB.prepare("UPDATE projects SET setup_state = 'live' WHERE id = ?").bind(wantPid).run();
        await audit(env, { org_id: proj.org_id, project_id: wantPid, who: (me && me.name) || role,
          action: 'project.live', detail: proj.name || wantPid });
        // A project never goes live with its test run still beside it.
        const td = await testState(env, wantPid).catch(() => ({ running: false }));
        if (td.running) {
          const gone = await endTest(env, wantPid);
          await audit(env, { org_id: proj.org_id, project_id: wantPid, who: (me && me.name) || role,
            action: 'testdrive.end', detail: 'deleted at go-live — ' + gone.removed + ' rows, ' + gone.people + ' test people' });
        }
        const warn = [];
        if (!gateConfigured(proj)) warn.push('the drawing gate is not configured');
        return json({ ok: true, state: 'live', warnings: warn });
      }

      if (p === '/api/setup/rules') {
        if (!can.platform(role, me) && !can.drawings(role)) return json({ error: 'auth' }, 401);
        if (req.method !== 'GET' && !can.platform(role, me)) {
          return json({ error: 'Only AETRAA sets a project’s drawing numbering.' }, 403);
        }
        await ensureGateColumns(env);
        const wantPid = url.searchParams.get('project') || pid;
        if (req.method === 'GET') {
          const proj = await getProject(env, wantPid);
          if (!proj) return json({ error: 'no such project' }, 404);
          return json({ project_id: wantPid, configured: gateConfigured(proj),
            rules: rulesOf(proj) || [], defaults: DEFAULT_RULES });
        }
        const b = await req.json().catch(() => ({}));
        const rules = cleanRules(Array.isArray(b.rules) ? b.rules : []);
        if (!rules.length) return json({ error: 'give at least one numbering rule' }, 400);
        await env.DB.prepare('UPDATE projects SET drawing_rules = ? WHERE id = ?')
          .bind(JSON.stringify(rules), wantPid).run();
        await audit(env, { project_id: wantPid, who: 'AETRAA Admin', action: 'gate.rules',
          detail: rules.map((r) => r.match).join(', ') });
        return json({ ok: true, rules });
      }

      /* ---- THE PROJECT LIBRARY: contracts, bonds, insurance, O&M manuals —
       * everything that is neither a drawing nor a workflow record, and which
       * until now had nowhere on the platform to be. */
      if (p === '/api/library' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const rows = await listLibrary(env, pid, { class: url.searchParams.get('class') || '' });
        if (rows === null) return json({ migrated: false, documents: [] });
        return json({ migrated: true, documents: rows, classes: CLASSES,
          summary: await librarySummary(env, pid) });
      }
      if (p === '/api/library' && req.method === 'POST') {
        // A read-only login (the consultant's) files nothing.
        if (!can.submit(role)) return json({ error: 'Filing a document is not part of your access.' }, 403);
        const b = await req.json().catch(() => ({}));
        let bytes = null;
        if (typeof b.data === 'string' && /^data:[\w.+-]+\/[\w.+-]+;base64,/.test(b.data)) {
          try { bytes = b64ToBytes(b.data); } catch (e) { return json({ error: 'that file did not arrive in a form the app can store' }, 400); }
        }
        const libWho = (me && me.name) || role;
        const r = await addDocument(env, pid, {
          org_id: me ? me.org_id : null, class: b.class, title: b.title,
          reference: b.reference, doc_date: b.doc_date, filename: b.filename,
          mime: b.mime, bytes, links: b.links, note: b.note,
          language: b.language, unread_reason: b.unread_reason,
        }, { name: libWho });
        if (!r.error && !r.already) {
          await audit(env, { org_id: me ? me.org_id : null, project_id: pid,
            user_id: me ? me.id : null, who: libWho, action: 'library.add',
            detail: (b.class || 'other') + ': ' + String(b.title || '').slice(0, 120) });
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/library/file' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const f = await documentFile(env, pid, url.searchParams.get('id') || '');
        if (!f) return json({ error: 'no such document' }, 404);
        // Only a PDF or a picture opens in the browser; anything else downloads (uploadedFileHeaders).
        return new Response(f.bytes, { headers: {
          ...uploadedFileHeaders(f.mime, f.filename.replace(/[^A-Za-z0-9 ._-]+/g, '-'), true), 'Cache-Control': 'no-store' } });
      }

      /* ---- Any register, as a real Excel workbook.
       *
       * The screen's "Export to Excel" wrote a comma-separated file with a
       * .csv name. This is the workbook itself: real dates that sort as dates,
       * a frozen header, and a second sheet carrying every field of every
       * record's own form. Read access is enough — exporting a register is
       * reading it, and the read-only folders say so on screen. */
      if ((p === '/api/register/xlsx' || p === '/api/register/schedule.xlsx') && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const whoDownloads = me ? me.name : (can.platform(role, me) ? 'AETRAA Admin' : role);
        const bucket = String(url.searchParams.get('reg') || '');
        // The drawing register and the priced bill are not records — they have
        // their own tables — so they are built from their own sources.
        if (bucket === 'drawings' || bucket === 'boq') {
          const proj0 = await getProject(env, pid);
          let bytes0 = null, label = '';
          if (bucket === 'drawings') {
            const dr = await listDrawings(env, pid, {});
            if (dr === null) return json({ error: 'This project has no drawing register yet.' }, 404);
            bytes0 = drawingsWorkbook(dr, proj0, { header: await xlsHeader(env, proj0, whoDownloads, 'Drawing register') }); label = 'Drawing register';
          } else {
            const bq = await listBOQ(env, pid);
            if (bq === null) return json({ error: 'No bill of quantities has been loaded for this project.' }, 404);
            bytes0 = boqWorkbook(bq, proj0, { header: await xlsHeader(env, proj0, whoDownloads, 'Bill of Quantities (priced)') }); label = 'Bill of Quantities';
          }
          const n0 = ((proj0 && proj0.name) || 'Project') + ' - ' + label + ' - ' + today() + '.xlsx';
          return new Response(bytes0, { headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control': 'no-store',
            'Content-Disposition': 'attachment; filename="' + n0.replace(/[^A-Za-z0-9 ._-]+/g, '-') + '"' } });
        }
        if (!REGISTERS[bucket]) return json({ error: 'There is no register by that name.' }, 404);
        await ensureRecordsTable(env);
        const all = await listRecords(env, pid, null);
        if (all === null) return json({ error: 'This project has no registers yet.' }, 404);
        const types = typesFor(bucket);
        const rows = all.filter((x) => types.includes(x.type) && (!mods || recordTypeOn(mods, x.type)));
        const proj = await getProject(env, pid);
        const sched = p.endsWith('schedule.xlsx');
        const header = await xlsHeader(env, proj, whoDownloads, REGISTERS[bucket].title + (sched ? ' — submission schedule' : ''), { dated: sched });
        // K10 (v5 A2): the letters register is the correspondence register —
        // in and out in one list, its own columns, overdue first.
        const bytes = sched ? scheduleWorkbook(bucket, rows, proj, { header })
          : bucket === 'letters' ? correspondenceWorkbook(await correspondenceRegister(env, pid), proj, { header })
          // K13 (v5 A10): the RFI log, by discipline, with v5's columns.
          : bucket === 'rfi' ? rfiWorkbook(await rfiLog(env, pid), proj, { header })
          : registerWorkbook(bucket, rows, proj, { header });
        const name = ((proj && proj.name) || 'Project') + ' - ' + REGISTERS[bucket].title +
          (sched ? ' schedule' : '') + ' - ' + today() + '.xlsx';
        return new Response(bytes, { headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Cache-Control': 'no-store',
          'Content-Disposition': 'attachment; filename="' + name.replace(/[^A-Za-z0-9 ._-]+/g, '-') + '"' } });
      }
      /* ---- STEP 10: what needs this person, across the whole project. */
      if (p === '/api/attention' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const proj = await getProject(env, pid);
        return json(await attentionFor(env, pid, proj, me ? { id: me.id, name: me.name } : null, me ? userFunctions(me) : [], role));
      }
      /* ---- STEP 8: meeting minutes and the action tracker. */
      if (p.startsWith('/api/meeting') || p.startsWith('/api/action')) {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const mfns = me ? userFunctions(me) : [];
        const proj = await getProject(env, pid);
        const who = { id: me ? me.id : '', name: (me && me.name) || role };
        const team = me ? await projectTeam(env, me.org_id, pid) : [];
        const bin = (bytes, type, name) => new Response(bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store',
          'Content-Disposition': 'attachment; filename="' + name.replace(/[^A-Za-z0-9 ._-]+/g, '-') + '"' } });
        if (p === '/api/meetings' && req.method === 'GET') {
          return json({ meetings: await listMeetings(env, pid), types: MEETING_TYPES, series: MEETING_SERIES, contacts: await listContacts(env, pid),
            ai_on: aiEnabled(env) && (!mods || mods.includes('ai')),
            may: { write: mayWriteMinutes(mfns, role), issue: mayIssueMinutes(mfns, role) },
            team: team.map((u) => ({ id: u.id, name: u.name, functions: u.functions,
              role: (u.functions || []).map((f) => (FUNCTIONS[f] || {}).label || f).join(' + ') })), me: who.id,
            project: { name: proj && proj.name } });
        }
        if (p === '/api/meeting' && req.method === 'GET') {
          const m = await getMeeting(env, pid, url.searchParams.get('ref') || '');
          if (!m) return json({ error: 'no meeting with that reference' }, 404);
          return json({ meeting: m, checks: m.status === 'draft' ? minutesChecks(m, m.arising_open) : null });
        }
        if (p === '/api/meeting/doc' && req.method === 'GET') {
          const m = await getMeeting(env, pid, url.searchParams.get('ref') || '');
          if (!m) return json({ error: 'no meeting with that reference' }, 404);
          if (url.searchParams.get('view')) {
            return new Response(minutesHTML(m, proj), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
          }
          // K13 (v5 A11): the series' own template — the consultant's for their
          // meetings, the company's for internal ones — where one is set up.
          const tplM = await templateFor(env, pid, 'minutes_' + (m.series || seriesOf(m.type))).catch(() => null);
          if (tplM) {
            const filled = await fillTemplate(tplM.bytes, { ...buildValues({ ref: m.ref, title: m.title, data: {}, created_by: m.prepared_by, created_at: m.created_at }, proj), ...minutesValues(m, proj) });
            if (!filled.error) {
              const fmtM = FORMATS[filled.format] || FORMATS.docx;
              return bin(filled.bytes, fmtM.mime, m.ref + ' minutes' + (m.status === 'draft' ? ' (draft)' : '') + '.' + fmtM.ext);
            }
          }
          return bin(new TextEncoder().encode(minutesWord(m, proj)), 'application/msword', m.ref + ' minutes' + (m.status === 'draft' ? ' (draft)' : '') + '.doc');
        }
        if (p === '/api/actions' && req.method === 'GET') {
          return json({ actions: await listActions(env, pid, { mine: url.searchParams.get('mine') ? who.id : '', status: url.searchParams.get('status') || '' }),
            may: { update_any: mayIssueMinutes(mfns, role) }, me: who.id });
        }
        if (p === '/api/actions/xlsx' && req.method === 'GET') {
          return bin(actionsWorkbook(await listActions(env, pid, {}), proj, { header: await xlsHeader(env, proj, who.name, 'Action log') }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Action log - ' + ((proj && proj.name) || 'project') + '.xlsx');
        }
        if (req.method === 'POST') {
          const b = await req.json().catch(() => ({}));
          if (p === '/api/action') {
            const r = await updateAction(env, pid, b, me, mfns, role);
            if (!r.error) await audit(env, { project_id: pid, user_id: who.id || null, who: who.name, action: b.close ? 'action.close' : 'action.redate', detail: String(b.ref || '') });
            return json(r, r.error ? (r.status || 400) : 200);
          }
          if (!mayWriteMinutes(mfns, role)) return json({ error: 'Writing minutes is not part of your access.' }, 403);
          /* K13 (A11): the minutes drafted from typed notes or a scanned
           * sheet — returned to the screen, saved only when the person saves;
           * each owner proposed until a person confirms it. And the
           * consultant's issued minutes, read and recorded as theirs. */
          if (p === '/api/meeting/ai-draft' || p === '/api/meeting/consultant/read') {
            if (mods && !mods.includes('ai')) return json({ error: 'The AI assistance module is not switched on for this project.', module: 'ai' }, 403);
            let file = null;
            try { if (b.file && b.file.data) file = { filename: String(b.file.filename || 'notes.pdf'), bytes: b64ToBytes(String(b.file.data)) }; }
            catch (e) { return json({ error: 'could not read that upload' }, 400); }
            const ctxM = { who: who.name, team, kindLabel: (MEETING_TYPES[b.type] || MEETING_TYPES.progress).label };
            const r = p === '/api/meeting/ai-draft' ? await draftMinutes(env, pid, { notes: b.notes, file }, ctxM) : await readConsultantMinutes(env, pid, { notes: b.notes, file }, ctxM);
            if (!r.error) await audit(env, { project_id: pid, user_id: who.id || null, who: who.name, action: p.endsWith('read') ? 'ai.minutes.consultant' : 'ai.minutes.draft',
              detail: r.draft.items.length + ' items, ' + r.draft.items.reduce((s, it) => s + it.actions.length, 0) + ' actions read by ' + r.model });
            return json(r, r.error ? 400 : 200);
          }
          if (p === '/api/meeting/consultant/record') {
            // Recorded as received: their reference kept, status "recorded";
            // their actions stay text in the minute — none goes to our tracker.
            const items = (Array.isArray(b.items) ? b.items : []).map((it) => ({ ...it, actions: (it.actions || []).map((a) => ({ text: a.text, owner_name: a.owner_name || a.owner || '', due: a.due || '', suggested_owner_user_id: a.suggested_owner_user_id || '' })) }));
            // ...and, later, the ones DC confirms go into our tracker (decision 8).
            const r = await saveDraft(env, pid, { ...b, ref: undefined, items, arising: [], series: 'consultant' }, who, team, { status: 'recorded', their_ref: b.their_ref, source: 'the consultant’s issued minutes' });
            if (r.error) return json(r, r.status || 400);
            if (b.file && b.file.data) {
              try { await addAttachment(env, pid, r.ref, String(b.file.filename || 'consultant minutes.pdf'), 'application/octet-stream', b64ToBytes(String(b.file.data)), who.name); } catch (e) { /* recorded either way */ }
            }
            await audit(env, { project_id: pid, user_id: who.id || null, who: who.name, action: 'minutes.consultant', detail: r.ref + (b.their_ref ? ' (their ' + String(b.their_ref).slice(0, 40) + ')' : '') + ' recorded' });
            return json({ ok: true, ref: r.ref, status: 'recorded' });
          }
          if (p === '/api/meeting') {
            const r = await saveDraft(env, pid, b, who, team);
            if (!r.error && r.meeting) await rememberContacts(env, pid, r.meeting.attendees, team);
            return json(r, r.error ? (r.status || 400) : 200);
          }
          // Decision 8: the consultant's actions, confirmed one by one into our tracker.
          if (p === '/api/meeting/consultant/track') {
            if (!mayIssueMinutes(mfns, role)) return json({ error: 'Document Control, the PM or the Principal confirms an action into the tracker.' }, 403);
            const r = await trackConsultantActions(env, pid, String(b.ref || ''), b.actions, who, team);
            if (r.created && r.created.length) await audit(env, { project_id: pid, user_id: who.id || null, who: who.name, action: 'minutes.consultant.track',
              detail: String(b.ref || '') + ': ' + r.created.map((a) => a.ref).join(', ') + ' added to the tracker' });
            for (const a of (r.created || [])) {
              if (!a.owner_user_id || !me || a.owner_user_id === me.id) continue;
              try { await notifyTeam(env, { me, pid, projectName: proj && proj.name, to: { people: [a.owner_user_id] }, title: a.ref + ': an action for you from the consultant’s minutes',
                message: a.text + ' — by ' + a.due, ref: String(b.ref || ''), kind: 'minutes', email: true }, (to, subject, htmlBody) => sendEmail(env, to, subject, htmlBody)); } catch (e) { /* tracked either way */ }
            }
            return json(r, r.error ? (r.status || 400) : 200);
          }
          // Decision 16 (v5 A11 step 3): DC sends the issued minutes to the
          // attendees from outside the platform, with the minutes attached.
          if (p === '/api/meeting/send') {
            if (!mayIssueMinutes(mfns, role)) return json({ error: 'Document Control, the PM or the Principal sends the minutes.' }, 403);
            const m = await getMeeting(env, pid, String(b.ref || ''));
            if (!m) return json({ error: 'no meeting with that reference' }, 404);
            if (m.status !== 'issued') return json({ error: m.status === 'draft' ? 'Issue the minutes first.' : m.ref + ' is the consultant’s minutes — they sent them.' }, 400);
            const to = outsideRecipients(m, team);
            if (!to.length) return json({ error: 'No attendee from outside the platform has an email address on these minutes. Add it to the attendance and save before issuing next time.' }, 400);
            let file = null;
            const tplM = await templateFor(env, pid, 'minutes_' + (m.series || seriesOf(m.type))).catch(() => null);
            if (tplM) {
              const filled = await fillTemplate(tplM.bytes, { ...buildValues({ ref: m.ref, title: m.title, data: {}, created_by: m.prepared_by, created_at: m.created_at }, proj), ...minutesValues(m, proj) });
              if (!filled.error) { const f = FORMATS[filled.format] || FORMATS.docx; file = { filename: m.ref + ' minutes.' + f.ext, contentType: f.mime, bytes: filled.bytes }; }
            }
            if (!file) file = { filename: m.ref + ' minutes.doc', contentType: 'application/msword', bytes: new TextEncoder().encode(minutesWord(m, proj)) };
            const subject = m.ref + ' — ' + m.title + ' — minutes (' + ((proj && proj.name) || '') + ')';
            const html = '<p>Dear all,</p><p>Please find attached the minutes of <b>' + escHtml(m.title) + '</b> held on ' + escHtml(m.meeting_date || '') + ' (' + escHtml(m.ref) + ').</p>'
              + '<p>Any comment on the minutes should reach us before the next meeting.</p><p>Regards,<br>' + escHtml(who.name) + '<br>' + escHtml((proj && proj.name) || '') + '</p>';
            const sent = await sendEmail(env, to.map((x) => x.email), subject, html, { attachments: [file], replyTo: me && me.email ? me.email : undefined });
            if (!sent || !sent.ok) return json({ error: 'The email could not be sent' + (sent && sent.error ? ': ' + sent.error : '') + '. Send the minutes by hand.', to }, 400);
            const log = await logSent(env, pid, m, { at: new Date().toISOString(), by: who.name, to: to.map((x) => x.email) });
            await audit(env, { project_id: pid, user_id: who.id || null, who: who.name, action: 'minutes.send', detail: m.ref + ' sent to ' + to.map((x) => x.email).join(', ') });
            return json({ ok: true, to, sent_log: log });
          }
          if (p === '/api/meeting/discard') {
            const r = await discardDraft(env, pid, String(b.ref || ''));
            return json(r, r.error ? (r.status || 400) : 200);
          }
          if (p === '/api/meeting/issue') {
            if (!mayIssueMinutes(mfns, role)) return json({ error: 'Minutes are issued by the PM, the Principal or Document Control.' }, 403);
            const r = await issueMinutes(env, pid, String(b.ref || ''), who);
            if (!r.error) {
              await audit(env, { project_id: pid, user_id: who.id || null, who: who.name, action: 'minutes.issue', detail: r.ref + ' · ' + r.created.length + ' actions' });
              // Everyone on the platform with an action is told, with their own list.
              const byOwner = {};
              for (const a of r.created) if (a.owner_user_id) (byOwner[a.owner_user_id] = byOwner[a.owner_user_id] || []).push(a);
              r.notified = 0;
              for (const [uidOwner, list] of Object.entries(byOwner)) {
                if (!me || uidOwner === me.id) continue;
                try {
                  const n = await notifyTeam(env, { me, pid, projectName: proj && proj.name, to: { people: [uidOwner] },
                    title: r.ref + ' minutes issued — ' + list.length + ' action' + (list.length === 1 ? '' : 's') + ' for you',
                    message: list.map((a) => a.ref + ': ' + a.text + ' — by ' + a.due).join('\n'), ref: r.ref, kind: 'minutes', email: true,
                  }, (to, subject, htmlBody) => sendEmail(env, to, subject, htmlBody));
                  if (n && n.ok) r.notified += n.sent || 1;
                } catch (e) { /* the minutes are issued either way */ }
              }
            }
            return json(r, r.error ? (r.status || 400) : 200);
          }
        }
      }

      if (p === '/api/records' && req.method === 'POST') {
        if (!can.submit(role)) return json({ error: 'auth' }, 401);
        await ensureRecordsTable(env);
        const b = await req.json().catch(() => ({}));
        // The access matrix, enforced. Until now any 'lead' could raise
        // anything, and 'lead' is Design, DC, QA/QC, HSE, Commercial,
        // Procurement, Finance and Subcontractors at once.
        if (!mayCreateRecord(me, String(b.type || ''), can.platform(role, me))) {
          return json({ error: 'Raising this is ' + whoMayRaise(String(b.type || '')) + "'s, not yours." }, 403);
        }
        if (mods && !recordTypeOn(mods, String(b.type || ''))) {
          return json({ error: 'That register belongs to a module that is not switched on for this project.' }, 403);
        }
        // A failure must carry a failing status. This returned 200 with an
        // error in the body, so anything checking the status code read a
        // rejected record as a created one.
        const proj = await getProject(env, pid);
        // The ladder THIS project runs, and the names it calls its roles. Both
        // come from the project's own catalogue, which the Principal may have
        // amended; both fall back to what the platform ships with.
        const ladder = await workflowFor(env, pid, String(b.type || '')).catch(() => null);
        const roleLabels = await labelsFor(env, pid).catch(() => null);
        // K13 (v5 A10): before an RFI is raised, one already asked — on the
        // same drawing or in the same words, in either RFI register — is
        // named, and the engineer says to raise it anyway.
        if (b.type === 'rfi' && !b.not_duplicate) {
          await ensureRecordsTable(env);
          const dd = b.data || {};
          const dups = await rfiDuplicates(env, pid, { subject: dd.Subject || b.title || '', question: dd.Question || '', drawing: dd['Drawing ref'] || '' });
          if (dups.length) return json({ error: 'This may already have been asked: ' + dups.map((x) => x.ref + ' “' + x.title + '” (' + (x.status || '') + ')').join('; ') + '. Raise it anyway?', duplicates: dups }, 409);
        }
        // K10 (v5 A2 step 2): an incoming letter logged from a dropped
        // letter's reading. The records it names come from that reading on the
        // server, never from the page; the reading is logged once.
        let letterRead = null;
        if (b.type === 'incoming' && b.read_id) {
          letterRead = await getLetterRead(env, pid, b.read_id);
          if (!letterRead) return json({ error: 'There is no such letter reading on this project.' }, 404);
          if (letterRead.logged_ref) return json({ error: 'That letter was already logged as ' + letterRead.logged_ref + '.' }, 409);
          b.data = { ...(b.data && typeof b.data === 'object' ? b.data : {}) };
          const links = (letterRead.refs.linked || []).map((x) => x.ref);
          if (links.length) b.data['Linked records'] = links.join(', '); else delete b.data['Linked records'];
          if (b.data.Summary) b.data.Summary = String(b.data.Summary).slice(0, 600);
        }
        const made = await createRecord(env, pid, b, (me && me.name) || role,
          { project: proj, workflow: ladder, labels: roleLabels });
        if (!made.error && letterRead) {
          // The letter itself, kept on the record; and which values were read
          // by rule, read by AI and confirmed, or typed.
          if (letterRead.file_key) {
            const f = await getFile(env, letterRead.file_key).catch(() => null);
            if (f) {
              const att = await addAttachment(env, pid, made.ref, letterRead.filename, 'application/octet-stream', f.bytes, (me && me.name) || role);
              if (att.error) made.attachment_error = att.error;
            }
          }
          const from = provenanceOf(letterRead, b.data);
          await markLogged(env, pid, letterRead.id, made.ref, { fields: from, model: letterRead.model, confirmed_by: (me && me.name) || role }, (me && me.name) || role);
          made.read_from = from;
        }
        // An RFI raised from an issue (Information required): the issue keeps
        // the RFI's reference, so the project has one RFI series.
        if (!made.error && b.type === 'rfi' && b.from_issue) {
          const iss = await getIssue(env, pid, str(b.from_issue, 40)).catch(() => null);
          if (iss && !iss.rfi_ref) { await linkIssueRfi(env, pid, iss.ref, made.ref); made.issue = iss.ref; }
        }
        // K7 (S0): who raised it, so the consultant's reply reaches them; and
        // the tracker's own word for where it stands.
        if (!made.error && S0_TYPES.includes(String(b.type || ''))) {
          await ensureS0(env);
          if (me) await env.DB.prepare('UPDATE records SET originator_id = ? WHERE project_id = ? AND ref = ?').bind(me.id, pid, made.ref).run();
          await afterAdvance(env, pid, made.ref);
          made.record = await getRecord(env, pid, made.ref);
        }
        // STEP 7: whoever an incoming letter is sent to is told, with the date.
        if (!made.error && b.type === 'incoming' && me) {
          const rec = made.record || {};
          const step = (rec.workflow || [])[1] || {};
          const fn = (step.by || [])[0];
          if (rec.step === 0 && fn) {                 // not when filed for information
            try {
              made.notified = await notifyTeam(env, {
                me, pid, projectName: proj && proj.name, to: { functions: [fn] },
                title: rec.ref + ' received from ' + String((rec.data || {}).From || '') + ' — reply by ' + (rec.due || ''),
                message: rec.ref + ': ' + (rec.title || '') + '. Sent to you for action. Reply by ' + (rec.due || '') + '.',
                ref: rec.ref, kind: 'record', email: true,
              }, (to, subject, htmlBody) => sendEmail(env, to, subject, htmlBody));
            } catch (e) { /* the letter is logged either way */ }
          }
        }
        return json(made, made.error ? 400 : 200);
      }
      /* ---- K5 (spec §3, §17): records from the old system, created closed.
       * Document Control, the PM or the Principal on their own project (the
       * AETRAA Admin on the project it names with ?p=). Each record is filed
       * or refused with its reason; nothing is ever filed twice. */
      if (p === '/api/records/import' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        if (b.project_id && String(b.project_id) !== pid) return json({ error: 'That project is not yours to open.' }, 403);
        if (!mayTakeOver(me, can.platform(role, me))) return json({ error: 'Document Control brings in the old registers.' }, 403);
        await ensureRecordsTable(env);
        const list = Array.isArray(b.records) ? b.records : (b.record ? [b.record] : []);
        if (!list.length) return json({ error: 'no records to import' }, 400);
        if (list.length > 5000) return json({ error: list.length + ' records in one go; the limit is 5,000. Import the log in parts.' }, 400);
        const whoName = (me && me.name) || (can.platform(role, me) ? 'AETRAA Admin' : role);
        const allowed = list.filter((x) => !mods || recordTypeOn(mods, String((x && x.type) || '')));
        const off = list.filter((x) => !allowed.includes(x)).map((x) => ({ ref: (x && x.ref) || '', error: 'that register belongs to a module that is not switched on for this project' }));
        const r = await importRecords(env, pid, allowed, whoName);
        r.refused = off.concat(r.refused);
        if (r.imported.length) {
          await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'records.import',
            detail: r.imported.length + ' imported (' + r.imported.slice(0, 20).join(', ') + (r.imported.length > 20 ? ', …' : '') + ')'
              + (r.refused.length ? ' · ' + r.refused.length + ' refused' : '') });
        }
        return json(r, r.imported.length ? 200 : 400);
      }
      /* ---- K6 · v5 E12: past registers. Document Control drops the old
       * system's RFI / submittal / material / NCR log, maps its columns and
       * statuses, and confirms; each row read becomes an imported record (K5).
       * DC, the PM or the Principal on their own project (AETRAA with ?p=). */
      if (p === '/api/past-registers' || p.startsWith('/api/past-registers/')) {
        if (!mayTakeOver(me, can.platform(role, me))) return json({ error: 'Document Control brings in the old registers.' }, 403);
        if (!pid) return json({ error: 'which project?' }, 400);
        const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        if (b.project_id && String(b.project_id) !== pid) return json({ error: 'That project is not yours to open.' }, 403);
        await ensurePastTables(env);
        const whoName = (me && me.name) || (can.platform(role, me) ? 'AETRAA Admin' : role);
        const typeOff = (t) => !!(mods && t && !recordTypeOn(mods, t));
        const offMsg = (t) => 'The ' + LOG_TYPES[t].replace(/ log$/, ' register') + ' belongs to a module that is not switched on for this project.';
        if (p === '/api/past-registers' && req.method === 'GET') {
          const id = url.searchParams.get('id');
          if (id) { const g = await getLog(env, pid, id); return g ? json(g) : json({ error: 'no such log on this project' }, 404); }
          return json({ logs: await listLogs(env, pid), types: LOG_TYPES, statuses: STATUS_CHOICES,
            fields: Object.fromEntries(Object.entries(LOG_FIELDS).map(([k, v]) => [k, v.label])) });
        }
        if (p === '/api/past-registers/read' && req.method === 'POST') {
          if (b.type && !LOG_TYPES[b.type]) return json({ error: 'only RFI, submittal, material approval and NCR logs are read (v5 E12)' }, 400);
          if (typeOff(b.type)) return json({ error: offMsg(b.type) }, 403);
          let bytes;
          try { bytes = b64ToBytes(String(b.data || '')); } catch (e) { return json({ error: 'could not read that upload' }, 400); }
          const r = await readLog(env, pid, { filename: String(b.filename || 'log.xlsx').slice(0, 200), bytes, type: b.type, sheet: b.sheet,
            mapping: b.mapping, status_map: b.status_map, date_order: b.date_order }, whoName);
          if (r.error) return json(r, 400);
          if (typeOff(r.type)) { await env.DB.prepare('DELETE FROM past_import WHERE id = ?').bind(r.id).run(); return json({ error: offMsg(r.type) }, 403); }
          await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'past.read',
            detail: r.filename + ' · ' + r.type + ' · ' + r.counts.rows + ' rows: ' + r.counts.read + ' read, ' + r.counts.held + ' held, ' + r.counts.not_read + ' not read, ' + r.counts.already + ' already here' });
          return json(r);
        }
        if (p === '/api/past-registers/map' && req.method === 'POST') {
          if (b.type && !LOG_TYPES[b.type]) return json({ error: 'only RFI, submittal, material approval and NCR logs are read (v5 E12)' }, 400);
          if (typeOff(b.type)) return json({ error: offMsg(b.type) }, 403);
          const r = await remapLog(env, pid, String(b.id || ''), { type: b.type, sheet: b.sheet, mapping: b.mapping, status_map: b.status_map, date_order: b.date_order }, whoName);
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/past-registers/confirm' && req.method === 'POST') {
          const cur = await getLog(env, pid, String(b.id || ''));
          if (!cur) return json({ error: 'no such log on this project' }, 404);
          if (typeOff(cur.type)) return json({ error: offMsg(cur.type) }, 403);
          const r = await confirmLog(env, pid, cur.id, whoName);
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'past.confirm',
            detail: cur.filename + ' · ' + r.created + ' imported' });
          return json(r, r.error ? 400 : 200);
        }
        return json({ error: 'not found' }, 404);
      }
      /* ---- K7 · v5 S0: the submittal desk. Each act is its owner's, checked
       * here: the PM (or Principal) returns it, Design resubmits and answers
       * comments, Document Control issues it and records the reply. */
      if (p === '/api/s0' || p.startsWith('/api/s0/')) {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        await ensureS0(env);
        const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        const whoName = (me && me.name) || (can.platform(role, me) ? 'AETRAA Admin' : role);
        const plat = can.platform(role, me);
        const fns = me ? userFunctions(me) : [];
        const boss = plat || fns.includes('pm') || fns.includes('principal');
        if (p === '/api/s0/issue-list') {
          if (req.method === 'GET') return json(await issueList(env, pid));
          if (!(boss || fns.includes('dc'))) return json({ error: 'The PM or Document Control sets who issues go to.' }, 403);
          const r = await setIssueList(env, pid, b);
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 's0.issue_list', detail: 'To ' + r.to.join(', ') + ' · Cc ' + r.cc.join(', ') });
          return json(r, r.error ? 400 : 200);
        }
        const ref = String(b.ref || url.searchParams.get('ref') || '');
        const rec = await getRecord(env, pid, ref);
        if (!rec) return json({ error: 'record not found' }, 404);
        if (mods && !recordTypeOn(mods, rec.type)) return json({ error: 'That register is not switched on for this project.' }, 403);
        if (!isS0(rec)) return json({ error: rec.ref + ' does not go to the consultant through the submittal desk' }, 400);
        const next = pendingStep(rec);
        // Issuing and recording the reply are Document Control's (the step's
        // owners), not the PM's — S0 step 4 and step 5.
        const mayStep = (st) => !!(st && (plat || (me && (st.by || []).some((f) => fns.includes(f)))));
        const isAuthor = !!(me && rec.originator_id && rec.originator_id === me.id) || mayCreateRecord(me, rec.type, plat);
        if (p === '/api/s0' && req.method === 'GET') {
          const atts = await listAttachments(env, pid, rec.ref);
          return json({ record: recordForViewer(me, rec, plat), comments: await listComments(env, pid, rec.ref),
            issue_list: await issueList(env, pid), attachments: atts, email_on: emailDriver(env) !== 'none', codes: CODES,
            max_mb: MAX_ISSUE_BYTES / 1048576,
            // K9 (A3): a scanned or stamped reply can be read by AI.
            ai_on: aiEnabled(env) && (!mods || mods.includes('ai')),
            may: { issue: !!(next && next.issue && mayStep(next)), reply: !!(next && next.reply && mayStep(next)),
              resubmit: !!(rec.returned && (isAuthor || boss)), answer: isAuthor || boss } });
        }
        if (p === '/api/s0/resubmit' && req.method === 'POST') {
          if (!(isAuthor || boss)) return json({ error: 'Design resubmits what was returned to it.' }, 403);
          const r = await resubmit(env, pid, rec, b, whoName);
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'record.resubmit', detail: rec.ref + ' — ' + String(b.note || '').slice(0, 160) });
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/s0/answer' && req.method === 'POST') {
          if (!(isAuthor || boss)) return json({ error: 'Design answers the consultant’s comments.' }, 403);
          const r = await answerComment(env, pid, rec.ref, b.id, b, whoName);
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/s0/issue' && req.method === 'POST') {
          if (!(next && next.issue)) return json({ error: rec.ref + ' is not waiting to be issued' }, 400);
          if (!mayStep(next)) return json({ error: 'Document Control issues it to the consultant.' }, 403);
          const r = await issueRecord(env, pid, rec, b, await s0Context(env, pid, me, whoName, rec));
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'record.issue',
            detail: rec.ref + (r.outside ? ' — outside the platform' : ' — to ' + r.sent.to.join(', ') + (r.sent.cc.length ? ' cc ' + r.sent.cc.join(', ') : '') + ' · ' + r.sent.files.join(', ')) });
          return json(r, r.error ? (r.too_big ? 413 : 400) : 200);
        }
        if (p === '/api/s0/read-reply' && req.method === 'POST') {
          // E14: the returned form, kept on the record and read for a proposal.
          if (!(next && next.reply && mayStep(next))) return json({ error: 'Document Control records the consultant’s reply.' }, 403);
          let bytes;
          try { bytes = b64ToBytes(String(b.data || '')); } catch (e) { return json({ error: 'could not read that upload' }, 400); }
          const added = await addAttachment(env, pid, rec.ref, String(b.filename || 'reply.xlsx'), String(b.mime || ''), bytes, whoName);
          if (added.error) return json(added, 400);
          let sheet = readXlsxSheet(bytes);
          if (sheet.error) sheet = readWordSheet(bytes);
          const tpl = await templateFor(env, pid, rec.type);
          const proposal = sheet.error ? { read: [{ part: 'the form', read: false, why: 'not a readable Excel or Word form — enter the reply by hand' }] }
            : readReturnedSheet(sheet, { ref: rec.ref, type: rec.type, fields: tpl ? readFields(tpl.row) || [] : [] });
          const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((x) => x.toString(16).padStart(2, '0')).join('');
          if (proposal.ref_read && !proposal.ref_ok) return json({ error: 'That form is for ' + proposal.ref_read + ', not ' + rec.ref + '. It was kept on the record; check it is the right reply.', attachment_id: added.id, proposal }, 409);
          const readId = await keepReplyRead(env, pid, rec.ref, sha, b.filename, proposal, whoName);
          return json({ ok: true, attachment_id: added.id, read_id: readId, sha256: sha, proposal });
        }
        // K13 (v5 A10): "possible variation" — an RFI's answer that changes
        // scope is flagged on the record and the QS is told. A flag only:
        // nothing is created in the variation register (A13 is later).
        const flagVariation = async (r0, note) => {
          const n = String(note || '').trim().slice(0, 300);
          if (rec.type !== 'rfi' || !n) return null;
          const cur = await getRecord(env, pid, rec.ref);
          await env.DB.prepare('UPDATE records SET data = ? WHERE project_id = ? AND ref = ?')
            .bind(JSON.stringify({ ...((cur && cur.data) || {}), 'Variation flag': 'Possible variation — ' + n }), pid, rec.ref).run();
          const proj = await getProject(env, pid);
          try {
            await notifyTeam(env, { me, pid, projectName: proj && proj.name, to: { functions: ['commercial'] },
              title: rec.ref + ': possible variation — ' + rec.title, message: 'The answer to ' + rec.ref + ' may change scope: ' + n + '. Check it for a variation.',
              ref: rec.ref, kind: 'record', email: true }, (to, subject, htmlBody) => sendEmail(env, to, subject, htmlBody));
          } catch (e) { /* flagged either way */ }
          await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'rfi.variation_flag', detail: rec.ref + ' — ' + n });
          return n;
        };
        if (p === '/api/s0/reply' && req.method === 'POST') {
          if (!(next && next.reply)) return json({ error: rec.ref + ' is not waiting for the consultant’s reply' }, 400);
          if (!mayStep(next)) return json({ error: 'Document Control records the consultant’s reply.' }, 403);
          const r = await recordReply(env, pid, rec, b, await s0Context(env, pid, me, whoName, rec));
          if (!r.error && b.variation) r.variation = await flagVariation(r, b.variation);
          if (!r.error && b.read_id) await confirmReplyRead(env, pid, b.read_id, { code: r.code, replied_on: r.replied_on, comments: b.comments || [], by: whoName });
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'record.reply',
            detail: rec.ref + ' — ' + r.status + (r.revision ? ' → ' + r.revision : '') });
          return json(r, r.error ? 400 : 200);
        }
        /* K9 · v5 A3 (= S0 step 5): a reply that came back scanned or
         * stamped (PDF, PNG, JPEG), read by AI — the code, each comment with
         * its drawing or clause and discipline, the reply date. DC confirms
         * with one click (step 6). Nothing is recorded until then; the
         * confirmation re-checks the reading here, and one that fails a check
         * (another reference, no code, a date that reads two ways) is not
         * applied — DC records that reply by hand. */
        if ((p === '/api/s0/ai-read' || p === '/api/s0/ai-confirm') && req.method === 'POST') {
          if (!(next && next.reply)) return json({ error: rec.ref + ' is not waiting for the consultant’s reply' }, 400);
          if (!mayStep(next)) return json({ error: 'Document Control records the consultant’s reply.' }, 403);
          if (mods && !mods.includes('ai')) return json({ error: 'The AI assistance module is not switched on for this project.', module: 'ai' }, 403);
          if (p === '/api/s0/ai-read') {
            const a = await getAttachment(env, pid, String(b.attachment_id || ''));
            if (!a || !a.row || a.row.ref !== rec.ref) return json({ error: 'Upload the reply on ' + rec.ref + ' first, then read it.' }, 404);
            const r = await readReplyWithAI(env, pid, rec, { bytes: a.bytes, filename: a.filename, mime: a.mime, attachment_id: a.row.id }, whoName);
            if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'ai.reply.read',
              detail: rec.ref + ' — ' + a.filename + ', read by ' + r.model + (r.may_confirm ? '' : ' (' + r.flags.filter((f) => f.blocks).length + ' to check)') });
            return json(r, r.error ? 400 : 200);
          }
          const prop = await getProposal(env, pid, b.id);
          if (!prop || prop.reader !== 'A3' || prop.target_id !== rec.ref) return json({ error: 'There is no such reading of ' + rec.ref + '.' }, 404);
          if (prop.state !== 'proposed') return json({ error: 'That reading was already ' + prop.state + ' by ' + (prop.decided_by || 'someone') + '.' }, 409);
          const ck = checkReply(prop.proposal.read, rec);
          if (!ck.may_confirm) {
            return json({ error: 'Not recorded: ' + ck.flags.filter((f) => f.blocks).map((f) => f.why).join('; ') + '. Record the reply by hand.', flags: ck.flags }, 400);
          }
          const r = await recordReply(env, pid, rec, { code: ck.code, replied_on: ck.replied_on, comments: ck.comments,
            attachment_id: prop.proposal.attachment_id }, await s0Context(env, pid, me, whoName, rec));
          if (r.error) return json(r, 400);
          if (b.variation) r.variation = await flagVariation(r, b.variation);
          await decideProposal(env, pid, prop.id, whoName, { code: r.code, replied_on: r.replied_on, comments: ck.comments.length });
          await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'record.reply',
            detail: rec.ref + ' — ' + r.status + (r.revision ? ' → ' + r.revision : '') + ' (read by AI, confirmed by ' + whoName + ')' });
          return json({ ...r, read_by_ai: prop.model });
        }
        return json({ error: 'not found' }, 404);
      }
      if (p === '/api/records/take-over' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        if (!mayTakeOver(me, can.platform(role, me))) return json({ error: 'Document Control takes an imported record over.' }, 403);
        await ensureRecordsTable(env);
        const old = await getRecord(env, pid, String(b.ref || ''));
        if (!old) return json({ error: 'record not found' }, 404);
        if (mods && !recordTypeOn(mods, old.type)) return json({ error: 'That register is not switched on for this project.' }, 403);
        const whoName = (me && me.name) || role;
        const ladder = await workflowFor(env, pid, old.type).catch(() => null);
        const roleLabels = await labelsFor(env, pid).catch(() => null);
        const r = await takeOverRecord(env, pid, old.ref, whoName, { project: await getProject(env, pid), workflow: ladder, labels: roleLabels });
        if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'record.take_over', detail: old.ref + ' → ' + r.ref });
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/record' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const ref = url.searchParams.get('ref') || '';
        const rec = await getRecord(env, pid, ref);
        if (rec && mods && !recordTypeOn(mods, rec.type)) return json({ error: 'That register is not switched on for this project.' }, 403);
        return json({ record: rec ? recordForViewer(me, rec, can.platform(role, me)) : rec, attachments: await listAttachments(env, pid, ref) });
      }
      /* ---- HSE. The design's safety report invented every figure in it and
              said it came from the registers. Permits, observations and
              incidents are ordinary records; men on site, toolbox talks,
              inductions and PPE checks are nobody's record until written
              down, which is what the log is for. */
      if (p === '/api/hse' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        await ensureRecordsTable(env);
        const all = (await listRecords(env, pid)) || [];
        const period = url.searchParams.get('period') === 'daily' ? 'daily' : 'weekly';
        const project = await getProject(env, pid);
        return json(await hseReport(env, pid, period, all, project, url.searchParams.get('to')));
      }
      if (p === '/api/hse/log' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        return json({ log: await listHseLog(env, pid,
          url.searchParams.get('from'), url.searchParams.get('to')) });
      }
      if (p === '/api/hse/log' && req.method === 'POST') {
        // The safety log is HSE's book. The PM and the Principal hold every
        // folder; nobody else writes in it.
        const hfns = me ? userFunctions(me) : [];
        const mayLog = can.platform(role, me) || hfns.includes('hse') ||
          hfns.includes('pm') || hfns.includes('principal');
        if (!mayLog) return json({ error: 'the safety log is HSE\u2019s to keep' }, 403);
        const b = await req.json().catch(() => ({}));
        const r = await saveHseLog(env, pid, b, (me && me.name) || role);
        if (!r.error) {
          await audit(env, { project_id: pid, user_id: me ? me.id : null, who: (me && me.name) || role,
            action: 'hse.log', detail: r.log_date });
        }
        return json(r, r.error ? 400 : 200);
      }

      /* ---- attachments. The files that hang off a record. A WIR goes to the
              consultant "with all attachments", so these are the attachments. */
      if (p === '/api/attachments' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        return json({
          attachments: await listAttachments(env, pid, url.searchParams.get('ref') || ''),
          counts: url.searchParams.get('counts') ? await attachmentCounts(env, pid) : undefined,
          limits: { max_bytes: MAX_ATTACHMENT, max_per_record: MAX_PER_RECORD },
        });
      }
      if (p === '/api/attachment' && req.method === 'POST') {
        if (!can.submit(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        if (b.remove) {
          const r = await removeAttachment(env, pid, String(b.remove));
          if (!r.error) {
            await audit(env, { project_id: pid, user_id: me ? me.id : null, who: (me && me.name) || role,
              action: 'attachment.remove', detail: String(r.ref || '') });
          }
          return json(r, r.error ? 400 : 200);
        }
        let bytes;
        try { bytes = b64ToBytes(b.file_b64 || ''); }
        catch (e) { return json({ error: 'could not read that upload' }, 400); }
        const r = await addAttachment(env, pid, String(b.ref || ''), String(b.filename || ''),
          String(b.mime || ''), bytes, (me && me.name) || role);
        if (!r.error) {
          await audit(env, { project_id: pid, user_id: me ? me.id : null, who: (me && me.name) || role,
            action: 'attachment.add', detail: r.ref + ' · ' + r.filename });
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p.startsWith('/attachment/')) {
        if (!can.view(role)) return new Response('auth', { status: 401 });
        const a = await getAttachment(env, pid, p.slice('/attachment/'.length));
        if (!a) return new Response('not found', { status: 404 });
        // Never inline. A file somebody uploaded is served as a download, so the
        // browser does not run it in the platform's own origin.
        return new Response(a.bytes, {
          headers: {
            'Content-Type': a.mime || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${String(a.filename || 'file').replace(/["\\]/g, '')}"`,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'private, max-age=3600',
          },
        });
      }
      /* ---- interim payment. The commercial team and the PM; the valuation a
              QS has reviewed is the only thing that can become an application. */
      if (p.startsWith('/api/ipc')) {
        const ifns = me ? userFunctions(me) : [];
        const ipcOk = role === 'owner' || role === 'manager'
          || ['commercial', 'finance', 'dc', 'pm', 'principal'].some((f) => ifns.includes(f));
        if (!ipcOk) return json({ error: 'payment is not part of your access' }, 403);
        // ON THIS WORKFLOW, OR NOT ON IT. Two QSs hold the same role and one
        // does the certificates while the other does the variations; the tick
        // beside their name is what divides them. The role opens the door, this
        // says whether this particular person walks through it.
        if (me && !onStream(me, 'ipc')) {
          return json({ error: 'Payment certificates are not one of your workflows on this project. ' +
                               'The Principal or the Project Manager can add you to them.' }, 403);
        }
        const whoName = (me && me.name) || role;
        const project = await getProject(env, pid);
        if (p === '/api/ipc' && req.method === 'GET') {
          const may = {};
          for (const a of ['raise', 'approve', 'return', 'issue', 'certify', 'engineer_return', 'pay']) may[a] = mayIPC(a, ifns, role);
          const certs = await listIPC(env, pid);
          return json({ certificates: certs.map((c) => ({ ...c, lines: undefined, detail: { warnings: (c.detail || {}).warnings || [], figures: (c.detail || {}).figures || {} } })),
            pack: IPC_PACK, may, terms: paymentTerms(project, 0) });
        }
        if (p === '/api/ipc/propose' && req.method === 'POST') {
          const b = await req.json().catch(() => ({}));
          const r = await proposeValuation(env, pid, project, b.period_to);
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/ipc/check' && req.method === 'POST') {
          const b = await req.json().catch(() => ({}));
          const r = await checkIPC(env, pid, project, b);
          return json({ ok: r.ok, blockers: r.blockers, warnings: r.warnings, figures: r.figures });
        }
        if (p === '/api/ipc' && req.method === 'POST') {
          if (!mayIPC('raise', ifns, role)) return json({ error: 'Only the QS (Contracts & Commercial), the PM or the Principal raise an application.' }, 403);
          const b = await req.json().catch(() => ({}));
          await ensureTermsTables(env);
          const tstate = await env.DB.prepare('SELECT terms_state FROM projects WHERE id = ?').bind(pid).first().catch(() => null);
          if (tstate && tstate.terms_state === 'pending') return json({ error: PENDING_MESSAGE }, 400);
          const r = await createIPC(env, pid, project, b, whoName);
          if (!r.error) {
            await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName,
              action: 'ipc.prepare', detail: r.ref + ' net ' + r.net });
          }
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/ipc/advance' && req.method === 'POST') {
          const b = await req.json().catch(() => ({}));
          const r = await advanceIPC(env, pid, project, b, whoName, ifns, role);
          if (!r.error) {
            await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName,
              action: 'ipc.' + String(b.action || ''), detail: String(b.ref || '') + (b.certified_amount != null ? ' certified ' + b.certified_amount : '') + (b.paid_amount != null ? ' paid ' + b.paid_amount : '') });
          }
          return json(r, r.error ? (r.status || 400) : 200);
        }
        // The documents: the whole pack, or the Excel / the letter on their own.
        if ((p === '/api/ipc/pack' || p === '/api/ipc/xlsx' || p === '/api/ipc/doc') && req.method === 'GET') {
          const ipc = await getIPC(env, pid, url.searchParams.get('ref') || '');
          if (!ipc) return json({ error: 'no application with that reference' }, 404);
          const history = await listIPC(env, pid);
          const base = (ipc.ref + ' - ' + (project.name || 'Project')).replace(/[^A-Za-z0-9 ._-]+/g, '-');
          const dl = (bytes, type, name) => new Response(bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store',
            'Content-Disposition': 'attachment; filename="' + name + '"', 'X-Content-Type-Options': 'nosniff' } });
          if (p === '/api/ipc/xlsx') return dl(ipcWorkbook(ipc, project, history, { header: await xlsHeader(env, project, whoName, ipc.ref + ' — BOQ valuation') }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base + ' BOQ valuation.xlsx');
          if (p === '/api/ipc/doc') return dl(new TextEncoder().encode(ipcDocumentWord(ipc, project, history, {})), 'application/msword', base + ' application.doc');
          const pack = await buildIpcPack(env, pid, project, ipc, history);
          await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'ipc.pack', detail: ipc.ref + ' · ' + pack.files + ' files' });
          return dl(pack.bytes, 'application/zip', pack.filename.replace(/[^A-Za-z0-9 ._-]+/g, '-'));
        }
      }

      /* ---- THE TEMPLATE IS THE FORM (src/template-forms.js). For any document
              type with a consultant's form assigned, on any project: the fields
              it asks for, the form drawn as it is typed, the document shown
              before every signature, and each signature in its own box. */
      if (p === '/api/template/form' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const wantPid = (can.platform(role, me) && url.searchParams.get('project')) || pid;
        const type = String(url.searchParams.get('type') || '').slice(0, 40);
        const tpl = wantPid ? await templateFor(env, wantPid, type) : null;
        if (!tpl) return json({ has: false });
        const project = await getProject(env, wantPid);
        let tokens = [];
        try { tokens = JSON.parse(tpl.row.tokens || '[]'); } catch (e) { tokens = []; }
        const labels = String(url.searchParams.get('labels') || '').split('|').filter(Boolean);
        const steps = (await workflowFor(env, wantPid, type).catch(() => null)) || (RECORD_TYPES[type] || {}).wf || [];
        const sm = readSignMap(tpl.row);
        const out = { has: true, format: /\.xlsx$/i.test(tpl.row.r2_key || tpl.row.filename || '') ? 'xlsx' : /\.pdf$/i.test(tpl.row.r2_key || tpl.row.filename || '') ? 'pdf' : 'docx',
          filename: tpl.row.filename, tokens, extra: extraFields(tokens, labels, project),
          fields: readFields(tpl.row) ? inputFields(readFields(tpl.row)) : null,
          steps: steps.map((x, i) => ({ i, st: x.st, by: x.by || [], issue: !!x.issue, reply: !!x.reply })), sign_map: sm,
          css: PREVIEW_CSS };
        if (url.searchParams.get('pick')) {
          const shown = {};
          for (const [i, cell] of Object.entries(sm.steps)) shown[cell] = { name: 'Step ' + (Number(i) + 1), role: (steps[i] || {}).st || '', date: '' };
          const d = await drawTemplate(tpl.bytes, buildValues({ ref: '', data: {} }, project), shown, { pick: true });
          out.html = d.html || '';
        }
        return json(out);
      }
      if (p === '/api/template/preview' && req.method === 'POST') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const type = String(b.type || '').slice(0, 40);
        const tpl = pid ? await templateFor(env, pid, type) : null;
        if (!tpl) return json({ has: false });
        const project = await getProject(env, pid);
        const steps = (await workflowFor(env, pid, type).catch(() => null)) || (RECORD_TYPES[type] || {}).wf || [];
        const who = (me && me.name) || role;
        const data = (b.data && typeof b.data === 'object') ? b.data : {};
        const rec = { ref: '(numbered when raised)', type, title: String(b.title || '').slice(0, 300), data,
          created_by: who, created_at: nowISO(),
          workflow: steps.map((x, i) => i === 0 ? { st: x.st, state: 'done', who, when: today() } : { st: x.st, state: 'wait' }) };
        const sig = signaturesFor(rec, steps, readSignMap(tpl.row), {});
        const d = await drawTemplate(tpl.bytes, { ...buildValues(rec, project), ...fieldValues(readFields(tpl.row), rec.data), ...sig.word }, sig.html);
        return json(d.error ? { error: d.error } : { has: true, html: d.html, format: d.format, css: PREVIEW_CSS });
      }
      if (p === '/api/record/preview' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const rec = await getRecord(env, pid, url.searchParams.get('ref') || '');
        if (!rec) return json({ error: 'unknown record' }, 404);
        if (mods && !recordTypeOn(mods, rec.type)) return json({ error: 'That register is not switched on for this project.' }, 403);
        const tpl = await templateFor(env, pid, url.searchParams.get('as') || rec.type);
        if (!tpl) return json({ has: false });
        const project = await getProject(env, pid);
        const view = recordForViewer(me, rec, can.platform(role, me));
        const wf = rec.workflow || [];
        const next = wf.findIndex((w) => !w || w.state !== 'done');
        const sig = signaturesFor(rec, wf, readSignMap(tpl.row), {
          pendingStep: next, pendingLabel: view.can_act ? 'Your signature goes here' : 'Awaiting: ' + ((wf[next] || {}).st || '') });
        const d = await drawTemplate(tpl.bytes, { ...buildValues(rec, project), ...fieldValues(readFields(tpl.row), rec.data), ...sig.word }, sig.html);
        return json(d.error ? { error: d.error } : { has: true, html: d.html, format: d.format, css: PREVIEW_CSS,
          your_box: view.can_act && next >= 0 && !!readSignMap(tpl.row).steps[next] });
      }
      if (p === '/api/setup/template-signs' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const r = await saveSignMap(env, String(b.project_id || ''), String(b.doc_type || ''), b.steps || {});
        return json(r, r.error ? 400 : 200);
      }

      /* ---- TEMPLATES, kept by Document Control (src/html/templates.js). Each
              project's own consultant forms, one per document; each form read
              for its fields, which become the inputs of that document's form. */
      if (p === '/api/templates' || p.startsWith('/api/templates/')) {
        const mine = can.platform(role, me) || !!(me && userFunctions(me).some((f) => ['dc', 'pm', 'principal'].includes(f)));
        if (!mine) return json({ error: 'Templates are kept by Document Control, the PM or the Principal.' }, 403);
        if (!pid) return json({ error: 'which project?' }, 400);
        await ensureFieldColumns(env);
        const who = (me && me.name) || 'AETRAA Admin';
        const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        const type = String(b.doc_type || url.searchParams.get('type') || '').slice(0, 40);
        if (p === '/api/templates' && req.method === 'GET') {
          const list = await listTemplates(env, pid);
          const parseJ = (v) => { try { return JSON.parse(v || '[]') || []; } catch (e) { return []; } };
          return json({ doc_types: DOC_TYPES, templates: list.map((t) => ({ doc_type: t.doc_type, filename: t.filename,
            format: t.format, uploaded_at: t.uploaded_at, uploaded_by: t.uploaded_by,
            inputs: inputFields(readFields(t) || []).map((f) => f.label), boxes: Object.keys((t.sign_map || {}).steps || {}).length,
            // K4: read fields (Excel E10 or Word E16), A6 under two, what prints blank.
            has_fields: !!(readFields(t) || []).length, field_count: t.field_count == null ? null : Number(t.field_count),
            needs_ai: t.field_count != null && Number(t.field_count) < 2, extractor: t.extractor || null,
            unknown_tokens: parseJ(t.unknown_tokens) })),
            // K9 (A6): "Find fields with AI" — for Document Control, with AI on.
            ai_fields: !!((can.platform(role, me) || (me && userFunctions(me).includes('dc'))) && aiEnabled(env) && (!mods || mods.includes('ai'))) });
        }
        if (p === '/api/templates/upload' && req.method === 'POST') {
          let bytes;
          try { bytes = b64ToBytes(b.file_b64 || ''); } catch (e) { return json({ error: 'could not read that upload' }, 400); }
          const r = await saveFormTemplate(env, pid, type, String(b.filename || 'form.xlsx'), bytes, who);
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who, action: 'template.upload', detail: type + ' — ' + (b.filename || '') });
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/templates/review' && req.method === 'GET') {
          const tpl = await getTemplateBytes(env, pid, type);
          if (!tpl) return json({ error: 'There is no form for that document yet.' }, 404);
          let orig = null;
          if (tpl.row.orig_key) { const f = await getFile(env, tpl.row.orig_key); if (f) orig = f.bytes; }
          const project = await getProject(env, pid);
          const fields = readFields(tpl.row) || [];
          const shown = {};
          for (const f of fields) shown[f.cell] = { pending: true, label: f.label, role: f.auto ? 'filled by the platform' : 'asked for' };
          const d = await drawTemplate(orig || tpl.bytes, buildValues({ ref: '', data: {} }, project), shown, { pick: true });
          return json({ ok: true, filename: tpl.row.filename, fields, html: d.html || '', css: PREVIEW_CSS, has_original: !!orig });
        }
        /* K9 · v5 A6: a form the extractor found fewer than two fields on
         * (E10 for Excel, E16 for Word — run again here, on the form itself).
         * The AI is sent the cell text and positions, not the file, and
         * proposes fields and signature boxes; Document Control reviews them
         * on the drawn form and saves (below). A form the extractor read is
         * never offered, and no field the extractor read is touched. A PDF form
         * (decision 14) is read by its own fields, so it never comes here. */
        if (p === '/api/templates/ai-fields' && req.method === 'POST') {
          if (!(can.platform(role, me) || (me && userFunctions(me).includes('dc')))) return json({ error: 'Document Control finds a form’s fields with AI.' }, 403);
          if (mods && !mods.includes('ai')) return json({ error: 'The AI assistance module is not switched on for this project.', module: 'ai' }, 403);
          const tpl = await getTemplateBytes(env, pid, type);
          if (!tpl) return json({ error: 'There is no form for that document yet.' }, 404);
          if (tpl.row.field_count != null && Number(tpl.row.field_count) >= 2) {
            return json({ error: 'The extractor read ' + Number(tpl.row.field_count) + ' fields on this form, so the AI does not change it. Check them with Fields.' }, 400);
          }
          let orig = null;
          if (tpl.row.orig_key) { const f = await getFile(env, tpl.row.orig_key).catch(() => null); if (f) orig = f.bytes; }
          const bytes = orig || tpl.bytes;
          const xl = readXlsxSheet(bytes);
          const ex = !xl.error ? extractXlsxFields(bytes) : extractWordFields(bytes);
          if (ex.error) return json({ error: 'That form could not be read: ' + ex.error }, 400);
          if (ex.fields.length >= 2) return json({ error: 'The extractor reads ' + ex.fields.length + ' fields on this form, so the AI does not change it. Check them with Fields.' }, 400);
          const sheet = !xl.error ? xl : readWordSheet(bytes);
          if (sheet.error) return json({ error: 'That form could not be drawn: ' + sheet.error }, 400);
          const r = await findFieldsWithAI(env, pid, { sheet, existing: readFields(tpl.row) || [], doc_type: type }, who);
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who, action: 'ai.fields.read',
            detail: type + ' — ' + r.fields.length + ' fields and ' + r.signatures.length + ' signature boxes proposed by ' + r.model + (r.dropped.length ? ', ' + r.dropped.length + ' dropped' : '') });
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/templates/fields' && req.method === 'POST') {
          // K9 (A6): saved from an AI draft — the fields DC kept from it are
          // marked as proposed by AI, and the signature boxes DC kept are kept.
          let ai = null;
          if (b.proposal_id) {
            const prop = await getProposal(env, pid, b.proposal_id);
            if (!prop || prop.reader !== 'A6' || prop.target_id !== type) return json({ error: 'There is no such AI draft for this form.' }, 404);
            if (prop.state !== 'proposed') return json({ error: 'That AI draft was already ' + prop.state + '.' }, 409);
            const keepSigns = new Set((Array.isArray(b.ai_signs) ? b.ai_signs : []).map((c) => String(c).toUpperCase()));
            ai = { prop, cells: new Set((prop.proposal.fields || []).map((f) => f.cell)),
              signs: (prop.proposal.signatures || []).filter((s) => keepSigns.has(s.cell)) };
          }
          const r = await updateFields(env, pid, type, b.fields, who, ai ? { ai } : {});
          if (!r.error && ai) {
            const kept = (r.fields || []).filter((f) => f.by === 'ai').length;
            await decideProposal(env, pid, ai.prop.id, who, { fields: kept, signatures: ai.signs.length });
          }
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who, action: 'template.fields', detail: type + ' — ' + (r.inputs || 0) + ' fields'
            + (ai ? ' (' + (r.fields || []).filter((f) => f.by === 'ai').length + ' proposed by AI, ' + ai.signs.length + ' signature boxes)' : '') });
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/templates/signs' && req.method === 'POST') {
          const r = await saveSignMap(env, pid, type, b.steps || {});
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/templates/remove' && req.method === 'POST') {
          const r = await deleteTemplate(env, pid, type);
          return json(r, r.error ? 400 : 200);
        }
        return json({ error: 'unknown templates action' }, 404);
      }

      // Generate a record's document in this project's consultant format.
      if (p === '/api/record/doc' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const ref = url.searchParams.get('ref') || '';
        const rec = await getRecord(env, pid, ref);
        if (!rec) return json({ error: 'unknown record' }, 404);
        if (mods && !recordTypeOn(mods, rec.type)) return json({ error: 'That register is not switched on for this project.' }, 403);
        // K5: this platform's form was never issued for an imported record —
        // generating one would make a document that never existed.
        if (rec.imported) return json({ error: rec.ref + ' was imported from the old system. Its own document is the one attached to it, if any; no form is generated for it.' }, 409);
        const docType = url.searchParams.get('as') || rec.type;
        const tpl = await templateFor(env, pid, docType);
        if (!tpl) {
          return json({ error: 'No template has been set up for ' +
            (DOC_TYPES[docType] || docType) + ' on this project.' }, 404);
        }
        const project = await getProject(env, pid);
        // Every signature so far goes in the box chosen for its step.
        const sig = signaturesFor(rec, rec.workflow || [], readSignMap(tpl.row), {});
        const filled = await issueFile(tpl.bytes, { ...buildValues(rec, project), ...fieldValues(readFields(tpl.row), rec.data), ...sig.word }, sig.cells);
        if (filled.error) return json({ error: filled.error }, 500);
        // The consultant's form decides the format, not this route: most of the
        // forms issued here are Excel sheets, and a workbook served as a .docx
        // is a file Word refuses to open.
        const fmt = FORMATS[filled.format] || FORMATS.docx;
        return new Response(filled.bytes, {
          headers: {
            'Content-Type': fmt.mime,
            'Content-Disposition': `attachment; filename="${(rec.ref || 'document')}.${fmt.ext}"`,
            'Cache-Control': 'no-store',
          },
        });
      }
      // Moving a record along is the office's act, not the man who raised it:
      // a site engineer must never be able to approve his own inspection.
      if (p === '/api/record/advance' && req.method === 'POST') {
        await ensureRecordsTable(env);
        const b = await req.json().catch(() => ({}));
        // Approving belongs to the folder that owns the record. This both
        // closes the hole and clears a jam: until now only the Principal and
        // the PM could move anything, so QA/QC could not close its own NCR.
        const existing = await getRecord(env, pid, String(b.ref || ''));
        if (!existing) return json({ error: 'record not found' }, 404);
        if (mods && !recordTypeOn(mods, existing.type)) return json({ error: 'That register is not switched on for this project.' }, 403);
        // Each step is its owner's to sign. The Principal and PM may act on any
        // step; everybody else only on the step that is theirs.
        const act = stepPermission(me, existing, can.platform(role, me), String(b.action || 'advance'));
        if (!act.ok) return json({ error: act.error }, 403);
        const whoName = (me && me.name) || role;
        // K7 (S0): a submittal, method statement, material or RFI follows the
        // tracker's rules — sent back to Design rather than dead-ended, not
        // approved while returned or while the consultant's comments are open,
        // issued and answered with the date and the code.
        if (isS0(existing)) {
          await ensureS0(env);
          const next = pendingStep(existing);
          const action = String(b.action || 'advance');
          const projS = await getProject(env, pid);
          if ((action === 'reject' || action === 'return') && next && !next.issue && !next.reply) {
            const r0 = await returnToDesign(env, pid, existing, b.note, whoName);
            if (!r0.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'record.return', detail: existing.ref + ' — ' + String(b.note || '').slice(0, 160) });
            return json(r0, r0.error ? 400 : 200);
          }
          if (action === 'advance' && next && !next.issue && !next.reply) {
            if (existing.returned) return json({ error: existing.ref + ' was returned to Design — it is approved once Design resubmits it.' }, 409);
            const open = (await openComments(env, pid, existing.ref)).length;
            if (open) return json({ error: open + ' of the consultant’s comment' + (open === 1 ? ' is' : 's are') + ' not answered on ' + existing.ref + '. Design answers each one before it is approved.', open_comments: open }, 409);
          }
          const ownerS0 = (st) => can.platform(role, me) || !!(me && (st.by || []).some((f) => userFunctions(me).includes(f)));
          if (action === 'advance' && next && (next.issue || next.reply) && !ownerS0(next)) {
            return json({ error: next.issue ? 'Document Control issues it to the consultant.' : 'Document Control records the consultant’s reply.' }, 403);
          }
          if (action === 'advance' && next && next.issue) {
            // The plain Issue button: issued by hand, recorded with the date.
            const r1 = await issueRecord(env, pid, existing, { outside: true, note: String(b.note || 'issued by hand; recorded on the platform') }, { who: whoName, me, project: projS });
            if (!r1.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'record.issue', detail: existing.ref + ' — outside the platform' });
            return json(r1, r1.error ? 400 : 200);
          }
          if (action === 'advance' && next && next.reply) {
            const r2 = await recordReply(env, pid, existing, { code: b.status || b.code, replied_on: b.replied_on || todayUAE(), comments: b.comments || [] },
              await s0Context(env, pid, me, whoName, existing));
            if (!r2.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'record.reply', detail: existing.ref + ' — ' + r2.status });
            return json(r2, r2.error ? 400 : 200);
          }
        }
        const r = await advanceRecord(env, pid, b, whoName, { project: await getProject(env, pid) });
        if (!r.error && isS0(existing)) r.status = (await afterAdvance(env, pid, existing.ref)) || r.status;
        // STEP 7: a reply letter just issued closes the incoming letters it answers.
        if (!r.error && existing.type === 'letter') {
          const after = await getRecord(env, pid, existing.ref);
          const issueAt = (after.workflow || []).findIndex((x) => x && x.issue);
          if (after && issueAt >= 0 && (after.step || 0) >= issueAt) {
            r.replied_to = await closeIncomingByReply(env, pid, after, whoName);
            // K10 (v5 A2): every letter DC issues is stored — the letter as
            // issued is kept on the record: the consultant's letter form
            // filled and signed, or (no form) a plain PDF of what was issued.
            const atts0 = await listAttachments(env, pid, after.ref).catch(() => []);
            if (!(atts0 || []).some((a) => /as issued\./i.test(a.filename || ''))) {
              const ff = await filledFormFor(env, pid, after).catch(() => null);
              const file = ff ? { name: after.ref + ' as issued.' + String(ff.filename).split('.').pop(), mime: ff.contentType, bytes: ff.bytes }
                : { name: after.ref + ' as issued.pdf', mime: 'application/pdf', bytes: await letterPdf(after, await getProject(env, pid)) };
              const kept = await addAttachment(env, pid, after.ref, file.name, file.mime, file.bytes, whoName);
              if (!kept.error) r.stored = file.name;
            }
          }
        }
        if (!r.error) {
          await audit(env, {
            project_id: pid, user_id: me ? me.id : null, who: whoName,
            action: 'record.' + String(b.action || 'advance'),
            detail: String(b.ref || '') + ' → ' + r.status,
          });
        }
        return json(r, r.error ? 400 : 200);
      }

      /* ---- K13 (A10) · v5 A10: an RFI prepared from a note and a photo.
       * The AI drafts; the engineer raises it (POST /api/records, with the
       * duplicate check), and S0 follows. Everyone on the project sees the log. */
      if (p === '/api/rfi' || p.startsWith('/api/rfi/')) {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        if (mods && !recordTypeOn(mods, 'rfi')) return json({ error: 'RFIs are not switched on for this project.' }, 403);
        await ensureRecordsTable(env);
        const plat = can.platform(role, me);
        const whoName = (me && me.name) || (plat ? 'AETRAA Admin' : role);
        const mayRaise = mayCreateRecord(me, 'rfi', plat);
        const aiOn = aiEnabled(env) && (!mods || mods.includes('ai'));
        const formFields = async () => {
          const tpl = await templateFor(env, pid, 'rfi').catch(() => null);
          const f = tpl ? inputFields(readFields(tpl.row) || []).map((x) => x.label) : [];
          return { has_form: !!tpl, fields: f.length ? f : DEFAULT_RFI_FIELDS };
        };
        if (p === '/api/rfi' && req.method === 'GET') {
          return json({ log: await rfiLog(env, pid), ...(await formFields()), ai_on: aiOn, may: { raise: mayRaise } });
        }
        if (!mayRaise) return json({ error: 'Raising an RFI is ' + whoMayRaise('rfi') + '’s, not yours.' }, 403);
        const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        if (p === '/api/rfi/draft' && req.method === 'POST') {
          let photo = null;
          try { if (b.photo && b.photo.data) photo = { filename: String(b.photo.filename || 'photo.jpg'), bytes: b64ToBytes(String(b.photo.data)) }; }
          catch (e) { return json({ error: 'could not read that upload' }, 400); }
          const drawings = (await listDrawings(env, pid).catch(() => null)) || [];
          const sections = (await liveSections(env, pid).catch(() => [])) || [];
          const r = await draftRfi(env, pid, { note: b.note, photo }, { fields: (await formFields()).fields, drawings, sections, who: whoName, useAi: !mods || mods.includes('ai') });
          if (!r.error && r.model) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'ai.rfi.draft',
            detail: 'drafted by ' + r.model + ' · ' + r.refs.drawings.length + ' drawings, ' + r.refs.specs.length + ' spec sections found' + (r.duplicates.length ? ' · ' + r.duplicates.length + ' possible duplicates' : '') });
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/rfi/duplicates' && req.method === 'POST') {
          return json({ duplicates: await rfiDuplicates(env, pid, { subject: b.subject, question: b.question, drawing: b.drawing }) });
        }
        return json({ error: 'not found' }, 404);
      }

      /* ---- K12 · v5 A7: the material submittal package. Design (and the
       * PM or Principal, who may raise one) prepares it; anyone on the project
       * sees the log. Nothing is submitted until the engineer confirms; then
       * S0 (K7): the PM approves, Document Control issues. */
      if (p === '/api/material' || p.startsWith('/api/material/')) {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        if (mods && !recordTypeOn(mods, 'material')) return json({ error: 'Material approvals are not switched on for this project.' }, 403);
        await ensurePackageTables(env);
        const plat = can.platform(role, me);
        const fm = me ? userFunctions(me) : [];
        const whoName = (me && me.name) || (plat ? 'AETRAA Admin' : role);
        const mayPrep = mayCreateRecord(me, 'material', plat);
        const mayLadder = plat || fm.includes('pm') || fm.includes('principal');
        const aiOn = aiEnabled(env) && (!mods || mods.includes('ai'));
        const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        const tplFields = async () => {
          const tpl = await templateFor(env, pid, 'material').catch(() => null);
          const f = tpl ? inputFields(readFields(tpl.row) || []).map((x) => x.label) : [];
          return { tpl, fields: f.length ? f : DEFAULT_FORM_FIELDS };
        };
        const ctxIn = {
          who: whoName,
          section: async (code) => (await liveSections(env, pid)).find((s) => s.code === code) || null,
          library: async (id) => documentFile(env, pid, id),
          boqLine: async (ref) => env.DB.prepare('SELECT ref, description FROM boq WHERE project_id = ? AND ref = ?').bind(pid, ref).first().catch(() => null),
          scheduleItem: async (id) => { await ensureScheduleTables(env); return env.DB.prepare("SELECT * FROM schedule_item WHERE project_id = ? AND id = ? AND schedule = 'material' AND state <> 'removed'").bind(pid, id).first().catch(() => null); },
        };
        const pkgOf = async (id) => { const x = await getPackage(env, pid, id); if (x) checkSections(x); return x; };
        if (p === '/api/material' && req.method === 'GET') {
          await ensureScheduleTables(env);
          const p3 = ((await env.DB.prepare("SELECT id, sr, description, spec_code, supplier, brand, discipline FROM schedule_item WHERE project_id = ? AND schedule = 'material' AND state <> 'removed' AND record_ref IS NULL ORDER BY sr").bind(pid).all().catch(() => ({ results: [] }))).results) || [];
          const ladder = (await workflowFor(env, pid, 'material').catch(() => null)) || RECORD_TYPES.material.wf;
          return json({ log: await materialLog(env, pid), sections: (await liveSections(env, pid)).map((s) => ({ code: s.code, title: s.title, discipline: s.discipline, manufacturers: s.manufacturers, or_equal: s.or_equal })),
            specs: ((await listLibrary(env, pid, { class: 'specification' })) || []).map((d) => ({ id: d.id, title: d.title, filename: d.filename })),
            boq: ((await env.DB.prepare('SELECT ref, description FROM boq WHERE project_id = ? ORDER BY id LIMIT 3000').bind(pid).all().catch(() => ({ results: [] }))).results) || [],
            p3, ai_on: aiOn, may: { prepare: mayPrep, qaqc: mayLadder }, qaqc_step: ladder.some((s) => /QA\/QC/i.test(s.st)) });
        }
        if (p === '/api/material/log.xlsx' && req.method === 'GET') {
          const proj = await getProject(env, pid);
          const list = await materialLog(env, pid);
          const rows = [['Sr', 'Ref', 'Discipline', 'Description', 'Supplier', 'Brand', 'Submitted', 'Rev', 'Status'].map((h) => ({ v: h, s: 'head' }))]
            .concat(list.map((r) => [r.sr, r.ref || '(not numbered yet)', r.discipline, r.description, r.supplier, r.brand, r.submitted ? { date: r.submitted } : '', r.rev, r.status]));
          const bytes = buildXlsx([{ name: 'Material log', rows, freeze: 1, cols: [6, 16, 16, 44, 26, 22, 12, 6, 36] }], { header: await xlsHeader(env, proj, whoName, 'Material submittal log') });
          return new Response(bytes, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control': 'no-store',
            'Content-Disposition': 'attachment; filename="Material submittal log ' + todayUAE() + '.xlsx"' } });
        }
        if (p === '/api/material/one' && req.method === 'GET') {
          const x = await pkgOf(url.searchParams.get('id'));
          if (!x) return json({ error: 'There is no such package on this project.' }, 404);
          const comments = x.record_ref ? await listComments(env, pid, x.record_ref).catch(() => []) : [];
          const { tpl, fields } = await tplFields();
          return json({ package: { ...x, inputs: { clauses: x.inputs.clauses, catalogue_pages: (x.inputs.catalogue_pages || []).length, unread_catalogue_pages: x.inputs.unread_catalogue_pages || [] } },
            revs: await packageRevs(env, x.id), comments, form_fields: fields, has_form: !!tpl, ai_on: aiOn, may: { prepare: mayPrep } });
        }
        if (p === '/api/material/page' && req.method === 'GET') {
          // Every line opens its source page: one page of the catalogue or the specification.
          const x = await getPackage(env, pid, url.searchParams.get('id'));
          if (!x) return json({ error: 'no such package' }, 404);
          const n = Math.round(Number(url.searchParams.get('page')) || 0);
          const spec = url.searchParams.get('src') === 'spec';
          const f = spec ? await documentFile(env, pid, x.spec.library_id) : await getFile(env, x.catalogue.key).catch(() => null);
          if (!f) return json({ error: 'The document could not be read back.' }, 404);
          let one;
          try { one = await onePdfPage(f.bytes, n - 1); } catch (e) { return json({ error: 'There is no page ' + n + ' in that document.' }, 404); }
          return new Response(one, { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'private, max-age=300',
            'Content-Disposition': 'inline; filename="' + (spec ? 'Spec' : 'Catalogue') + ' page ' + n + '.pdf"' } });
        }
        if (p === '/api/material/pdf' && req.method === 'GET') {
          const x = await pkgOf(url.searchParams.get('id'));
          if (!x) return json({ error: 'no such package' }, 404);
          const bytes = await packagePdf(env, x, await getProject(env, pid), x.record_ref);
          return new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store',
            'Content-Disposition': 'inline; filename="' + ((x.record_ref || 'Material submittal') + ' Rev ' + x.rev).replace(/[^\w .-]+/g, '_') + '.pdf"' } });
        }
        if (p === '/api/material/form' && req.method === 'GET') {
          // The consultant's material form, filled from the package (before a number: none).
          const x = await pkgOf(url.searchParams.get('id'));
          if (!x) return json({ error: 'no such package' }, 404);
          const { tpl } = await tplFields();
          if (!tpl) return json({ error: 'No consultant’s material form has been set up on this project — the plain form is used.' }, 404);
          const data = Object.fromEntries(((x.sections.form || {}).fields || []).map((f) => [f.name, f.value]));
          const recLike = { ref: x.record_ref || '', title: x.title, type: 'material', data, workflow: [], created_by: whoName, created_at: new Date().toISOString() };
          const project = await getProject(env, pid);
          const filled = await issueFile(tpl.bytes, { ...buildValues(recLike, project), ...fieldValues(readFields(tpl.row), data) }, {});
          if (filled.error) return json({ error: filled.error }, 500);
          const fmt = FORMATS[filled.format] || FORMATS.docx;
          return new Response(filled.bytes, { headers: { 'Content-Type': fmt.mime, 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="Material form.' + fmt.ext + '"' } });
        }
        if (p === '/api/material/qaqc' && req.method === 'POST') {
          // v5 A7: no QA/QC step now — the PM can add one on the project.
          if (!mayLadder) return json({ error: 'The PM adds a QA/QC step to the material workflow.' }, 403);
          const cur = (await workflowFor(env, pid, 'material').catch(() => null)) || RECORD_TYPES.material.wf.map((s) => ({ st: s.st, by: s.by.slice(), issue: !!s.issue, reply: !!s.reply }));
          const valid = (await listRoles(env, pid, { all: true })).map((r) => r.id);
          const r = await saveWorkflow(env, pid, 'material', { steps: materialSteps(cur, !!b.on), days: RESPONSE_DEFAULTS.material.days }, me || { name: whoName }, valid);
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'workflow.material', detail: b.on ? 'QA/QC step added' : 'QA/QC step taken out' });
          return json(r, r.error ? 400 : 200);
        }
        if (!mayPrep) return json({ error: 'Material submittals are prepared by Design.' }, 403);
        if (p === '/api/material/start' && req.method === 'POST') {
          let cat = null; const certs = [];
          try {
            if (b.catalogue && b.catalogue.data) cat = { filename: String(b.catalogue.filename || 'catalogue.pdf'), bytes: b64ToBytes(String(b.catalogue.data)) };
            for (const c of Array.isArray(b.certificates) ? b.certificates : []) if (c && c.data) certs.push({ filename: String(c.filename || 'certificate.pdf'), bytes: b64ToBytes(String(c.data)) });
          } catch (e) { return json({ error: 'could not read that upload' }, 400); }
          const r = await createPackage(env, pid, { ...b, catalogue: cat, certificates: certs }, ctxIn);
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'material.start', detail: r.title + ' — ' + (r.spec.code || r.spec.title || 'specification pages') + (r.schedule_item ? ' (from the P3 schedule)' : '') });
          return json(r.error ? r : { ok: true, id: r.id, state: r.state }, r.error ? 400 : 200);
        }
        if (p === '/api/material/revise' && req.method === 'POST') {
          // K7's Code C/D opened the next revision record; its package starts
          // from the one submitted, with the consultant's comments beside it.
          const rec = await getRecord(env, pid, String(b.ref || ''));
          if (!rec || rec.type !== 'material' || !rec.revision_of) return json({ error: 'That is not a revision of a material submittal.' }, 400);
          const prev = (await env.DB.prepare('SELECT id FROM material_package WHERE project_id = ? AND record_ref = ?').bind(pid, rec.revision_of).first());
          if (!prev) return json({ error: rec.revision_of + ' was not prepared as a package here — revise it on the record.' }, 404);
          const done0 = await env.DB.prepare('SELECT id FROM material_package WHERE project_id = ? AND record_ref = ?').bind(pid, rec.ref).first();
          if (done0) return json({ ok: true, id: done0.id, already: true });
          const old = await getPackage(env, pid, prev.id);
          const id = 'mp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
          await env.DB.prepare(`INSERT INTO material_package (id, project_id, title, discipline, supplier, brand, spec, boq, approved, schedule_item, catalogue, certificates,
              inputs, sections, rev, state, record_ref, revision_of, model, created_by, created_at, updated_by, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .bind(id, pid, old.title, old.discipline, old.supplier, old.brand, JSON.stringify(old.spec), old.boq ? JSON.stringify(old.boq) : null, JSON.stringify(old.approved), old.schedule_item,
              JSON.stringify(old.catalogue), JSON.stringify(old.certificates), JSON.stringify(old.inputs), JSON.stringify(old.sections), old.rev, 'ready', rec.ref, old.id, old.model,
              whoName, new Date().toISOString(), whoName, new Date().toISOString()).run();
          return json({ ok: true, id });
        }
        const x = await pkgOf(b.id);
        if (!x) return json({ error: 'There is no such package on this project.' }, 404);
        if (p === '/api/material/draft' && req.method === 'POST') {
          if (mods && !mods.includes('ai')) return json({ error: 'The AI assistance module is not switched on for this project.', module: 'ai' }, 403);
          const r = await draftSections(env, pid, x, Array.isArray(b.sections) ? b.sections : null, { who: whoName, formFields: (await tplFields()).fields });
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'material.draft', detail: x.title + ' — ' + r.done.join(', ') + ' drafted by ' + (x.model || 'AI') });
          return json(r.error ? r : { ok: true, done: r.done, state: r.package.state }, r.error ? 400 : 200);
        }
        if (p === '/api/material/edit' && req.method === 'POST') {
          const r = await editPackage(env, pid, x, b, whoName);
          return json(r.error ? r : { ok: true, state: x.state }, r.error ? 400 : 200);
        }
        if (p === '/api/material/cert' && req.method === 'POST') {
          let bytes; try { bytes = b64ToBytes(String(b.data || '')); } catch (e) { return json({ error: 'could not read that upload' }, 400); }
          const r = await addCertificate(env, pid, x, { filename: String(b.filename || ''), bytes }, whoName);
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/material/complete' && req.method === 'POST') {
          const r = await completePackage(env, pid, x, whoName);
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'material.complete', detail: x.title + ' — Rev ' + r.rev + ' formed, Rev ' + (r.rev - 1) + ' kept' });
          return json(r.error ? r : { ok: true, rev: r.rev }, r.error ? 400 : 200);
        }
        if (p === '/api/material/submit' && req.method === 'POST') {
          // Generate → Check → Confirm & submit: numbered, the package filed on
          // the MAR, and S0 from here — the PM approves, DC issues.
          if (x.state !== 'complete') return json({ error: x.state === 'submitted' ? 'This package is already submitted as ' + x.record_ref + '.' : 'Complete the package first (it forms the next revision and keeps the last).' }, 400);
          const project = await getProject(env, pid);
          const pdf = await packagePdf(env, x, project, x.record_ref || '');
          let ref = x.record_ref;
          const brand = (x.sections.brand || {});
          if (!ref) {
            await ensureRecordsTable(env);
            await settleMaterialLadder(env, pid);
            const ladder = await workflowFor(env, pid, 'material').catch(() => null);
            const roleLabels = await labelsFor(env, pid).catch(() => null);
            const formData = Object.fromEntries(((x.sections.form || {}).fields || []).map((f) => [f.name, f.value]));
            const made = await createRecord(env, pid, { type: 'material', title: x.title, data: { ...formData, Material: x.title, Discipline: x.discipline, Supplier: x.supplier, Brand: x.brand,
              'Brand status': brand.label || '', 'Spec section': [x.spec.code, x.spec.title].filter(Boolean).join(' '), 'BOQ line': (x.boq && x.boq.ref) || '', Rev: String(x.rev), Package: x.id } },
              whoName, { project, workflow: ladder, labels: roleLabels });
            if (made.error) return json(made, 400);
            ref = made.ref;
            await ensureS0(env);
            if (me) await env.DB.prepare('UPDATE records SET originator_id = ? WHERE project_id = ? AND ref = ?').bind(me.id, pid, ref).run();
            await afterAdvance(env, pid, ref);
            if (x.schedule_item) await env.DB.prepare("UPDATE schedule_item SET record_ref = ?, updated_by = ?, updated_at = ? WHERE project_id = ? AND id = ? AND record_ref IS NULL").bind(ref, whoName, new Date().toISOString(), pid, x.schedule_item).run();
          } else {
            // A revision's package: the record K7 opened carries the new revision number.
            const r0 = await getRecord(env, pid, ref);
            if (r0) await env.DB.prepare('UPDATE records SET data = ? WHERE project_id = ? AND ref = ?').bind(JSON.stringify({ ...(r0.data || {}), Rev: String(x.rev) }), pid, ref).run();
          }
          const att = await addAttachment(env, pid, ref, ref + ' material package Rev ' + x.rev + '.pdf', 'application/pdf', pdf, whoName);
          if (att.error) return json({ error: ref + ' was raised, but the package could not be filed on it: ' + att.error, ref }, 400);
          x.record_ref = ref; x.state = 'submitted';
          await env.DB.prepare("UPDATE material_package SET record_ref = ?, state = 'submitted', updated_by = ?, updated_at = ? WHERE project_id = ? AND id = ?").bind(ref, whoName, new Date().toISOString(), pid, x.id).run();
          await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'material.submit', detail: ref + ' — ' + x.title + ', package Rev ' + x.rev + ' (' + (x.sections.compliance || []).length + ' compliance lines)' });
          return json({ ok: true, ref, rev: x.rev, package_pdf: att.filename });
        }
        return json({ error: 'not found' }, 404);
      }

      /* ---- K10 · v5 A2: the correspondence register. Everyone on the
       * project sees it; Document Control (and whoever the access matrix lets
       * log an incoming letter) drops and logs; DC logs an outgoing letter
       * signed outside the platform. The reader never logs, routes, replies
       * or closes — logging goes through POST /api/records as before. */
      if (p === '/api/letters' || p.startsWith('/api/letters/')) {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        if (mods && !recordTypeOn(mods, 'incoming')) return json({ error: 'The correspondence register is not switched on for this project.' }, 403);
        await ensureRecordsTable(env);
        await ensureLetterReads(env);
        const plat = can.platform(role, me);
        const whoName = (me && me.name) || (plat ? 'AETRAA Admin' : role);
        const mayLog = mayCreateRecord(me, 'incoming', plat);
        const isDc = plat || !!(me && userFunctions(me).includes('dc'));
        const aiOn = aiEnabled(env) && (!mods || mods.includes('ai'));
        const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        if (p === '/api/letters' && req.method === 'GET') {
          const list = await correspondenceRegister(env, pid);
          return json({ letters: list, overdue: list.filter((x) => x.overdue).length,
            may: { log: mayLog, outgoing: isDc, ai: aiOn }, action_by: actionLabels(), types: LETTER_TYPES,
            open_incoming: list.filter((x) => x.dir === 'In' && x.open).map((x) => ({ ref: x.ref, subject: x.subject, their_ref: x.their_ref })) });
        }
        if (p === '/api/letters/register.xlsx' && req.method === 'GET') {
          const proj = await getProject(env, pid);
          const bytes = correspondenceWorkbook(await correspondenceRegister(env, pid), proj, { header: await xlsHeader(env, proj, whoName, 'Correspondence register') });
          return new Response(bytes, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control': 'no-store',
            'Content-Disposition': 'attachment; filename="' + (((proj && proj.name) || 'Project') + ' - Correspondence register - ' + todayUAE() + '.xlsx').replace(/[^A-Za-z0-9 ._-]+/g, '-') + '"' } });
        }
        if (p === '/api/letters/read' && req.method === 'POST') {
          // Step 1: the letter dropped and read — nothing logged yet.
          if (!mayLog) return json({ error: 'Document Control logs incoming letters.' }, 403);
          let bytes;
          try { bytes = b64ToBytes(String(b.data || '')); } catch (e) { return json({ error: 'could not read that upload' }, 400); }
          const r = await readLetter(env, pid, { filename: String(b.filename || 'letter.pdf'), bytes }, { who: whoName, useAi: !mods || mods.includes('ai') });
          if (!r.error && !r.kept) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'letter.read',
            detail: r.filename + ' — ' + (r.model ? 'read by rule and by ' + r.model : 'read by rule only') + ' · ' + r.refs.linked.length + ' linked, ' + r.refs.unmatched.length + ' not on this project' });
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/letters/read' && req.method === 'GET') {
          const r = await getLetterRead(env, pid, url.searchParams.get('id'));
          return r ? json(r) : json({ error: 'no such reading' }, 404);
        }
        if (p === '/api/letters/outgoing' && req.method === 'POST') {
          // A letter signed and sent outside the platform, logged by DC with
          // its signed copy; it closes the incoming letters it answers.
          if (!isDc) return json({ error: 'Document Control logs the letters it issues.' }, 403);
          let bytes = null;
          try { bytes = b.data ? b64ToBytes(String(b.data)) : null; } catch (e) { return json({ error: 'could not read that upload' }, 400); }
          const ck = checkOutgoing({ ...b, file: bytes ? { bytes } : null });
          if (ck.error) return json(ck, 400);
          const proj = await getProject(env, pid);
          const ladder = await workflowFor(env, pid, 'letter').catch(() => null);
          const roleLabels = await labelsFor(env, pid).catch(() => null);
          const data = { Subject: ck.subject, To: ck.to, Type: ck.type, 'Issued on': ck.issued, 'In reply to': String(b.in_reply_to || ''),
            ...(ck.our_ref ? { 'Our reference': ck.our_ref } : {}), ...(ck.signed_by ? { 'Signed by': ck.signed_by } : {}),
            'Logged': 'signed and sent outside the platform; logged by Document Control' };
          const made = await createRecord(env, pid, { type: 'letter', title: ck.subject, data }, whoName, { project: proj, workflow: ladder, labels: roleLabels });
          if (made.error) return json(made, 400);
          // Issued already: every step signed, the issue on the day it went.
          const rec = await getRecord(env, pid, made.ref);
          const wf = (rec.workflow || []).map((s, i, all) => ({ ...s, state: 'done',
            who: i === all.length - 1 ? whoName : i === 0 ? 'outside the platform' : (ck.signed_by || 'signed outside the platform'),
            when: i === all.length - 1 ? ck.issued + 'T00:00:00.000Z' : (s.when || '') }));
          await env.DB.prepare('UPDATE records SET step = ?, workflow = ?, status = ?, cls = ?, due = NULL, due_basis = NULL, updated_at = ? WHERE project_id = ? AND ref = ?')
            .bind(wf.length - 1, JSON.stringify(wf), 'Issued ' + ck.issued + ' — logged by Document Control', 'ok', new Date().toISOString(), pid, made.ref).run();
          const att = await addAttachment(env, pid, made.ref, String(b.filename || made.ref + ' signed.pdf'), 'application/octet-stream', bytes, whoName);
          if (att.error) return json({ error: made.ref + ' was logged, but the signed copy could not be kept: ' + att.error, ref: made.ref }, 400);
          const after = await getRecord(env, pid, made.ref);
          const closed = await closeIncomingByReply(env, pid, after, whoName, ck.issued);
          await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'letter.outgoing',
            detail: made.ref + ' to ' + ck.to + ', issued ' + ck.issued + (closed.length ? ' — answers ' + closed.join(', ') : '') });
          return json({ ok: true, ref: made.ref, replied_to: closed, stored: att.filename });
        }
        return json({ error: 'not found' }, 404);
      }

      /* ---- K11 · v5 A5 (part of the daily diary): delivery notes and
       * certificates uploaded with the day's diary by site or Document Control
       * (and HSE, QA/QC, the PM). Read by rule and by AI; nothing is received
       * or filed until the person confirms. Under /api/diary, so the Site
       * module covers it; a certificate is filed only where the certificates
       * register (HSE module) is on. */
      if (p.startsWith('/api/diary/docs')) {
        const plat = can.platform(role, me);
        const fd = me ? userFunctions(me) : [];
        const mayDocs = plat || (!me && ['owner', 'manager', 'site'].includes(role)) || fd.some((f) => ['site', 'dc', 'hse', 'qaqc', 'pm', 'principal'].includes(f));
        if (!mayDocs) return json({ error: 'Delivery notes and certificates are uploaded by site, Document Control or HSE.' }, 403);
        await ensureDiaryDocs(env);
        const whoName = (me && me.name) || (plat ? 'AETRAA Admin' : role);
        const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        if (p === '/api/diary/docs' && req.method === 'GET') {
          const day = String(url.searchParams.get('day') || '').slice(0, 10);
          return json({ docs: await listDiaryDocs(env, pid, day), ai: aiEnabled(env) && (!mods || mods.includes('ai')), types: CERT_TYPES,
            certs_on: !mods || recordTypeOn(mods, 'cert'), expiring: await certExpiries(env, pid) });
        }
        if (p === '/api/diary/docs/file' && req.method === 'GET') {
          const doc = await getDiaryDoc(env, pid, url.searchParams.get('id'));
          const f = doc && doc.file_key ? await getFile(env, doc.file_key).catch(() => null) : null;
          if (!f) return json({ error: 'no such file' }, 404);
          const mime = /\.pdf$/i.test(doc.filename) ? 'application/pdf' : /\.png$/i.test(doc.filename) ? 'image/png' : /\.jpe?g$/i.test(doc.filename) ? 'image/jpeg' : 'application/octet-stream';
          return new Response(f.bytes, { headers: { 'Content-Type': mime, 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline; filename="' + doc.filename.replace(/[^\w.\- ]+/g, '_') + '"' } });
        }
        if (p === '/api/diary/docs/read' && req.method === 'POST') {
          let bytes;
          try { bytes = b64ToBytes(String(b.data || '')); } catch (e) { return json({ error: 'could not read that upload' }, 400); }
          const r = await readDiaryDoc(env, pid, { day: String(b.day || ''), kind: String(b.kind || ''), filename: String(b.filename || 'document.pdf'), bytes },
            { who: whoName, useAi: !mods || mods.includes('ai') });
          if (!r.error && !r.kept) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'diary.doc.read',
            detail: r.day + ' · ' + r.kind + ' · ' + r.filename + (r.model ? ' — read by rule and by ' + r.model : ' — read by rule only') });
          return json(r, r.error ? 400 : 200);
        }
        if ((p === '/api/diary/docs/confirm' || p === '/api/diary/docs/discard') && req.method === 'POST') {
          const doc = await getDiaryDoc(env, pid, b.id);
          if (!doc) return json({ error: 'There is no such document on this project.' }, 404);
          if (doc.state !== 'read') return json({ error: 'That ' + (doc.kind === 'delivery' ? 'delivery note' : 'certificate') + ' was already ' + doc.state + (doc.confirmed_by ? ' by ' + doc.confirmed_by : '') + '.' }, 409);
          if (p === '/api/diary/docs/discard') { await decideDoc(env, pid, doc.id, 'discarded', null, null, whoName); return json({ ok: true, discarded: true }); }
          if (doc.kind === 'delivery') {
            const st = settleDelivery(doc, b);
            if (st.error) return json(st, 400);
            const project = await getProject(env, pid);
            const r = await applyDelivery(doc, st.rows, { who: whoName, reason: b.reason,
              loadDiary: (day) => loadDiary(env, pid, day, project),
              saveDiary: (body) => saveDiary(env, pid, { ...body, changed_by: whoName }, whoName) });
            if (r.error) return json(r, 400);
            await decideDoc(env, pid, doc.id, 'confirmed', { lines: st.rows.length, how: st.how, model: doc.model, revised: r.revised }, null, whoName);
            await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'diary.delivery',
              detail: doc.day + ' — ' + st.rows.length + ' line' + (st.rows.length === 1 ? '' : 's') + ' from ' + doc.filename + (r.revised ? ' (submitted diary revised: ' + String(b.reason || '').slice(0, 100) + ')' : '') });
            return json({ ok: true, lines: st.rows.length, revised: r.revised });
          }
          // A certificate: into the certificates register (HSE's), where it is on.
          if (mods && !recordTypeOn(mods, 'cert')) return json({ error: 'The certificates register is not switched on for this project (it is part of HSE).' }, 403);
          const st = settleCert(doc, b);
          if (st.error) return json(st, 400);
          await ensureRecordsTable(env);
          const proj = await getProject(env, pid);
          const ladder = await workflowFor(env, pid, 'cert').catch(() => null);
          const roleLabels = await labelsFor(env, pid).catch(() => null);
          const made = await createRecord(env, pid, { type: 'cert', title: st.title, data: { ...st.data,
            Read: Object.values(st.how).includes('ai') ? 'by AI (' + (doc.model || '') + '), confirmed by ' + whoName : 'typed by ' + whoName } }, whoName, { project: proj, workflow: ladder, labels: roleLabels });
          if (made.error) return json(made, 400);
          if (doc.file_key) {
            const f = await getFile(env, doc.file_key).catch(() => null);
            if (f) await addAttachment(env, pid, made.ref, doc.filename, 'application/octet-stream', f.bytes, whoName).catch(() => null);
          }
          await decideDoc(env, pid, doc.id, 'confirmed', { how: st.how, flag: st.flag, model: doc.model }, made.ref, whoName);
          await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'diary.certificate',
            detail: made.ref + ' ' + st.title + (st.flag ? ' — ' + st.flag : '') + ' (from the diary of ' + doc.day + ')' });
          return json({ ok: true, ref: made.ref, flag: st.flag || null, due: (made.record || {}).due || null });
        }
        return json({ error: 'not found' }, 404);
      }

      /* ---- K8 · v5 E15: subcontractors' timesheets into the diary's
       * manpower (and from it the manpower log and the HSE man-hours). Site
       * and HSE drop and apply; the PM submits the diary as before. Under
       * /api/diary, so the Site module's switch covers it. */
      if (p.startsWith('/api/diary/timesheets') || p === '/api/diary/manpower.xlsx') {
        const tf = me ? userFunctions(me) : [];
        const mayTs = can.platform(role, me) || ['owner', 'manager', 'site'].includes(role) && !me
          || tf.some((f) => ['site', 'hse', 'pm', 'principal'].includes(f));
        if (!mayTs) return json({ error: 'Timesheets are read by Site and HSE.' }, 403);
        const whoName = (me && me.name) || (can.platform(role, me) ? 'AETRAA Admin' : role);
        const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        if (b.project_id && String(b.project_id) !== pid) return json({ error: 'That project is not yours to open.' }, 403);
        await ensureTimesheetTables(env);
        if (p === '/api/diary/timesheets' && req.method === 'GET') return json({ reads: await listReads(env, pid, url.searchParams.get('day') || '') });
        if (p === '/api/diary/timesheets/one' && req.method === 'GET') {
          const r = await getRead(env, pid, url.searchParams.get('id'));
          return r ? json(r) : json({ error: 'no such timesheet on this project' }, 404);
        }
        if (p === '/api/diary/timesheets/read' && req.method === 'POST') {
          let bytes;
          try { bytes = b64ToBytes(String(b.data || '')); } catch (e) { return json({ error: 'could not read that upload' }, 400); }
          const r = await readAndKeep(env, pid, { filename: String(b.filename || 'timesheet.xlsx'), bytes, subcontractor: b.subcontractor, day: b.day, date_order: b.date_order }, whoName);
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'timesheet.read',
            detail: r.filename + ' · ' + r.groups.map((g) => (g.subcontractor || '?') + ' ' + (g.day || '?') + ': ' + g.men + ' men, ' + g.man_hours + ' h').join('; ') });
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/diary/timesheets/apply' && req.method === 'POST') {
          const project = await getProject(env, pid);
          const r = await applyRead(env, pid, String(b.id || ''), b, {
            who: whoName,
            loadDiary: (day) => loadDiary(env, pid, day, project),
            saveDiary: (body) => saveDiary(env, pid, { ...body, changed_by: whoName }, whoName),
          });
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'timesheet.apply',
            detail: r.applied.map((a) => a.subcontractor + ' ' + a.day + ': ' + a.men + ' men, ' + a.man_hours + ' h' + (a.revised ? ' (submitted diary revised: ' + String(b.reason || '').slice(0, 100) + ')' : '')).join('; ') });
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/diary/manpower.xlsx' && req.method === 'GET') {
          // "Manpower by trade and day" (v5 E15's live log), with the X1 header.
          const from = String(url.searchParams.get('from') || '').slice(0, 10), to = String(url.searchParams.get('to') || '').slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return json({ error: 'give the days: from and to' }, 400);
          const { results } = await env.DB.prepare('SELECT report_date, staff, subs FROM diary WHERE project_id = ? AND report_date BETWEEN ? AND ? ORDER BY report_date').bind(pid, from, to).all();
          const pj = (v) => { try { return JSON.parse(v || '[]') || []; } catch (e) { return []; } };
          const rows = [['Day', 'Whose', 'Trade', 'Men', 'Hours each', 'Man-hours'].map((h) => ({ v: h, s: 'head' }))];
          for (const d of results || []) {
            for (const s of pj(d.staff)) if (Number(s.n) > 0) rows.push([d.report_date, 'Own staff', s.t, Number(s.n), s.h ? Number(s.h) : '', s.h ? Math.round(Number(s.n) * Number(s.h) * 100) / 100 : '']);
            for (const s of pj(d.subs)) if (s.c !== undefined && Number(s.c) > 0) rows.push([d.report_date, s.n, s.t || s.p || '', Number(s.c), s.h ? Number(s.h) : '', s.h ? Math.round(Number(s.c) * Number(s.h) * 100) / 100 : '']);
          }
          const proj0 = await getProject(env, pid);
          const bytes = buildXlsx([{ name: 'Manpower', rows, freeze: 1, cols: [12, 30, 26, 8, 10, 12] }], { header: await xlsHeader(env, proj0, whoName, 'Manpower by trade and day') });
          return new Response(bytes, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control': 'no-store',
            'Content-Disposition': 'attachment; filename="Manpower ' + from + ' to ' + to + '.xlsx"' } });
        }
        return json({ error: 'not found' }, 404);
      }
      /* ---- K13 · v5 A12: who prepares the diary (Document Control, or the
       * person the PM assigns), and the AI's draft from typed notes or a
       * scanned site sheet — into the day's diary on screen, never saved or
       * submitted by the AI. Under /api/diary, so the Site module covers it. */
      if (p === '/api/diary/assignee' && req.method === 'POST') {
        const fa = me ? userFunctions(me) : [];
        if (!(can.platform(role, me) || (!me && role === 'owner') || fa.includes('pm') || fa.includes('principal'))) {
          return json({ error: 'The Project Manager assigns who prepares the site diary.' }, 403);
        }
        const b = await req.json().catch(() => ({}));
        if (b.project_id && String(b.project_id) !== pid) return json({ error: 'That project is not yours to open.' }, 403);
        await ensureDiaryA12(env);
        const proj = await getProject(env, pid);
        const target = str(b.user_id, 60);
        let named = null;
        if (target) {
          const u = await getUser(env, target);
          if (!u || u.org_id !== proj.org_id || !userInProject(u, pid) || u.status === 'suspended') return json({ error: 'That person is not on this project.' }, 400);
          if (!can.diaryEdit(u.role)) return json({ error: u.name + ' cannot write the site diary on this project.' }, 400);
          named = u;
        }
        await env.DB.prepare('UPDATE projects SET diary_assignee = ? WHERE id = ?').bind(named ? named.id : null, pid).run();
        const whoA = (me && me.name) || (can.platform(role, me) ? 'AETRAA Admin' : role);
        await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoA, action: 'diary.assignee',
          detail: named ? named.name + ' prepares the site diary' : 'Document Control prepares the site diary (nobody assigned)' });
        return json({ ok: true, assignee: named ? { id: named.id, name: named.name } : null });
      }
      if (p === '/api/diary/ai-draft' && req.method === 'POST') {
        if (!can.diaryEdit(role)) return json({ error: 'auth' }, 401);
        await ensureDiaryA12(env);
        const proj = await getProject(env, pid);
        if (me && !onStream(me, 'progress') && proj.diary_assignee !== me.id) {
          return json({ error: 'The progress diary is not one of your workflows on this project. The Principal or the Project Manager can add you to it.' }, 403);
        }
        // v5 A12, Ajay 6 Oct 2026 (decision 11): prepared by Document Control
        // or the person the PM assigns — nobody else.
        if (!mayWriteDiary(me, role, proj)) {
          return json({ error: 'The site diary is prepared by Document Control or the person the Project Manager assigns.' }, 403);
        }
        if (mods && !mods.includes('ai')) return json({ error: 'The AI assistance module is not switched on for this project.', module: 'ai' }, 403);
        const b = await req.json().catch(() => ({}));
        if (b.project_id && String(b.project_id) !== pid) return json({ error: 'That project is not yours to open.' }, 403);
        const day = date(b.date) || todayUAE();
        let file = null;
        try { if (b.file && b.file.data) file = { filename: String(b.file.filename || 'site sheet.pdf'), bytes: b64ToBytes(String(b.file.data)) }; }
        catch (e) { return json({ error: 'could not read that upload' }, 400); }
        const d = await loadDiary(env, pid, day, proj);
        if (d.missing) return json({ error: 'The diary is not set up yet.' }, 400);
        const whoD = (me && me.name) || (can.platform(role, me) ? 'AETRAA Admin' : role);
        const r = await draftDiary(env, pid, { notes: b.notes, file }, { who: whoD, roster: d.roster });
        if (r.error) return json(r, 400);
        await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoD, action: 'ai.diary.draft',
          detail: day + ' — prepared from ' + r.from + ' by ' + r.model + '; not saved' + (r.draft.notes.length ? ' (' + r.draft.notes.length + ' to check)' : '') });
        return json({ ok: true, date: day, model: r.model, from: r.from, notes: r.draft.notes, draft: r.draft, diary: applyDraft(d, r.draft, d.roster) });
      }
      /* ---- Tender ↔ IFC deviations (P1 step 3; Ajay, 6 Oct 2026, decision 20).
       * Sheets paired and compared by rule; the AI describes; Design, the PM,
       * the QS or the Principal decides each deviation. */
      if (p === '/api/deviations' || p.startsWith('/api/deviations/')) {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const plat = can.platform(role, me);
        const fd = me ? userFunctions(me) : [];
        const mayRun = plat || ['design', 'pm', 'commercial', 'principal'].some((x) => fd.includes(x));
        const whoD = (me && me.name) || (plat ? 'AETRAA Admin' : role);
        const drawingsAll = async () => ((await listDrawings(env, pid, {}).catch(() => null)) || []);
        if (p === '/api/deviations' && req.method === 'GET') {
          return json({ ...(await deviationsView(env, pid, await drawingsAll())), may: { run: mayRun, decide: mayRun }, ai_on: aiEnabled(env) && (!mods || mods.includes('ai')) });
        }
        if (p === '/api/deviations/overlay' && req.method === 'GET') {
          await ensureTifcTables(env);
          const row = await env.DB.prepare('SELECT overlay_key FROM tifc_pair WHERE project_id = ? AND id = ?').bind(pid, str(url.searchParams.get('id'), 60)).first();
          const f = row && row.overlay_key ? await getFile(env, row.overlay_key).catch(() => null) : null;
          if (!f) return json({ error: 'no overlay for that sheet' }, 404);
          return new Response(f.bytes, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=600' } });
        }
        if (p === '/api/deviations/xlsx' && req.method === 'GET') {
          const v = await deviationsView(env, pid, await drawingsAll());
          const proj = await getProject(env, pid);
          const c = (val, st) => ({ v: val, s: st });
          const label = { proposed: 'to decide', variation: 'possible variation', no_impact: 'no cost impact', not_a_change: 'not a change' };
          const rows = [[c('Tender ↔ IFC deviations', 'title')], [], ['Sheet', 'Deviation', 'Kind', 'Where', 'Found by', 'Decision', 'Note', 'Decided by'].map((h) => c(h, 'head'))]
            .concat(v.deviations.map((x) => [c(x.number, 'text'), c(x.what, 'text'), c(x.kind, 'text'), c(x.place || '', 'text'), c(x.source === 'ai' ? 'AI' : 'rule', 'text'),
              c(label[x.decision] || x.decision, 'text'), c(x.note || '', 'text'), c(x.decided_by || '', 'text')]))
            .concat([[], [c('IFC sheets with no tender sheet: ' + (v.ifc_only.map((d) => d.number).join(', ') || 'none'), 'text')], [c('Tender sheets with no IFC sheet: ' + (v.tender_only.map((d) => d.number).join(', ') || 'none'), 'text')]]);
          const bytes = buildXlsx([{ name: 'Deviations', rows, freeze: 4, landscape: true, cols: [16, 60, 14, 18, 10, 16, 40, 16] }], { header: await xlsHeader(env, proj, whoD, 'Tender ↔ IFC deviations') });
          return new Response(bytes, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control': 'no-store',
            'Content-Disposition': 'attachment; filename="' + (((proj && proj.name) || 'Project') + ' - Tender IFC deviations.xlsx').replace(/[^A-Za-z0-9 ._-]+/g, '-') + '"' } });
        }
        if (!mayRun) return json({ error: 'The deviations are run and decided by Design, the PM, the QS or the Principal.' }, 403);
        const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        if (p === '/api/deviations/run' && req.method === 'POST') {
          const r = await runComparison(env, pid, await drawingsAll(), { who: whoD, limit: b.limit, useAi: !mods || mods.includes('ai') });
          if (r.compared.length) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoD, action: 'tifc.compare', detail: r.compared.map((x) => x.number + ' ' + x.state + (x.deviations ? ' (' + x.deviations + ')' : '')).join(', ') });
          return json(r);
        }
        if (p === '/api/deviations/decide' && req.method === 'POST') {
          const r = await decideDeviation(env, pid, b, whoD);
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoD, action: 'tifc.decide', detail: String(b.id || '') + ' — ' + r.decision });
          return json(r, r.error ? (r.status || 400) : 200);
        }
        return json({ error: 'not found' }, 404);
      }
      /* ---- A4 (v5; Ajay, 6 Oct 2026, decision 1): the contract obligations.
       * QS (or AETRAA) finds them — the AI reads the indexed clauses — and
       * confirms each line; the Principal approves; approved ones are live. */
      if (p === '/api/obligations' || p.startsWith('/api/obligations/')) {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const plat = can.platform(role, me);
        const fo = me ? userFunctions(me) : [];
        const mayFind = plat || fo.includes('commercial');
        const mayApprove = plat || fo.includes('principal');
        const whoO = (me && me.name) || (plat ? 'AETRAA Admin' : role);
        if (p === '/api/obligations' && req.method === 'GET') {
          return json({ obligations: await listObligations(env, pid), kinds: OBL_KINDS, binds: OBL_BINDS, may: { find: mayFind, confirm: mayFind, approve: mayApprove },
            ai_on: aiEnabled(env) && (!mods || mods.includes('ai')) });
        }
        const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        if (p === '/api/obligations/find' && req.method === 'POST') {
          if (!mayFind) return json({ error: 'The contract obligations are found by the QS (Contracts & Commercial) or AETRAA.' }, 403);
          if (mods && !mods.includes('ai')) return json({ error: 'The AI assistance module is not switched on for this project.', module: 'ai' }, 403);
          const r = await findObligations(env, pid, { who: whoO, clauses: b.clauses });
          if (!r.error && r.read) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoO, action: 'ai.obligations.find', detail: r.read + ' clauses read by ' + r.model + ', ' + r.added + ' obligations proposed' + (r.dropped ? ', ' + r.dropped + ' dropped (not the clause’s words)' : '') });
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/obligations/confirm' && req.method === 'POST') {
          if (!mayFind) return json({ error: 'The QS confirms each obligation.' }, 403);
          const r = await confirmObligation(env, pid, b, whoO);
          return json(r, r.error ? (r.status || 400) : 200);
        }
        if (p === '/api/obligations/approve' && req.method === 'POST') {
          if (!mayApprove) return json({ error: 'The Principal approves the contract obligations.' }, 403);
          const r = await approveObligations(env, pid, whoO);
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoO, action: 'obligations.approve', detail: r.approved + ' obligations approved' });
          return json(r, r.error ? (r.status || 400) : 200);
        }
        return json({ error: 'not found' }, 404);
      }
      /* ---- Decision 2 (v5 A12): the day's photos — a caption, the activity
       * and the location proposed by AI, confirmed by the person who writes
       * the diary. Nothing reaches the photo until then. */
      if (p === '/api/diary/photos' && req.method === 'GET') {
        if (!can.diary(role)) return json({ error: 'auth' }, 401);
        const day = date(url.searchParams.get('date')) || todayUAE();
        const projP = await getProject(env, pid);
        return json({ date: day, ...(await dayPhotos(env, pid, day)), may: { confirm: mayWriteDiary(me, role, projP) },
          ai_on: aiEnabled(env) && (!mods || mods.includes('ai')) });
      }
      if ((p === '/api/diary/photos/suggest' || p === '/api/diary/photos/confirm') && req.method === 'POST') {
        await ensureDiaryA12(env);
        if (!mayWriteDiary(me, role, await getProject(env, pid))) return json({ error: 'The diary’s photos are captioned by Document Control or the person the Project Manager assigns.' }, 403);
        const b = await req.json().catch(() => ({}));
        const whoP = (me && me.name) || (can.platform(role, me) ? 'AETRAA Admin' : role);
        if (p === '/api/diary/photos/suggest') {
          if (mods && !mods.includes('ai')) return json({ error: 'The AI assistance module is not switched on for this project.', module: 'ai' }, 403);
          const day = date(b.date) || todayUAE();
          const r = await suggestPhotos(env, pid, day, { who: whoP, limit: b.limit });
          if (!r.error && r.read) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoP, action: 'ai.diary.photos', detail: day + ' — ' + r.read + ' photos captioned by AI, not confirmed' });
          return json(r, r.error ? 400 : 200);
        }
        const r = await confirmPhoto(env, pid, b, whoP);
        return json(r, r.error ? (r.status || 400) : 200);
      }
      if (p === '/api/diary' && req.method === 'GET') {
        if (!can.diary(role)) return json({ error: 'auth' }, 401);
        const project = await getProject(env, pid);
        const day = date(url.searchParams.get('date')) || todayUAE();
        const d = await loadDiary(env, pid, day, project);
        if (d.missing) return json(d);
        // Step 3: what would stop it being submitted, and what to look at.
        const ctx = await diaryContext(env, pid, day);
        // K13 (A12): who prepares it, whether this person may change that,
        // and whether the AI can prepare it.
        await ensureDiaryA12(env);
        const proj12 = await getProject(env, pid);
        const fa = me ? userFunctions(me) : [];
        const mayAssign = can.platform(role, me) || (!me && role === 'owner') || fa.includes('pm') || fa.includes('principal');
        const team12 = (await projectTeam(env, proj12.org_id, pid).catch(() => [])) || [];
        const prep = preparersOf(proj12, team12);
        let pickable = [];
        if (mayAssign) {
          const all = (await listUsers(env, proj12.org_id).catch(() => [])) || [];
          pickable = all.filter((u) => u.status !== 'suspended' && userInProject(u, pid) && can.diaryEdit(u.role)).map((u) => ({ id: u.id, name: u.name }));
        }
        return json({ ...d, checks: diaryChecks(d, ctx), context: { prev_date: ctx.prev_date, prev_men: ctx.prev_men,
          photos: ctx.photos, progress: ctx.progress.length },
          a12: { assigned: prep.assigned, preparers: prep.people.map((u) => ({ id: u.id, name: u.name })), may_assign: mayAssign, team: pickable,
            may_save: mayWriteDiary(me, role, proj12), may_submit: can.export(role) && (mayWriteDiary(me, role, proj12) || fa.includes('pm') || fa.includes('principal')),
            // v5 A12 step 3: DC sends the diary where the contract requires it.
            send: await (async () => { const ob = await diaryObligation(env, pid); return { to: await diaryRecipients(env, pid),
              basis: ob ? { clause: ob.clause_key, page: ob.page, quote: String(ob.quote).slice(0, 240) } : null, log: await diarySentLog(env, pid, day),
              may_set: can.platform(role, me) || ['dc', 'pm', 'principal'].some((x) => fa.includes(x)), may_send: can.platform(role, me) || fa.includes('dc') }; })(),
            ai_on: aiEnabled(env) && (!mods || mods.includes('ai')) } });
      }
      // v5 A12 step 3: who the diary goes to, and DC's sending of a submitted day.
      if ((p === '/api/diary/send-to' || p === '/api/diary/send') && req.method === 'POST') {
        const fs3 = me ? userFunctions(me) : [];
        const b = await req.json().catch(() => ({}));
        const whoS = (me && me.name) || (can.platform(role, me) ? 'AETRAA Admin' : role);
        if (p === '/api/diary/send-to') {
          if (!(can.platform(role, me) || ['dc', 'pm', 'principal'].some((x) => fs3.includes(x)))) return json({ error: 'Document Control, the PM or the Principal sets who the diary goes to.' }, 403);
          const r = await setDiaryRecipients(env, pid, b.to);
          if (!r.error) await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoS, action: 'diary.send_to', detail: r.to.join(', ') || '(nobody)' });
          return json(r, r.error ? 400 : 200);
        }
        if (!(can.platform(role, me) || fs3.includes('dc'))) return json({ error: 'Document Control sends the diary.' }, 403);
        const day = date(b.date);
        if (!day) return json({ error: 'Which day?' }, 400);
        const project = await getProject(env, pid);
        const d = await loadDiary(env, pid, day, project);
        if (!d || d.missing || !d.exists) return json({ error: 'There is no diary for ' + day + '.' }, 404);
        if (d.status !== 'submitted') return json({ error: 'The diary for ' + day + ' is not submitted yet — the PM submits it, then it is sent.' }, 400);
        const to = await diaryRecipients(env, pid);
        if (!to.length) return json({ error: 'Nobody is set to receive the diary. Set the address first (usually the Engineer’s).' }, 400);
        const file = { filename: diaryFileName(project, day, 'docx'), contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: diaryDocx(project, d) };
        const ob = await diaryObligation(env, pid);
        const html = '<p>Dear Sir / Madam,</p><p>Please find attached the daily site diary for <b>' + escHtml(day) + '</b> — ' + escHtml(project.name || '') + '.</p>'
          + (ob ? '<p>Submitted under ' + escHtml(ob.clause_key) + ' of the contract.</p>' : '') + '<p>Regards,<br>' + escHtml(whoS) + '</p>';
        const sent = await sendEmail(env, to, (project.name || 'Project') + ' — daily site diary ' + day, html, { attachments: [file], replyTo: me && me.email ? me.email : undefined });
        if (!sent || !sent.ok) return json({ error: 'The diary could not be emailed' + (sent && sent.error ? ': ' + sent.error : '') + '. Send it by hand.' }, 400);
        const log = await logDiarySending(env, pid, day, { at: new Date().toISOString(), by: whoS, to });
        await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoS, action: 'diary.send', detail: day + ' to ' + to.join(', ') });
        return json({ ok: true, to, log });
      }
      if (p === '/api/diary' && req.method === 'POST') {
        if (!can.diaryEdit(role)) return json({ error: 'auth' }, 401);
        // K13 (A12): the person the PM assigned may write the diary whatever
        // their workflows; everyone else as before.
        if (me && !onStream(me, 'progress') && (await ensureDiaryA12(env), (await getProject(env, pid)).diary_assignee) !== me.id) {
          return json({ error: 'The progress diary is not one of your workflows on this project. ' +
                               'The Principal or the Project Manager can add you to it.' }, 403);
        }
        const b = await req.json().catch(() => ({}));
        // Only the office decides a diary has been issued.
        if (b.submit && !can.export(role)) return json({ error: 'auth' }, 401);
        // Ajay, 6 Oct 2026 (decision 11): only Document Control and the person
        // the PM assigns save it; the PM (and the Principal) submit it.
        const proj11 = await getProject(env, pid);
        const fs11 = me ? userFunctions(me) : [];
        if (!mayWriteDiary(me, role, proj11) && !(b.submit && (fs11.includes('pm') || fs11.includes('principal')))) {
          return json({ error: 'The site diary is saved by Document Control or the person the Project Manager assigns. The Project Manager submits it.' }, 403);
        }
        if (b.submit) {
          // Save what was typed first (as a draft), then check the whole diary
          // as it now stands. A diary with blockers stays a draft.
          const draft = await saveDiary(env, pid, { ...b, submit: false }, str(b.prepared_by, 120));
          if (draft.error) return json(draft, 400);
          const project = await getProject(env, pid);
          const d = await loadDiary(env, pid, draft.report_date, project);
          const checks = diaryChecks(d, await diaryContext(env, pid, draft.report_date));
          if (!checks.ok) {
            return json({ error: 'Saved as a draft — it cannot be submitted yet: ' + checks.blockers.join(' '), checks, saved: true }, 400);
          }
        }
        const changer = (me && (me.name || me.email)) || role;
        const r = await saveDiary(env, pid, { ...b, changed_by: changer }, str(b.prepared_by, 120));
        // EVERY DIARY SAVE IS IN THE AUDIT TRAIL. It was the one record on the
        // platform that could be written, and rewritten, with nothing recording
        // that it had happened.
        if (!r.error) {
          await audit(env, { org_id: me && me.org_id, project_id: pid, user_id: me && me.id, who: changer,
            action: r.revised ? 'diary.revise' : b.submit ? 'diary.submit' : 'diary.save',
            detail: (r.report_date || '') + (r.revised ? ' \u2014 submitted version ' + r.kept_version + ' kept'
                    + (b.reason ? ': ' + str(b.reason, 200) : '') : '') }).catch(() => {});
        }
        return json(r, r.error ? 400 : 200);
      }
      // The versions of one day's diary that were kept when it was changed
      // after submission — who changed it, when, and why.
      if (p === '/api/diary/versions') {
        if (!can.diary(role)) return json({ error: 'auth' }, 401);
        const day = date(url.searchParams.get('date'));
        if (!day) return json({ error: 'which day?' }, 400);
        return json({ date: day, versions: await listDiaryVersions(env, pid, day) });
      }
      if (p === '/api/diary/status') {
        if (!can.diary(role)) return json({ error: 'auth' }, 401);
        const project = await getProject(env, pid);
        const n = Math.max(7, Math.min(62, Number(url.searchParams.get('days')) || 14));
        return json(await diaryStatus(env, pid, project, todayUAE(), n));
      }
      if (p === '/api/diary/progress') {
        if (!can.diary(role)) return json({ error: 'auth' }, 401);
        return json({ progress: await todaysProgress(env, pid, date(url.searchParams.get('date')) || todayUAE()) });
      }
      if (p === '/api/diary/list') {
        if (!can.diary(role)) return json({ error: 'auth' }, 401);
        const to = date(url.searchParams.get('to')) || today();
        const from = date(url.searchParams.get('from')) || shiftDay(to, -120);
        const diaries = await listDiaries(env, pid, from, to);
        return json({ from, to, diaries: diaries || [] });
      }
      if (p === '/api/issues') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        return json(await issuesPayload(env, pid, url));
      }
      // One issue — the RFI page reads it to start an RFI from it.
      if (p === '/api/issue' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const it = await getIssue(env, pid, str(url.searchParams.get('ref'), 40));
        return it ? json({ issue: it }) : json({ error: 'no such issue' }, 404);
      }
      if (p === '/api/issue' && req.method === 'POST') {
        if (!can.raise(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        // Site may raise one; only the office may issue, answer or close it.
        if (!b.create && !can.issueOut(role)) return json({ error: 'auth' }, 401);
        const r = b.create || !b.ref
          ? await createIssue(env, pid, b, role, str(b.raised_by, 120))
          : await updateIssue(env, pid, b);
        return json(r, r.error ? 400 : 200);
      }
      // Whether this app can send email at all, and — on a POST — proof either
      // way. A code that never arrives has four possible causes and no symptom;
      // this turns it into one sentence.
      // A sign-in code the owner can read out. The only route by which one person
      // obtains another's sign-in, so it is confined to the owner, confined to his
      // own organisation, and written to the audit under his name every time.
      if (p === '/api/signin/issue' && req.method === 'POST') {
        if (!can.people(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const who = await getUser(env, str(b.user_id, 60));
        if (!who) return json({ error: 'unknown person' }, 404);
        const oid = me ? me.org_id : (str(b.org, 60) || await onlyOrg(env));
        if (!oid || who.org_id !== oid) return json({ error: 'not on this account' }, 403);

        const r = await issueSignInCode(env, who.id, sha256);
        if (r.error) return json({ error: r.error }, 400);
        await audit(env, {
          org_id: who.org_id, project_id: pid, user_id: who.id,
          who: (me && me.name) || 'owner',
          action: 'sign-in code issued',
          detail: `read out to ${who.name} — email not used`,
        });
        return json(r);
      }
      if (p === '/api/email-check' && req.method === 'GET') {
        if (!can.people(role)) return json({ error: 'auth' }, 401);
        const st = emailStatus(env);
        let withEmail = null, total = null;
        // The platform owner belongs to no organisation, so he is counted across
        // the one he is looking at, or across all of them — not across nothing,
        // which would report "0 people" on an account full of people.
        const oid = me ? me.org_id : (url.searchParams.get('org') || await onlyOrg(env));
        try {
          const r = oid
            ? await env.DB.prepare(
                `SELECT COUNT(*) AS n, SUM(CASE WHEN COALESCE(email,'') <> '' THEN 1 ELSE 0 END) AS e
                   FROM users WHERE org_id = ? AND COALESCE(status,'') <> 'suspended'`
              ).bind(oid).first()
            : await env.DB.prepare(
                `SELECT COUNT(*) AS n, SUM(CASE WHEN COALESCE(email,'') <> '' THEN 1 ELSE 0 END) AS e
                   FROM users WHERE COALESCE(status,'') <> 'suspended'`
              ).first();
          total = (r && r.n) || 0; withEmail = (r && r.e) || 0;
        } catch (err) { /* org tables not there yet */ }
        return json({ ...st, people: total, people_with_email: withEmail });
      }
      if (p === '/api/email-check' && req.method === 'POST') {
        if (!can.people(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const to = parseRecipients(b.to || (me && me.email) || '');
        if (!to.length) return json({ error: 'Put an address to test with.' }, 400);
        const sent = await sendEmail(env, to,
          'Test — AETRAA',
          '<p style="font-family:system-ui,sans-serif;font-size:15px">' +
          'This is the test message from your AETRAA platform. ' +
          'If it reached you, sign-in codes will reach your people too.</p>');
        return json(sent.ok
          ? { ok: true, to: to[0] }
          : { error: emailAdvice(sent, env), raw: sent.error || '', status: sent.status || 0 },
          sent.ok ? 200 : 400);
      }
      if (p === '/api/report-email' && req.method === 'POST') {
        // The office, or by function the Principal, PM or Planning. It goes only
        // to the project's own report list, never to an address typed here.
        const fns = me ? userFunctions(me) : [];
        if (!can.admin(role) && !['principal', 'pm', 'planning', 'hse'].some((x) => fns.includes(x))) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const kind = ['daily', 'weekly', 'monthly', 'hse'].includes(b.kind) ? b.kind : 'daily';
        const r = await emailReport(env, pid, kind, str(b.key, 10));
        return json(r, r.ok ? 200 : 400);
      }
    } catch (err) {
      // The detail goes to the server log, not to whoever sent the request —
      // an error message can carry table names, paths or data.
      console.error(req.method + ' ' + p + ' failed:', (err && err.stack) || err);
      return json({ error: 'the server could not complete that request' }, 500);
    }

    return new Response('Not found', { status: 404 });
  },

  // The evening send. Cloudflare calls this on the cron in wrangler.toml.
  async scheduled(event, env, ctx) {
    // Every 15 minutes: a drop whose filing stopped part-way — whoever ran it
    // is told, once (spec §22 "Batch interrupted").
    if (event.cron === '*/15 * * * *') {
      ctx.waitUntil(runBatchAlerts(env, Date.now(), (to, s, h) => sendEmail(env, to, s, h))
        .then((r) => { if (r && r.told) console.log('batch alerts', JSON.stringify(r)); }).catch((e) => console.error('batch alerts', e && e.message)));
      return;
    }
    // Two crons share this handler; the Monday one carries the weekly send.
    if (event.cron === '0 2 * * *') {
      ctx.waitUntil(runScheduledDigest(env).then((r) => console.log('attention digest', JSON.stringify(r))));
      // K3 (spec §22): AETRAA's daily alerts — the held digest, items held too
      // long, projects with too many held, the database filling up. Each is
      // sent once per its period, however often this fires.
      ctx.waitUntil(runAdminAlerts(env, todayUAE(), (to, s, h) => sendEmail(env, to, s, h))
        .then((r) => console.log('admin alerts', JSON.stringify(r))).catch((e) => console.error('admin alerts', e && e.message)));
      // K11 (v5 A5): certificates near or past their expiry — to the project's
      // HSE and PM, once each.
      ctx.waitUntil(runCertAlerts(env, todayUAE(), (to, s, h) => sendEmail(env, to, s, h), certAlertPeople(env))
        .then((r) => console.log('certificate alerts', JSON.stringify(r))).catch((e) => console.error('certificate alerts', e && e.message)));
      // K13 (v5 A12): yesterday's site diary still not saved — the PM told, once.
      ctx.waitUntil(runDiaryReminders(env, todayUAE(), 'morning', diaryReminderDeps(env))
        .then((r) => console.log('diary next morning', JSON.stringify(r))).catch((e) => console.error('diary next morning', e && e.message)));
      return;
    }
    // K13 (v5 A12): 6 pm — today's site diary not saved, the person who
    // prepares it told, once.
    if (event.cron === '0 14 * * *') {
      ctx.waitUntil(runDiaryReminders(env, todayUAE(), 'evening', diaryReminderDeps(env))
        .then((r) => console.log('diary 6 pm', JSON.stringify(r))).catch((e) => console.error('diary 6 pm', e && e.message)));
    }
    if (event.cron === '0 4 1 * *') {
      ctx.waitUntil(runScheduledMonthly(env).then((r) => console.log('monthly reports', JSON.stringify(r))));
    } else if (event.cron === '0 3 * * 1') {
      ctx.waitUntil(runScheduledWeekly(env).then((r) => console.log('weekly reports', JSON.stringify(r))));
    } else {
      ctx.waitUntil(runScheduledReports(env).then((r) => console.log('daily reports', JSON.stringify(r))));
    }
    // Spent sign-in codes are worthless, but they are still rows.
    ctx.waitUntil(purgeSignInCodes(env));
    // Old attempt counters, likewise.
    ctx.waitUntil(purgeThrottle(env));
  },
};

/* ------------------------------------------------------- security headers
 *
 * Added to every response, on Cloudflare and on Oracle alike:
 *   HSTS               browsers only ever use https:// for this site
 *   frame-ancestors    nobody can frame the app to trick a click (clickjacking)
 *   nosniff            a file is only ever treated as the type it says it is
 *   Referrer-Policy    links out do not carry our URLs with them
 *   Permissions-Policy the camera (site photos) is allowed; mic, location etc. are not
 *   CSP                pages load code only from here and the one CDN the BOQ
 *                      importer uses; they can talk only to this server.
 * The screens use inline scripts and styles, so those are allowed; what CSP
 * adds here is that nothing can be loaded or sent to any other host.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  // The fonts are served from /fonts; Google's copy is only the fallback (theme.js).
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

export function withSecurityHeaders(res) {
  let out = res;
  try { out.headers.set('X-Content-Type-Options', 'nosniff'); }
  catch (e) { out = new Response(res.body, res); }        // immutable headers: copy once
  const h = out.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()');
  const type = h.get('Content-Type') || '';
  if (/text\/html/i.test(type) && !h.has('Content-Security-Policy')) h.set('Content-Security-Policy', CSP);
  return out;
}

export default {
  async fetch(req, env, ctx) {
    return withSecurityHeaders(await APP.fetch(req, env, ctx));
  },
  async scheduled(event, env, ctx) {
    return APP.scheduled(event, env, ctx);
  },
};
