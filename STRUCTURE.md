# Complete Folder Structure

```
robotics-competition-manager/
│
├── server/
│   └── index.js                    # Express API server with all routes
│
├── src/
│   ├── components/
│   │   ├── TeamManagement.tsx      # Team addition and listing component
│   │   ├── MatchSchedule.tsx       # Match generation and scoring component
│   │   └── Rankings.tsx            # Live rankings display component
│   │
│   ├── App.tsx                     # Main application with tab navigation
│   ├── main.tsx                    # React entry point
│   ├── index.css                   # Global styles (Tailwind)
│   └── vite-env.d.ts              # Vite type definitions
│
├── public/                         # Static assets
│
├── dist/                           # Production build output (generated)
│
├── node_modules/                   # Dependencies (generated)
│
├── .env                            # Environment variables (Supabase credentials)
├── .gitignore                      # Git ignore rules
├── Dockerfile                      # Docker container configuration
├── docker-compose.yml              # Docker Compose setup
├── eslint.config.js                # ESLint configuration
├── index.html                      # HTML entry point
├── package.json                    # NPM dependencies and scripts
├── package-lock.json               # NPM lock file
├── postcss.config.js               # PostCSS configuration
├── tailwind.config.js              # Tailwind CSS configuration
├── tsconfig.json                   # TypeScript configuration (root)
├── tsconfig.app.json               # TypeScript configuration (app)
├── tsconfig.node.json              # TypeScript configuration (node)
├── vite.config.ts                  # Vite configuration
├── README.md                       # Complete documentation
├── QUICKSTART.md                   # Quick start guide
└── STRUCTURE.md                    # This file - folder structure overview
```

## Key Files Explained

### Backend (server/)
- **index.js**: Express server with 6 API routes
  - POST /teams - Add team
  - GET /teams - List teams
  - POST /generate-schedule - Generate matches
  - GET /matches - List matches with team details
  - POST /matches/:id/score - Update match score
  - GET /rankings - Calculate rankings

### Frontend (src/)
- **App.tsx**: Main component with tab-based navigation
- **TeamManagement.tsx**: Form to add teams, table to display them
- **MatchSchedule.tsx**: Button to generate schedule, table with score inputs
- **Rankings.tsx**: Auto-updating table showing team standings

### Database (Supabase)
- **teams table**: Stores team information
- **matches table**: Stores match data with scores and team references

### Configuration Files
- **package.json**: Contains all dependencies and npm scripts
- **vite.config.ts**: Vite bundler configuration
- **tailwind.config.js**: Tailwind CSS settings
- **tsconfig.json**: TypeScript compiler options
- **Dockerfile & docker-compose.yml**: Docker deployment setup

## Database Migration
The database schema is automatically created in Supabase through the migration system with proper RLS policies for public access.
