import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as api from '../../utils/api';
import { playStartSound, playWarningSound, playEndSound, initAudio } from '../../utils/sounds';
import {
  Gavel, Play, Pause, RotateCcw, Send, LogOut, AlertCircle, CheckCircle, Timer, RefreshCw
} from 'lucide-react';

const MATCH_DURATION = 150; // 2 minutes 30 seconds
const WARNING_TIME = 30;   // Warning at 30 seconds remaining

interface Team { id: string; name: string; team_number: number | null; }
interface Match {
  id: string; match_number: number; match_type: string; status: string;
  red_team1: Team | null; red_team2: Team | null;
  blue_team1: Team | null; blue_team2: Team | null;
}

export default function JudgeDashboard() {
  const { user, logout, isJudge, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [settings, setSettings] = useState<any>(null);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(MATCH_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [matchStarted, setMatchStarted] = useState(false);
  const [matchEnded, setMatchEnded] = useState(false);
  const warningPlayed = useRef(false);
  const endPlayed = useRef(false);

  // Score state
  const [scoreAutoRed, setScoreAutoRed] = useState(0);
  const [scoreTeleopRed, setScoreTeleopRed] = useState(0);
  const [foulsMinorRed, setFoulsMinorRed] = useState(0);
  const [foulsMajorRed, setFoulsMajorRed] = useState(0);
  const [scoreAutoBlue, setScoreAutoBlue] = useState(0);
  const [scoreTeleopBlue, setScoreTeleopBlue] = useState(0);
  const [foulsMinorBlue, setFoulsMinorBlue] = useState(0);
  const [foulsMajorBlue, setFoulsMajorBlue] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login?redirect=judge'); return; }
    if (!isJudge && !isAdmin) { navigate('/'); return; }
  }, [user, isJudge, isAdmin, navigate]);

  // Fetch active match
  const refresh = useCallback(async () => {
    try {
      const [allMatches, s] = await Promise.all([
        api.fetchMatches(), api.fetchSettings()
      ]);
      setSettings(s);
      if (s?.active_match_id) {
        const match = allMatches.find((m: Match) => m.id === s.active_match_id);
        setActiveMatch(match || null);
      } else {
        setActiveMatch(null);
      }
    } catch (e) {
      console.error('Refresh failed:', e);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Timer logic
  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        // Warning sound at 30 seconds
        if (next === WARNING_TIME && !warningPlayed.current) {
          warningPlayed.current = true;
          playWarningSound();
        }
        // End sound
        if (next <= 0 && !endPlayed.current) {
          endPlayed.current = true;
          playEndSound();
          setIsRunning(false);
          setMatchEnded(true);
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartMatch = async () => {
    initAudio();
    playStartSound();
    setIsRunning(true);
    setMatchStarted(true);
    setMatchEnded(false);
    warningPlayed.current = false;
    endPlayed.current = false;
    setTimeLeft(MATCH_DURATION);

    // Update match status to playing
    if (activeMatch) {
      try {
        await api.updateMatchStatus(activeMatch.id, 'playing');
      } catch (e) { console.error(e); }
    }
  };

  const handlePauseResume = () => {
    if (isRunning) {
      setIsRunning(false);
    } else {
      initAudio();
      setIsRunning(true);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setMatchStarted(false);
    setMatchEnded(false);
    setTimeLeft(MATCH_DURATION);
    warningPlayed.current = false;
    endPlayed.current = false;
  };

  const handleSubmit = async () => {
    if (!activeMatch) return;
    setLoading(true);
    setError('');
    try {
      await api.submitScore(activeMatch.id, {
        score_auto_red: scoreAutoRed,
        score_teleop_red: scoreTeleopRed,
        fouls_minor_red: foulsMinorRed,
        fouls_major_red: foulsMajorRed,
        score_auto_blue: scoreAutoBlue,
        score_teleop_blue: scoreTeleopBlue,
        fouls_minor_blue: foulsMinorBlue,
        fouls_major_blue: foulsMajorBlue,
      });
      setSuccess('Scores submitted for admin approval!');
      setTimeout(() => setSuccess(''), 3000);
      handleReset();
      // Reset scores
      setScoreAutoRed(0); setScoreTeleopRed(0); setFoulsMinorRed(0); setFoulsMajorRed(0);
      setScoreAutoBlue(0); setScoreTeleopBlue(0); setFoulsMinorBlue(0); setFoulsMajorBlue(0);
      await refresh();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally { setLoading(false); }
  };

  const timerColor = timeLeft <= WARNING_TIME
    ? (timeLeft <= 10 ? 'timer-danger' : 'timer-warning')
    : 'text-white';

  const redTotal = scoreAutoRed + scoreTeleopRed + (foulsMinorBlue * 5) + (foulsMajorBlue * 10);
  const blueTotal = scoreAutoBlue + scoreTeleopBlue + (foulsMinorRed * 5) + (foulsMajorRed * 10);

  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #020617, #0a0e1a)' }}>
      {/* Header */}
      <header className="glass-card mx-4 mt-4 mb-6 px-6 py-4 flex items-center justify-between"
        style={{ borderRadius: '16px' }}>
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
            <Gavel className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              Judge Panel
            </h1>
            <p className="text-xs text-gray-400">UniBotics Competition</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={refresh} className="text-gray-400 hover:text-white transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
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
          {error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {error || success}
        </div>
      )}

      {/* No Active Match */}
      {!activeMatch ? (
        <div className="mx-4 glass-card p-16 text-center">
          <Timer className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h2 className="text-2xl font-bold text-gray-400 mb-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            No Active Match
          </h2>
          <p className="text-gray-500">Waiting for Admin to select and activate a match...</p>
        </div>
      ) : (
        <div className="mx-4 pb-8 space-y-6">
          {/* Match Info Header */}
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-gray-400 mb-1 tracking-widest uppercase">
              {activeMatch.match_type} Match
            </p>
            <h2 className="text-3xl font-black tracking-wider mb-4"
              style={{ fontFamily: "'Orbitron', sans-serif" }}>
              Match {activeMatch.match_number}
            </h2>

            {/* Teams Display */}
            <div className="flex items-center justify-center gap-6 md:gap-12">
              <div className="text-right animate-slideInLeft">
                <div className="text-sm text-gray-500 mb-1 uppercase tracking-wider">Red Alliance</div>
                <div className="text-xl font-bold team-name-red">
                  {activeMatch.red_team1?.name}
                </div>
                {activeMatch.match_type === '2v2' && activeMatch.red_team2 && (
                  <div className="text-lg font-semibold text-red-400/70">
                    {activeMatch.red_team2.name}
                  </div>
                )}
              </div>

              <div className="vs-text text-3xl">VS</div>

              <div className="text-left animate-slideInRight">
                <div className="text-sm text-gray-500 mb-1 uppercase tracking-wider">Blue Alliance</div>
                <div className="text-xl font-bold team-name-blue">
                  {activeMatch.blue_team1?.name}
                </div>
                {activeMatch.match_type === '2v2' && activeMatch.blue_team2 && (
                  <div className="text-lg font-semibold text-blue-400/70">
                    {activeMatch.blue_team2.name}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timer */}
          <div className={`glass-card p-8 text-center ${isRunning ? 'animate-pulse-glow' : ''}`}>
            <div className={`timer-display text-8xl md:text-9xl ${timerColor}`}>
              {formatTime(timeLeft)}
            </div>
            <div className="flex justify-center gap-4 mt-8">
              {!matchStarted ? (
                <button onClick={handleStartMatch}
                  className="btn-success py-4 px-10 text-lg flex items-center gap-3 font-bold">
                  <Play className="w-6 h-6" /> START MATCH
                </button>
              ) : (
                <>
                  <button onClick={handlePauseResume}
                    className={`${isRunning ? 'btn-outline' : 'btn-primary'} py-3 px-6 flex items-center gap-2`}>
                    {isRunning ? <><Pause className="w-5 h-5" /> Pause</> : <><Play className="w-5 h-5" /> Resume</>}
                  </button>
                  <button onClick={handleReset}
                    className="btn-outline py-3 px-6 flex items-center gap-2">
                    <RotateCcw className="w-5 h-5" /> Reset
                  </button>
                </>
              )}
            </div>
            {matchEnded && (
              <div className="mt-4 text-lg font-bold text-yellow-400 animate-fadeIn"
                style={{ fontFamily: "'Orbitron', sans-serif" }}>
                ⏱ MATCH ENDED
              </div>
            )}
          </div>

          {/* Scoring */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Red Alliance Scoring */}
            <div className="glass-card-red p-6">
              <h3 className="text-lg font-bold text-red-400 mb-6 flex items-center gap-2"
                style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <span className="w-4 h-4 rounded-full bg-red-500"></span>
                Red Alliance
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-red-300/70 mb-2">Auto Score</label>
                  <input type="number" min={0} value={scoreAutoRed}
                    onChange={e => setScoreAutoRed(parseInt(e.target.value) || 0)}
                    className="input-field text-center text-2xl font-bold"
                    style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }} />
                </div>
                <div>
                  <label className="block text-sm text-red-300/70 mb-2">TeleOp Score</label>
                  <input type="number" min={0} value={scoreTeleopRed}
                    onChange={e => setScoreTeleopRed(parseInt(e.target.value) || 0)}
                    className="input-field text-center text-2xl font-bold"
                    style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-yellow-300/70 mb-2">Minor Fouls</label>
                    <input type="number" min={0} value={foulsMinorRed}
                      onChange={e => setFoulsMinorRed(parseInt(e.target.value) || 0)}
                      className="input-field text-center text-xl font-bold"
                      style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }} />
                    <p className="text-xs text-gray-500 mt-1 text-center">+5 pts to Blue</p>
                  </div>
                  <div>
                    <label className="block text-sm text-orange-300/70 mb-2">Major Fouls</label>
                    <input type="number" min={0} value={foulsMajorRed}
                      onChange={e => setFoulsMajorRed(parseInt(e.target.value) || 0)}
                      className="input-field text-center text-xl font-bold"
                      style={{ borderColor: 'rgba(234, 88, 12, 0.3)' }} />
                    <p className="text-xs text-gray-500 mt-1 text-center">+10 pts to Blue</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-red-500/20 flex justify-between items-center">
                  <span className="text-gray-400 font-semibold">Total (with opp. fouls)</span>
                  <span className="text-3xl font-black text-red-300">{redTotal}</span>
                </div>
              </div>
            </div>

            {/* Blue Alliance Scoring */}
            <div className="glass-card-blue p-6">
              <h3 className="text-lg font-bold text-blue-400 mb-6 flex items-center gap-2"
                style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <span className="w-4 h-4 rounded-full bg-blue-500"></span>
                Blue Alliance
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-blue-300/70 mb-2">Auto Score</label>
                  <input type="number" min={0} value={scoreAutoBlue}
                    onChange={e => setScoreAutoBlue(parseInt(e.target.value) || 0)}
                    className="input-field text-center text-2xl font-bold"
                    style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }} />
                </div>
                <div>
                  <label className="block text-sm text-blue-300/70 mb-2">TeleOp Score</label>
                  <input type="number" min={0} value={scoreTeleopBlue}
                    onChange={e => setScoreTeleopBlue(parseInt(e.target.value) || 0)}
                    className="input-field text-center text-2xl font-bold"
                    style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-yellow-300/70 mb-2">Minor Fouls</label>
                    <input type="number" min={0} value={foulsMinorBlue}
                      onChange={e => setFoulsMinorBlue(parseInt(e.target.value) || 0)}
                      className="input-field text-center text-xl font-bold"
                      style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }} />
                    <p className="text-xs text-gray-500 mt-1 text-center">+5 pts to Red</p>
                  </div>
                  <div>
                    <label className="block text-sm text-orange-300/70 mb-2">Major Fouls</label>
                    <input type="number" min={0} value={foulsMajorBlue}
                      onChange={e => setFoulsMajorBlue(parseInt(e.target.value) || 0)}
                      className="input-field text-center text-xl font-bold"
                      style={{ borderColor: 'rgba(234, 88, 12, 0.3)' }} />
                    <p className="text-xs text-gray-500 mt-1 text-center">+10 pts to Red</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-blue-500/20 flex justify-between items-center">
                  <span className="text-gray-400 font-semibold">Total (with opp. fouls)</span>
                  <span className="text-3xl font-black text-blue-300">{blueTotal}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button onClick={handleSubmit} disabled={loading || (!matchEnded && matchStarted && isRunning)}
            className="btn-primary w-full py-5 text-lg font-bold flex items-center justify-center gap-3">
            <Send className="w-6 h-6" />
            {loading ? 'Submitting...' : 'Submit Scores to Admin'}
          </button>
        </div>
      )}
    </div>
  );
}
