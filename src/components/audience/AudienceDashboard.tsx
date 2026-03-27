import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../../utils/api';
import { calcTotalScore } from '../../utils/api';
import { playStartSound, playWarningSound, playEndSound, initAudio } from '../../utils/sounds';
import { Trophy, Zap, Timer as TimerIcon } from 'lucide-react';

const MATCH_DURATION = 150;
const WARNING_TIME = 30;

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
interface Ranking {
  team_id: string; team_name: string; team_number: number | null;
  matches_played: number; wins: number; losses: number; ties: number;
  total_rp: number; average_rp: string;
  total_score: number; avg_score: string;
}

export default function AudienceDashboard() {
  const [settings, setSettings] = useState<any>(null);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [currentView, setCurrentView] = useState<string>('standby');
  const [transitioning, setTransitioning] = useState(false);

  // Timer state (client-side, synced from settings)
  const [timeLeft, setTimeLeft] = useState(MATCH_DURATION);
  const [timerRunning, setTimerRunning] = useState(false);
  const prevTimerRunning = useRef(false);
  const warningPlayed = useRef(false);
  const endPlayed = useRef(false);
  const audioInitialized = useRef(false);

  // Init audio on first user interaction
  useEffect(() => {
    const handleClick = () => {
      if (!audioInitialized.current) {
        initAudio();
        audioInitialized.current = true;
      }
    };
    window.addEventListener('click', handleClick, { once: true });
    window.addEventListener('keydown', handleClick, { once: true });
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleClick);
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [s, allMatches, r] = await Promise.all([
        api.fetchSettings(), api.fetchMatches(), api.fetchRankings()
      ]);
      setSettings(s);
      setRankings(r);

      if (s?.active_match_id) {
        const match = allMatches.find((m: Match) => m.id === s.active_match_id);
        setActiveMatch(match || null);
      } else {
        setActiveMatch(null);
      }

      // Sync timer from settings
      if (s?.timer_running && s?.timer_started_at) {
        const startTime = new Date(s.timer_started_at).getTime();
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, MATCH_DURATION - elapsed);
        setTimeLeft(remaining);

        // Detect transition from not running to running → play start sound
        if (!prevTimerRunning.current) {
          warningPlayed.current = false;
          endPlayed.current = false;
          if (audioInitialized.current) playStartSound();
        }
        setTimerRunning(true);
      } else {
        setTimerRunning(false);
      }
      prevTimerRunning.current = s?.timer_running || false;

      // Handle view transitions
      if (s?.audience_view && s.audience_view !== currentView) {
        setTransitioning(true);
        setTimeout(() => {
          setCurrentView(s.audience_view);
          setTransitioning(false);
        }, 400);
      }
    } catch (e) {
      console.error('Refresh failed:', e);
    }
  }, [currentView]);

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Client-side timer countdown
  useEffect(() => {
    if (!timerRunning || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next === WARNING_TIME && !warningPlayed.current && audioInitialized.current) {
          warningPlayed.current = true;
          playWarningSound();
        }
        if (next <= 0 && !endPlayed.current && audioInitialized.current) {
          endPlayed.current = true;
          playEndSound();
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timerRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const timerColor = timeLeft <= WARNING_TIME
    ? (timeLeft <= 10 ? 'timer-danger' : 'timer-warning')
    : 'text-white';

  return (
    <div className="audience-bg" onClick={() => { if (!audioInitialized.current) { initAudio(); audioInitialized.current = true; } }}>
      <div className="audience-grid" />

      {/* UniBotics Header */}
      <div className="relative z-10 text-center pt-6 pb-4">
        <h1 className="text-3xl md:text-4xl font-black tracking-[0.3em] gradient-text"
          style={{ fontFamily: "'Orbitron', sans-serif" }}>
          UNIBOTICS
        </h1>
      </div>

      {/* Main Content with transition */}
      <div className={`relative z-10 transition-all duration-400 ${transitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
        style={{ minHeight: 'calc(100vh - 100px)' }}>

        {/* ─── STANDBY VIEW ───────────────────────────────── */}
        {currentView === 'standby' && (
          <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
            <div className="animate-float">
              <div className="text-[120px] md:text-[180px] mb-8">🤖</div>
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-[0.2em] gradient-text mb-6 animate-fadeIn"
              style={{ fontFamily: "'Orbitron', sans-serif" }}>
              UNIBOTICS
            </h2>
            <p className="text-xl md:text-2xl text-gray-500 tracking-[0.5em] uppercase animate-fadeIn"
              style={{ animationDelay: '0.3s' }}>
              Competition
            </p>
            <div className="mt-12 flex items-center gap-3 text-gray-600 animate-fadeIn" style={{ animationDelay: '0.6s' }}>
              <span className="status-dot live"></span>
              <span className="text-sm tracking-wider uppercase">Event in progress</span>
            </div>
          </div>
        )}

        {/* ─── MATCH VIEW ─────────────────────────────────── */}
        {currentView === 'match' && activeMatch && (
          <div className="px-6 md:px-16 py-4">
            {/* Match Title */}
            <div className="text-center mb-8 animate-fadeIn">
              <span className="badge badge-gray text-xs tracking-widest mb-2 inline-block">
                {activeMatch.match_type} • Match #{activeMatch.match_number}
              </span>
            </div>

            {/* Timer */}
            {(timerRunning || activeMatch.status === 'playing') && (
              <div className="text-center mb-10 animate-fadeIn">
                <div className={`timer-display text-[100px] md:text-[140px] leading-none ${timerColor}`}>
                  {formatTime(timeLeft)}
                </div>
              </div>
            )}

            {/* Teams Face-off */}
            <div className="flex items-stretch justify-center gap-4 md:gap-8 max-w-6xl mx-auto">
              {/* Red Alliance */}
              <div className="flex-1 glass-card-red p-8 md:p-12 text-center animate-slideInLeft"
                style={{ maxWidth: '500px' }}>
                <div className="inline-flex items-center gap-2 mb-6">
                  <span className="w-4 h-4 rounded-full bg-red-500 shadow-lg shadow-red-500/50"></span>
                  <span className="text-sm text-red-400/70 tracking-[0.3em] uppercase font-semibold">
                    Red Alliance
                  </span>
                </div>
                <div className="team-name-red text-3xl md:text-5xl font-black mb-2">
                  {activeMatch.red_team1?.name}
                </div>
                {activeMatch.match_type === '2v2' && activeMatch.red_team2 && (
                  <div className="team-name-red text-xl md:text-3xl font-bold opacity-70 mt-2">
                    {activeMatch.red_team2.name}
                  </div>
                )}
                {(activeMatch.status === 'completed' || activeMatch.status === 'judge_submitted') && (
                  <div className="mt-8 animate-score-reveal">
                    <div className="text-6xl md:text-8xl font-black text-red-300"
                      style={{ fontFamily: "'Orbitron', sans-serif" }}>
                      {calcTotalScore(activeMatch.score_auto_red, activeMatch.score_teleop_red,
                        activeMatch.fouls_minor_blue, activeMatch.fouls_major_blue)}
                    </div>
                  </div>
                )}
              </div>

              {/* VS */}
              <div className="flex items-center">
                <div className="vs-text animate-fadeIn" style={{ animationDelay: '0.3s' }}>
                  VS
                </div>
              </div>

              {/* Blue Alliance */}
              <div className="flex-1 glass-card-blue p-8 md:p-12 text-center animate-slideInRight"
                style={{ maxWidth: '500px' }}>
                <div className="inline-flex items-center gap-2 mb-6">
                  <span className="w-4 h-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></span>
                  <span className="text-sm text-blue-400/70 tracking-[0.3em] uppercase font-semibold">
                    Blue Alliance
                  </span>
                </div>
                <div className="team-name-blue text-3xl md:text-5xl font-black mb-2">
                  {activeMatch.blue_team1?.name}
                </div>
                {activeMatch.match_type === '2v2' && activeMatch.blue_team2 && (
                  <div className="team-name-blue text-xl md:text-3xl font-bold opacity-70 mt-2">
                    {activeMatch.blue_team2.name}
                  </div>
                )}
                {(activeMatch.status === 'completed' || activeMatch.status === 'judge_submitted') && (
                  <div className="mt-8 animate-score-reveal" style={{ animationDelay: '0.2s' }}>
                    <div className="text-6xl md:text-8xl font-black text-blue-300"
                      style={{ fontFamily: "'Orbitron', sans-serif" }}>
                      {calcTotalScore(activeMatch.score_auto_blue, activeMatch.score_teleop_blue,
                        activeMatch.fouls_minor_red, activeMatch.fouls_major_red)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Match Status Indicator */}
            {activeMatch.status === 'playing' && (
              <div className="text-center mt-8 animate-fadeIn">
                <span className="inline-flex items-center gap-2 badge badge-yellow text-base px-6 py-2">
                  <Zap className="w-5 h-5" /> MATCH IN PROGRESS
                </span>
              </div>
            )}
          </div>
        )}

        {/* No active match in match view */}
        {currentView === 'match' && !activeMatch && (
          <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
            <TimerIcon className="w-20 h-20 text-gray-700 mb-6" />
            <h2 className="text-3xl font-bold text-gray-500" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              Waiting for next match...
            </h2>
          </div>
        )}

        {/* ─── RESULTS VIEW ───────────────────────────────── */}
        {currentView === 'results' && activeMatch && (
          <div className="px-6 md:px-16 py-4 max-w-5xl mx-auto">
            <div className="text-center mb-10 animate-fadeIn">
              <span className="badge badge-green text-sm tracking-widest mb-3 inline-block">
                MATCH RESULTS
              </span>
              <h2 className="text-4xl md:text-5xl font-black"
                style={{ fontFamily: "'Orbitron', sans-serif" }}>
                Match {activeMatch.match_number}
              </h2>
            </div>

            {/* Score Breakdown */}
            <div className="glass-card overflow-hidden animate-slideUp">
              {/* Header Row */}
              <div className="grid grid-cols-3 p-6 border-b border-gray-700/50">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    <span className="text-sm text-red-400/70 tracking-wider uppercase">Red</span>
                  </div>
                  <div className="team-name-red text-lg font-bold">
                    {activeMatch.red_team1?.name}
                    {activeMatch.match_type === '2v2' && ` & ${activeMatch.red_team2?.name}`}
                  </div>
                </div>
                <div className="text-center text-gray-500">
                  <span className="score-label">Category</span>
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    <span className="text-sm text-blue-400/70 tracking-wider uppercase">Blue</span>
                  </div>
                  <div className="team-name-blue text-lg font-bold">
                    {activeMatch.blue_team1?.name}
                    {activeMatch.match_type === '2v2' && ` & ${activeMatch.blue_team2?.name}`}
                  </div>
                </div>
              </div>

              {/* Auto Row */}
              <div className="score-row animate-fadeIn" style={{ animationDelay: '0.2s' }}>
                <div className="score-value-red text-center flex-1">{activeMatch.score_auto_red}</div>
                <div className="score-label flex-1 text-center">AUTO</div>
                <div className="score-value-blue text-center flex-1">{activeMatch.score_auto_blue}</div>
              </div>

              {/* TeleOp Row */}
              <div className="score-row animate-fadeIn" style={{ animationDelay: '0.4s' }}>
                <div className="score-value-red text-center flex-1">{activeMatch.score_teleop_red}</div>
                <div className="score-label flex-1 text-center">TELEOP</div>
                <div className="score-value-blue text-center flex-1">{activeMatch.score_teleop_blue}</div>
              </div>

              {/* Penalty Row (opponent fouls become your points) */}
              <div className="score-row animate-fadeIn" style={{ animationDelay: '0.6s' }}>
                <div className="score-value-red text-center flex-1">
                  +{(activeMatch.fouls_minor_blue * 5) + (activeMatch.fouls_major_blue * 10)}
                </div>
                <div className="score-label flex-1 text-center">PENALTY</div>
                <div className="score-value-blue text-center flex-1">
                  +{(activeMatch.fouls_minor_red * 5) + (activeMatch.fouls_major_red * 10)}
                </div>
              </div>

              {/* Fouls Detail */}
              <div className="score-row animate-fadeIn" style={{ animationDelay: '0.7s', background: 'rgba(245, 158, 11, 0.05)' }}>
                <div className="text-center flex-1 text-yellow-400 text-sm">
                  {activeMatch.fouls_minor_red}m / {activeMatch.fouls_major_red}M
                </div>
                <div className="score-label flex-1 text-center text-xs">FOULS (minor/Major)</div>
                <div className="text-center flex-1 text-yellow-400 text-sm">
                  {activeMatch.fouls_minor_blue}m / {activeMatch.fouls_major_blue}M
                </div>
              </div>

              {/* Total Row */}
              <div className="score-row animate-fadeIn" style={{ animationDelay: '0.8s', background: 'rgba(75, 85, 99, 0.2)' }}>
                <div className="flex-1 text-center">
                  <span className="text-4xl md:text-5xl font-black text-red-300 animate-score-reveal"
                    style={{ fontFamily: "'Orbitron', sans-serif", animationDelay: '1s' }}>
                    {calcTotalScore(activeMatch.score_auto_red, activeMatch.score_teleop_red,
                      activeMatch.fouls_minor_blue, activeMatch.fouls_major_blue)}
                  </span>
                </div>
                <div className="score-label flex-1 text-center text-base">TOTAL</div>
                <div className="flex-1 text-center">
                  <span className="text-4xl md:text-5xl font-black text-blue-300 animate-score-reveal"
                    style={{ fontFamily: "'Orbitron', sans-serif", animationDelay: '1.2s' }}>
                    {calcTotalScore(activeMatch.score_auto_blue, activeMatch.score_teleop_blue,
                      activeMatch.fouls_minor_red, activeMatch.fouls_major_red)}
                  </span>
                </div>
              </div>

              {/* Winner */}
              {(() => {
                const redT = calcTotalScore(activeMatch.score_auto_red, activeMatch.score_teleop_red,
                  activeMatch.fouls_minor_blue, activeMatch.fouls_major_blue);
                const blueT = calcTotalScore(activeMatch.score_auto_blue, activeMatch.score_teleop_blue,
                  activeMatch.fouls_minor_red, activeMatch.fouls_major_red);
                if (redT === blueT) return (
                  <div className="p-6 text-center animate-fadeIn" style={{ animationDelay: '1.4s' }}>
                    <span className="text-2xl font-black text-yellow-400"
                      style={{ fontFamily: "'Orbitron', sans-serif" }}>
                      TIE MATCH
                    </span>
                  </div>
                );
                const winner = redT > blueT ? 'RED' : 'BLUE';
                const color = redT > blueT ? 'text-red-400' : 'text-blue-400';
                return (
                  <div className="p-6 text-center animate-fadeIn" style={{ animationDelay: '1.4s' }}>
                    <span className="text-sm text-gray-500 tracking-[0.3em] uppercase block mb-2">Winner</span>
                    <span className={`text-3xl font-black ${color}`}
                      style={{ fontFamily: "'Orbitron', sans-serif" }}>
                      🏆 {winner} ALLIANCE
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {currentView === 'results' && !activeMatch && (
          <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
            <Trophy className="w-20 h-20 text-gray-700 mb-6" />
            <h2 className="text-3xl font-bold text-gray-500" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              No results to display
            </h2>
          </div>
        )}

        {/* ─── RANKINGS VIEW ──────────────────────────────── */}
        {currentView === 'rankings' && (
          <div className="px-6 md:px-16 py-4 max-w-6xl mx-auto">
            <div className="text-center mb-10 animate-fadeIn">
              <span className="badge badge-green text-sm tracking-widest mb-3 inline-block">
                LEADERBOARD
              </span>
              <h2 className="text-4xl md:text-5xl font-black gradient-text-gold"
                style={{ fontFamily: "'Orbitron', sans-serif" }}>
                Rankings
              </h2>
            </div>

            {rankings.length === 0 ? (
              <div className="glass-card p-16 text-center">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                <p className="text-gray-500 text-xl">No rankings data yet</p>
              </div>
            ) : (
              <div className="glass-card overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[60px_1fr_80px_80px_100px_100px_100px] gap-2 px-6 py-4 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-700/50 font-semibold">
                  <div>Rank</div>
                  <div>Team</div>
                  <div className="text-center">W-L-T</div>
                  <div className="text-center">GP</div>
                  <div className="text-center">Total RP</div>
                  <div className="text-center">Avg RP</div>
                  <div className="text-center">Avg Score</div>
                </div>

                {/* Table Rows */}
                {rankings.map((team, index) => (
                  <div key={team.team_id}
                    className={`rank-row grid grid-cols-[60px_1fr_80px_80px_100px_100px_100px] gap-2 px-6 py-5 items-center border-b border-gray-700/20 transition-colors hover:bg-gray-800/30 ${
                      index === 0 ? 'rank-gold' : index === 1 ? 'rank-silver' : index === 2 ? 'rank-bronze' : ''
                    }`}>
                    {/* Rank */}
                    <div className="flex items-center">
                      <span className={`text-2xl font-black ${
                        index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-gray-500'
                      }`} style={{ fontFamily: "'Orbitron', sans-serif" }}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                      </span>
                    </div>

                    {/* Team Name */}
                    <div>
                      <span className="font-bold text-lg">{team.team_name}</span>
                      {team.team_number && (
                        <span className="text-xs text-gray-500 ml-2">#{team.team_number}</span>
                      )}
                    </div>

                    {/* W-L-T */}
                    <div className="text-center text-sm">
                      <span className="text-green-400">{team.wins}</span>
                      <span className="text-gray-600">-</span>
                      <span className="text-red-400">{team.losses}</span>
                      <span className="text-gray-600">-</span>
                      <span className="text-yellow-400">{team.ties}</span>
                    </div>

                    {/* Games Played */}
                    <div className="text-center text-gray-400">{team.matches_played}</div>

                    {/* Total RP */}
                    <div className="text-center font-bold text-lg">{team.total_rp}</div>

                    {/* Average RP */}
                    <div className="text-center">
                      <span className={`font-black text-xl ${
                        parseFloat(team.average_rp) >= 2.5 ? 'text-green-400' :
                        parseFloat(team.average_rp) >= 1.5 ? 'text-yellow-400' : 'text-gray-400'
                      }`} style={{ fontFamily: "'Orbitron', sans-serif" }}>
                        {team.average_rp}
                      </span>
                    </div>

                    {/* Average Score */}
                    <div className="text-center text-gray-300 font-semibold">{team.avg_score}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
