# benjaminpacini.com

Source for Benjamin Pacini's website.

- `site/` is the website. Cloudflare serves this folder at benjaminpacini.com (see `wrangler.jsonc`).
  - `site/index.html` is the landing page: a card for each textbook, a "Course resources" list, then a short "More from me" list.
  - `site/assets/` holds the headshot and the two cover thumbnails.
  - `site/edcor200/` is the EDCOR 200 course page (benjaminpacini.com/edcor200/). Each activity gets its own folder under it, such as `danielson/` for the Teaching Practice Sort & Match Lab. To add one, make a new folder with an `index.html` and add a card to `site/edcor200/index.html`.
- `site/ta-application/` is the TA application form (https://benjaminpacini.com/ta-application/). Submissions go to the `TA_APPLICATIONS_DB` database through `src/index.js`.
- `site/ta-review/` holds three password-protected review pages that share `review.js` and `review.css`:
  - https://benjaminpacini.com/ta-review/ full applications with names (Benjamin's password)
  - https://benjaminpacini.com/ta-review/summary/ names, candidate names and everyone's ratings (Benjamin's password)
  - https://benjaminpacini.com/ta-review/ta/ applications with names, emails and dates removed, with each rater's ratings at the bottom of every candidate (five questions 1–4, plus an overall vibe from hard no to definite yes) (TA password or Benjamin's). The old `/ta-review/rate/` address forwards here.
  The two passwords are Cloudflare secrets, `OWNER_REVIEW_PASSWORD` and `TA_REVIEW_PASSWORD`, and are never stored in this repository. Each real applicant gets a permanent random tree name ("Candidate Aspen"), and every page lists candidates alphabetically by it.
- `archive/` holds the original Google Site, preserved before the migration. It is never published.

The textbooks live in their own repositories and on their own subdomains:

- EDCOR 310, *The Science of Learning*: `bpacini-alt/edcor-310-textbook`, learning.benjaminpacini.com
- Econ 150, *Principles of Microeconomics*: `bpacini-alt/Econ-150-textbook`, econ.benjaminpacini.com

The cover thumbnails are smaller copies of each book's `build/cover-web.png`. If a cover changes, regenerate the thumbnail here too.

The photo is Benjamin's Mistborn portrait, shown whole at 4:5.
