const MAX_BODY_BYTES = 65536;
const PRODUCTION_HOSTS = new Set(["benjaminpacini.com", "www.benjaminpacini.com"]);
const REQUIRED_ACKNOWLEDGMENTS = ["grade", "schedule", "attendanceHours", "relationship"];
const REVIEW_TOKEN_HASHES = {
  owner: "30cc9477aeb96691e04a034f0f3a638a9276c00d0833bccf496b3251be91d193",
  "ta:EDCOR 200": "b86f92bd94950e42ae7ffedc8c1c71a8d112fb1d7ed3275a55a37abe464d74d4",
  "blind:EDCOR 200": "1793306ca005eed34d6fa87f8ab59e282f3978a1d4c9666f163e358b58e50688",
  "ta:EDCOR 310": "0ac7fe38310a513de3011519d5f99117c0bfbcec1e97addaf09a0d3921996710",
  "blind:EDCOR 310": "684829b716a333d01a216bfa8e52a0090dc34eaf7ed0e9ac6b49a80790d842fa",
  "ta:ECON 150": "01ce39d15587eedba777476d7aaffd64882acd47a66fc7ccd9ff844cd56bdc13",
  "blind:ECON 150": "fe53c62866bc03f089e5c6fe36ea31a110b4082e8af0aeb9afa270d59cbc0216"
};
const COURSE_OPTIONS = ["EDCOR 200", "EDCOR 310", "ECON 150"];
const COURSE_TITLES = {
  "EDCOR 200": "Educational Psychology and Human Development",
  "EDCOR 310": "Teaching as a Profession",
  "ECON 150": "Principles of Microeconomics"
};
const BLIND_QUESTION_KEYS = ["courseMagic", "managingUp", "holyGhostAction", "whyThisJob", "uniqueContribution"];
const RATING_FIELDS = [
  "vibe", "technology", "mentorship", "content",
  "assertiveness", "grading", "innovation", "initiative"
];
const RESPONSIBILITY_IDS = [
  "grade", "dress-code", "personal-life", "integrity", "canvas-bugs",
  "call-it", "weekend-zoom", "refer-support", "diagnose-disability",
  "modify-assignment", "grade-exception", "correct-ta", "redirect-student",
  "practical-jokes", "change-memes", "financial-support", "interview-tas",
  "promise-grade"
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
      !Number.isInteger(reflection.timeSpentMinutes) ||
      reflection.timeSpentMinutes < 1 ||
      reflection.timeSpentMinutes > 1440 ||
      !hasText(reflection.answer, 1000) ||
      typeof reflection.otherOpportunities !== "boolean") {
    return "Please complete the final reflection.";
  }

  if (data.timing !== undefined &&
      (!isObject(data.timing) || !Number.isInteger(data.timing.activeSeconds) ||
       data.timing.activeSeconds < 0 || data.timing.activeSeconds > 86400)) {
    return "Please resubmit the application.";
  }

  return null;
}


function constantTimeStringEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function reviewScope(request, url) {
  if (url.protocol !== "https:" || !PRODUCTION_HOSTS.has(url.hostname)) return null;
  const match = (request.headers.get("Authorization") || "").match(/^Bearer ([a-f0-9]{64})$/i);
  if (!match) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(match[1].toLowerCase()));
  const candidate = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  for (const [scope, expected] of Object.entries(REVIEW_TOKEN_HASHES)) {
    if (constantTimeStringEqual(candidate, expected)) return scope;
  }
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

function canShareWithReviewers(answers) {
  return answers?.acknowledgments?.shareWithReviewers === true;
}

async function listReviewApplications(env) {
  const result = await env.TA_APPLICATIONS_DB.prepare(
    "SELECT id, submitted_at, name, email, course, answers_json, blind_id FROM applications ORDER BY submitted_at DESC"
  ).all();
  const rows = result.results || [];
  for (const row of rows) {
    if (!row.blind_id) {
      const candidate = crypto.randomUUID().replace(/-/g, "");
      await env.TA_APPLICATIONS_DB.prepare(
        "UPDATE applications SET blind_id = ? WHERE id = ? AND blind_id IS NULL"
      ).bind(candidate, row.id).run();
      const assigned = await env.TA_APPLICATIONS_DB.prepare(
        "SELECT blind_id FROM applications WHERE id = ?"
      ).bind(row.id).first();
      row.blind_id = assigned?.blind_id || candidate;
    }
  }
  return rows.map((row) => ({ row, answers: parseAnswers(row.answers_json) }));
}

async function handleFullReview(env, scope) {
  const all = await listReviewApplications(env);
  const courseScope = scope === "owner" ? null : scope.slice("ta:".length);
  const visible = scope === "owner"
    ? all
    : all.filter(({ answers }) => canShareWithReviewers(answers) && answers?.applicant?.courseSelections?.includes(courseScope));
  const rankingMap = new Map();
  if (scope === "owner") {
    const rankings = await env.TA_APPLICATIONS_DB.prepare(
      "SELECT reviewer_key, blind_id, rank FROM blind_rankings"
    ).all();
    const totals = new Map();
    for (const item of rankings.results || []) {
      const separator = item.reviewer_key.indexOf("::");
      if (separator < 1) continue;
      const course = item.reviewer_key.slice(0, separator).toUpperCase();
      const key = item.blind_id + "|" + course;
      const total = totals.get(key) || { total: 0, count: 0 };
      total.total += item.rank;
      total.count += 1;
      totals.set(key, total);
    }
    for (const [key, total] of totals) {
      const separator = key.lastIndexOf("|");
      const blindId = key.slice(0, separator);
      const course = key.slice(separator + 1);
      const byCourse = rankingMap.get(blindId) || {};
      byCourse[course] = { reviewerCount: total.count, averageRank: Math.round((total.total / total.count) * 100) / 100 };
      rankingMap.set(blindId, byCourse);
    }
  }
  return jsonResponse({
    role: scope === "owner" ? "Instructor view" : "TA reviewer view · " + courseScope + " — " + COURSE_TITLES[courseScope],
    applications: visible.map(({ row, answers }) => {
      const visibleAnswers = scope === "owner" || !answers ? answers : { ...answers };
      if (scope !== "owner" && visibleAnswers) {
        delete visibleAnswers.timing;
        if (visibleAnswers.applicant) {
          visibleAnswers.applicant = {
            ...visibleAnswers.applicant,
            course: courseScope,
            courseSelections: [courseScope],
            otherCourse: ""
          };
        }
      }
      return {
        submittedAt: row.submitted_at,
        answers: visibleAnswers,
        ...(scope === "owner" ? {
          blindId: row.blind_id,
          rankingByCourse: rankingMap.get(row.blind_id) || {}
        } : {})
      };
    })
  }, 200);
}

async function handleBlindReview(env, courseScope) {
  const all = await listReviewApplications(env);
  const eligible = all
    .filter(({ row, answers }) =>
      row.blind_id && canShareWithReviewers(answers) && answers?.applicant?.courseSelections?.includes(courseScope))
    .map(({ row, answers }) => ({
      blindId: row.blind_id,
      questions: Object.fromEntries(BLIND_QUESTION_KEYS.map((key) => [key, answers?.questions?.[key] || ""]))
    }));
  for (let index = eligible.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [eligible[index], eligible[other]] = [eligible[other], eligible[index]];
  }
  return jsonResponse({ course: courseScope, courseTitle: COURSE_TITLES[courseScope], applications: eligible }, 200);
}

async function handleBlindRanking(request, env, courseScope) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return jsonResponse({ error: "Please submit the ranking form." }, 415);
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
  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return jsonResponse({ error: "The ranking could not be read. Please try again." }, 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > 16384) {
    return jsonResponse({ error: "The ranking is too large to save." }, 413);
  }
  let data;
  try {
    data = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Please review the ranking and try again." }, 400);
  }
  const reviewerLabel = typeof data?.reviewerLabel === "string" ? data.reviewerLabel.trim().replace(/\s+/g, " ") : "";
  const reviewerKey = courseScope.toLowerCase() + "::" + reviewerLabel.toLowerCase();
  const rankings = data?.rankings;
  if (!hasText(reviewerLabel, 80) || /[\u0000-\u001f]/.test(reviewerLabel) ||
      !Array.isArray(rankings) || rankings.length < 1 || rankings.length > 100) {
    return jsonResponse({ error: "Enter your name or initials and rank each application." }, 400);
  }
  const ids = new Set();
  const ranks = new Set();
  for (const item of rankings) {
    if (!isObject(item) || !/^[a-f0-9]{32}$/i.test(item.blindId) ||
        !Number.isInteger(item.rank) || item.rank < 1 || item.rank > rankings.length ||
        ids.has(item.blindId) || ranks.has(item.rank)) {
      return jsonResponse({ error: "Each application needs one unique rank." }, 400);
    }
    ids.add(item.blindId);
    ranks.add(item.rank);
  }
  if (ranks.size !== rankings.length) {
    return jsonResponse({ error: "Use each rank from 1 through the number of applications exactly once." }, 400);
  }

  const all = await listReviewApplications(env);
  const eligibleIds = new Set(all
    .filter(({ row, answers }) => row.blind_id && canShareWithReviewers(answers) && answers?.applicant?.courseSelections?.includes(courseScope))
    .map(({ row }) => row.blind_id));
  if (eligibleIds.size !== rankings.length || rankings.some((item) => !eligibleIds.has(item.blindId))) {
    return jsonResponse({ error: "The application list changed. Refresh the page and rank the current list." }, 409);
  }

  const updatedAt = new Date().toISOString();
  const statements = [
    env.TA_APPLICATIONS_DB.prepare("DELETE FROM blind_rankings WHERE reviewer_key = ?").bind(reviewerKey),
    ...rankings.map((item) => env.TA_APPLICATIONS_DB.prepare(
      "INSERT INTO blind_rankings (reviewer_key, reviewer_label, blind_id, rank, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(reviewerKey, reviewerLabel, item.blindId, item.rank, updatedAt))
  ];
  await env.TA_APPLICATIONS_DB.batch(statements);
  return jsonResponse({ ok: true, saved: rankings.length, updatedAt }, 200);
}

async function handleReviewRequest(request, env, url) {
  if (url.protocol !== "https:" || !PRODUCTION_HOSTS.has(url.hostname)) {
    return jsonResponse({ error: "Review pages work on the live site only." }, 403);
  }
  const scope = await reviewScope(request, url);
  if (!scope) return jsonResponse({ error: "This private review link is invalid." }, 401);

  if (url.pathname === "/api/review/full") {
    if (request.method !== "GET") return jsonResponse({ error: "Use the review page to view applications." }, 405);
    if (scope !== "owner" && !scope.startsWith("ta:")) return jsonResponse({ error: "This link does not open the full review page." }, 403);
    try {
      return await handleFullReview(env, scope);
    } catch (error) {
      console.error("Could not load TA applications for review.", error);
      return jsonResponse({ error: "Applications could not be loaded right now." }, 500);
    }
  }
  if (url.pathname === "/api/review/blind") {
    if (request.method !== "GET") return jsonResponse({ error: "Use the blind review page to view applications." }, 405);
    if (!scope.startsWith("blind:")) return jsonResponse({ error: "This link does not open the blind review page." }, 403);
    try {
      return await handleBlindReview(env, scope.slice("blind:".length));
    } catch (error) {
      console.error("Could not load blind TA application responses.", error);
      return jsonResponse({ error: "Responses could not be loaded right now." }, 500);
    }
  }
  if (url.pathname === "/api/review/blind/rankings") {
    if (request.method !== "POST") return jsonResponse({ error: "Use the blind review page to save rankings." }, 405);
    if (!scope.startsWith("blind:")) return jsonResponse({ error: "This link cannot save blind rankings." }, 403);
    try {
      return await handleBlindRanking(request, env, scope.slice("blind:".length));
    } catch (error) {
      console.error("Could not save blind TA application rankings.", error);
      return jsonResponse({ error: "Rankings could not be saved right now." }, 500);
    }
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
