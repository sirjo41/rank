import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 3001;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());

app.post('/teams', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const { data, error } = await supabase
      .from('teams')
      .insert([{ name }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/teams', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name');

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/generate-schedule', async (req, res) => {
  try {
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id');

    if (teamsError) throw teamsError;

    if (teams.length < 4) {
      return res.status(400).json({ error: 'Need at least 4 teams to generate schedule' });
    }

    const matches = [];
    const teamIds = teams.map(t => t.id);
    const usedPairings = new Set();

    const generateMatch = () => {
      const shuffled = [...teamIds].sort(() => Math.random() - 0.5);
      return {
        team1_id: shuffled[0],
        team2_id: shuffled[1],
        team3_id: shuffled[2],
        team4_id: shuffled[3]
      };
    };

    const getPairingKey = (match) => {
      const alliance1 = [match.team1_id, match.team2_id].sort().join('-');
      const alliance2 = [match.team3_id, match.team4_id].sort().join('-');
      return `${alliance1}:${alliance2}`;
    };

    const numMatches = Math.max(6, Math.floor(teams.length / 2) * 3);
    let attempts = 0;
    const maxAttempts = numMatches * 10;

    while (matches.length < numMatches && attempts < maxAttempts) {
      const match = generateMatch();
      const pairingKey = getPairingKey(match);

      if (!usedPairings.has(pairingKey)) {
        matches.push(match);
        usedPairings.add(pairingKey);
      }
      attempts++;
    }

    const { data: insertedMatches, error: matchesError } = await supabase
      .from('matches')
      .insert(matches)
      .select();

    if (matchesError) throw matchesError;

    res.json({ matches: insertedMatches, count: insertedMatches.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/matches/:id/score', async (req, res) => {
  try {
    const { id } = req.params;
    const { score1, score2 } = req.body;

    if (score1 === undefined || score2 === undefined) {
      return res.status(400).json({ error: 'Both score1 and score2 are required' });
    }

    const { data, error } = await supabase
      .from('matches')
      .update({ score1, score2 })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/matches', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        team1:teams!matches_team1_id_fkey(id, name),
        team2:teams!matches_team2_id_fkey(id, name),
        team3:teams!matches_team3_id_fkey(id, name),
        team4:teams!matches_team4_id_fkey(id, name)
      `)
      .order('created_at');

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/rankings', async (req, res) => {
  try {
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name');

    if (teamsError) throw teamsError;

    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .not('score1', 'is', null)
      .not('score2', 'is', null);

    if (matchesError) throw matchesError;

    const rankings = teams.map(team => {
      let totalRP = 0;
      let matchesPlayed = 0;

      matches.forEach(match => {
        const isAlliance1 = match.team1_id === team.id || match.team2_id === team.id;
        const isAlliance2 = match.team3_id === team.id || match.team4_id === team.id;

        if (isAlliance1 || isAlliance2) {
          matchesPlayed++;
          const score1 = match.score1;
          const score2 = match.score2;

          if (isAlliance1) {
            if (score1 > score2) totalRP += 3;
            else if (score1 === score2) totalRP += 1;
          } else if (isAlliance2) {
            if (score2 > score1) totalRP += 3;
            else if (score1 === score2) totalRP += 1;
          }
        }
      });

      return {
        team_id: team.id,
        team_name: team.name,
        matches_played: matchesPlayed,
        total_rp: totalRP,
        average_rp: matchesPlayed > 0 ? (totalRP / matchesPlayed).toFixed(2) : '0.00'
      };
    });

    rankings.sort((a, b) => parseFloat(b.average_rp) - parseFloat(a.average_rp));

    res.json(rankings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
