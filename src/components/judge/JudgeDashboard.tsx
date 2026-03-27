import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as api from '../../utils/api';
import { ScoreBreakdown, EMPTY_BREAKDOWN, POINTS, computeAllianceScore, isAutoPeriod, getTimerFromSettings, MATCH_DURATION } from '../../utils/scoring';
import { playStartSound, playWarningSound, playEndSound, initAudio } from '../../utils/sounds';
import { Gavel, Play, Pause, RotateCcw, Send, LogOut, Timer, RefreshCw, Star, ArrowDown } from 'lucide-react';

const WARNING_TIME = 30;

// ─── Shape definitions ─────────────────────────────────────────
const SHAPES = [
  {
    key: 'boxes' as const,
    label: 'Box',
    color: '#22c55e',
    shape: (size = 40) => (
      <div style={{ width: size, height: size, background: '#22c55e', borderRadius: 6, boxShadow: '0 0 12px rgba(34,197,94,0.5)' }} />
    ),
  },
  {
    key: 'triangles' as const,
    label: 'Triangle',
    color: '#ef4444',
    shape: (size = 40) => (
      <div style={{ width: 0, height: 0, borderLeft: `${size / 2}px solid transparent`, borderRight: `${size / 2}px solid transparent`, borderBottom: `${size}px solid #ef4444`, filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.5))' }} />
    ),
  },
  {
    key: 'circles' as const,
    label: 'Circle',
    color: '#eab308',
    shape: (size = 40) => (
      <div style={{ width: size, height: size, background: '#eab308', borderRadius: '50%', boxShadow: '0 0 12px rgba(234,179,8,0.6)' }} />
    ),
  },
];

// ─── Counter Button Component ─────────────────────────────────
function Counter({ value, onChange, min = 0, size = 'lg' }: { value: number; onChange: (v: number) => void; min?: number; size?: 'sm' | 'lg' }) {
  const btnClass = size === 'lg'
    ? 'w-12 h-12 rounded-xl text-2xl font-bold flex items-center justify-center transition-all active:scale-95'
    : 'w-8 h-8 rounded-lg text-lg font-bold flex items-center justify-center transition-all active:scale-95';
  const numClass = size === 'lg' ? 'text-3xl font-black w-14 text-center' : 'text-xl font-black w-10 text-center';
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(min, value - 1))}
        className={`${btnClass} bg-gray-700 hover:bg-gray-600 text-gray-200`}>−</button>
      <span className={numClass} style={{ fontFamily: "'Orbitron', sans-serif" }}>{value}</span>
      <button onClick={() => onChange(value + 1)}
        className={`${btnClass} bg-gray-700 hover:bg-gray-600 text-white`}>+</button>
    </div>
  );
}

// ─── Alliance Scoring Panel ──────────────────────────────────
function AlliancePanel({
  alliance, breakdown, onChange, foulsMinor, foulsMajor,
  onFoulsMinorChange, onFoulsMajorChange, timeLeft, isAuto,
}: {
  alliance: 'red' | 'blue';
  breakdown: Partial<ScoreBreakdown>;
  onChange: (key: keyof ScoreBreakdown, val: number | boolean) => void;
  foulsMinor: number; foulsMajor: number;
  onFoulsMinorChange: (v: number) => void;
  onFoulsMajorChange: (v: number) => void;
  timeLeft: number; isAuto: boolean;
}) {
  const bd = { ...EMPTY_BREAKDOWN, ...breakdown };
  const isRed = alliance === 'red';
  const color = isRed ? '#ef4444' : '#3b82f6';
  const glowClass = isRed ? 'glass-card-red' : 'glass-card-blue';

  const periodLabel = isAuto ? '⚡ AUTO PERIOD (2×)' : '🕹 TELEOP PERIOD';
  const periodColor = isAuto ? '#eab308' : '#6366f1';

  const autoKeys: Record<string, { low: keyof ScoreBreakdown; high: keyof ScoreBreakdown; lowPts: number; highPts: number }> = {
    boxes:     { low: 'boxes_low_auto',     high: 'boxes_high_auto',     lowPts: POINTS.box_low_auto,      highPts: POINTS.box_high_auto },
    triangles: { low: 'triangles_low_auto', high: 'triangles_high_auto', lowPts: POINTS.triangle_low_auto, highPts: POINTS.triangle_high_auto },
    circles:   { low: 'circles_low_auto',   high: 'circles_high_auto',   lowPts: POINTS.circle_low_auto,   highPts: POINTS.circle_high_auto },
  };
  const teleopKeys: Record<string, { low: keyof ScoreBreakdown; high: keyof ScoreBreakdown; lowPts: number; highPts: number }> = {
    boxes:     { low: 'boxes_low_teleop',     high: 'boxes_high_teleop',     lowPts: POINTS.box_low,      highPts: POINTS.box_high },
    triangles: { low: 'triangles_low_teleop', high: 'triangles_high_teleop', lowPts: POINTS.triangle_low, highPts: POINTS.triangle_high },
    circles:   { low: 'circles_low_teleop',   high: 'circles_high_teleop',   lowPts: POINTS.circle_low,   highPts: POINTS.circle_high },
  };
  const curKeys = isAuto ? autoKeys : teleopKeys;

  const total = computeAllianceScore(bd);

  return (
    <div className={`${glowClass} p-4 rounded-2xl space-y-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          <h3 className="font-black tracking-wider text-lg" style={{ fontFamily: "'Orbitron', sans-serif", color }}>
            {isRed ? 'RED' : 'BLUE'}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black" style={{ fontFamily: "'Orbitron', sans-serif", color }}>
            {total}
          </div>
          <div className="text-xs text-gray-400">total pts</div>
        </div>
      </div>

      {/* Period Indicator */}
      <div className="rounded-xl px-4 py-2 text-center text-sm font-bold"
        style={{ background: `${periodColor}20`, border: `1px solid ${periodColor}50`, color: periodColor }}>
        {periodLabel}
      </div>

      {/* Shape Counters */}
      {SHAPES.map(shape => {
        const keys = curKeys[shape.key];
        const lowVal  = bd[keys.low]  as number;
        const highVal = bd[keys.high] as number;
        return (
          <div key={shape.key} className="glass-card p-3 rounded-xl space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10">
                {shape.shape(32)}
              </div>
              <div>
                <div className="font-bold text-sm">{shape.label}</div>
                <div className="text-xs text-gray-500">Low: +{keys.lowPts} | High: +{keys.highPts}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* Low Shelf */}
              <div className="bg-gray-800/60 rounded-lg p-2">
                <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <ArrowDown className="w-3 h-3" /> Low Shelf
                </div>
                <Counter value={lowVal} onChange={v => onChange(keys.low, v)} size="sm" />
              </div>
              {/* High Shelf */}
              <div className="bg-gray-800/60 rounded-lg p-2">
                <div className="text-xs text-gray-400 mb-1">⬆ High Shelf</div>
                <Counter value={highVal} onChange={v => onChange(keys.high, v)} size="sm" />
              </div>
            </div>
          </div>
        );
      })}

      {/* Special Orders */}
      <div className="glass-card p-3 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            <div>
              <div className="font-bold text-sm text-yellow-300">Special Order</div>
              <div className="text-xs text-gray-500">+{POINTS.special_order} pts each</div>
            </div>
          </div>
          <Counter value={bd.special_orders} onChange={v => onChange('special_orders', v)} size="sm" />
        </div>
      </div>

      {/* Back to Place Toggles */}
      <div className="space-y-2">
        {[
          { key: 'back_to_place_auto' as keyof ScoreBreakdown, label: 'Back to Place (Auto)', pts: POINTS.back_to_place_auto, color: '#f59e0b' },
          { key: 'back_to_place_match' as keyof ScoreBreakdown, label: 'Back to Place (Match)', pts: POINTS.back_to_place_match, color: '#10b981' },
        ].map(item => (
          <button key={item.key} onClick={() => onChange(item.key, !bd[item.key])}
            className={`w-full p-3 rounded-xl text-left transition-all flex items-center justify-between ${
              bd[item.key] ? 'border-2' : 'bg-gray-800/50 border border-gray-700'
            }`}
            style={bd[item.key] ? { borderColor: item.color, background: `${item.color}15` } : {}}>
            <div>
              <div className="font-semibold text-sm">{item.label}</div>
              <div className="text-xs text-gray-500">+{item.pts} pts</div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-all flex items-center px-1 ${bd[item.key] ? 'justify-end' : 'justify-start bg-gray-700'}`}
              style={bd[item.key] ? { background: item.color } : {}}>
              <div className="w-4 h-4 rounded-full bg-white shadow" />
            </div>
          </button>
        ))}
      </div>

      {/* Foul Counters */}
      <div className="glass-card p-3 rounded-xl space-y-2">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Fouls (give pts to opponent)</div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-yellow-300">Minor Foul</div>
              <div className="text-xs text-gray-500">+{POINTS.minor_foul_to_opponent} to opponent</div>
            </div>
            <Counter value={foulsMinor} onChange={onFoulsMinorChange} size="sm" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-orange-400">Major Foul</div>
              <div className="text-xs text-gray-500">+{POINTS.major_foul_to_opponent} to opponent</div>
            </div>
            <Counter value={foulsMajor} onChange={onFoulsMajorChange} size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Judge Dashboard ─────────────────────────────────────
export default function JudgeDashboard() {
  const { user, logout, canScoreRed, canScoreBlue } = useAuth();
  const navigate = useNavigate();

  const [activeMatch, setActiveMatch] = useState<api.Match | null>(null);
  const [settings, setSettings] = useState<any>(null);

  // Timer
  const [timeLeft, setTimeLeft] = useState(MATCH_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [matchStarted, setMatchStarted] = useState(false);
  const [matchEnded, setMatchEnded] = useState(false);
  const warningPlayed = useRef(false);
  const endPlayed = useRef(false);

  // Scoring state
  const [redBreakdown, setRedBreakdown]   = useState<Partial<ScoreBreakdown>>({});
  const [blueBreakdown, setBlueBreakdown] = useState<Partial<ScoreBreakdown>>({});
  const [foulsMinorRed, setFoulsMinorRed]   = useState(0);
  const [foulsMajorRed, setFoulsMajorRed]   = useState(0);
  const [foulsMinorBlue, setFoulsMinorBlue] = useState(0);
  const [foulsMajorBlue, setFoulsMajorBlue] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Debounce ref for real-time push
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) { navigate('/login?redirect=judge'); return; }
  }, [user, navigate]);

  const refresh = useCallback(async () => {
    try {
      const [allMatches, s] = await Promise.all([api.fetchMatches(), api.fetchSettings()]);
      setSettings(s);
      const match = s?.active_match_id ? allMatches.find((m: api.Match) => m.id === s.active_match_id) : null;
      if (match) {
        setActiveMatch(match);
        // Sync timer from server settings
        const tl = getTimerFromSettings(s);
        setTimeLeft(tl);
        setIsRunning(s?.timer_running || false);
        if (tl < MATCH_DURATION && tl > 0) setMatchStarted(true);
        if (tl === 0) { setMatchEnded(true); setIsRunning(false); }
      } else {
        setActiveMatch(null);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const i = setInterval(refresh, 5000);
    return () => clearInterval(i);
  }, [refresh]);

  // Subscribe to live settings changes for timer sync
  useEffect(() => {
    const ch = api.subscribeToSettings((s) => {
      setSettings(s);
      const tl = getTimerFromSettings(s);
      setTimeLeft(tl);
      setIsRunning(s.timer_running || false);
      if (tl <= 0) { setMatchEnded(true); setIsRunning(false); }
    });
    return () => { ch.unsubscribe(); };
  }, []);

  // Local timer tick
  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next === WARNING_TIME && !warningPlayed.current) { warningPlayed.current = true; playWarningSound(); }
        if (next <= 0 && !endPlayed.current) { endPlayed.current = true; playEndSound(); setIsRunning(false); setMatchEnded(true); }
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isRunning, timeLeft]);

  const isAuto = isAutoPeriod(timeLeft);

  // Debounced real-time push on counter change
  const triggerPush = useCallback((newRed: Partial<ScoreBreakdown>, newBlue: Partial<ScoreBreakdown>, fmr: number, fmjr: number, fmb: number, fmjb: number) => {
    if (!activeMatch) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      try {
        if (canScoreRed)  await api.pushScoreBreakdown(activeMatch.id, 'red',  newRed,  fmr, fmjr);
        if (canScoreBlue) await api.pushScoreBreakdown(activeMatch.id, 'blue', newBlue, fmb, fmjb);
      } catch (e) { console.error('Push failed:', e); }
    }, 400);
  }, [activeMatch, canScoreRed, canScoreBlue]);

  const handleRedChange = (key: keyof ScoreBreakdown, val: number | boolean) => {
    const next = { ...EMPTY_BREAKDOWN, ...redBreakdown, [key]: val };
    setRedBreakdown(next);
    triggerPush(next, { ...EMPTY_BREAKDOWN, ...blueBreakdown }, foulsMinorRed, foulsMajorRed, foulsMinorBlue, foulsMajorBlue);
  };

  const handleBlueChange = (key: keyof ScoreBreakdown, val: number | boolean) => {
    const next = { ...EMPTY_BREAKDOWN, ...blueBreakdown, [key]: val };
    setBlueBreakdown(next);
    triggerPush({ ...EMPTY_BREAKDOWN, ...redBreakdown }, next, foulsMinorRed, foulsMajorRed, foulsMinorBlue, foulsMajorBlue);
  };

  const handleFoulChange = (type: 'minor_red' | 'major_red' | 'minor_blue' | 'major_blue', val: number) => {
    let fmr = foulsMinorRed, fmjr = foulsMajorRed, fmb = foulsMinorBlue, fmjb = foulsMajorBlue;
    if (type === 'minor_red')  { fmr = val;  setFoulsMinorRed(val); }
    if (type === 'major_red')  { fmjr = val; setFoulsMajorRed(val); }
    if (type === 'minor_blue') { fmb = val;  setFoulsMinorBlue(val); }
    if (type === 'major_blue') { fmjb = val; setFoulsMajorBlue(val); }
    triggerPush({ ...EMPTY_BREAKDOWN, ...redBreakdown }, { ...EMPTY_BREAKDOWN, ...blueBreakdown }, fmr, fmjr, fmb, fmjb);
  };

  const handleStart = async () => {
    initAudio(); playStartSound();
    warningPlayed.current = false; endPlayed.current = false;
    setMatchStarted(true); setMatchEnded(false);
    try {
      if (activeMatch) await api.updateMatchStatus(activeMatch.id, 'playing');
    } catch (e) { console.error(e); }
  };

  const handlePause = () => setIsRunning(prev => !prev);

  const handleReset = () => {
    setIsRunning(false); setMatchStarted(false); setMatchEnded(false);
    setTimeLeft(MATCH_DURATION);
    warningPlayed.current = false; endPlayed.current = false;
  };

  const handleSubmit = async () => {
    if (!activeMatch) return;
    setLoading(true); setError('');
    try {
      await api.submitScore(activeMatch.id, redBreakdown, blueBreakdown, foulsMinorRed, foulsMajorRed, foulsMinorBlue, foulsMajorBlue);
      setSuccess('Scores submitted to Admin!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally { setLoading(false); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= WARNING_TIME ? '#f59e0b' : '#ffffff';

  if (!user) return null;

  return (
    <div className="min-h-screen pb-8" style={{ background: 'linear-gradient(180deg, #020617, #0a0e1a)' }}>
      {/* Header */}
      <header className="glass-card mx-4 mt-4 mb-4 px-6 py-4 flex items-center justify-between" style={{ borderRadius: '16px' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
            <Gavel className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              Judge Panel
            </h1>
            <p className="text-xs text-gray-400">
              {canScoreRed && canScoreBlue ? 'Full Access' : canScoreRed ? '🔴 Red Judge' : '🔵 Blue Judge'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={refresh} className="text-gray-400 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => { logout(); navigate('/'); }} className="btn-outline py-2 px-3 flex items-center gap-2 text-xs">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      {/* Notifications */}
      {(error || success) && (
        <div className={`mx-4 mb-4 p-3 rounded-xl text-sm font-medium animate-fadeIn ${error ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-green-500/10 border border-green-500/30 text-green-300'}`}>
          {error || success}
        </div>
      )}

      {!activeMatch ? (
        <div className="mx-4 glass-card p-16 text-center">
          <Timer className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h2 className="text-2xl font-bold text-gray-400" style={{ fontFamily: "'Orbitron', sans-serif" }}>No Active Match</h2>
          <p className="text-gray-500 mt-2">Admin must select an active match first</p>
        </div>
      ) : (
        <div className="mx-4 space-y-4">
          {/* Match Info */}
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{activeMatch.match_type} • Match #{activeMatch.match_number}</p>
            <div className="flex items-center justify-center gap-4">
              <span className="font-bold text-red-300 text-lg">{activeMatch.red_team1?.name}{activeMatch.match_type === '2v2' && ` & ${activeMatch.red_team2?.name}`}</span>
              <span className="vs-text text-lg">VS</span>
              <span className="font-bold text-blue-300 text-lg">{activeMatch.blue_team1?.name}{activeMatch.match_type === '2v2' && ` & ${activeMatch.blue_team2?.name}`}</span>
            </div>
          </div>

          {/* Timer */}
          <div className="glass-card p-6 text-center">
            <div className="text-7xl font-black mb-2" style={{ fontFamily: "'Orbitron', sans-serif", color: timerColor }}>
              {formatTime(timeLeft)}
            </div>
            <div className="text-sm font-bold mb-5 tracking-wider px-4 py-1 rounded-full inline-block"
              style={{ background: isAuto ? '#eab30820' : '#6366f120', color: isAuto ? '#eab308' : '#818cf8', border: `1px solid ${isAuto ? '#eab30840' : '#6366f140'}` }}>
              {isAuto ? '⚡ AUTO' : '🕹 TELEOP'}
            </div>
            <div className="flex justify-center gap-3">
              {!matchStarted ? (
                <button onClick={handleStart} className="btn-success py-3 px-8 text-base font-bold flex items-center gap-2">
                  <Play className="w-5 h-5" /> START
                </button>
              ) : (
                <>
                  <button onClick={handlePause} className={`${isRunning ? 'btn-outline' : 'btn-primary'} py-3 px-5 flex items-center gap-2`}>
                    {isRunning ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Resume</>}
                  </button>
                  <button onClick={handleReset} className="btn-outline py-3 px-5 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" /> Reset
                  </button>
                </>
              )}
            </div>
            {matchEnded && <div className="mt-3 text-yellow-400 font-bold" style={{ fontFamily: "'Orbitron', sans-serif" }}>⏱ MATCH END</div>}
          </div>

          {/* Scoring Panels */}
          <div className={`grid gap-4 ${canScoreRed && canScoreBlue ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
            {canScoreRed && (
              <AlliancePanel alliance="red" breakdown={redBreakdown} onChange={handleRedChange}
                foulsMinor={foulsMinorRed} foulsMajor={foulsMajorRed}
                onFoulsMinorChange={v => handleFoulChange('minor_red', v)}
                onFoulsMajorChange={v => handleFoulChange('major_red', v)}
                timeLeft={timeLeft} isAuto={isAuto} />
            )}
            {canScoreBlue && (
              <AlliancePanel alliance="blue" breakdown={blueBreakdown} onChange={handleBlueChange}
                foulsMinor={foulsMinorBlue} foulsMajor={foulsMajorBlue}
                onFoulsMinorChange={v => handleFoulChange('minor_blue', v)}
                onFoulsMajorChange={v => handleFoulChange('major_blue', v)}
                timeLeft={timeLeft} isAuto={isAuto} />
            )}
          </div>

          {/* Submit */}
          <button onClick={handleSubmit} disabled={loading}
            className="btn-primary w-full py-5 text-lg font-bold flex items-center justify-center gap-3">
            <Send className="w-5 h-5" />
            {loading ? 'Submitting...' : 'Submit Scores to Admin'}
          </button>
        </div>
      )}
    </div>
  );
}
