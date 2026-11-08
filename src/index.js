const MAX_BODY_BYTES = 65536;
const PRODUCTION_HOSTS = new Set(["benjaminpacini.com", "www.benjaminpacini.com"]);
const REQUIRED_ACKNOWLEDGMENTS = ["grade", "schedule", "attendanceHours", "relationship"];
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
      !hasText(applicant.course, 120)) {
    return "Please check your name, email address, and class.";
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

  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
          if (!PRODUCTION_HOSTS.has(new URL(origin).hostname)) {
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
          "INSERT INTO applications (id, submitted_at, name, email, course, answers_json) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(
          crypto.randomUUID(),
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
