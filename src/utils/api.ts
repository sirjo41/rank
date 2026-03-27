import { supabase } from './supabase';
import bcrypt from 'bcryptjs';

// ─── Types ────────────────────────────────────────────────────
export interface Team {
  id: string;
  name: string;
  team_number: number | null;
  created_at?: string;
}

export interface Match {
  id: string;
  match_number: number;
  match_type: '1v1' | '2v2';
  status: 'scheduled' | 'playing' | 'judge_submitted' | 'completed';
  red_team1_id: string | null;
  red_team2_id: string | null;
  blue_team1_id: string | null;
  blue_team2_id: string | null;
  score_auto_red: number;
  score_teleop_red: number;
  fouls_minor_red: number;
  fouls_major_red: number;
  score_auto_blue: number;
  score_teleop_blue: number;
  fouls_minor_blue: number;
  fouls_major_blue: number;
  red_team1?: Team | null;
  red_team2?: Team | null;
  blue_team1?: Team | null;
  blue_team2?: Team | null;
}

export interface CompetitionSettings {
  id: number;
  active_match_id: string | null;
  audience_view: 'standby' | 'match' | 'results' | 'rankings';
  timer_running: boolean;
  timer_started_at: string | null;
  updated_at: string;
}

export interface Ranking {
  team_id: string;
  team_name: string;
  team_number: number | null;
  matches_played: number;
  wins: number;
  losses: number;
  ties: number;
  total_rp: number;
  average_rp: string;
  total_score: number;
  avg_score: string;
}

export interface StoredUser {
  id: string;
  username: string;
  role: 'admin' | 'judge';
}

// ─── Auth ─────────────────────────────────────────────────────
export async function login(username: string, password: string): Promise<{ user: StoredUser }> {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username.trim())
    .single();

  if (error || !user) {
    throw new Error('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  const storedUser: StoredUser = { id: user.id, username: user.username, role: user.role };
  localStorage.setItem('unibotics_user', JSON.stringify(storedUser));
  return { user: storedUser };
}

export function logout() {
  localStorage.removeItem('unibotics_user');
}

export function getStoredUser(): StoredUser | null {
  const str = localStorage.getItem('unibotics_user');
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

// ─── Teams ────────────────────────────────────────────────────
export async function fetchTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at');
  if (error) throw new Error(error.message);
  return data;
}

export async function addTeam(name: string, teamNumber?: number): Promise<Team> {
  const { data, error } = await supabase
    .from('teams')
    .insert([{ name, team_number: teamNumber || null }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Matches ──────────────────────────────────────────────────
export async function fetchMatches(): Promise<Match[]> {
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
  if (error) throw new Error(error.message);
  return data;
}

export async function generateSchedule(
  matchType: '1v1' | '2v2',
  matchCount: number
): Promise<{ matches: Match[]; count: number }> {
  const teamsNeeded = matchType === '1v1' ? 2 : 4;

  const { data: teams, error: teamsError } = await supabase.from('teams').select('id');
  if (teamsError) throw new Error(teamsError.message);
  if (!teams || teams.length < teamsNeeded) {
    throw new Error(`Need at least ${teamsNeeded} teams for ${matchType} matches`);
  }

  // Get current max match number
  const { data: existing } = await supabase
    .from('matches')
    .select('match_number')
    .order('match_number', { ascending: false })
    .limit(1);

  let nextMatchNum = 1;
  if (existing && existing.length > 0) {
    nextMatchNum = existing[0].match_number + 1;
  }

  const teamIds = teams.map((t) => t.id);
  const matches: Omit<Match, 'id' | 'status' | 'score_auto_red' | 'score_teleop_red' | 'fouls_minor_red' | 'fouls_major_red' | 'score_auto_blue' | 'score_teleop_blue' | 'fouls_minor_blue' | 'fouls_major_blue'>[] = [];
  const usedPairings = new Set<string>();

  const getPairingKey = (m: typeof matches[0]): string => {
    if (matchType === '1v1') {
      return [m.red_team1_id, m.blue_team1_id].sort().join(':');
    }
    const red = [m.red_team1_id, m.red_team2_id].sort().join('-');
    const blue = [m.blue_team1_id, m.blue_team2_id].sort().join('-');
    return `${red}|${blue}`;
  };

  let attempts = 0;
  const maxAttempts = matchCount * 50;

  while (matches.length < matchCount && attempts < maxAttempts) {
    const shuffled = [...teamIds].sort(() => Math.random() - 0.5);
    const match = matchType === '1v1'
      ? {
          match_number: nextMatchNum + matches.length,
          match_type: matchType,
          red_team1_id: shuffled[0],
          red_team2_id: null,
          blue_team1_id: shuffled[1],
          blue_team2_id: null,
        }
      : {
          match_number: nextMatchNum + matches.length,
          match_type: matchType,
          red_team1_id: shuffled[0],
          red_team2_id: shuffled[1],
          blue_team1_id: shuffled[2],
          blue_team2_id: shuffled[3],
        };

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
  if (insertError) throw new Error(insertError.message);

  return { matches: inserted, count: inserted.length };
}

export async function deleteAllMatches(): Promise<void> {
  // Clear active match from settings first
  await supabase
    .from('competition_settings')
    .update({ active_match_id: null, timer_running: false, timer_started_at: null })
    .eq('id', 1);

  const { error } = await supabase
    .from('matches')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(error.message);
}

export async function deleteMatch(id: string): Promise<void> {
  // Check if active match
  const { data: settings } = await supabase
    .from('competition_settings')
    .select('active_match_id')
    .eq('id', 1)
    .single();
  if (settings?.active_match_id === id) {
    await supabase
      .from('competition_settings')
      .update({ active_match_id: null, timer_running: false, timer_started_at: null })
      .eq('id', 1);
  }
  const { error } = await supabase.from('matches').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function submitScore(
  matchId: string,
  scores: {
    score_auto_red: number;
    score_teleop_red: number;
    fouls_minor_red: number;
    fouls_major_red: number;
    score_auto_blue: number;
    score_teleop_blue: number;
    fouls_minor_blue: number;
    fouls_major_blue: number;
  }
): Promise<Match> {
  const { data, error } = await supabase
    .from('matches')
    .update({ ...scores, status: 'judge_submitted' })
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateMatchStatus(matchId: string, status: string): Promise<Match> {
  const updateData: Record<string, unknown> = { status };

  if (status === 'playing') {
    await supabase
      .from('competition_settings')
      .update({
        active_match_id: matchId,
        timer_running: true,
        timer_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
  }

  if (status === 'completed') {
    await supabase
      .from('competition_settings')
      .update({ timer_running: false, updated_at: new Date().toISOString() })
      .eq('id', 1);
  }

  const { data, error } = await supabase
    .from('matches')
    .update(updateData)
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ─── Settings ─────────────────────────────────────────────────
export async function fetchSettings(): Promise<CompetitionSettings | null> {
  const { data, error } = await supabase
    .from('competition_settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) {
    // If no row, create one
    if (error.code === 'PGRST116') {
      const { data: created } = await supabase
        .from('competition_settings')
        .insert({ id: 1, audience_view: 'standby' })
        .select()
        .single();
      return created;
    }
    return null;
  }
  return data;
}

export async function updateSettings(settings: Record<string, unknown>): Promise<CompetitionSettings> {
  const { data, error } = await supabase
    .from('competition_settings')
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ─── Rankings (computed client-side from raw match data) ───────
export async function fetchRankings(): Promise<Ranking[]> {
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, team_number');
  if (teamsError) throw new Error(teamsError.message);

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'completed');
  if (matchesError) throw new Error(matchesError.message);

  const rankings: Ranking[] = (teams || []).map((team) => {
    let totalRP = 0;
    let matchesPlayed = 0;
    let totalScore = 0;
    let wins = 0;
    let losses = 0;
    let ties = 0;

    (matches || []).forEach((match) => {
      const isRed = match.red_team1_id === team.id || match.red_team2_id === team.id;
      const isBlue = match.blue_team1_id === team.id || match.blue_team2_id === team.id;
      if (!isRed && !isBlue) return;
      matchesPlayed++;

      const totalRed = match.score_auto_red + match.score_teleop_red
        + (match.fouls_minor_blue * 5) + (match.fouls_major_blue * 10);
      const totalBlue = match.score_auto_blue + match.score_teleop_blue
        + (match.fouls_minor_red * 5) + (match.fouls_major_red * 10);

      if (isRed) {
        totalScore += totalRed;
        if (totalRed > totalBlue) { totalRP += 3; wins++; }
        else if (totalRed === totalBlue) { totalRP += 1; ties++; }
        else { losses++; }
      } else {
        totalScore += totalBlue;
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
    };
  });

  rankings.sort((a, b) => {
    const rpDiff = parseFloat(b.average_rp) - parseFloat(a.average_rp);
    return rpDiff !== 0 ? rpDiff : b.total_score - a.total_score;
  });

  return rankings;
}

// ─── Score Calculation Helper ──────────────────────────────────
export function calcTotalScore(
  autoScore: number, teleopScore: number,
  opponentMinorFouls: number, opponentMajorFouls: number
): number {
  return autoScore + teleopScore + (opponentMinorFouls * 5) + (opponentMajorFouls * 10);
}
