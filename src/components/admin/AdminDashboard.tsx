import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { computeMatchTotals, EMPTY_BREAKDOWN } from '../../utils/scoring';
import * as api from '../../utils/api';
import {
  Shield, Plus, Trash2, Calendar, Users, Eye, EyeOff, CheckCircle, XCircle,
  LogOut, Trophy, Monitor, BarChart3, AlertTriangle, RefreshCw, UserPlus, Gavel, Edit2, Save
} from 'lucide-react';

interface Team { id: string; name: string; team_number: number | null; }
interface Judge { id: string; username: string; role: string; judge_type: 'red' | 'blue' | null; }

type Tab = 'teams' | 'schedule' | 'control' | 'approvals' | 'judges';

export default function AdminDashboard() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('teams');
  const [teams, setTeams]     = useState<Team[]>([]);
  const [matches, setMatches] = useState<api.Match[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [judges, setJudges]   = useState<Judge[]>([]);

  // Team form
  const [teamName, setTeamName]     = useState('');
  const [teamNumber, setTeamNumber] = useState('');

  // Schedule form
  const [matchType, setMatchType]   = useState<'1v1' | '2v2'>('2v2');
  const [matchCount, setMatchCount] = useState(6);

  // Judge creation form
  const [judgeUsername, setJudgeUsername] = useState('');
  const [judgePassword, setJudgePassword] = useState('');
  const [judgeType, setJudgeType]         = useState<'red' | 'blue'>('red');

  // Score override state
  const [overrideMatchId, setOverrideMatchId] = useState<string | null>(null);
  const [overrideRed, setOverrideRed]   = useState<any>({});
  const [overrideBlue, setOverrideBlue] = useState<any>({});
  const [overrideFoulsMinorRed, setOverrideFoulsMinorRed]   = useState(0);
  const [overrideFoulsMajorRed, setOverrideFoulsMajorRed]   = useState(0);
  const [overrideFoulsMinorBlue, setOverrideFoulsMinorBlue] = useState(0);
  const [overrideFoulsMajorBlue, setOverrideFoulsMajorBlue] = useState(0);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  useEffect(() => {
    if (!user) { navigate('/login?redirect=admin'); return; }
    if (!isAdmin) { navigate('/'); return; }
  }, [user, isAdmin, navigate]);

  const refresh = useCallback(async () => {
    try {
      const [t, m, s, j] = await Promise.all([
        api.fetchTeams(), api.fetchMatches(), api.fetchSettings(), api.fetchJudges()
      ]);
      setTeams(t); setMatches(m); setSettings(s); setJudges(j);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const i = setInterval(refresh, 5000);
    return () => clearInterval(i);
  }, [refresh]);

  const showMsg = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(''); } else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  // ─── Team Actions ─────────────────────────────────────────────
  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setLoading(true);
    try {
      await api.addTeam(teamName.trim(), teamNumber ? parseInt(teamNumber) : undefined);
      setTeamName(''); setTeamNumber('');
      showMsg('Team added!'); await refresh();
    } catch (err: any) { showMsg(err.message, true); }
    finally { setLoading(false); }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Delete this team? This also deletes their matches.')) return;
    try { await api.deleteTeam(id); showMsg('Team deleted'); await refresh(); }
    catch (err: any) { showMsg(err.message, true); }
  };

  // ─── Schedule Actions ─────────────────────────────────────────
  const handleGenerateSchedule = async () => {
    setLoading(true);
    try { const r = await api.generateSchedule(matchType, matchCount); showMsg(`Generated ${r.count} matches!`); await refresh(); }
    catch (err: any) { showMsg(err.message, true); }
    finally { setLoading(false); }
  };

  const handleDeleteAllMatches = async () => {
    if (!confirm('Delete ALL matches? Cannot be undone.')) return;
    try { await api.deleteAllMatches(); showMsg('All matches deleted'); await refresh(); }
    catch (err: any) { showMsg(err.message, true); }
  };

  const handleDeleteMatch = async (id: string) => {
    try { await api.deleteMatch(id); showMsg('Match deleted'); await refresh(); }
    catch (err: any) { showMsg(err.message, true); }
  };

  // ─── Approvals ────────────────────────────────────────────────
  const handleApprove = async (id: string) => {
    try { await api.updateMatchStatus(id, 'completed'); showMsg('Match approved!'); await refresh(); }
    catch (err: any) { showMsg(err.message, true); }
  };

  const handleReject = async (id: string) => {
    try { await api.updateMatchStatus(id, 'scheduled'); showMsg('Sent back to Scheduled'); await refresh(); }
    catch (err: any) { showMsg(err.message, true); }
  };

  const handleOverrideSave = async (id: string) => {
    setLoading(true);
    try {
      await api.overrideMatchScore(id, {
        score_breakdown_red: overrideRed, score_breakdown_blue: overrideBlue,
        fouls_minor_red: overrideFoulsMinorRed, fouls_major_red: overrideFoulsMajorRed,
        fouls_minor_blue: overrideFoulsMinorBlue, fouls_major_blue: overrideFoulsMajorBlue,
      });
      showMsg('Scores overridden!'); setOverrideMatchId(null); await refresh();
    } catch (err: any) { showMsg(err.message, true); }
    finally { setLoading(false); }
  };

  // ─── Audience Control ─────────────────────────────────────────
  const setAudienceView = async (view: string) => {
    try { await api.updateSettings({ audience_view: view }); await refresh(); }
    catch (err: any) { showMsg(err.message, true); }
  };

  const setActiveMatch = async (matchId: string | null) => {
    try { await api.updateSettings({ active_match_id: matchId }); await refresh(); }
    catch (err: any) { showMsg(err.message, true); }
  };

  // ─── Judge Management ─────────────────────────────────────────
  const handleCreateJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!judgeUsername.trim() || !judgePassword.trim()) return;
    setLoading(true);
    try {
      await api.createJudge(judgeUsername.trim(), judgePassword, judgeType);
      setJudgeUsername(''); setJudgePassword('');
      showMsg(`Judge "${judgeUsername}" created!`); await refresh();
    } catch (err: any) { showMsg(err.message, true); }
    finally { setLoading(false); }
  };

  const handleDeleteJudge = async (id: string, username: string) => {
    if (!confirm(`Delete judge "${username}"?`)) return;
    try { await api.deleteJudge(id); showMsg('Judge deleted'); await refresh(); }
    catch (err: any) { showMsg(err.message, true); }
  };

  // ─── Helpers ─────────────────────────────────────────────────
  const pendingMatches = matches.filter(m => m.status === 'judge_submitted');

  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      scheduled:       { cls: 'badge-gray',   label: 'Scheduled' },
      playing:         { cls: 'badge-yellow', label: 'LIVE' },
      judge_submitted: { cls: 'badge-blue',   label: 'Pending' },
      completed:       { cls: 'badge-green',  label: 'Completed' },
    };
    const s = map[status] || { cls: 'badge-gray', label: status };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  const getMatchTotals = (m: api.Match) => computeMatchTotals(
    m.score_breakdown_red ?? {}, m.score_breakdown_blue ?? {},
    m.fouls_minor_red, m.fouls_major_red, m.fouls_minor_blue, m.fouls_major_blue,
  );

  if (!user || !isAdmin) return null;

  const tabs = [
    { id: 'teams'     as Tab, label: 'Teams',       icon: <Users className="w-4 h-4" />,       count: teams.length },
    { id: 'schedule'  as Tab, label: 'Schedule',    icon: <Calendar className="w-4 h-4" />,     count: matches.length },
    { id: 'control'   as Tab, label: 'Live Control',icon: <Monitor className="w-4 h-4" /> },
    { id: 'approvals' as Tab, label: 'Approvals',   icon: <CheckCircle className="w-4 h-4" />,  count: pendingMatches.length },
    { id: 'judges'    as Tab, label: 'Judges',       icon: <Gavel className="w-4 h-4" />,        count: judges.length },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #020617, #0a0e1a)' }}>
      {/* Header */}
      <header className="glass-card mx-4 mt-4 mb-6 px-6 py-4 flex items-center justify-between" style={{ borderRadius: '16px' }}>
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>Admin Panel</h1>
            <p className="text-xs text-gray-400">UniBotics Competition Manager</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 hidden md:inline">
            <span className="status-dot live mr-2" />Logged in as <span className="text-white font-semibold">{user.username}</span>
          </span>
          <button onClick={refresh} className="text-gray-400 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => { logout(); navigate('/'); }} className="btn-outline py-2 px-4 flex items-center gap-2 text-sm">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      {/* Notifications */}
      {(error || success) && (
        <div className={`mx-4 mb-4 p-4 rounded-xl text-sm font-medium flex items-center gap-2 animate-fadeIn ${error ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-green-500/10 border border-green-500/30 text-green-300'}`}>
          {error ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {error || success}
        </div>
      )}

      {/* Tabs */}
      <div className="mx-4 mb-6 glass-card flex overflow-x-auto" style={{ borderRadius: '16px' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`nav-tab flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'active' : ''}`}>
            {tab.icon} {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-300">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mx-4 pb-8">

        {/* ─── TEAMS ──────────────────────────────────────────── */}
        {activeTab === 'teams' && (
          <div className="animate-fadeIn">
            <div className="glass-card p-6 mb-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <Plus className="w-5 h-5 text-blue-400" /> Add Team
              </h2>
              <form onSubmit={handleAddTeam} className="flex gap-3">
                <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Team Name" className="input-field flex-1" />
                <input type="number" value={teamNumber} onChange={e => setTeamNumber(e.target.value)} placeholder="Team # (optional)" className="input-field w-40" />
                <button type="submit" disabled={loading || !teamName.trim()} className="btn-primary flex items-center gap-2 whitespace-nowrap">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </form>
            </div>
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-gray-700/50">
                <h3 className="font-semibold text-gray-300">Registered Teams ({teams.length})</h3>
              </div>
              {teams.length === 0 ? (
                <div className="p-12 text-center text-gray-500"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No teams yet</p></div>
              ) : (
                <div className="divide-y divide-gray-700/30">
                  {teams.map((team, i) => (
                    <div key={team.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-sm font-bold">{i + 1}</span>
                        <div>
                          <span className="font-medium">{team.name}</span>
                          {team.team_number && <span className="ml-2 text-xs text-gray-500">#{team.team_number}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteTeam(team.id)} className="text-gray-500 hover:text-red-400 transition-colors p-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── SCHEDULE ────────────────────────────────────────── */}
        {activeTab === 'schedule' && (
          <div className="animate-fadeIn">
            <div className="glass-card p-6 mb-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <Calendar className="w-5 h-5 text-blue-400" /> Generate Schedule
              </h2>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Match Type</label>
                  <div className="flex gap-2">
                    {(['1v1', '2v2'] as const).map(type => (
                      <button key={type} onClick={() => setMatchType(type)}
                        className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${matchType === type ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Number of Matches</label>
                  <input type="number" min={1} max={50} value={matchCount}
                    onChange={e => setMatchCount(parseInt(e.target.value) || 1)} className="input-field w-28" />
                </div>
                <button onClick={handleGenerateSchedule} disabled={loading} className="btn-primary flex items-center gap-2">
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
                <div className="p-12 text-center text-gray-500"><Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No matches scheduled</p></div>
              ) : (
                <div className="divide-y divide-gray-700/30">
                  {matches.map(match => (
                    <div key={match.id} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-bold text-gray-500 w-16">Match {match.match_number}</span>
                          <span className="badge badge-gray text-xs">{match.match_type}</span>
                          {getStatusBadge(match.status)}
                        </div>
                        <button onClick={() => handleDeleteMatch(match.id)} className="text-gray-500 hover:text-red-400 transition-colors p-2">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-sm">
                        <span className="text-red-300">{match.red_team1?.name}{match.match_type === '2v2' && ` & ${match.red_team2?.name}`}</span>
                        <span className="text-gray-600 font-bold">vs</span>
                        <span className="text-blue-300">{match.blue_team1?.name}{match.match_type === '2v2' && ` & ${match.blue_team2?.name}`}</span>
                        {match.status === 'completed' && (() => { const t = getMatchTotals(match); return <span className="ml-auto text-gray-400 text-xs"><span className="text-red-300 font-bold">{t.redTotal}</span> — <span className="text-blue-300 font-bold">{t.blueTotal}</span></span>; })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── LIVE CONTROL ────────────────────────────────────── */}
        {activeTab === 'control' && (
          <div className="animate-fadeIn space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <Eye className="w-5 h-5 text-blue-400" /> Audience Display
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Current: <span className="text-white font-semibold">{settings?.audience_view || 'standby'}</span>
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { view: 'standby',  label: 'Standby',    icon: <EyeOff className="w-5 h-5" />,   desc: 'Show UniBotics logo' },
                  { view: 'match',    label: 'Live Match',  icon: <Monitor className="w-5 h-5" />,  desc: 'Show active match' },
                  { view: 'rankings', label: 'Rankings',    icon: <BarChart3 className="w-5 h-5" />,desc: 'Show leaderboard' },
                  { view: 'results',  label: 'Results',     icon: <Trophy className="w-5 h-5" />,   desc: 'Show score breakdown' },
                ].map(item => (
                  <button key={item.view} onClick={() => setAudienceView(item.view)}
                    className={`p-4 rounded-xl border text-left transition-all ${settings?.audience_view === item.view ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}>
                    <div className="mb-2">{item.icon}</div>
                    <div className="font-semibold text-sm">{item.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="glass-card p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <Trophy className="w-5 h-5 text-yellow-400" /> Active Match
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <button onClick={() => setActiveMatch(null)}
                  className={`w-full text-left p-3 rounded-lg transition-all border ${!settings?.active_match_id ? 'bg-gray-700 border-gray-500' : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'}`}>
                  <span className="text-sm text-gray-400">None Selected</span>
                </button>
                {matches.filter(m => m.status !== 'completed').map(match => (
                  <button key={match.id} onClick={() => setActiveMatch(match.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all border ${settings?.active_match_id === match.id ? 'bg-blue-600/20 border-blue-500' : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'}`}>
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

        {/* ─── APPROVALS ───────────────────────────────────────── */}
        {activeTab === 'approvals' && (
          <div className="animate-fadeIn">
            {pendingMatches.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500/30" />
                <p className="text-gray-400 text-lg">No pending approvals</p>
                <p className="text-gray-600 text-sm mt-2">Judge submissions appear here</p>
              </div>
            ) : (
              <div className="space-y-6">
                {pendingMatches.map(match => {
                  const totals = getMatchTotals(match);
                  const isOverriding = overrideMatchId === match.id;
                  return (
                    <div key={match.id} className="glass-card p-6 animate-fadeIn">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-lg" style={{ fontFamily: "'Orbitron', sans-serif" }}>Match {match.match_number}</h3>
                          {getStatusBadge(match.status)}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => {
                            if (isOverriding) { setOverrideMatchId(null); return; }
                            setOverrideMatchId(match.id);
                            setOverrideRed({ ...EMPTY_BREAKDOWN, ...match.score_breakdown_red });
                            setOverrideBlue({ ...EMPTY_BREAKDOWN, ...match.score_breakdown_blue });
                            setOverrideFoulsMinorRed(match.fouls_minor_red); setOverrideFoulsMajorRed(match.fouls_major_red);
                            setOverrideFoulsMinorBlue(match.fouls_minor_blue); setOverrideFoulsMajorBlue(match.fouls_major_blue);
                          }} className="btn-outline flex items-center gap-2 py-2 px-3 text-sm">
                            <Edit2 className="w-4 h-4" /> {isOverriding ? 'Cancel' : 'Override'}
                          </button>
                          {isOverriding && (
                            <button onClick={() => handleOverrideSave(match.id)} disabled={loading}
                              className="btn-primary flex items-center gap-2 py-2 px-3 text-sm">
                              <Save className="w-4 h-4" /> Save Override
                            </button>
                          )}
                          <button onClick={() => handleApprove(match.id)} className="btn-success flex items-center gap-2 py-2 px-4">
                            <CheckCircle className="w-4 h-4" /> Approve
                          </button>
                          <button onClick={() => handleReject(match.id)} className="btn-danger flex items-center gap-2 py-2 px-4">
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      </div>

                      {/* Score Display / Override */}
                      <div className="grid grid-cols-2 gap-4">
                        {(['red', 'blue'] as const).map(side => {
                          const total = side === 'red' ? totals.redTotal : totals.blueTotal;
                          const t1 = side === 'red' ? match.red_team1 : match.blue_team1;
                          const t2 = side === 'red' ? match.red_team2 : match.blue_team2;
                          const fMinor = side === 'red' ? (isOverriding ? overrideFoulsMinorRed : match.fouls_minor_red) : (isOverriding ? overrideFoulsMinorBlue : match.fouls_minor_blue);
                          const fMajor = side === 'red' ? (isOverriding ? overrideFoulsMajorRed : match.fouls_major_red) : (isOverriding ? overrideFoulsMajorBlue : match.fouls_major_blue);
                          const setFMinor = side === 'red' ? setOverrideFoulsMinorRed : setOverrideFoulsMinorBlue;
                          const setFMajor = side === 'red' ? setOverrideFoulsMajorRed : setOverrideFoulsMajorBlue;
                          const cardClass = side === 'red' ? 'glass-card-red' : 'glass-card-blue';
                          const c = side === 'red' ? 'text-red-300' : 'text-blue-300';

                          return (
                            <div key={side} className={`${cardClass} p-4 rounded-xl`}>
                              <h4 className={`font-bold text-sm mb-1 ${c}`}>
                                {t1?.name}{match.match_type === '2v2' && t2 ? ` & ${t2.name}` : ''}
                              </h4>
                              <div className="space-y-2 text-sm mt-3">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Total Score</span>
                                  <span className={`font-black text-xl ${c}`}>{total}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-400">Minor Fouls</span>
                                  {isOverriding ? (
                                    <input type="number" min={0} value={fMinor}
                                      onChange={e => setFMinor(parseInt(e.target.value) || 0)}
                                      className="input-field w-16 text-center py-1 text-sm" />
                                  ) : <span className="font-bold text-yellow-400">{fMinor}</span>}
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-400">Major Fouls</span>
                                  {isOverriding ? (
                                    <input type="number" min={0} value={fMajor}
                                      onChange={e => setFMajor(parseInt(e.target.value) || 0)}
                                      className="input-field w-16 text-center py-1 text-sm" />
                                  ) : <span className="font-bold text-orange-400">{fMajor}</span>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── JUDGES ──────────────────────────────────────────── */}
        {activeTab === 'judges' && (
          <div className="animate-fadeIn">
            <div className="glass-card p-6 mb-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <UserPlus className="w-5 h-5 text-blue-400" /> Create Judge Account
              </h2>
              <form onSubmit={handleCreateJudge} className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Username</label>
                  <input type="text" value={judgeUsername} onChange={e => setJudgeUsername(e.target.value)}
                    placeholder="judge_red1" className="input-field w-36" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Password</label>
                  <input type="password" value={judgePassword} onChange={e => setJudgePassword(e.target.value)}
                    placeholder="••••••••" className="input-field w-36" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Alliance</label>
                  <div className="flex gap-2">
                    {(['red', 'blue'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setJudgeType(t)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${judgeType === t
                          ? t === 'red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                        {t === 'red' ? '🔴 Red' : '🔵 Blue'}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={loading || !judgeUsername.trim() || !judgePassword.trim()}
                  className="btn-primary flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> Create
                </button>
              </form>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-gray-700/50">
                <h3 className="font-semibold text-gray-300">Judge Accounts ({judges.length})</h3>
              </div>
              {judges.length === 0 ? (
                <div className="p-12 text-center text-gray-500"><Gavel className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No judges created yet</p></div>
              ) : (
                <div className="divide-y divide-gray-700/30">
                  {judges.map(judge => (
                    <div key={judge.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${judge.judge_type === 'red' ? 'bg-red-600/30 text-red-400' : 'bg-blue-600/30 text-blue-400'}`}>
                          {judge.judge_type === 'red' ? '🔴' : '🔵'}
                        </div>
                        <div>
                          <span className="font-medium">{judge.username}</span>
                          <span className={`ml-2 text-xs ${judge.judge_type === 'red' ? 'text-red-400' : 'text-blue-400'}`}>
                            {judge.judge_type === 'red' ? 'Red Alliance' : 'Blue Alliance'}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteJudge(judge.id, judge.username)}
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

      </div>
    </div>
  );
}
