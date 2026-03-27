# Robotics Competition Manager

A full-stack web application for managing 2v2 robotics competitions similar to FTC (FIRST Tech Challenge).

## Features

- **Team Management**: Add and view teams
- **Match Scheduling**: Automatically generate randomized 2v2 matches
- **Score Entry**: Submit scores for each match
- **Live Rankings**: Real-time ranking calculations based on Ranking Points (RP)
  - Win: 3 RP
  - Draw: 1 RP
  - Loss: 0 RP
  - Rankings sorted by Average RP (Total RP / Matches Played)

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React

## Project Structure

```
.
├── server/
│   └── index.js           # Express API server
├── src/
│   ├── components/
│   │   ├── TeamManagement.tsx    # Team addition and listing
│   │   ├── MatchSchedule.tsx     # Match generation and scoring
│   │   └── Rankings.tsx          # Live rankings table
│   ├── App.tsx            # Main application component
│   ├── main.tsx           # React entry point
│   └── index.css          # Global styles
└── package.json           # Dependencies and scripts
```

## Database Schema

### Tables

**teams**
- `id` (uuid, primary key)
- `name` (text, unique)
- `created_at` (timestamptz)

**matches**
- `id` (uuid, primary key)
- `team1_id` (uuid, foreign key) - Alliance 1, Team 1
- `team2_id` (uuid, foreign key) - Alliance 1, Team 2
- `team3_id` (uuid, foreign key) - Alliance 2, Team 1
- `team4_id` (uuid, foreign key) - Alliance 2, Team 2
- `score1` (integer, nullable) - Alliance 1 score
- `score2` (integer, nullable) - Alliance 2 score
- `created_at` (timestamptz)

## API Routes

### Teams
- `POST /teams` - Add a new team
  - Body: `{ "name": "Team Name" }`
- `GET /teams` - List all teams

### Matches
- `POST /generate-schedule` - Generate randomized 2v2 matches
- `GET /matches` - List all matches with team details
- `POST /matches/:id/score` - Update match scores
  - Body: `{ "score1": 100, "score2": 95 }`

### Rankings
- `GET /rankings` - Calculate and return team rankings

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Supabase account and project

### Installation

1. Clone the repository

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - The `.env` file should already contain your Supabase credentials

### Running the Application

1. Start the backend server (in one terminal):
```bash
npm run server
```

2. Start the frontend development server (in another terminal):
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

### Running with Docker (Optional)

If you prefer to use Docker:

```bash
docker-compose up
```

This will start both the frontend and backend in a single container. Access the application at `http://localhost:5173`

## Usage Guide

1. **Add Teams**: Go to the "Teams" tab and add at least 4 teams
2. **Generate Schedule**: Navigate to the "Matches" tab and click "Generate Schedule"
3. **Enter Scores**: For each match, enter scores for both alliances and click "Submit"
4. **View Rankings**: Check the "Rankings" tab to see live standings

## Match Generation Algorithm

The schedule generator:
- Randomly assigns teams to 2v2 matches (Alliance 1 vs Alliance 2)
- Attempts to minimize repeated alliance pairings
- Generates approximately 6 matches or more based on team count
- Each alliance consists of 2 teams competing together

## Ranking System

- **Win**: Alliance with higher score gets 3 RP
- **Draw**: Both alliances get 1 RP each
- **Loss**: Alliance with lower score gets 0 RP
- **Ranking**: Teams are sorted by Average RP (Total RP ÷ Matches Played)

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Development

- `npm run dev` - Start frontend dev server
- `npm run server` - Start backend API server
- `npm run build` - Build for production
- `npm run lint` - Lint code
- `npm run typecheck` - Type check TypeScript

## License

MIT
