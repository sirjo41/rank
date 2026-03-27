import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'unibotics-competition-secret-2026';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());

// ─── Auth Middleware ───────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ─── Auth Routes ──────────────────────────────────────────────
app.post('/auth/setup', async (req, res) => {
  try {
    const { data: existing } = await supabase.from('users').select('id').limit(1);
    if (existing && existing.length > 0) {
      return res.json({ message: 'Users already configured' });
    }
    const adminHash = await bcrypt.hash('Admin@UniBoticsSiraj', 10);
    const judgeHash = await bcrypt.hash('Judge@Password', 10);
    await supabase.from('users').insert([
      { username: 'admin', password_hash: adminHash, role: 'admin' },
      { username: 'judge', password_hash: judgeHash, role: 'judge' }
    ]);
    res.json({
      message: 'Default users created',
      credentials: [
        { username: 'admin', password: 'Admin@UniBoticsSiraj', role: 'admin' },
        { username: 'judge', password: 'Judge@Password', role: 'judge' }
      ]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Teams ────────────────────────────────────────────────────
app.get('/teams', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('created_at');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/teams', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, team_number } = req.body;
    if (!name) return res.status(400).json({ error: 'Team name is required' });

    const { data, error } = await supabase
      .from('teams')
      .insert([{ name, team_number: team_number || null }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/teams/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Team deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Schedule Generation ──────────────────────────────────────
app.post('/generate-schedule', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { matchType = '2v2', matchCount = 6 } = req.body;
    const teamsNeeded = matchType === '1v1' ? 2 : 4;

    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id');
    if (teamsError) throw teamsError;

    if (teams.length < teamsNeeded) {
      return res.status(400).json({
        error: `Need at least ${teamsNeeded} teams for ${matchType} matches`
      });
    }

    // Get current max match number
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('match_number')
      .order('match_number', { ascending: false })
      .limit(1);

    let nextMatchNum = 1;
    if (existingMatches && existingMatches.length > 0) {
      nextMatchNum = existingMatches[0].match_number + 1;
    }

    const teamIds = teams.map(t => t.id);
    const matches = [];
    const usedPairings = new Set();

    const getPairingKey = (match) => {
      if (matchType === '1v1') {
        return [match.red_team1_id, match.blue_team1_id].sort().join(':');
      }
      const red = [match.red_team1_id, match.red_team2_id].sort().join('-');
      const blue = [match.blue_team1_id, match.blue_team2_id].sort().join('-');
      return `${red}|${blue}`;
    };

    let attempts = 0;
    const maxAttempts = matchCount * 50;

    while (matches.length < matchCount && attempts < maxAttempts) {
      const shuffled = [...teamIds].sort(() => Math.random() - 0.5);
      let match;

      if (matchType === '1v1') {
        match = {
          match_number: nextMatchNum + matches.length,
          match_type: '1v1',
          red_team1_id: shuffled[0],
          red_team2_id: null,
          blue_team1_id: shuffled[1],
          blue_team2_id: null
        };
      } else {
        match = {
          match_number: nextMatchNum + matches.length,
          match_type: '2v2',
          red_team1_id: shuffled[0],
          red_team2_id: shuffled[1],
          blue_team1_id: shuffled[2],
          blue_team2_id: shuffled[3]
        };
      }

      const key = getPairingKey(match);
      if (!usedPairings.has(key)) {
        matches.push(match);
        usedPairings.add(key);
      }
      attempts++;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('matches')
      .insert(matches)
      .select();
    if (insertError) throw insertError;

    res.json({ matches: inserted, count: inserted.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Matches ──────────────────────────────────────────────────
app.get('/matches', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        red_team1:teams!matches_red_team1_id_fkey(id, name, team_number),
        red_team2:teams!matches_red_team2_id_fkey(id, name, team_number),
        blue_team1:teams!matches_blue_team1_id_fkey(id, name, team_number),
        blue_team2:teams!matches_blue_team2_id_fkey(id, name, team_number)
      `)
      .order('match_number');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/matches', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Clear active match from settings first
    await supabase
      .from('competition_settings')
      .update({ active_match_id: null, timer_running: false, timer_started_at: null })
      .eq('id', 1);
    const { error } = await supabase
      .from('matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    res.json({ message: 'All matches deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/matches/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    // If this match is active, clear it from settings
    const { data: settings } = await supabase
      .from('competition_settings')
      .select('active_match_id')
      .eq('id', 1)
      .single();
    if (settings && settings.active_match_id === req.params.id) {
      await supabase
        .from('competition_settings')
        .update({ active_match_id: null, timer_running: false, timer_started_at: null })
        .eq('id', 1);
    }
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Match deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Score submission (judge or admin)
app.put('/matches/:id/score', authMiddleware, async (req, res) => {
  try {
    const {
      score_auto_red = 0, score_teleop_red = 0,
      fouls_minor_red = 0, fouls_major_red = 0,
      score_auto_blue = 0, score_teleop_blue = 0,
      fouls_minor_blue = 0, fouls_major_blue = 0
    } = req.body;

    const { data, error } = await supabase
      .from('matches')
      .update({
        score_auto_red, score_teleop_red,
        fouls_minor_red, fouls_major_red,
        score_auto_blue, score_teleop_blue,
        fouls_minor_blue, fouls_major_blue,
        status: 'judge_submitted'
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Status update (approve/reject/start)
app.put('/matches/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['scheduled', 'playing', 'judge_submitted', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData = { status };

    // If setting to playing, also update timer in settings
    if (status === 'playing') {
      await supabase
        .from('competition_settings')
        .update({
          active_match_id: req.params.id,
          timer_running: true,
          timer_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);
    }

    // If completed, stop timer
    if (status === 'completed') {
      await supabase
        .from('competition_settings')
        .update({
          timer_running: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);
    }

    const { data, error } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Competition Settings ─────────────────────────────────────
app.get('/settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('competition_settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/settings', authMiddleware, async (req, res) => {
  try {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from('competition_settings')
      .update(updates)
      .eq('id', 1)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Rankings ─────────────────────────────────────────────────
app.get('/rankings', async (req, res) => {
  try {
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, team_number');
    if (teamsError) throw teamsError;

    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'completed');
    if (matchesError) throw matchesError;

    const rankings = teams.map(team => {
      let totalRP = 0;
      let matchesPlayed = 0;
      let totalScore = 0;
      let totalAutoScore = 0;
      let totalTeleopScore = 0;
      let totalFoulsCommitted = 0;
      let wins = 0;
      let losses = 0;
      let ties = 0;

      matches.forEach(match => {
        const isRed = match.red_team1_id === team.id || match.red_team2_id === team.id;
        const isBlue = match.blue_team1_id === team.id || match.blue_team2_id === team.id;

        if (!isRed && !isBlue) return;
        matchesPlayed++;

        // Calculate total scores with foul penalties
        // Red total = red_auto + red_teleop + (blue_minor_fouls * 5) + (blue_major_fouls * 10)
        const totalRed = match.score_auto_red + match.score_teleop_red
          + (match.fouls_minor_blue * 5) + (match.fouls_major_blue * 10);
        const totalBlue = match.score_auto_blue + match.score_teleop_blue
          + (match.fouls_minor_red * 5) + (match.fouls_major_red * 10);

        if (isRed) {
          totalAutoScore += match.score_auto_red;
          totalTeleopScore += match.score_teleop_red;
          totalScore += totalRed;
          totalFoulsCommitted += match.fouls_minor_red + match.fouls_major_red;
          if (totalRed > totalBlue) { totalRP += 3; wins++; }
          else if (totalRed === totalBlue) { totalRP += 1; ties++; }
          else { losses++; }
        } else {
          totalAutoScore += match.score_auto_blue;
          totalTeleopScore += match.score_teleop_blue;
          totalScore += totalBlue;
          totalFoulsCommitted += match.fouls_minor_blue + match.fouls_major_blue;
          if (totalBlue > totalRed) { totalRP += 3; wins++; }
          else if (totalRed === totalBlue) { totalRP += 1; ties++; }
          else { losses++; }
        }
      });

      return {
        team_id: team.id,
        team_name: team.name,
        team_number: team.team_number,
        matches_played: matchesPlayed,
        wins, losses, ties,
        total_rp: totalRP,
        average_rp: matchesPlayed > 0 ? (totalRP / matchesPlayed).toFixed(2) : '0.00',
        total_score: totalScore,
        avg_score: matchesPlayed > 0 ? (totalScore / matchesPlayed).toFixed(1) : '0.0',
        total_auto: totalAutoScore,
        total_teleop: totalTeleopScore,
        total_fouls_committed: totalFoulsCommitted
      };
    });

    // Sort by average RP, then by total score as tiebreaker
    rankings.sort((a, b) => {
      const rpDiff = parseFloat(b.average_rp) - parseFloat(a.average_rp);
      if (rpDiff !== 0) return rpDiff;
      return b.total_score - a.total_score;
    });

    res.json(rankings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Server Init ──────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🤖 UniBotics Competition Server running on http://localhost:${PORT}`);

  // Ensure settings row exists
  try {
    const { data } = await supabase
      .from('competition_settings')
      .select('id')
      .eq('id', 1)
      .single();
    if (!data) {
      await supabase
        .from('competition_settings')
        .insert({ id: 1, audience_view: 'standby' });
    }
  } catch {
    // Settings table might not exist yet
  }

  // Auto-setup default users if none exist
  try {
    const { data: users } = await supabase.from('users').select('id').limit(1);
    if (!users || users.length === 0) {
      const adminHash = await bcrypt.hash('admin123', 10);
      const judgeHash = await bcrypt.hash('judge123', 10);
      await supabase.from('users').insert([
        { username: 'admin', password_hash: adminHash, role: 'admin' },
        { username: 'judge', password_hash: judgeHash, role: 'judge' }
      ]);
      console.log('✅ Default users created: admin/admin123, judge/judge123');
    }
  } catch {
    console.log('⚠️  Could not auto-setup users. Run POST /auth/setup manually.');
  }
});
