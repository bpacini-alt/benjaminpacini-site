const MAX_BODY_BYTES = 65536;
const PRODUCTION_HOSTS = new Set(["benjaminpacini.com", "www.benjaminpacini.com"]);
const REQUIRED_ACKNOWLEDGMENTS = ["grade", "schedule", "attendanceHours", "relationship"];
const COURSE_OPTIONS = ["EDCOR 200", "EDCOR 310", "ECON 150"];
const COURSE_TITLES = {
  "EDCOR 200": "Teaching as a Profession",
  "EDCOR 310": "Educational Psychology and Human Development",
  "ECON 150": "Principles of Microeconomics"
};
const BLIND_QUESTION_KEYS = ["courseMagic", "managingUp", "holyGhostAction", "whyThisJob", "uniqueContribution"];
const RATING_FIELDS = [
  "vibe", "technology", "mentorship", "content",
  "assertiveness", "grading", "innovation", "initiative"
];
// Only the items that split applicants (Nov 2026 data). Older applications
// may hold answers for items that have since been removed.
const RESPONSIBILITY_IDS = [
  "dress-code", "canvas-bugs", "redirect-student", "practical-jokes", "change-memes", "promise-grade"
];
const RESPONSIBILITY_ROLES = new Set(["ta", "brother-pacini", "no-one"]);
const QUESTION_LIMITS = {
  courseMagic: 1400,
  managingUp: 1200,
  holyGhostAction: 1200,
  whyThisJob: 1200,
  uniqueContribution: 1600
};

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function validateApplication(data) {
  if (!isObject(data)) return "Please review your answers and try again.";

  const applicant = data.applicant;
  if (!isObject(applicant) ||
      !hasText(applicant.name, 120) ||
      !hasText(applicant.email, 254) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email) ||
      !Array.isArray(applicant.courseSelections) ||
      applicant.courseSelections.length < 1 ||
      applicant.courseSelections.length > COURSE_OPTIONS.length + 1 ||
      applicant.courseSelections.some((course) => course !== "OTHER" && !COURSE_OPTIONS.includes(course)) ||
      new Set(applicant.courseSelections).size !== applicant.courseSelections.length) {
    return "Please check your name, email address, and selected class or classes.";
  }

  const hasOtherCourse = applicant.courseSelections.includes("OTHER");
  if (hasOtherCourse
        ? !hasText(applicant.otherCourse, 80)
        : typeof applicant.otherCourse !== "string" || applicant.otherCourse.length > 80) {
    return "Please name the other course you selected.";
  }
  const expectedCourse = applicant.courseSelections
    .map((course) => course === "OTHER" ? "Other: " + applicant.otherCourse.trim() : course + " — " + COURSE_TITLES[course])
    .join(", ");
  if (!hasText(applicant.course, 240) || applicant.course.trim() !== expectedCourse) {
    return "Please check your selected class or classes.";
  }

  const acknowledgments = data.acknowledgments;
  if (!isObject(acknowledgments) ||
      REQUIRED_ACKNOWLEDGMENTS.some((key) => acknowledgments[key] !== true)) {
    return "Please complete the required confirmations.";
  }

  const ratings = data.ratings;
  if (!isObject(ratings) ||
      RATING_FIELDS.some((key) => !Number.isInteger(ratings[key]) || ratings[key] < 1 || ratings[key] > 10)) {
    return "Please review your slider answers.";
  }

  if (!hasText(data.sliderContext, 1200) ||
      typeof data.responsibilityContext !== "string" ||
      data.responsibilityContext.length > 800) {
    return "Please review your self-assessment answers.";
  }

  const responsibilities = data.responsibilities;
  if (!isObject(responsibilities) ||
      RESPONSIBILITY_IDS.some((key) => !RESPONSIBILITY_ROLES.has(responsibilities[key]))) {
    return "Please sort each responsibility into a role.";
  }

  const questions = data.questions;
  if (!isObject(questions) ||
      Object.entries(QUESTION_LIMITS).some(([key, limit]) => !hasText(questions[key], limit))) {
    return "Please complete the common questions.";
  }

  if (!Array.isArray(data.workSamples) || data.workSamples.length !== 3) {
    return "Please choose exactly three work samples.";
  }
  const seenWorkSamples = new Set();
  for (const sample of data.workSamples) {
    if (!isObject(sample) ||
        !/^[a-z0-9-]{1,80}$/.test(sample.id) ||
        seenWorkSamples.has(sample.id) ||
        !hasText(sample.title, 160) ||
        !hasText(sample.response, 1400) ||
        typeof sample.aiUse !== "string" ||
        sample.aiUse.length > 240) {
      return "Please complete each selected work sample.";
    }
    seenWorkSamples.add(sample.id);
  }

  const reflection = data.reflection;
  if (!isObject(reflection) ||
      !hasText(reflection.answer, 1000)) {
    return "Please complete the final reflection.";
  }

  if (data.timing !== undefined &&
      (!isObject(data.timing) || !Number.isInteger(data.timing.activeSeconds) ||
       data.timing.activeSeconds < 0 || data.timing.activeSeconds > 86400)) {
    return "Please resubmit the application.";
  }

  return null;
}


// ---------------------------------------------------------------------------
// TA review: two passwords, four fixed pages.
//   /ta-review/          owner: every application, with names
//   /ta-review/summary/  owner: names, candidate names, ratings
//   /ta-review/ta/       TA or owner: applications with names removed
//   /ta-review/rate/     TA or owner: four-level ratings on five criteria
// The passwords are Cloudflare secrets (OWNER_REVIEW_PASSWORD and
// TA_REVIEW_PASSWORD), never stored in this repository.
// ---------------------------------------------------------------------------

// Five rubric questions scored 1-4, plus an overall vibe scored 1-5
// (hard no, concern, meh, good vibe, definite yes).
const RATING_LEVELS = {
  vibe: [1, 2, 3, 4], innovation: [1, 2, 3, 4], managingUp: [1, 2, 3, 4], dedication: [1, 2, 3, 4], content: [1, 2, 3, 4],
  overallVibe: [1, 2, 3, 4, 5]
};
const RATING_CRITERIA = Object.keys(RATING_LEVELS);

// Candidate names are tree names. Each real applicant gets one at random,
// once, and keeps it. Every page lists candidates alphabetically by that
// name, so the order is fixed for everyone and says nothing about who
// applied when. Names that match a word in an applicant's own name are skipped.
const CANDIDATE_NAMES = [
  "Acacia", "Alder", "Almond", "Apricot", "Ash", "Aspen", "Avocado", "Balsa", "Banyan", "Baobab",
  "Basswood", "Beech", "Birch", "Blackthorn", "Boxelder", "Buckeye", "Butternut", "Cacao", "Camphor", "Catalpa",
  "Cedar", "Cherry", "Chestnut", "Cinnamon", "Citron", "Coconut", "Cork", "Cottonwood", "Cypress",
  "Dogwood", "Ebony", "Elder", "Elm", "Eucalyptus", "Fig", "Fir", "Ginkgo", "Guava", "Hackberry",
  "Hawthorn", "Hemlock", "Hickory", "Hornbeam", "Ironwood", "Jacaranda", "Juniper", "Kapok", "Kumquat", "Larch",
  "Lemon", "Lilac", "Locust", "Lychee", "Mahogany", "Mango", "Mangrove", "Maple", "Mesquite", "Mulberry",
  "Nutmeg", "Oak", "Olive", "Orange", "Palm", "Papaya", "Pawpaw", "Peach", "Pear", "Pecan",
  "Persimmon", "Pine", "Pinyon", "Pistachio", "Plum", "Pomegranate", "Poplar", "Quince", "Redbud", "Redwood",
  "Sassafras", "Sequoia", "Spruce", "Sumac", "Sycamore", "Tamarack", "Tamarind", "Teak", "Tupelo", "Walnut",
  "Wisteria", "Yew"
];

// Ratings live in candidate_scores (levels 1-5). The first version kept
// them in candidate_ratings (levels 1-4); those are copied over once, the
// first time candidate_scores is created, and the old table is left alone.
let reviewSchemaReady = false;
async function ensureReviewSchema(env) {
  if (reviewSchemaReady) return;
  const db = env.TA_APPLICATIONS_DB;
  const existing = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('candidate_codes', 'candidate_ratings', 'candidate_scores')"
  ).all();
  const tables = new Set((existing.results || []).map((row) => row.name));
  const steps = [
    db.prepare("CREATE TABLE IF NOT EXISTS candidate_codes (application_id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, assigned_at TEXT NOT NULL)")
  ];
  if (!tables.has("candidate_scores")) {
    steps.push(db.prepare(
      "CREATE TABLE IF NOT EXISTS candidate_scores (rater_key TEXT NOT NULL, rater_label TEXT NOT NULL, application_id TEXT NOT NULL, criterion TEXT NOT NULL, level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5), updated_at TEXT NOT NULL, PRIMARY KEY (rater_key, application_id, criterion))"
    ));
    if (tables.has("candidate_ratings")) {
      steps.push(db.prepare(
        "INSERT OR IGNORE INTO candidate_scores (rater_key, rater_label, application_id, criterion, level, updated_at) " +
        "SELECT rater_key, rater_label, application_id, criterion, level, updated_at FROM candidate_ratings"
      ));
    }
  }
  await db.batch(steps);
  reviewSchemaReady = true;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function constantTimeStringEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

// Returns "owner", "ta", "unset" (passwords not configured), or null.
async function reviewRole(request, env) {
  if (!env.OWNER_REVIEW_PASSWORD || !env.TA_REVIEW_PASSWORD) return "unset";
  const given = request.headers.get("X-Review-Password");
  if (typeof given !== "string" || given.length < 1 || given.length > 200) return null;
  const givenHash = await sha256Hex(given);
  const ownerMatch = constantTimeStringEqual(givenHash, await sha256Hex(env.OWNER_REVIEW_PASSWORD));
  const taMatch = constantTimeStringEqual(givenHash, await sha256Hex(env.TA_REVIEW_PASSWORD));
  if (ownerMatch) return "owner";
  if (taMatch) return "ta";
  return null;
}

function parseAnswers(json) {
  try {
    const parsed = JSON.parse(json);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isCandidate(answers) {
  return Array.isArray(answers?.applicant?.courseSelections) && answers.applicant.courseSelections.length > 0;
}

function nameParts(name) {
  return String(name || "").split(/[^A-Za-zÀ-ɏ'’-]+/).filter((part) => part.length >= 3);
}

// Every application, each real applicant with a permanent candidate name.
// Sorted by candidate name; applications without one (tests) come last.
async function listCandidates(env) {
  await ensureReviewSchema(env);
  const db = env.TA_APPLICATIONS_DB;
  const [apps, codes] = await Promise.all([
    db.prepare("SELECT id, submitted_at, name, email, answers_json FROM applications ORDER BY submitted_at").all(),
    db.prepare("SELECT application_id, code FROM candidate_codes").all()
  ]);
  const codeById = new Map((codes.results || []).map((item) => [item.application_id, item.code]));
  const rows = (apps.results || []).map((row) => ({ row, answers: parseAnswers(row.answers_json) }));

  const blocked = new Set(rows.flatMap(({ row }) => nameParts(row.name).map((part) => part.toLowerCase())));
  const used = new Set(codeById.values());
  const missing = rows.filter(({ row, answers }) => isCandidate(answers) && !codeById.has(row.id));
  for (const { row } of missing) {
    const open = CANDIDATE_NAMES.filter((code) => !used.has(code) && !blocked.has(code.toLowerCase()));
    if (!open.length) throw new Error("No candidate names left. Add more to CANDIDATE_NAMES.");
    const pick = new Uint32Array(1);
    crypto.getRandomValues(pick);
    const code = open[pick[0] % open.length];
    await db.prepare("INSERT OR IGNORE INTO candidate_codes (application_id, code, assigned_at) VALUES (?, ?, ?)")
      .bind(row.id, code, new Date().toISOString()).run();
    const saved = await db.prepare("SELECT code FROM candidate_codes WHERE application_id = ?").bind(row.id).first();
    if (saved?.code) {
      codeById.set(row.id, saved.code);
      used.add(saved.code);
    }
  }

  return rows
    .map((item) => ({ ...item, code: isCandidate(item.answers) ? codeById.get(item.row.id) || null : null }))
    .sort((a, b) => {
      if (a.code && b.code) return a.code.localeCompare(b.code);
      if (a.code || b.code) return a.code ? -1 : 1;
      return a.row.submitted_at < b.row.submitted_at ? -1 : 1;
    });
}

// Strip names, emails, dates and timing; scrub the applicant's own name
// and any email address out of every answer.
function anonymize(answers, name) {
  const parts = nameParts(name).sort((a, b) => b.length - a.length)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = parts.length ? new RegExp("(^|[^A-Za-zÀ-ɏ])(" + parts.join("|") + ")(?=$|[^A-Za-zÀ-ɏ])", "gi") : null;
  const scrub = (value) => {
    if (typeof value === "string") {
      let text = value.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email removed]");
      if (pattern) text = text.replace(pattern, "$1[name removed]");
      return text;
    }
    if (Array.isArray(value)) return value.map(scrub);
    if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrub(item)]));
    return value;
  };
  const { applicant, timing, ...rest } = answers || {};
  return { ...scrub(rest), applicant: { courseSelections: applicant?.courseSelections || [], otherCourse: scrub(applicant?.otherCourse || "") } };
}

async function handleApplications(env, role, view) {
  if (view === "owner" && role !== "owner") return jsonResponse({ error: "This page needs BroPa's password." }, 403);
  const all = await listCandidates(env);
  const showNames = role === "owner" && view !== "ta";
  const list = showNames ? all : all.filter(({ code, answers }) => code && canShareWithReviewers(answers));
  return jsonResponse({
    role: showNames ? "owner" : "ta",
    applications: list.map(({ row, answers, code }) => showNames
      ? { code, name: row.name, email: row.email, submittedAt: row.submitted_at, answers }
      : { code, answers: anonymize(answers, row.name) })
  }, 200);
}

function canShareWithReviewers(answers) {
  return answers?.acknowledgments?.shareWithReviewers === true;
}

function raterKey(label) {
  return label.toLowerCase();
}

function cleanRater(value) {
  const label = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return hasText(label, 60) && !/[\u0000-\u001f]/.test(label) ? label : null;
}

async function handleRatingsGet(env, role, url) {
  const rater = cleanRater(url.searchParams.get("rater"));
  if (!rater) return jsonResponse({ error: "Type your name first." }, 400);
  const all = await listCandidates(env);
  const visible = all.filter(({ code, answers }) => code && (role === "owner" || canShareWithReviewers(answers)));
  const ids = new Map(visible.map(({ row, code }) => [row.id, code]));
  const saved = await env.TA_APPLICATIONS_DB.prepare(
    "SELECT application_id, criterion, level FROM candidate_scores WHERE rater_key = ?"
  ).bind(raterKey(rater)).all();
  const ratings = {};
  for (const item of saved.results || []) {
    const code = ids.get(item.application_id);
    if (!code) continue;
    (ratings[code] = ratings[code] || {})[item.criterion] = item.level;
  }
  return jsonResponse({
    rater,
    candidates: visible.map(({ code, answers }) => ({ code, courses: answers.applicant.courseSelections })),
    ratings
  }, 200);
}

async function readJson(request, limit) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return null;
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > limit) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function handleRatingsPost(request, env, role) {
  const data = await readJson(request, 2048);
  const rater = cleanRater(data?.rater);
  if (!rater) return jsonResponse({ error: "Type your name first." }, 400);
  if (typeof data?.code !== "string" || !RATING_CRITERIA.includes(data?.criterion) ||
      !(data.level === null || RATING_LEVELS[data.criterion].includes(data.level))) {
    return jsonResponse({ error: "That rating could not be saved." }, 400);
  }
  const all = await listCandidates(env);
  const target = all.find(({ code, answers }) => code === data.code && (role === "owner" || canShareWithReviewers(answers)));
  if (!target) return jsonResponse({ error: "That candidate was not found. Refresh the page." }, 404);
  const db = env.TA_APPLICATIONS_DB;
  if (data.level === null) {
    await db.prepare("DELETE FROM candidate_scores WHERE rater_key = ? AND application_id = ? AND criterion = ?")
      .bind(raterKey(rater), target.row.id, data.criterion).run();
  } else {
    await db.prepare(
      "INSERT INTO candidate_scores (rater_key, rater_label, application_id, criterion, level, updated_at) VALUES (?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT (rater_key, application_id, criterion) DO UPDATE SET rater_label = excluded.rater_label, level = excluded.level, updated_at = excluded.updated_at"
    ).bind(raterKey(rater), rater, target.row.id, data.criterion, data.level, new Date().toISOString()).run();
  }
  return jsonResponse({ ok: true }, 200);
}

async function handleSummary(env) {
  const all = await listCandidates(env);
  const saved = await env.TA_APPLICATIONS_DB.prepare(
    "SELECT rater_key, rater_label, application_id, criterion, level FROM candidate_scores"
  ).all();
  const byApp = new Map();
  for (const item of saved.results || []) {
    const raters = byApp.get(item.application_id) || new Map();
    const entry = raters.get(item.rater_key) || { rater: item.rater_label, scores: {} };
    entry.scores[item.criterion] = item.level;
    raters.set(item.rater_key, entry);
    byApp.set(item.application_id, raters);
  }
  return jsonResponse({
    criteria: RATING_CRITERIA,
    candidates: all.filter(({ code }) => code).map(({ row, answers, code }) => ({
      code,
      name: row.name,
      courses: answers.applicant.courseSelections,
      sharedWithTAs: canShareWithReviewers(answers),
      ratings: Array.from((byApp.get(row.id) || new Map()).values()).sort((a, b) => a.rater.localeCompare(b.rater))
    }))
  }, 200);
}

async function handleReviewRequest(request, env, url) {
  if (url.protocol !== "https:" || !PRODUCTION_HOSTS.has(url.hostname)) {
    return jsonResponse({ error: "Review pages work on the live site only." }, 403);
  }
  const role = await reviewRole(request, env);
  if (role === "unset") return jsonResponse({ error: "The review passwords have not been set up yet." }, 503);
  if (!role) return jsonResponse({ error: "That password didn't work." }, 401);

  try {
    if (url.pathname === "/api/review/applications" && request.method === "GET") {
      return await handleApplications(env, role, url.searchParams.get("view"));
    }
    if (url.pathname === "/api/review/ratings" && request.method === "GET") {
      return await handleRatingsGet(env, role, url);
    }
    if (url.pathname === "/api/review/ratings" && request.method === "POST") {
      return await handleRatingsPost(request, env, role);
    }
    if (url.pathname === "/api/review/summary" && request.method === "GET") {
      if (role !== "owner") return jsonResponse({ error: "This page needs BroPa's password." }, 403);
      return await handleSummary(env);
    }
  } catch (error) {
    console.error("TA review request failed.", error);
    return jsonResponse({ error: "Something went wrong loading this. Try again in a minute." }, 500);
  }
  return jsonResponse({ error: "This page could not be found." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/review/")) return handleReviewRequest(request, env, url);
    if (url.pathname === "/api/applications") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "Use the application form to submit." }, 405);
      }
      if (!PRODUCTION_HOSTS.has(url.hostname)) {
        return jsonResponse({ error: "Applications can only be submitted on the live site." }, 403);
      }

      const origin = request.headers.get("Origin");
      if (origin) {
        try {
          const originUrl = new URL(origin);
          if (!PRODUCTION_HOSTS.has(originUrl.hostname) || originUrl.protocol !== "https:") {
            return jsonResponse({ error: "This request could not be accepted." }, 403);
          }
        } catch {
          return jsonResponse({ error: "This request could not be accepted." }, 403);
        }
      }

      const contentType = request.headers.get("Content-Type") || "";
      if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
        return jsonResponse({ error: "Please submit the application form." }, 415);
      }

      let rawBody;
      try {
        rawBody = await request.text();
      } catch {
        return jsonResponse({ error: "Your application could not be read. Please try again." }, 400);
      }
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
        return jsonResponse({ error: "Your application is too large to submit." }, 413);
      }

      let application;
      try {
        application = JSON.parse(rawBody);
      } catch {
        return jsonResponse({ error: "Please review your answers and try again." }, 400);
      }

      const validationError = validateApplication(application);
      if (validationError) return jsonResponse({ error: validationError }, 400);

      try {
        await env.TA_APPLICATIONS_DB.prepare(
          "INSERT INTO applications (id, blind_id, submitted_at, name, email, course, answers_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          crypto.randomUUID(),
          crypto.randomUUID().replace(/-/g, ""),
          new Date().toISOString(),
          application.applicant.name.trim(),
          application.applicant.email.trim(),
          application.applicant.course.trim(),
          JSON.stringify(application)
        ).run();

        return jsonResponse({ ok: true }, 201);
      } catch (error) {
        console.error("Could not save TA application to D1.", error);
        return jsonResponse({ error: "We could not save your application just now. Please try again." }, 500);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return jsonResponse({ error: "This page could not be found." }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
