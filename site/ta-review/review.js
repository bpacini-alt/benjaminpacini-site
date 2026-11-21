// Shared script for the four TA review pages. Each page's <body> says
// which page it is (data-page) and which password it needs (data-role).
"use strict";

const page = document.body.dataset.page;
const needs = document.body.dataset.role; // "owner" or "ta"
const storageKey = "ta-review-password-" + needs;

const CRITERIA = [
  ["vibe", "Can they bring the vibe?"],
  ["innovation", "Can they be innovative?"],
  ["managingUp", "Can they manage up?"],
  ["dedication", "Will they work hard and be dedicated?"],
  ["content", "Do they know and love the content?"]
];
const LEVELS = [[1, "Not yet"], [2, "Somewhat"], [3, "Yes"], [4, "Absolutely"]];
const QUESTION_LABELS = {
  courseMagic: "Three magical things to preserve, and the highest-priority change",
  managingUp: "Managing up",
  holyGhostAction: "High-leverage action for Holy Ghost–inspired learning",
  whyThisJob: "Why this job",
  uniqueContribution: "What this applicant would uniquely bring or build"
};
const SLIDER_LABELS = {
  vibe: "Class vibe", technology: "Technology", mentorship: "Student mentorship", content: "Course knowledge",
  assertiveness: "Assertiveness", grading: "Reliable grading", innovation: "Innovation", initiative: "Proactive initiative"
};
const RESPONSIBILITY_LABELS = {
  grade: "Grade student work using the rubric", "dress-code": "Talk with a student about a dress-code violation",
  "personal-life": "Monitor students’ personal lives outside class", integrity: "Deal with academic-integrity issues",
  "canvas-bugs": "Fix bugs in Canvas", "call-it": "Call IT if the classroom computer is broken",
  "weekend-zoom": "Answer Zoom messages on a weekend", "refer-support": "Refer a student to the dean of students or Title IX",
  "diagnose-disability": "Diagnose a student with a disability", "modify-assignment": "Modify a major assignment",
  "grade-exception": "Make an exception to a student’s grade", "correct-ta": "Correct a TA’s behavior or performance",
  "redirect-student": "Address a student leaving early, using a phone, or distracting others",
  "practical-jokes": "Play practical jokes", "change-memes": "Change memes",
  "financial-support": "Provide financial support to a student", "interview-tas": "Interview TAs",
  "promise-grade": "Promise a certain grade to a student"
};
const ROLE_LABELS = { ta: "TA job", "brother-pacini": "BroPa’s job", "no-one": "No one’s job" };

// ---------- small helpers ----------
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}
function store(action, value) {
  try {
    if (action === "get") return localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
    if (action === "set") { localStorage.setItem(storageKey, value); return value; }
    localStorage.removeItem(storageKey); sessionStorage.removeItem(storageKey);
  } catch (error) {
    // Storage can be blocked; the password then lasts only while the page is open.
  }
  return null;
}
let password = store("get");
function show(id, on) { document.getElementById(id).hidden = !on; }
function fail(message) {
  show("loading", false);
  const box = document.getElementById("error");
  box.textContent = message;
  box.hidden = false;
}
async function api(path, options) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
    headers: { "X-Review-Password": password || "", ...((options && options.headers) || {}) }
  });
  let data = {};
  try { data = await response.json(); } catch (error) { /* not JSON */ }
  if (!response.ok) {
    const problem = new Error(data.error || "Something went wrong. Try again in a minute.");
    problem.status = response.status;
    throw problem;
  }
  return data;
}
function candidateLabel(code) { return code ? "Candidate " + code : "Not a candidate (no course chosen)"; }
function slug(code) { return code ? code.toLowerCase() : ""; }
function courseList(courses, otherCourse) {
  const list = (courses || []).map((course) => course === "OTHER" ? "Other" + (otherCourse ? ": " + otherCourse : "") : course);
  return list.length ? list.join(", ") : "No course";
}

// Text with clickable links. Built from text nodes, so answers can't inject HTML.
function linkedText(className, value) {
  const node = el("p", className);
  const text = value === undefined || value === null || value === "" ? "—" : String(value);
  const pattern = /https?:\/\/[^\s<>"]+/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const url = match[0].replace(/[.,;:!?)\]]+$/, "");
    node.append(text.slice(last, match.index));
    const link = el("a", "", url);
    link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
    node.append(link);
    last = match.index + url.length;
  }
  node.append(text.slice(last));
  return node;
}
function addField(parent, label, value) {
  const block = el("div", "answer-item");
  block.append(el("p", "answer-label", label), linkedText("answer-text", value));
  parent.append(block);
}
function addSection(parent, title) {
  const section = el("section", "answer-section");
  section.append(el("h3", "", title));
  parent.append(section);
  return section;
}

// ---------- password gate ----------
function askForPassword(message) {
  show("loading", false);
  show("content", false);
  document.getElementById("error").hidden = true;
  const gate = document.getElementById("gate");
  gate.hidden = false;
  document.getElementById("gate-message").textContent = message || "";
  document.getElementById("gate-message").hidden = !message;
  document.getElementById("password").focus();
}
document.getElementById("gate").addEventListener("submit", (event) => {
  event.preventDefault();
  const typed = document.getElementById("password").value.trim();
  if (!typed) return;
  password = typed;
  if (document.getElementById("remember").checked) store("set", typed);
  else try { sessionStorage.setItem(storageKey, typed); } catch (error) { /* ignore */ }
  document.getElementById("gate").hidden = true;
  show("loading", true);
  start();
});
document.getElementById("forget").addEventListener("click", () => {
  store("clear");
  password = null;
  document.getElementById("password").value = "";
  askForPassword("Password forgotten on this device.");
});

async function start() {
  if (!password) return askForPassword();
  try {
    await PAGES[page]();
    show("loading", false);
    show("content", true);
    document.getElementById("forget").hidden = false;
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      store("clear");
      password = null;
      return askForPassword(error.message);
    }
    fail(error.message);
  }
}

// ---------- application pages (owner and TA) ----------
function renderApplication(card, item, isOwner) {
  card.replaceChildren();
  const data = item.answers || {};
  const applicant = data.applicant || {};
  const title = isOwner ? (item.name || "No name") + " · " + candidateLabel(item.code) : candidateLabel(item.code);
  card.append(el("h2", "app-name", title));
  card.append(el("p", "meta", isOwner
    ? (item.email || "No email") + " · " + courseList(applicant.courseSelections, applicant.otherCourse) + " · Submitted " + new Date(item.submittedAt).toLocaleString()
    : "Applied for: " + courseList(applicant.courseSelections, applicant.otherCourse)));
  if (isOwner) {
    const basics = addSection(card, "Application details");
    addField(basics, "Shared with TA reviewers", data.acknowledgments && data.acknowledgments.shareWithReviewers === true ? "Yes" : "No");
  }
  const ratings = data.ratings || {};
  const sliders = addSection(card, "Self-assessment sliders");
  Object.keys(SLIDER_LABELS).forEach((key) => addField(sliders, SLIDER_LABELS[key], ratings[key] === undefined ? "—" : ratings[key] + " / 10"));
  addField(sliders, "Slider context", data.sliderContext);
  const jobs = addSection(card, "Whose job is this?");
  const answers = data.responsibilities || {};
  Object.keys(answers).forEach((key) => addField(jobs, RESPONSIBILITY_LABELS[key] || key, ROLE_LABELS[answers[key]] || answers[key]));
  addField(jobs, "Additional context", data.responsibilityContext);
  const questions = addSection(card, "Common questions");
  Object.keys(QUESTION_LABELS).forEach((key) => addField(questions, QUESTION_LABELS[key], data.questions && data.questions[key]));
  const samples = addSection(card, "Work samples");
  (Array.isArray(data.workSamples) ? data.workSamples : []).forEach((sample) => {
    const block = el("div", "sample");
    block.append(el("p", "sample-title", sample.title || sample.id || "Work sample"), linkedText("answer-text", sample.response));
    if (sample.aiUse) addField(block, "AI or other tools", sample.aiUse);
    samples.append(block);
  });
  const reflection = data.reflection || {};
  const last = addSection(card, "Final reflection");
  addField(last, "Time spent (applicant estimate)", reflection.timeSpentMinutes ? reflection.timeSpentMinutes + " minutes" : "—");
  if (isOwner && data.timing && Number.isInteger(data.timing.activeSeconds)) {
    addField(last, "Tracked active time", Math.floor(data.timing.activeSeconds / 60) + " min " + data.timing.activeSeconds % 60 + " sec");
  }
  addField(last, "What they will carry forward", reflection.answer);
  addField(last, "Interested in other opportunities", reflection.otherOpportunities ? "Yes" : "No");
}

async function applicationPage(view) {
  const data = await api("/api/review/applications" + (view ? "?view=" + view : ""));
  const isOwner = data.role === "owner";
  const list = data.applications || [];
  if (!list.length) throw new Error(isOwner ? "There are no applications yet." : "No candidates have agreed to TA review yet.");
  const picker = document.getElementById("picker");
  const card = document.getElementById("application-card");
  picker.replaceChildren(...list.map((item, index) => {
    const option = el("option", "", isOwner ? candidateLabel(item.code) + " — " + (item.name || "No name") : candidateLabel(item.code));
    option.value = String(index);
    return option;
  }));
  let current = 0;
  const wanted = decodeURIComponent(location.hash.slice(1)).toLowerCase();
  if (wanted) current = Math.max(0, list.findIndex((item) => slug(item.code) === wanted));
  const go = (index, scroll) => {
    current = index;
    picker.value = String(index);
    renderApplication(card, list[index], isOwner);
    document.getElementById("previous").disabled = index === 0;
    document.getElementById("next").disabled = index === list.length - 1;
    document.getElementById("counter").textContent = (index + 1) + " of " + list.length;
    if (list[index].code) history.replaceState(null, "", "#" + slug(list[index].code));
    if (scroll) window.scrollTo(0, 0);
  };
  picker.addEventListener("change", () => go(Number(picker.value), true));
  document.getElementById("previous").addEventListener("click", () => current > 0 && go(current - 1, true));
  document.getElementById("next").addEventListener("click", () => current < list.length - 1 && go(current + 1, true));
  go(current, false);
}

// ---------- rating page ----------
const raterKey = "ta-review-rater";
async function ratePage() {
  const nameBox = document.getElementById("rater");
  try { nameBox.value = nameBox.value || localStorage.getItem(raterKey) || ""; } catch (error) { /* ignore */ }
  const form = document.getElementById("rater-form");
  const begin = async () => {
    const rater = nameBox.value.trim().replace(/\s+/g, " ");
    if (!rater) { nameBox.focus(); return; }
    try { localStorage.setItem(raterKey, rater); } catch (error) { /* ignore */ }
    const data = await api("/api/review/ratings?rater=" + encodeURIComponent(rater));
    renderRatings(rater, data);
  };
  form.onsubmit = (event) => { event.preventDefault(); begin().catch((error) => fail(error.message)); };
  if (nameBox.value) await begin();
}

function renderRatings(rater, data) {
  const holder = document.getElementById("ratings");
  holder.replaceChildren();
  const progress = document.getElementById("progress");
  const saved = data.ratings || {};
  const updateProgress = () => {
    const done = data.candidates.filter((item) => CRITERIA.every(([key]) => saved[item.code] && saved[item.code][key])).length;
    progress.textContent = "Rating as " + rater + ". " + done + " of " + data.candidates.length + " candidates fully rated. Every choice saves as you click it.";
  };
  data.candidates.forEach((item) => {
    const card = el("article", "panel rate-card");
    card.id = slug(item.code);
    const head = el("div", "rate-head");
    head.append(el("h2", "", candidateLabel(item.code)));
    const link = el("a", "", "Read their application ↗");
    link.href = "/ta-review/ta/#" + slug(item.code);
    link.target = "_blank"; link.rel = "noopener";
    const meta = el("p", "meta");
    meta.append("Applied for: " + courseList(item.courses) + " · ", link);
    meta.style.margin = "0";
    head.append(meta);
    card.append(head);
    const status = el("p", "status");
    status.setAttribute("role", "status");
    CRITERIA.forEach(([key, label]) => {
      const row = el("div", "criterion");
      const labelId = "label-" + slug(item.code) + "-" + key;
      const text = el("span", "criterion-label", label);
      text.id = labelId;
      const levels = el("div", "levels");
      levels.setAttribute("role", "radiogroup");
      levels.setAttribute("aria-labelledby", labelId);
      const paint = () => levels.querySelectorAll("button").forEach((button) =>
        button.setAttribute("aria-checked", String(Number(button.dataset.level) === (saved[item.code] || {})[key])));
      LEVELS.forEach(([level, name]) => {
        const button = el("button");
        button.type = "button";
        button.setAttribute("role", "radio");
        button.dataset.level = String(level);
        button.append(el("b", "", level), name);
        button.addEventListener("click", async () => {
          const before = (saved[item.code] || {})[key];
          const next = before === level ? null : level; // click again to clear
          saved[item.code] = saved[item.code] || {};
          if (next === null) delete saved[item.code][key]; else saved[item.code][key] = next;
          paint();
          status.className = "status";
          status.textContent = "Saving…";
          try {
            await api("/api/review/ratings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rater, code: item.code, criterion: key, level: next })
            });
            status.className = "status saved";
            status.textContent = "Saved.";
          } catch (error) {
            if (before === undefined) delete saved[item.code][key]; else saved[item.code][key] = before;
            paint();
            status.className = "status fail";
            status.textContent = "Not saved: " + error.message;
          }
          updateProgress();
        });
        levels.append(button);
      });
      paint();
      row.append(text, levels);
      card.append(row);
    });
    card.append(status);
    holder.append(card);
  });
  updateProgress();
  document.getElementById("rating-area").hidden = false;
  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)).toLowerCase());
    if (target) target.scrollIntoView();
  }
}

// ---------- summary page ----------
function mean(values) {
  const list = values.filter((value) => Number.isInteger(value));
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
}
function fmt(value) { return value === null ? "—" : value.toFixed(2); }

async function summaryPage() {
  const data = await api("/api/review/summary");
  const rows = data.candidates.map((item) => {
    const byCriterion = Object.fromEntries(CRITERIA.map(([key]) => [key, mean(item.ratings.map((r) => r.scores[key]))]));
    const averages = Object.values(byCriterion).filter((value) => value !== null);
    return { ...item, byCriterion, overall: averages.length ? averages.reduce((a, b) => a + b, 0) / averages.length : null };
  });
  let sortKey = "code";
  let direction = 1;
  const body = document.getElementById("summary-body");
  const draw = () => {
    const value = (row) => sortKey === "code" || sortKey === "name" ? row[sortKey] : sortKey === "overall" ? row.overall : sortKey === "raters" ? row.ratings.length : row.byCriterion[sortKey];
    const sorted = rows.slice().sort((a, b) => {
      const x = value(a), y = value(b);
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * direction;
    });
    body.replaceChildren();
    sorted.forEach((row) => {
      const tr = el("tr");
      const first = el("th");
      first.scope = "row";
      const link = el("a", "", row.code);
      link.href = "/ta-review/#" + slug(row.code);
      first.append(link);
      const toggle = el("button", "linkish", row.ratings.length ? "show" : "");
      toggle.type = "button";
      tr.append(first, el("td", "", row.name + (row.sharedWithTAs ? "" : " (not shared with TAs)")), el("td", "", courseList(row.courses)), el("td", "n", row.ratings.length));
      CRITERIA.forEach(([key]) => tr.append(el("td", "n", fmt(row.byCriterion[key]))));
      tr.append(el("td", "n", fmt(row.overall)));
      const last = el("td");
      if (row.ratings.length) last.append(toggle);
      tr.append(last);
      body.append(tr);
      if (row.ratings.length) {
        const detail = el("tr");
        detail.hidden = true;
        const cell = el("td", "detail");
        cell.colSpan = 6 + CRITERIA.length;
        const table = el("table", "detail");
        const head = el("tr");
        head.append(el("th", "", "Rater"), ...CRITERIA.map(([, label]) => el("th", "n", label.replace(/\?$/, ""))));
        table.append(head);
        row.ratings.forEach((r) => {
          const line = el("tr");
          line.append(el("td", "", r.rater), ...CRITERIA.map(([key]) => el("td", "n", r.scores[key] || "—")));
          table.append(line);
        });
        cell.append(table);
        detail.append(cell);
        body.append(detail);
        toggle.addEventListener("click", () => {
          detail.hidden = !detail.hidden;
          toggle.textContent = detail.hidden ? "show" : "hide";
        });
      }
    });
  };
  document.querySelectorAll("[data-sort]").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.sort;
    direction = key === sortKey ? -direction : (key === "code" || key === "name" ? 1 : -1);
    sortKey = key;
    draw();
  }));
  draw();
  const raters = new Set(rows.flatMap((row) => row.ratings.map((r) => r.rater.toLowerCase())));
  document.getElementById("summary-note").textContent = rows.length + " candidates, " + raters.size + " rater" + (raters.size === 1 ? "" : "s") + " so far. Scores run 1 (not yet) to 4 (absolutely). Overall is the mean of the five criterion averages. Click a column to sort.";
}

const PAGES = {
  "owner-review": () => applicationPage("owner"),
  "ta-review": () => applicationPage("ta"),
  rate: ratePage,
  summary: summaryPage
};
start();
