const API_URL = 'http://localhost:3001';

function getToken(): string | null {
  return localStorage.getItem('unibotics_token');
}

function authHeaders(): HeadersInit {
  const token = getToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(res: Response) {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

// ─── Auth ─────────────────────────────────────────────────────
export async function login(username: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await handleResponse(res);
  localStorage.setItem('unibotics_token', data.token);
  localStorage.setItem('unibotics_user', JSON.stringify(data.user));
  return data;
}

export function logout() {
  localStorage.removeItem('unibotics_token');
  localStorage.removeItem('unibotics_user');
}

export function getStoredUser() {
  const userStr = localStorage.getItem('unibotics_user');
  if (!userStr) return null;
  try { return JSON.parse(userStr); } catch { return null; }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ─── Teams ────────────────────────────────────────────────────
export async function fetchTeams() {
  const res = await fetch(`${API_URL}/teams`);
  return handleResponse(res);
}

export async function addTeam(name: string, teamNumber?: number) {
  const res = await fetch(`${API_URL}/teams`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, team_number: teamNumber }),
  });
  return handleResponse(res);
}

export async function deleteTeam(id: string) {
  const res = await fetch(`${API_URL}/teams/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ─── Matches ──────────────────────────────────────────────────
export async function fetchMatches() {
  const res = await fetch(`${API_URL}/matches`);
  return handleResponse(res);
}

export async function generateSchedule(matchType: '1v1' | '2v2', matchCount: number) {
  const res = await fetch(`${API_URL}/generate-schedule`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ matchType, matchCount }),
  });
  return handleResponse(res);
}

export async function deleteAllMatches() {
  const res = await fetch(`${API_URL}/matches`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function deleteMatch(id: string) {
  const res = await fetch(`${API_URL}/matches/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function submitScore(matchId: string, scores: {
  score_auto_red: number;
  score_teleop_red: number;
  fouls_minor_red: number;
  fouls_major_red: number;
  score_auto_blue: number;
  score_teleop_blue: number;
  fouls_minor_blue: number;
  fouls_major_blue: number;
}) {
  const res = await fetch(`${API_URL}/matches/${matchId}/score`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(scores),
  });
  return handleResponse(res);
}

export async function updateMatchStatus(matchId: string, status: string) {
  const res = await fetch(`${API_URL}/matches/${matchId}/status`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
}

// ─── Settings ─────────────────────────────────────────────────
export async function fetchSettings() {
  const res = await fetch(`${API_URL}/settings`);
  return handleResponse(res);
}

export async function updateSettings(settings: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/settings`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(settings),
  });
  return handleResponse(res);
}

// ─── Rankings ─────────────────────────────────────────────────
export async function fetchRankings() {
  const res = await fetch(`${API_URL}/rankings`);
  return handleResponse(res);
}

// ─── Score Calculation Helper ─────────────────────────────────
export function calcTotalScore(
  autoScore: number, teleopScore: number,
  opponentMinorFouls: number, opponentMajorFouls: number
): number {
  return autoScore + teleopScore + (opponentMinorFouls * 5) + (opponentMajorFouls * 10);
}
