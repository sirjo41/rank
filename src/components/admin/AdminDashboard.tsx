import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { calcTotalScore } from '../../utils/api';
import * as api from '../../utils/api';
import {
  Shield, Plus, Trash2, Calendar, Users, Eye, EyeOff, CheckCircle, XCircle,
  LogOut, Trophy, Monitor, BarChart3, ChevronDown, AlertTriangle, RefreshCw
} from 'lucide-react';

interface Team { id: string; name: string; team_number: number | null; }
interface Match {
  id: string; match_number: number; match_type: string; status: string;
  red_team1: Team | null; red_team2: Team | null;
  blue_team1: Team | null; blue_team2: Team | null;
  score_auto_red: number; score_teleop_red: number;
  fouls_minor_red: number; fouls_major_red: number;
  score_auto_blue: number; score_teleop_blue: number;
  fouls_minor_blue: number; fouls_major_blue: number;
}

type Tab = 'teams' | 'schedule' | 'control' | 'approvals';

export default function AdminDashboard() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [settings, setSettings] = useState<any>(null);

  // Team form
  const [teamName, setTeamName] = useState('');
  const [teamNumber, setTeamNumber] = useState('');

  // Schedule form
  const [matchType, setMatchType] = useState<'1v1' | '2v2'>('2v2');
  const [matchCount, setMatchCount] = useState(6);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login?redirect=admin'); return; }
    if (!isAdmin) { navigate('/'); return; }
  }, [user, isAdmin, navigate]);

  const refresh = useCallback(async () => {
    try {
      const [t, m, s] = await Promise.all([
        api.fetchTeams(), api.fetchMatches(), api.fetchSettings()
      ]);
      setTeams(t);
      setMatches(m);
      setSettings(s);
    } catch (e) {
      console.error('Refresh failed:', e);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const showMsg = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  // ─── Team Actions ────────────────────────────────────────────
  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setLoading(true);
    try {
      await api.addTeam(teamName.trim(), teamNumber ? parseInt(teamNumber) : undefined);
      setTeamName(''); setTeamNumber('');
      showMsg('Team added!');
      await refresh();
    } catch (err: any) {
      showMsg(err.message, true);
    } finally { setLoading(false); }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Delete this team? This will also delete any matches they are in.')) return;
    try {
      await api.deleteTeam(id);
      showMsg('Team deleted');
      await refresh();
    } catch (err: any) { showMsg(err.message, true); }
  };

  // ─── Schedule Actions ────────────────────────────────────────
  const handleGenerateSchedule = async () => {
    setLoading(true);
    try {
      const result = await api.generateSchedule(matchType, matchCount);
      showMsg(`Generated ${result.count} matches!`);
      await refresh();
    } catch (err: any) { showMsg(err.message, true); }
    finally { setLoading(false); }
  };

  const handleDeleteAllMatches = async () => {
    if (!confirm('Delete ALL matches? This cannot be undone.')) return;
    try {
      await api.deleteAllMatches();
      showMsg('All matches deleted');
      await refresh();
    } catch (err: any) { showMsg(err.message, true); }
  };

  const handleDeleteMatch = async (id: string) => {
    try {
      await api.deleteMatch(id);
      showMsg('Match deleted');
      await refresh();
    } catch (err: any) { showMsg(err.message, true); }
  };

  // ─── Approval Actions ────────────────────────────────────────
  const handleApprove = async (id: string) => {
    try {
      await api.updateMatchStatus(id, 'completed');
      showMsg('Match approved!');
      await refresh();
    } catch (err: any) { showMsg(err.message, true); }
  };

  const handleReject = async (id: string) => {
    try {
      await api.updateMatchStatus(id, 'scheduled');
      showMsg('Match sent back to scheduled');
      await refresh();
    } catch (err: any) { showMsg(err.message, true); }
  };

  // ─── Audience Control ────────────────────────────────────────
  const setAudienceView = async (view: string) => {
    try {
      await api.updateSettings({ audience_view: view });
      await refresh();
    } catch (err: any) { showMsg(err.message, true); }
  };

  const setActiveMatch = async (matchId: string | null) => {
    try {
      await api.updateSettings({ active_match_id: matchId });
      await refresh();
    } catch (err: any) { showMsg(err.message, true); }
  };

  // ─── Pending Approvals ───────────────────────────────────────
  const pendingMatches = matches.filter(m => m.status === 'judge_submitted');

  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      scheduled: { cls: 'badge-gray', label: 'Scheduled' },
      playing: { cls: 'badge-yellow', label: 'LIVE' },
      judge_submitted: { cls: 'badge-blue', label: 'Pending' },
      completed: { cls: 'badge-green', label: 'Completed' },
    };
    const s = map[status] || { cls: 'badge-gray', label: status };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  const getRedTotal = (m: Match) => calcTotalScore(
    m.score_auto_red, m.score_teleop_red, m.fouls_minor_blue, m.fouls_major_blue
  );
  const getBlueTotal = (m: Match) => calcTotalScore(
    m.score_auto_blue, m.score_teleop_blue, m.fouls_minor_red, m.fouls_major_red
  );

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #020617, #0a0e1a)' }}>
      {/* Header */}
      <header className="glass-card mx-4 mt-4 mb-6 px-6 py-4 flex items-center justify-between"
        style={{ borderRadius: '16px' }}>
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              Admin Panel
            </h1>
            <p className="text-xs text-gray-400">UniBotics Competition Manager</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            <span className="status-dot live mr-2"></span>
            Logged in as <span className="text-white font-semibold">{user.username}</span>
          </span>
          <button onClick={() => { logout(); navigate('/'); }}
            className="btn-outline py-2 px-4 flex items-center gap-2 text-sm">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      {/* Notifications */}
      {(error || success) && (
        <div className={`mx-4 mb-4 p-4 rounded-xl text-sm font-medium flex items-center gap-2 animate-fadeIn ${
          error ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                : 'bg-green-500/10 border border-green-500/30 text-green-300'
        }`}>
          {error ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {error || success}
        </div>
      )}

      {/* Tabs */}
      <div className="mx-4 mb-6 glass-card flex overflow-x-auto" style={{ borderRadius: '16px' }}>
        {[
          { id: 'teams' as Tab, label: 'Teams', icon: <Users className="w-4 h-4" />, count: teams.length },
          { id: 'schedule' as Tab, label: 'Schedule', icon: <Calendar className="w-4 h-4" />, count: matches.length },
          { id: 'control' as Tab, label: 'Live Control', icon: <Monitor className="w-4 h-4" /> },
          { id: 'approvals' as Tab, label: 'Approvals', icon: <CheckCircle className="w-4 h-4" />, count: pendingMatches.length },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`nav-tab flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'active' : ''}`}>
            {tab.icon} {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-300">
                {tab.count}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center px-4">
          <button onClick={refresh} className="text-gray-400 hover:text-white transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-4 pb-8">
        {/* ─── TEAMS TAB ──────────────────────────────────────── */}
        {activeTab === 'teams' && (
          <div className="animate-fadeIn">
            <div className="glass-card p-6 mb-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2"
                style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <Plus className="w-5 h-5 text-blue-400" /> Add Team
              </h2>
              <form onSubmit={handleAddTeam} className="flex gap-3">
                <input
                  type="text" value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  placeholder="Team Name" className="input-field flex-1"
                />
                <input
                  type="number" value={teamNumber}
                  onChange={e => setTeamNumber(e.target.value)}
                  placeholder="Team # (optional)" className="input-field w-40"
                />
                <button type="submit" disabled={loading || !teamName.trim()}
                  className="btn-primary flex items-center gap-2 whitespace-nowrap">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </form>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-300">
                  Registered Teams ({teams.length})
                </h3>
              </div>
              {teams.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No teams registered yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/30">
                  {teams.map((team, i) => (
                    <div key={team.id}
                      className="flex items-center justify-between px-6 py-4 hover:bg-gray-800/30 transition-colors"
                      style={{ animationDelay: `${i * 0.05}s` }}>
                      <div className="flex items-center gap-4">
                        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-sm font-bold">
                          {i + 1}
                        </span>
                        <div>
                          <span className="font-medium">{team.name}</span>
                          {team.team_number && (
                            <span className="ml-2 text-xs text-gray-500">#{team.team_number}</span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteTeam(team.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── SCHEDULE TAB ───────────────────────────────────── */}
        {activeTab === 'schedule' && (
          <div className="animate-fadeIn">
            <div className="glass-card p-6 mb-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2"
                style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <Calendar className="w-5 h-5 text-blue-400" /> Generate Schedule
              </h2>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Match Type</label>
                  <div className="flex gap-2">
                    {(['1v1', '2v2'] as const).map(type => (
                      <button key={type} onClick={() => setMatchType(type)}
                        className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                          matchType === type
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Number of Matches</label>
                  <input type="number" min={1} max={50} value={matchCount}
                    onChange={e => setMatchCount(parseInt(e.target.value) || 1)}
                    className="input-field w-28" />
                </div>
                <button onClick={handleGenerateSchedule} disabled={loading}
                  className="btn-primary flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Generate
                </button>
                {matches.length > 0 && (
                  <button onClick={handleDeleteAllMatches} className="btn-danger flex items-center gap-2">
                    <Trash2 className="w-4 h-4" /> Delete All
                  </button>
                )}
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-gray-700/50">
                <h3 className="font-semibold text-gray-300">Match List ({matches.length})</h3>
              </div>
              {matches.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No matches scheduled yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/30">
                  {matches.map(match => (
                    <div key={match.id} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-bold text-gray-500 w-16">
                            Match {match.match_number}
                          </span>
                          <span className="badge badge-gray text-xs">{match.match_type}</span>
                          {getStatusBadge(match.status)}
                        </div>
                        <button onClick={() => handleDeleteMatch(match.id)}
                          className="text-gray-500 hover:text-red-400 transition-colors p-2">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-red-500"></span>
                          <span className="text-red-300">
                            {match.red_team1?.name || '?'}
                            {match.match_type === '2v2' && ` & ${match.red_team2?.name || '?'}`}
                          </span>
                        </div>
                        <span className="text-gray-600 font-bold">vs</span>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                          <span className="text-blue-300">
                            {match.blue_team1?.name || '?'}
                            {match.match_type === '2v2' && ` & ${match.blue_team2?.name || '?'}`}
                          </span>
                        </div>
                        {match.status === 'completed' && (
                          <span className="ml-auto text-gray-400">
                            <span className="text-red-300 font-bold">{getRedTotal(match)}</span>
                            {' - '}
                            <span className="text-blue-300 font-bold">{getBlueTotal(match)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── LIVE CONTROL TAB ───────────────────────────────── */}
        {activeTab === 'control' && (
          <div className="animate-fadeIn space-y-6">
            {/* Audience View Control */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2"
                style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <Eye className="w-5 h-5 text-blue-400" /> Audience Display
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Control what the audience sees on the big screen.
                Current: <span className="text-white font-semibold">{settings?.audience_view || 'standby'}</span>
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { view: 'standby', label: 'Standby', icon: <EyeOff className="w-5 h-5" />, desc: 'Show UniBotics logo' },
                  { view: 'match', label: 'Live Match', icon: <Monitor className="w-5 h-5" />, desc: 'Show active match' },
                  { view: 'rankings', label: 'Rankings', icon: <BarChart3 className="w-5 h-5" />, desc: 'Show leaderboard' },
                  { view: 'results', label: 'Results', icon: <Trophy className="w-5 h-5" />, desc: 'Show score breakdown' },
                ].map(item => (
                  <button key={item.view} onClick={() => setAudienceView(item.view)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      settings?.audience_view === item.view
                        ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}>
                    <div className="mb-2">{item.icon}</div>
                    <div className="font-semibold text-sm">{item.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Match Selection */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2"
                style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <Trophy className="w-5 h-5 text-yellow-400" /> Active Match
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Select which match the Judge and Audience see.
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <button onClick={() => setActiveMatch(null)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    !settings?.active_match_id
                      ? 'bg-gray-700 border border-gray-500'
                      : 'bg-gray-800/50 border border-gray-700/50 hover:border-gray-600'
                  }`}>
                  <span className="text-sm text-gray-400">None Selected</span>
                </button>
                {matches.filter(m => m.status !== 'completed').map(match => (
                  <button key={match.id} onClick={() => setActiveMatch(match.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      settings?.active_match_id === match.id
                        ? 'bg-blue-600/20 border border-blue-500'
                        : 'bg-gray-800/50 border border-gray-700/50 hover:border-gray-600'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Match {match.match_number}</span>
                      {getStatusBadge(match.status)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      <span className="text-red-300">{match.red_team1?.name}</span>
                      {match.match_type === '2v2' && <span className="text-red-300"> & {match.red_team2?.name}</span>}
                      {' vs '}
                      <span className="text-blue-300">{match.blue_team1?.name}</span>
                      {match.match_type === '2v2' && <span className="text-blue-300"> & {match.blue_team2?.name}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── APPROVALS TAB ─────────────────────────────────── */}
        {activeTab === 'approvals' && (
          <div className="animate-fadeIn">
            {pendingMatches.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500/30" />
                <p className="text-gray-400 text-lg">No pending approvals</p>
                <p className="text-gray-600 text-sm mt-2">
                  Matches submitted by judges will appear here for review
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingMatches.map(match => {
                  const redTotal = getRedTotal(match);
                  const blueTotal = getBlueTotal(match);
                  return (
                    <div key={match.id} className="glass-card p-6 animate-fadeIn">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-lg" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                            Match {match.match_number}
                          </h3>
                          {getStatusBadge(match.status)}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(match.id)}
                            className="btn-success flex items-center gap-2 py-2 px-4">
                            <CheckCircle className="w-4 h-4" /> Approve
                          </button>
                          <button onClick={() => handleReject(match.id)}
                            className="btn-danger flex items-center gap-2 py-2 px-4">
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      </div>

                      {/* Score Breakdown */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Red */}
                        <div className="glass-card-red p-4">
                          <h4 className="text-red-400 font-bold text-sm mb-3 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span>
                            Red Alliance
                          </h4>
                          <p className="text-xs text-red-300/70 mb-3">
                            {match.red_team1?.name}
                            {match.match_type === '2v2' && ` & ${match.red_team2?.name}`}
                          </p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Auto</span>
                              <span className="font-bold">{match.score_auto_red}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">TeleOp</span>
                              <span className="font-bold">{match.score_teleop_red}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Minor Fouls</span>
                              <span className="font-bold text-yellow-400">{match.fouls_minor_red}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Major Fouls</span>
                              <span className="font-bold text-orange-400">{match.fouls_major_red}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-red-500/20">
                              <span className="text-gray-300 font-semibold">Total</span>
                              <span className="font-black text-lg text-red-300">{redTotal}</span>
                            </div>
                          </div>
                        </div>

                        {/* Blue */}
                        <div className="glass-card-blue p-4">
                          <h4 className="text-blue-400 font-bold text-sm mb-3 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                            Blue Alliance
                          </h4>
                          <p className="text-xs text-blue-300/70 mb-3">
                            {match.blue_team1?.name}
                            {match.match_type === '2v2' && ` & ${match.blue_team2?.name}`}
                          </p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Auto</span>
                              <span className="font-bold">{match.score_auto_blue}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">TeleOp</span>
                              <span className="font-bold">{match.score_teleop_blue}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Minor Fouls</span>
                              <span className="font-bold text-yellow-400">{match.fouls_minor_blue}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Major Fouls</span>
                              <span className="font-bold text-orange-400">{match.fouls_major_blue}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-blue-500/20">
                              <span className="text-gray-300 font-semibold">Total</span>
                              <span className="font-black text-lg text-blue-300">{blueTotal}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
