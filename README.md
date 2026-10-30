# Word Atlas
**Every word, beautifully mapped.** Word Atlas is a full-stack dictionary with an editorial interface: definitions, pronunciation, origins, quotations and an interactive map of the meaning around every word.

## Features

### Explore
- **Command palette** (`⌘K` / `Ctrl K`, or `/`) with live suggestions, recent and saved words, and quick actions
- **Hero search** with keyboard-navigable suggestions
- **Word of the Day** and curated collections on the home page

### Every entry
- Full sense list with grammar and usage labels, usage notes and example sentences (the headword is highlighted)
- Part-of-speech tabs for words like *run* (verb / noun)
- Syllable breaks, source IPA and persistent Google Chirp 3 HD Iapetus recordings, with explicit readiness and unavailable states
- **Origin**: source etymology, with optional Merriam-Webster Collegiate enrichment
- **In the wild**: quotations from published writing
- **At a glance**: a commonness rating based on corpus frequency
- Thesaurus (synonyms and antonyms), inflections, a filterable phrase list, and rhymes
- **The atlas**: an interactive semantic map. Closest, related and associated words orbit the headword; hover to trace a path, click to travel, and toggle each ring

### Personal library
- Save words (`S`), browse your history, filter and sort, and export to CSV
- Owner login, PostgreSQL synchronization across devices, and safe import of existing browser records

### Polish
- Light, dark and system themes, with no flash on load
- Responsive from 320px up, with reduced-motion support, skip links and ARIA comboboxes
- Keyboard shortcuts: `P` to listen, `S` to save, `⌘K` to search

## Tech Stack

The agreed [Word Atlas architecture plan](tasks/plan.md) and [implementation checklist](tasks/todo.md) describe the expanded English dictionary, VPS PostgreSQL persistence, and cached Google Iapetus pronunciation. See the [acceptance report](docs/acceptance-report.md) for deployed coverage, measurements and operational limits.

### Frontend
- React
- Vite
- React Router
- Tailwind CSS v4
- Motion (animation)
- Lucide icons

### Backend
- Node.js
- Express
- PostgreSQL 17 for the open dictionary, personal records, sessions and audio jobs
- One bounded audio worker, with immutable MP3 files on the VPS

### External APIs
- Kaikki/Wiktextract English Wiktionary export (persistent open dictionary and local suggestions)
- Merriam-Webster Learner's and Collegiate (optional live definitions and editorial enrichment; no persistent proprietary snapshots)
- Datamuse (optional thesaurus, related words, frequency and rhymes through a quota-controlled backend)
- Google Text-to-Speech (Iapetus, normal rate, verified free allowance only)

## Project Structure
```
word-atlas
├── backend
│   └── src
│       ├── controllers
│       ├── routes
│       ├── services
│       └── utils
└── frontend
    └── src
        ├── app
        ├── assets
        ├── components
        ├── features
        └── pages
```

## How It Works
The frontend handles the user interface and search flow.

Typing searches indexed local headwords and forms without creating history or audio jobs. Submitted searches resolve exact words, expressions and source-supplied form links in PostgreSQL. Ambiguous forms remain explicit choices. Optional providers cannot block a local result; a local miss may use the complete Learner's/Collegiate adapters.

After owner login, saves and submitted searches synchronize with stable operation IDs. Migration retains the original browser keys and imports identities/timestamps only. Opening a selected pronunciation reuses a saved recording or queues one permitted synthesis. Concurrent requests share one job; uncertain outcomes are held without automatic retries.

## Main User Flow
1. User types a word in the search field.
2. The app shows suggestions.
3. User submits a word or clicks a suggestion.
4. The app opens the word detail page.
5. The backend resolves the persistent open dictionary, with optional editorial fallback.
6. The frontend displays definitions, examples, audio, forms and phrases.
7. If no result is found, the app shows a not found page with suggestions when available.

## Installation
1. Clone the repository

```bash
git clone https://github.com/Ammar-Hadid/word-atlas.git
cd word-atlas
```

2. Install backend dependencies

```bash
cd backend
npm ci --ignore-scripts
```

3. Install frontend dependencies

```bash
cd ../frontend
npm ci --ignore-scripts
```

## Environment Variables

### Backend
Create a `.env` file inside the backend folder.

```
PORT=4000
APP_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://word_atlas:password@localhost:5432/word_atlas
SESSION_SECRET=replace_with_at_least_32_random_characters
AUDIO_DIR=/absolute/path/to/persistent/audio
AUDIO_SYNTHESIS_ENABLED=false
MERRIAM_WEBSTER_LEARNERS=your_learners_key
MERRIAM_WEBSTER_DICTIONARY=your_collegiate_key
```

### Frontend
Create a `.env` file inside the frontend folder.

```
VITE_API_URL=/api
```

## Running the Project
Apply migrations to the dedicated database, import a validated source release, and provision the owner with `OWNER_PASSWORD` supplied privately to `node scripts/create-owner.js`. The complete VPS setup and rollback instructions are in [deployment](docs/operations/deployment.md). Production secrets never belong in Git or frontend variables.

Start the backend

```bash
cd backend
npm run dev
```

Start the frontend

```bash
cd frontend
npm run dev
```

The frontend will run on:

```
http://localhost:5173
```

The backend will run on:

```
http://localhost:4000
```

Vite proxies `/api` and `/audio` to port 4000. Set `VITE_DEV_API_TARGET=http://127.0.0.1:14010` when using the authorized VPS staging tunnel. Production uses same-origin Caddy routes. Run the worker separately with `npm run worker`; leave synthesis disabled without a current [verified free allocation](docs/operations/free-allowance.md).

Verification: `cd backend && node --env-file=.env.test --test && npm run lint` uses an isolated PostgreSQL test database; `cd frontend && node --test test/*.test.js && npm run lint && npm run build`. Tests do not call paid synthesis or external dictionaries.

## Important Backend Logic
The backend does more than just forward API data.

It also:

- filters unrelated Merriam-Webster entries
- resolves indexed suggestions, forms and ambiguous source links
- persists pronunciation identity, allowance reservations and recordings
- cleans Merriam-Webster markup
- normalizes definitions, examples, forms and phrases

This makes the frontend easier to work with and prevents confusing results for the user.

## Known Limitations
- Unsupported or ambiguous phonemes are withheld; another voice is never substituted
- New synthesis stops when the verified free allocation expires or is exhausted; cached recordings keep working
- Open-source coverage and editorial quality vary; source quotations/media with uncertain rights are excluded
- Datamuse associations are statistical, so the outer ring of the map can be loose
- Mobile verification uses Chrome viewport emulation; physical-phone and audio-output latency are not claimed
- The encrypted offsite backup is copied to the owner's Mac when reachable; it cannot guarantee a continuous 24-hour offsite recovery point

## Author
Built by Ammar Hadid.
