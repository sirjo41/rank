# Quick Start Guide

## Running the Application

You need to run TWO commands in TWO separate terminals:

### Terminal 1 - Backend Server
```bash
npm run server
```
This starts the Express API server on `http://localhost:3001`

### Terminal 2 - Frontend Application
```bash
npm run dev
```
This starts the React frontend on `http://localhost:5173`

## First Time Setup

1. Make sure both servers are running (see above)
2. Open `http://localhost:5173` in your browser
3. Add at least 4 teams in the "Teams" tab
4. Go to "Matches" tab and click "Generate Schedule"
5. Enter scores for matches and submit them
6. Check "Rankings" tab to see live standings

## Key Features

- **Teams Tab**: Add teams one by one using the form
- **Matches Tab**: Generate schedule and enter scores
- **Rankings Tab**: Auto-updates every 3 seconds to show current standings

## Troubleshooting

**Problem**: Frontend can't connect to backend
- **Solution**: Make sure `npm run server` is running in a separate terminal

**Problem**: Database errors
- **Solution**: Check that your `.env` file has valid Supabase credentials

**Problem**: "Need at least 4 teams" error
- **Solution**: Add more teams in the Teams tab before generating a schedule

## Match Format

Each match is a 2v2 format:
- **Alliance 1** (Blue): Team 1 + Team 2
- **Alliance 2** (Red): Team 3 + Team 4
- Enter final scores for each alliance
- System automatically calculates ranking points

## Ranking Points

- Win: 3 RP
- Draw: 1 RP
- Loss: 0 RP
- Final ranking = Average RP per match
