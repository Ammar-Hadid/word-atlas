# Word Atlas
Word Atlas is a full stack dictionary application built for quickly searching and understanding English words while consuming entertainment.

The app helps users search for a word, view clear definitions, see examples, hear pronunciation audio, and get useful word forms and phrases.

## Features
- Search for English words
- Live word suggestions using Datamuse
- Word detail page using Merriam-Webster Learner's Dictionary
- Definitions and example sentences
- Pronunciation audio when available
- Word forms such as plural or past tense forms
- Phrases connected to the searched word
- Offensive word label when Merriam-Webster marks a word as offensive
- Loading skeleton while word data is loading
- Not found page for unknown words
- Validated suggestions on the not found page

## Tech Stack

### Frontend
- React
- Vite
- React Router
- Tailwind CSS

### Backend
- Node.js
- Express
- Merriam-Webster Learner's Dictionary API

### External APIs
- Datamuse API
- Merriam-Webster Learner's Dictionary API

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
MERRIAM_WEBSTER_LEARNERS=your_api_key_here
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
- Not every word has pronunciation audio
- Some Datamuse suggestions may still not exist in Merriam-Webster
- The app currently only has a light theme
- The word detail page does not yet include images
- There are no fallback dictionary APIs yet

## Future Improvements
- Add dark mode
- Add fallback dictionary APIs
- Add images to help explain words visually
- Add local text to speech for words without audio
- Add synonyms and antonyms
- Add more detailed filtering for suggestions

## Author
Built by Ammar Hadid.