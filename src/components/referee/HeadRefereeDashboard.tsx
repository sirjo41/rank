import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as api from '../../utils/api';
import { 
  ScoreBreakdown, 
  EMPTY_BREAKDOWN, 
  computeMatchTotals, 
  getTimerFromSettings, 
  MATCH_DURATION,
  AUTO_DURATION 
} from '../../utils/scoring';
import { playNotificationSound, initAudio, playClickSound, playBuzzerSound } from '../../utils/sounds';
import { 
  Gavel, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle, 
  AlertTriangle, 
  Timer,
  Users,
  Send,
  UserCheck
} from 'lucide-react';

const AUTO_PAUSE_TIME = 120; // 150 - 30 = 120
const PICKUP_DURATION = 8;

export default function HeadRefereeDashboard() {
  const { user, isReferee, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [activeMatch, setActiveMatch] = useState<api.Match | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(MATCH_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  
  // Transition state for 8s wait
  const [isWaitingForDrivers, setIsWaitingForDrivers] = useState(false);
  const [waitProgress, setWaitProgress] = useState(PICKUP_DURATION);

  useEffect(() => {
    if (!user) { navigate('/login?redirect=referee'); return; }
    if (!isReferee && !isAdmin) { navigate('/'); return; }
  }, [user, isReferee, isAdmin, navigate]);

  const refresh = useCallback(async () => {
    try {
      const [allMatches, s] = await Promise.all([api.fetchMatches(), api.fetchSettings()]);
      setSettings(s);
      const match = s?.active_match_id ? allMatches.find((m: api.Match) => m.id === s.active_match_id) : null;
      setActiveMatch(match);
      
      const tl = getTimerFromSettings(s);
      setTimeLeft(tl);
      setIsRunning(s?.timer_running || false);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    refresh();
    const sub = api.subscribeToSettings(s => {
      setSettings(s);
      setTimeLeft(getTimerFromSettings(s));
      setIsRunning(s.timer_running || false);
      
      // Auto-sync phase
      if (s.timer_phase === 'pickup') {
        if (!isWaitingForDrivers) {
          setIsWaitingForDrivers(true);
          setWaitProgress(PICKUP_DURATION);
        }
      } else {
        setIsWaitingForDrivers(false);
      }
    });
    const subMatch = api.subscribeToMatch(settings?.active_match_id, m => {
      if (m.id === activeMatch?.id) setActiveMatch(m);
    });
    const interval = setInterval(refresh, 3000);
    return () => { sub.unsubscribe(); subMatch.unsubscribe(); clearInterval(interval); };
  }, [refresh, settings?.active_match_id, activeMatch?.id]);

  // Handle local countdown for 8s wait
  useEffect(() => {
    if (!isWaitingForDrivers) return;
    if (waitProgress <= 0) {
      setIsWaitingForDrivers(false);
      handleResumeTeleop();
      return;
    }
    const t = setInterval(() => setWaitProgress(p => p - 1), 1000);
    return () => clearInterval(t);
  }, [isWaitingForDrivers, waitProgress]);

  // Monitor Timer for Auto End
  useEffect(() => {
    if (isRunning && timeLeft === AUTO_PAUSE_TIME && !isWaitingForDrivers) {
      // Trigger 8s pause
      handleAutoPause();
    }
  }, [isRunning, timeLeft]);

  const handleAutoPause = async () => {
    try {
      await api.setTimer(false, AUTO_PAUSE_TIME, 'pickup');
      setIsWaitingForDrivers(true);
      setWaitProgress(PICKUP_DURATION);
      playBuzzerSound();
    } catch (e) { alert('Pause failed'); }
  };

  const handleResumeTeleop = async () => {
    try {
      await api.setTimer(true, AUTO_PAUSE_TIME, 'teleop');
      playBuzzerSound();
    } catch (e) { alert('Resume failed'); }
  };

  const handleStartMatch = async () => {
    if (!activeMatch) return;
    initAudio();
    try {
      await api.updateMatchStatus(activeMatch.id, 'playing');
      setWaitProgress(PICKUP_DURATION);
      setIsWaitingForDrivers(false);
    } catch (e) { alert('Failed to start'); }
  };

  const handleTogglePause = async () => {
    try {
      await api.setTimer(!isRunning, timeLeft);
    } catch (e) { alert('Action failed'); }
  };

  const handleRestart = async () => {
    if (!confirm('Restart match timer to 2:30?')) return;
    try {
      await api.setTimer(false, MATCH_DURATION);
      await api.updateMatchStatus(activeMatch!.id, 'scheduled');
      await api.toggleJudgeReady(activeMatch!.id, 'red', false);
      await api.toggleJudgeReady(activeMatch!.id, 'blue', false);
    } catch (e) { alert('Restart failed'); }
  };

  const handleSubmitToAdmin = async () => {
    if (!activeMatch) return;
    if (!confirm('Finalize scores and send to Admin for approval?')) return;
    try {
      await api.updateMatchStatus(activeMatch.id, 'judge_submitted');
      navigate('/admin');
    } catch (e) { alert('Submit failed'); }
  };

  const bothReady = activeMatch?.judge_red_ready && activeMatch?.judge_blue_ready;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between glass-card p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="bg-amber-500/20 p-3 rounded-xl">
              <Gavel className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                HEAD REFEREE DASHBOARD
              </h1>
              <p className="text-slate-400 text-sm">Match Orchestration & Control</p>
            </div>
          </div>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
            Exit
          </button>
        </div>

        {!activeMatch ? (
          <div className="glass-card p-12 text-center text-slate-400 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-xl">No active match selected in Admin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Timer & Main Controls */}
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card p-8 bg-slate-900/50 rounded-3xl border border-slate-700 text-center relative overflow-hidden">
                {isWaitingForDrivers && (
                  <div className="absolute inset-0 bg-amber-500/10 flex flex-col items-center justify-center backdrop-blur-sm z-10">
                    <div className="text-amber-500 font-black text-xl mb-2">PICK UP CONTROLLERS!</div>
                    <div className="text-6xl font-black text-amber-400">{waitProgress}s</div>
                  </div>
                )}
                
                <h3 className="text-slate-500 font-bold mb-2 uppercase tracking-widest text-sm">Match {activeMatch.match_number} Timer</h3>
                <div className="text-9xl font-black mb-8 tracking-tighter" style={{ fontFamily: "'Orbitron', sans-serif", color: timeLeft <= 30 ? '#ef4444' : '#fff' }}>
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </div>

                <div className="flex flex-wrap justify-center gap-4">
                  {!activeMatch.status.includes('playing') && timeLeft === MATCH_DURATION ? (
                    <button 
                      disabled={!bothReady}
                      onClick={handleStartMatch}
                      className={`flex items-center gap-3 px-12 py-5 rounded-2xl text-2xl font-black transition-all ${
                        bothReady ? 'bg-green-600 hover:bg-green-500 hover:scale-105 shadow-xl shadow-green-900/40' : 'bg-gray-700 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-8 h-8 fill-current" /> START MATCH
                    </button>
                  ) : (
                    <>
                      <button onClick={handleTogglePause} className="flex items-center gap-3 px-8 py-4 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-all">
                        {isRunning ? <><Pause className="w-6 h-6 fill-current" /> PAUSE</> : <><Play className="w-6 h-6 fill-current" /> RESUME</>}
                      </button>
                      <button onClick={handleRestart} className="flex items-center gap-3 px-8 py-4 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-xl font-bold border border-red-900/50 transition-all">
                        <RotateCcw className="w-6 h-6" /> RESTART
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Ready Status Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-6 rounded-2xl border transition-all ${activeMatch.judge_red_ready ? 'bg-red-500/20 border-red-500' : 'bg-slate-800/50 border-slate-700 opacity-60'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-red-400 font-bold text-sm uppercase">Red Alliance</div>
                      <div className="text-lg font-black">{activeMatch.judge_red_ready ? 'READY' : 'NOT READY'}</div>
                    </div>
                    {activeMatch.judge_red_ready ? <UserCheck className="w-8 h-8 text-red-400" /> : <AlertTriangle className="w-8 h-8 text-slate-500" />}
                  </div>
                </div>
                <div className={`p-6 rounded-2xl border transition-all ${activeMatch.judge_blue_ready ? 'bg-blue-500/20 border-blue-500' : 'bg-slate-800/50 border-slate-700 opacity-60'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-blue-400 font-bold text-sm uppercase">Blue Alliance</div>
                      <div className="text-lg font-black">{activeMatch.judge_blue_ready ? 'READY' : 'NOT READY'}</div>
                    </div>
                    {activeMatch.judge_blue_ready ? <UserCheck className="w-8 h-8 text-blue-400" /> : <AlertTriangle className="w-8 h-8 text-slate-500" />}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar / Match Summary */}
            <div className="space-y-6">
              <div className="glass-card p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                  <Timer className="w-5 h-5" /> MATCH DATA
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                    <span className="text-slate-400 text-sm">Status</span>
                    <span className="uppercase font-bold text-amber-400">{activeMatch.status}</span>
                  </div>
                  {timeLeft === 0 && (
                    <button 
                      onClick={handleSubmitToAdmin}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-black text-lg transition-all shadow-lg shadow-indigo-900/30"
                    >
                      <Send className="w-5 h-5" /> COMPLETE MATCH
                    </button>
                  )}
                </div>
              </div>

              <div className="glass-card p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
                <h3 className="text-lg font-black mb-4">LIVE OVERVIEW</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-red-400">Red Base</span>
                    <span>{computeMatchTotals(activeMatch.score_breakdown_red, activeMatch.score_breakdown_blue, activeMatch.fouls_minor_red, activeMatch.fouls_major_red, activeMatch.fouls_minor_blue, activeMatch.fouls_major_blue).redTotal}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-400">Blue Base</span>
                    <span>{computeMatchTotals(activeMatch.score_breakdown_red, activeMatch.score_breakdown_blue, activeMatch.fouls_minor_red, activeMatch.fouls_major_red, activeMatch.fouls_minor_blue, activeMatch.fouls_major_blue).blueTotal}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
