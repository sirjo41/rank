import { supabase } from './supabase';
import bcrypt from 'bcryptjs';
import { computeAllianceScore, computeMatchTotals, EMPTY_BREAKDOWN, ScoreBreakdown } from './scoring';

// ─── Types ────────────────────────────────────────────────────
export interface Team {
  id: string; name: string; team_number: number | null; created_at?: string;
}

export interface Match {
  id: string; match_number: number; match_type: '1v1' | '2v2';
  status: 'scheduled' | 'playing' | 'judge_submitted' | 'completed';
  red_team1_id: string | null; red_team2_id: string | null;
  blue_team1_id: string | null; blue_team2_id: string | null;
  score_breakdown_red: Partial<ScoreBreakdown>;
  score_breakdown_blue: Partial<ScoreBreakdown>;
  fouls_minor_red: number; fouls_major_red: number;
  fouls_minor_blue: number; fouls_major_blue: number;
  red_team1?: Team | null; red_team2?: Team | null;
  blue_team1?: Team | null; blue_team2?: Team | null;
}

export interface CompetitionSettings {
  id: number; active_match_id: string | null;
  audience_view: 'standby' | 'match' | 'results' | 'rankings';
  timer_running: boolean; timer_started_at: string | null;
  timer_paused_remaining: number | null; updated_at: string;
}

export interface StoredUser {
  id: string; username: string; role: 'admin' | 'judge';
  judge_type: 'red' | 'blue' | null;
}

export interface Ranking {
  team_id: string; team_name: string; team_number: number | null;
  matches_played: number; wins: number; losses: number; ties: number;
  total_rp: number; average_rp: string; total_score: number; avg_score: string;
}

// ─── Auth ─────────────────────────────────────────────────────
export async function login(username: string, password: string): Promise<{ user: StoredUser }> {
  const { data: user, error } = await supabase
    .from('users').select('*').eq('username', username.trim()).single();
  if (error || !user) throw new Error('Invalid credentials');
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error('Invalid credentials');
  const stored: StoredUser = { id: user.id, username: user.username, role: user.role, judge_type: user.judge_type ?? null };
  localStorage.setItem('unibotics_user', JSON.stringify(stored));
  return { user: stored };
}

export function logout() { localStorage.removeItem('unibotics_user'); }

export function getStoredUser(): StoredUser | null {
  const str = localStorage.getItem('unibotics_user');
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

// ─── Judge Management (Admin only) ────────────────────────────
export async function fetchJudges(): Promise<(StoredUser & { id: string })[]> {
  const { data, error } = await supabase.from('users').select('id, username, role, judge_type').eq('role', 'judge');
  if (error) throw new Error(error.message);
  return data;
}

export async function createJudge(username: string, password: string, judgeType: 'red' | 'blue'): Promise<void> {
  const hash = await bcrypt.hash(password, 10);
  const { error } = await supabase.from('users').insert([{ username, password_hash: hash, role: 'judge', judge_type: judgeType }]);
  if (error) throw new Error(error.message);
}

export async function deleteJudge(id: string): Promise<void> {
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Teams ────────────────────────────────────────────────────
export async function fetchTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from('teams').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return data;
}

export async function addTeam(name: string, teamNumber?: number): Promise<Team> {
  const { data, error } = await supabase.from('teams').insert([{ name, team_number: teamNumber || null }]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Matches ──────────────────────────────────────────────────
const MATCH_SELECT = `
  *,
  red_team1:teams!matches_red_team1_id_fkey(id, name, team_number),
  red_team2:teams!matches_red_team2_id_fkey(id, name, team_number),
  blue_team1:teams!matches_blue_team1_id_fkey(id, name, team_number),
  blue_team2:teams!matches_blue_team2_id_fkey(id, name, team_number)
`;

export async function fetchMatches(): Promise<Match[]> {
  const { data, error } = await supabase.from('matches').select(MATCH_SELECT).order('match_number');
  if (error) throw new Error(error.message);
  return (data || []).map(normalizeMatch);
}

function normalizeMatch(m: any): Match {
  return {
    ...m,
    score_breakdown_red:  m.score_breakdown_red  ?? {},
    score_breakdown_blue: m.score_breakdown_blue ?? {},
    fouls_minor_red: m.fouls_minor_red ?? 0, fouls_major_red: m.fouls_major_red ?? 0,
    fouls_minor_blue: m.fouls_minor_blue ?? 0, fouls_major_blue: m.fouls_major_blue ?? 0,
  };
}

export async function generateSchedule(matchType: '1v1' | '2v2', matchCount: number) {
  const teamsNeeded = matchType === '1v1' ? 2 : 4;
  const { data: teams, error } = await supabase.from('teams').select('id');
  if (error) throw new Error(error.message);
  if (!teams || teams.length < teamsNeeded) throw new Error(`Need at least ${teamsNeeded} teams for ${matchType}`);

  const { data: existing } = await supabase.from('matches').select('match_number').order('match_number', { ascending: false }).limit(1);
  let nextNum = existing?.[0]?.match_number ? existing[0].match_number + 1 : 1;

  const ids = teams.map((t: any) => t.id);
  const matches: any[] = [];
  const seen = new Set<string>();
  let attempts = 0;

  while (matches.length < matchCount && attempts < matchCount * 50) {
    const s = [...ids].sort(() => Math.random() - 0.5);
    const match = matchType === '1v1'
      ? { match_number: nextNum + matches.length, match_type: matchType, red_team1_id: s[0], red_team2_id: null, blue_team1_id: s[1], blue_team2_id: null }
      : { match_number: nextNum + matches.length, match_type: matchType, red_team1_id: s[0], red_team2_id: s[1], blue_team1_id: s[2], blue_team2_id: s[3] };
    const key = matchType === '1v1' ? [match.red_team1_id, match.blue_team1_id].sort().join(':')
      : `${[match.red_team1_id, match.red_team2_id].sort().join('-')}|${[match.blue_team1_id, match.blue_team2_id].sort().join('-')}`;
    if (!seen.has(key)) { matches.push(match); seen.add(key); }
    attempts++;
  }

  const { data: inserted, error: ie } = await supabase.from('matches').insert(matches).select();
  if (ie) throw new Error(ie.message);
  return { matches: inserted, count: inserted.length };
}

export async function deleteAllMatches(): Promise<void> {
  await supabase.from('competition_settings').update({ active_match_id: null, timer_running: false, timer_started_at: null }).eq('id', 1);
  const { error } = await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(error.message);
}

export async function deleteMatch(id: string): Promise<void> {
  const { data: s } = await supabase.from('competition_settings').select('active_match_id').eq('id', 1).single();
  if (s?.active_match_id === id) await supabase.from('competition_settings').update({ active_match_id: null, timer_running: false }).eq('id', 1);
  const { error } = await supabase.from('matches').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Real-time Score Push (judge counter → Supabase) ──────────
export async function pushScoreBreakdown(
  matchId: string, alliance: 'red' | 'blue',
  breakdown: Partial<ScoreBreakdown>,
  foulsMinor: number, foulsMajor: number,
): Promise<void> {
  const field_bd   = alliance === 'red' ? 'score_breakdown_red' : 'score_breakdown_blue';
  const field_minor = alliance === 'red' ? 'fouls_minor_red' : 'fouls_minor_blue';
  const field_major = alliance === 'red' ? 'fouls_major_red' : 'fouls_major_blue';
  const { error } = await supabase.from('matches').update({
    [field_bd]: breakdown, [field_minor]: foulsMinor, [field_major]: foulsMajor,
  }).eq('id', matchId);
  if (error) throw new Error(error.message);
}

// ─── Submit scores to admin (changes status to judge_submitted) ─
export async function submitScore(matchId: string, redBreakdown: Partial<ScoreBreakdown>, blueBreakdown: Partial<ScoreBreakdown>, foulsMinorRed: number, foulsMajorRed: number, foulsMinorBlue: number, foulsMajorBlue: number): Promise<void> {
  const { error } = await supabase.from('matches').update({
    score_breakdown_red: redBreakdown, score_breakdown_blue: blueBreakdown,
    fouls_minor_red: foulsMinorRed, fouls_major_red: foulsMajorRed,
    fouls_minor_blue: foulsMinorBlue, fouls_major_blue: foulsMajorBlue,
    status: 'judge_submitted',
  }).eq('id', matchId);
  if (error) throw new Error(error.message);
}

// Admin score override before approval
export async function overrideMatchScore(matchId: string, updates: Partial<Match>): Promise<void> {
  const { error } = await supabase.from('matches').update(updates).eq('id', matchId);
  if (error) throw new Error(error.message);
}

export async function updateMatchStatus(matchId: string, status: string): Promise<void> {
  if (status === 'playing') {
    const { error: err1 } = await supabase.from('competition_settings').update({ active_match_id: matchId, timer_running: true, timer_started_at: new Date().toISOString(), timer_paused_remaining: null, updated_at: new Date().toISOString() }).eq('id', 1);
    if (err1) console.error('Failed to update settings:', err1);
  }
  if (status === 'completed') {
    const { error: err2 } = await supabase.from('competition_settings').update({ timer_running: false, updated_at: new Date().toISOString() }).eq('id', 1);
    if (err2) console.error('Failed to update settings:', err2);
  }
  const { error: err3 } = await supabase.from('matches').update({ status }).eq('id', matchId);
  if (err3) throw new Error(err3.message);
}

// ─── Settings ─────────────────────────────────────────────────
export async function fetchSettings(): Promise<CompetitionSettings | null> {
  const { data, error } = await supabase.from('competition_settings').select('*').eq('id', 1).single();
  if (error) {
    if (error.code === 'PGRST116') {
      const { data: c } = await supabase.from('competition_settings').insert({ id: 1, audience_view: 'standby' }).select().single();
      return c;
    }
    return null;
  }
  return data;
}

export async function updateSettings(s: Record<string, unknown>): Promise<CompetitionSettings> {
  const { data, error } = await supabase.from('competition_settings').update({ ...s, updated_at: new Date().toISOString() }).eq('id', 1).select().single();
  if (error) throw new Error(error.message);
  return data;
}

// ─── Rankings ─────────────────────────────────────────────────
export async function fetchRankings(): Promise<Ranking[]> {
  const { data: teams, error: te } = await supabase.from('teams').select('id, name, team_number');
  if (te) throw new Error(te.message);
  const { data: matches, error: me } = await supabase.from('matches').select('*').eq('status', 'completed');
  if (me) throw new Error(me.message);

  const rankings: Ranking[] = (teams || []).map((team: any) => {
    let totalRP = 0, matchesPlayed = 0, totalScore = 0, wins = 0, losses = 0, ties = 0;
    (matches || []).forEach((match: any) => {
      const isRed  = match.red_team1_id === team.id  || match.red_team2_id === team.id;
      const isBlue = match.blue_team1_id === team.id || match.blue_team2_id === team.id;
      if (!isRed && !isBlue) return;
      matchesPlayed++;
      const { redTotal, blueTotal } = computeMatchTotals(
        match.score_breakdown_red ?? {}, match.score_breakdown_blue ?? {},
        match.fouls_minor_red ?? 0, match.fouls_major_red ?? 0,
        match.fouls_minor_blue ?? 0, match.fouls_major_blue ?? 0,
      );
      if (isRed) {
        totalScore += redTotal;
        if (redTotal > blueTotal)       { totalRP += 3; wins++; }
        else if (redTotal === blueTotal) { totalRP += 1; ties++; }
        else                             { losses++; }
      } else {
        totalScore += blueTotal;
        if (blueTotal > redTotal)        { totalRP += 3; wins++; }
        else if (redTotal === blueTotal)  { totalRP += 1; ties++; }
        else                             { losses++; }
      }
    });
    return {
      team_id: team.id, team_name: team.name, team_number: team.team_number,
      matches_played: matchesPlayed, wins, losses, ties, total_rp: totalRP,
      average_rp: matchesPlayed > 0 ? (totalRP / matchesPlayed).toFixed(2) : '0.00',
      total_score: totalScore,
      avg_score: matchesPlayed > 0 ? (totalScore / matchesPlayed).toFixed(1) : '0.0',
    };
  });

  return rankings.sort((a, b) => {
    const d = parseFloat(b.average_rp) - parseFloat(a.average_rp);
    return d !== 0 ? d : b.total_score - a.total_score;
  });
}

export function subscribeToMatch(matchId: string, onUpdate: (match: Match) => void) {
  return supabase.channel(`match-${matchId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' },
      (payload: any) => {
        if (payload.new.id === matchId) onUpdate(normalizeMatch(payload.new));
      })
    .subscribe((status: string) => console.log('subscribeToMatch status:', status));
}

export function subscribeToSettings(onUpdate: (s: CompetitionSettings) => void) {
  return supabase.channel('competition-settings')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'competition_settings' },
      (payload: any) => onUpdate(payload.new as CompetitionSettings))
    .subscribe((status: string) => console.log('subscribeToSettings status:', status));
}

// ─── Helpers ──────────────────────────────────────────────────
export { computeAllianceScore, computeMatchTotals, EMPTY_BREAKDOWN };
export type { ScoreBreakdown };
