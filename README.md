# benjaminpacini.com

Source for Benjamin Pacini's website.

- `site/` is the website. Cloudflare serves this folder at benjaminpacini.com (see `wrangler.jsonc`).
  - `site/index.html` is the landing page: a card for each textbook, then a short "More from me" list.
  - `site/assets/` holds the headshot and the two cover thumbnails.
- `archive/` holds the original Google Site, preserved before the migration. It is never published.

The textbooks live in their own repositories and on their own subdomains:

- EDCOR 310, *The Science of Learning*: `bpacini-alt/edcor-310-textbook`, learning.benjaminpacini.com
- Econ 150, *Principles of Microeconomics*: `bpacini-alt/Econ-150-textbook`, econ.benjaminpacini.com

The cover thumbnails are smaller copies of each book's `build/cover-web.png`. If a cover changes, regenerate the thumbnail here too.

The photo is Benjamin's Mistborn portrait, shown whole at 4:5.
