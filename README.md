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
- Syllable breaks, IPA and pronunciation audio, with a speech-synthesis fallback for words that have no recording
- **Origin**: etymology and first known use (Merriam-Webster Collegiate)
- **In the wild**: quotations from published writing
- **At a glance**: a commonness rating based on corpus frequency
- Thesaurus (synonyms and antonyms), inflections, a filterable phrase list, and rhymes
- **The atlas**: an interactive semantic map. Closest, related and associated words orbit the headword; hover to trace a path, click to travel, and toggle each ring

### Personal library
- Save words (`S`), browse your history, filter and sort, and export to CSV
- Stored locally on the device

### Polish
- Light, dark and system themes, with no flash on load
- Responsive from 320px up, with reduced-motion support, skip links and ARIA comboboxes
- Keyboard shortcuts: `P` to listen, `S` to save, `⌘K` to search

## Tech Stack

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
- In-memory TTL cache for dictionary responses

### External APIs
- Merriam-Webster Learner's Dictionary (definitions, audio, forms, phrases)
- Merriam-Webster Collegiate Dictionary (etymology, first known use, quotations)
- Datamuse (suggestions, thesaurus, related words, frequency, rhymes)

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

When a user types in the search field, the app fetches suggestions from the Datamuse API. When the user searches for a word, the frontend sends a request to the backend.

The backend calls the Merriam-Webster Learner's Dictionary API and receives the raw dictionary response. Because this response is complex, the backend normalizes the data before sending it back to the frontend.

This keeps the frontend cleaner and makes the word data easier to display.

## Main User Flow
1. User types a word in the search field.
2. The app shows suggestions.
3. User submits a word or clicks a suggestion.
4. The app opens the word detail page.
5. The backend fetches and normalizes Merriam-Webster data.
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
npm install
```

3. Install frontend dependencies

```bash
cd ../frontend
npm install
```

## Environment Variables

### Backend
Create a `.env` file inside the backend folder.

```
PORT=4000
CLIENT_URL=http://localhost:5173
MERRIAM_WEBSTER_LEARNERS=your_learners_key
MERRIAM_WEBSTER_DICTIONARY=your_collegiate_key
```

### Frontend
Create a `.env` file inside the frontend folder.

```
VITE_API_URL=http://localhost:4000/api
```

## Running the Project
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

## Important Backend Logic
The backend does more than just forward API data.

It also:

- filters unrelated Merriam-Webster entries
- validates suggestions before sending them to the frontend
- builds audio URLs
- cleans Merriam-Webster markup
- normalizes definitions, examples, forms and phrases

This makes the frontend easier to work with and prevents confusing results for the user.

## Known Limitations
- Not every word has a studio recording. These fall back to the browser's speech engine
- Datamuse associations are statistical, so the outer ring of the map can be loose
- The library is stored per device (no accounts yet)

## Author
Built by Ammar Hadid.