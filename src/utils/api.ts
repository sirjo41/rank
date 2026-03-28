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
  judge_red_ready: boolean;
  judge_blue_ready: boolean;
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
  timer_paused_remaining: number | null; 
  timer_phase: 'none' | 'autonomous' | 'pickup' | 'teleop';
  updated_at: string;
}

export interface StoredUser {
  id: string; username: string; role: 'admin' | 'judge' | 'head_referee';
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
    judge_red_ready: m.judge_red_ready ?? false,
    judge_blue_ready: m.judge_blue_ready ?? false,
  };
}

// ─── Balanced schedule generation ─────────────────────────────
function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Canonical key for two teams as partners (orderless). */
function alliancePairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function canonicalFullMatch1v1(red: string, blue: string): string {
  return alliancePairKey(red, blue);
}

/** Same 4 teams + same pairing split (orderless across Red/Blue side). */
function canonicalFullMatch2v2(r1: string, r2: string, b1: string, b2: string): string {
  const rp = alliancePairKey(r1, r2);
  const bp = alliancePairKey(b1, b2);
  return rp < bp ? `${rp}||${bp}` : `${bp}||${rp}`;
}

function sortTeamsByBalance(ids: string[], teamCounts: Map<string, number>): string[] {
  const buckets = new Map<number, string[]>();
  for (const id of ids) {
    const c = teamCounts.get(id) ?? 0;
    if (!buckets.has(c)) buckets.set(c, []);
    buckets.get(c)!.push(id);
  }
  const sortedCounts = [...buckets.keys()].sort((a, b) => a - b);
  const result: string[] = [];
  for (const c of sortedCounts) {
    const arr = buckets.get(c)!;
    shuffleInPlace(arr);
    result.push(...arr);
  }
  return result;
}

function seedScheduleState(
  rows: { match_type: string; red_team1_id: string | null; red_team2_id: string | null; blue_team1_id: string | null; blue_team2_id: string | null }[],
  teamCounts: Map<string, number>,
  seenAlliancePairs: Set<string>,
  seenFullMatches: Set<string>,
): void {
  for (const m of rows) {
    if (m.match_type === '1v1') {
      const r = m.red_team1_id;
      const b = m.blue_team1_id;
      if (r && b) {
        teamCounts.set(r, (teamCounts.get(r) ?? 0) + 1);
        teamCounts.set(b, (teamCounts.get(b) ?? 0) + 1);
        seenFullMatches.add(canonicalFullMatch1v1(r, b));
      }
    } else {
      const r1 = m.red_team1_id;
      const r2 = m.red_team2_id;
      const b1 = m.blue_team1_id;
      const b2 = m.blue_team2_id;
      if (r1 && r2 && b1 && b2) {
        for (const id of [r1, r2, b1, b2]) teamCounts.set(id, (teamCounts.get(id) ?? 0) + 1);
        seenAlliancePairs.add(alliancePairKey(r1, r2));
        seenAlliancePairs.add(alliancePairKey(b1, b2));
        seenFullMatches.add(canonicalFullMatch2v2(r1, r2, b1, b2));
      }
    }
  }
}

const PEN_ALLIANCE_REPEAT = 8_000;
const PEN_FULL_MATCH_REPEAT = 50_000_000;

function scoreBalanceAfter(r1: string, r2: string | null, b1: string, b2: string | null, teamCounts: Map<string, number>): number {
  const ids = r2 && b2 ? [r1, r2, b1, b2] : [r1, b1];
  const after = ids.map(id => (teamCounts.get(id) ?? 0) + 1);
  const max = Math.max(...after);
  const min = Math.min(...after);
  return (max - min) * 100 + max * 20;
}

export async function generateSchedule(matchType: '1v1' | '2v2', matchCount: number) {
  const teamsNeeded = matchType === '1v1' ? 2 : 4;
  const { data: teams, error } = await supabase.from('teams').select('id');
  if (error) throw new Error(error.message);
  if (!teams || teams.length < teamsNeeded) throw new Error(`Need at least ${teamsNeeded} teams for ${matchType}`);

  const { data: existingRows } = await supabase
    .from('matches')
    .select('match_type, red_team1_id, red_team2_id, blue_team1_id, blue_team2_id');

  const { data: existingNum } = await supabase.from('matches').select('match_number').order('match_number', { ascending: false }).limit(1);
  let nextNum = existingNum?.[0]?.match_number ? existingNum[0].match_number + 1 : 1;

  const ids = teams.map((t: { id: string }) => t.id);
  const teamCounts = new Map<string, number>();
  for (const id of ids) teamCounts.set(id, 0);
  const seenAlliancePairs = new Set<string>();
  const seenFullMatches = new Set<string>();
  seedScheduleState(existingRows || [], teamCounts, seenAlliancePairs, seenFullMatches);

  const matches: any[] = [];
  const maxAttemptsPerMatch = 1_200;

  for (let mi = 0; mi < matchCount; mi++) {
    let best: { score: number; row: any } | null = null;

    for (let attempt = 0; attempt < maxAttemptsPerMatch; attempt++) {
      const ordered = sortTeamsByBalance(ids, teamCounts);
      const widen = Math.min(ordered.length, 4 + Math.floor(attempt / 100) + (attempt % 7));
      const pool = ordered.slice(0, widen);
      shuffleInPlace(pool);

      if (matchType === '1v1') {
        const t0 = pool[0];
        const t1 = pool[1];
        if (!t0 || !t1 || t0 === t1) continue;
        const fullKey = canonicalFullMatch1v1(t0, t1);
        const dupFull = seenFullMatches.has(fullKey);
        let score = scoreBalanceAfter(t0, null, t1, null, teamCounts);
        if (dupFull) score += PEN_FULL_MATCH_REPEAT;

        const row = {
          match_number: nextNum + mi,
          match_type: '1v1' as const,
          red_team1_id: t0,
          red_team2_id: null,
          blue_team1_id: t1,
          blue_team2_id: null,
        };
        if (!best || score < best.score) best = { score, row };
        continue;
      }

      const four = pool.slice(0, 4);
      if (new Set(four).size !== 4) continue;
      const [a, b, c, d] = four;
      const splits: [string, string, string, string][] = [
        [a, b, c, d],
        [a, c, b, d],
        [a, d, b, c],
      ];

      for (const [r1, r2, b1, b2] of splits) {
        const fullKey = canonicalFullMatch2v2(r1, r2, b1, b2);
        const rp = alliancePairKey(r1, r2);
        const bp = alliancePairKey(b1, b2);
        let score = scoreBalanceAfter(r1, r2, b1, b2, teamCounts);
        if (seenFullMatches.has(fullKey)) score += PEN_FULL_MATCH_REPEAT;
        if (seenAlliancePairs.has(rp)) score += PEN_ALLIANCE_REPEAT;
        if (seenAlliancePairs.has(bp)) score += PEN_ALLIANCE_REPEAT;

        const row = {
          match_number: nextNum + mi,
          match_type: '2v2' as const,
          red_team1_id: r1,
          red_team2_id: r2,
          blue_team1_id: b1,
          blue_team2_id: b2,
        };
        if (!best || score < best.score) best = { score, row };
      }
    }

    if (!best) {
      throw new Error(
        'Could not generate a match. Try fewer matches, add more teams, or clear some existing matches.',
      );
    }

    const row = best.row;
    matches.push(row);

    if (matchType === '1v1') {
      const r = row.red_team1_id as string;
      const b = row.blue_team1_id as string;
      teamCounts.set(r, (teamCounts.get(r) ?? 0) + 1);
      teamCounts.set(b, (teamCounts.get(b) ?? 0) + 1);
      seenFullMatches.add(canonicalFullMatch1v1(r, b));
    } else {
      const r1 = row.red_team1_id as string;
      const r2 = row.red_team2_id as string;
      const b1 = row.blue_team1_id as string;
      const b2 = row.blue_team2_id as string;
      for (const id of [r1, r2, b1, b2]) teamCounts.set(id, (teamCounts.get(id) ?? 0) + 1);
      seenAlliancePairs.add(alliancePairKey(r1, r2));
      seenAlliancePairs.add(alliancePairKey(b1, b2));
      seenFullMatches.add(canonicalFullMatch2v2(r1, r2, b1, b2));
    }
  }

  const { data: inserted, error: ie } = await supabase.from('matches').insert(matches).select();
  if (ie) throw new Error(ie.message);
  return { matches: inserted, count: inserted.length };
}

/** Add a single match with chosen Red vs Blue alliances (no random draw). */
export async function createManualMatch(params: {
  matchType: '1v1' | '2v2';
  red_team1_id: string;
  red_team2_id: string | null;
  blue_team1_id: string;
  blue_team2_id: string | null;
}): Promise<Match> {
  const { matchType, red_team1_id, red_team2_id, blue_team1_id, blue_team2_id } = params;
  if (matchType === '1v1') {
    if (!red_team1_id || !blue_team1_id) throw new Error('Select both teams for Red and Blue');
    if (red_team1_id === blue_team1_id) throw new Error('Red and Blue must be different teams');
  } else {
    const ids = [red_team1_id, red_team2_id, blue_team1_id, blue_team2_id].filter(Boolean) as string[];
    if (ids.length !== 4) throw new Error('Select all four teams (two per alliance)');
    if (new Set(ids).size !== 4) throw new Error('All four teams must be different');
  }

  const { data: existing } = await supabase
    .from('matches')
    .select('match_number')
    .order('match_number', { ascending: false })
    .limit(1);
  const nextNum = existing?.[0]?.match_number ? existing[0].match_number + 1 : 1;

  const row =
    matchType === '1v1'
      ? {
          match_number: nextNum,
          match_type: '1v1' as const,
          red_team1_id,
          red_team2_id: null,
          blue_team1_id,
          blue_team2_id: null,
        }
      : {
          match_number: nextNum,
          match_type: '2v2' as const,
          red_team1_id,
          red_team2_id: red_team2_id!,
          blue_team1_id,
          blue_team2_id: blue_team2_id!,
        };

  const { data, error } = await supabase.from('matches').insert([row]).select(MATCH_SELECT).single();
  if (error) throw new Error(error.message);
  return normalizeMatch(data);
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

export async function toggleJudgeReady(matchId: string, alliance: 'red' | 'blue', ready: boolean): Promise<void> {
  const field = alliance === 'red' ? 'judge_red_ready' : 'judge_blue_ready';
  const { error } = await supabase.from('matches').update({ [field]: ready }).eq('id', matchId);
  if (error) throw new Error(error.message);
}

export async function overrideMatchScore(matchId: string, updates: Partial<Match>): Promise<void> {
  const { error } = await supabase.from('matches').update(updates).eq('id', matchId);
  if (error) throw new Error(error.message);
}

// Admin status update (start match / complete match)
export async function updateMatchStatus(matchId: string, status: string): Promise<void> {

  if (status === 'playing') {
    const { error: err1 } = await supabase.from('competition_settings').upsert({ 
      id: 1, 
      active_match_id: matchId, 
      timer_running: true, 
      timer_started_at: new Date().toISOString(), 
      timer_paused_remaining: null, 
      timer_phase: 'autonomous',
      updated_at: new Date().toISOString() 
    });
    if (err1) throw new Error('Failed to start timer: ' + err1.message);
  }
  if (status === 'completed') {
    const { error: err2 } = await supabase.from('competition_settings').upsert({ 
      id: 1, 
      timer_running: false, 
      timer_started_at: null,
      timer_paused_remaining: 0,
      timer_phase: 'none',
      updated_at: new Date().toISOString() 
    });
    if (err2) throw new Error('Failed to stop timer: ' + err2.message);
  }
  const { error: err3 } = await supabase.from('matches').update({ status }).eq('id', matchId);
  if (err3) throw new Error(err3.message);
}

export async function setTimer(running: boolean, remaining: number | null, phase?: 'none' | 'autonomous' | 'pickup' | 'teleop'): Promise<void> {
  const now = new Date().toISOString();
  const updates: any = { 
    id: 1, 
    timer_running: running, 
    updated_at: now 
  };
  
  if (phase) updates.timer_phase = phase; 
  
  if (running) {
    // If we are starting/resuming, we set the started_at based on remaining time
    // MATCH_DURATION - elapsed = remaining  =>  elapsed = MATCH_DURATION - remaining
    const elapsedMs = (150 - (remaining ?? 150)) * 1000;
    updates.timer_started_at = new Date(Date.now() - elapsedMs).toISOString();
    updates.timer_paused_remaining = null;
  } else {
    updates.timer_started_at = null;
    updates.timer_paused_remaining = remaining;
  }

  const { error } = await supabase.from('competition_settings').upsert(updates);
  if (error) throw new Error(error.message);
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
