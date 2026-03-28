import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../../utils/api';
import { computeMatchTotals, getTimerFromSettings, isAutoPeriod, MATCH_DURATION, PICKUP_DURATION, POINTS, EMPTY_BREAKDOWN } from '../../utils/scoring';
import { playStartSound, playWarningSound, playEndSound, initAudio, playBuzzerSound } from '../../utils/sounds';
import { Trophy, Timer as TimerIcon, Zap, Gamepad2 } from 'lucide-react';

const WARNING_TIME = 30;

// ─── Shape Icons ───────────────────────────────────────────────
function ShapeBox({ size = 24 }: { size?: number }) {
  return <div style={{ width: size, height: size, background: '#22c55e', borderRadius: 4, boxShadow: '0 0 8px rgba(34,197,94,0.5)', flexShrink: 0 }} />;
}
function ShapeTriangle({ size = 24 }: { size?: number }) {
  return <div style={{ width: 0, height: 0, borderLeft: `${size / 2}px solid transparent`, borderRight: `${size / 2}px solid transparent`, borderBottom: `${size}px solid #ef4444`, filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.5))', flexShrink: 0 }} />;
}
function ShapeCircle({ size = 24 }: { size?: number }) {
  return <div style={{ width: size, height: size, background: '#eab308', borderRadius: '50%', boxShadow: '0 0 8px rgba(234,179,8,0.6)', flexShrink: 0 }} />;
}

export default function AudienceDashboard() {
  const [settings, setSettings] = useState<api.CompetitionSettings | null>(null);
  const [activeMatch, setActiveMatch] = useState<api.Match | null>(null);
  const [rankings, setRankings] = useState<api.Ranking[]>([]);
  const [currentView, setCurrentView] = useState<string>('standby');
  const [transitioning, setTransitioning] = useState(false);

  // Timer (derived from server settings)
  const [timeLeft, setTimeLeft] = useState(MATCH_DURATION);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPhase, setTimerPhase] = useState<'none' | 'autonomous' | 'pickup' | 'teleop'>('none');
  const [pickupTime, setPickupTime] = useState(PICKUP_DURATION);
  const prevRunning = useRef(false);
  const prevPhaseRef = useRef<string>('none');
  const warningPlayed = useRef(false);
  const endPlayed = useRef(false);
  const audioInit = useRef(false);

  // Init audio on first tap/click
  useEffect(() => {
    const handler = () => { if (!audioInit.current) { initAudio(); audioInit.current = true; } };
    window.addEventListener('click', handler, { once: true });
    window.addEventListener('touchstart', handler, { once: true });
    return () => { window.removeEventListener('click', handler); window.removeEventListener('touchstart', handler); };
  }, []);

  const applySettings = useCallback((s: api.CompetitionSettings, allMatches: api.Match[]) => {
    const wasRunning = prevRunning.current;
    const nowRunning = s.timer_running || false;
    const tl = getTimerFromSettings(s);
    setTimeLeft(Math.max(0, tl));
    setTimerRunning(nowRunning);
    setTimerPhase(s.timer_phase || 'none');

    // Running edge: claim prevRunning immediately so overlapping applySettings() can't double-fire sounds
    const ph = s.timer_phase || 'none';
    if (!wasRunning && nowRunning) {
      prevRunning.current = true;
      if (audioInit.current) {
        warningPlayed.current = false; endPlayed.current = false;
        if (ph === 'autonomous') playStartSound();
        else if (ph === 'teleop') playBuzzerSound();
      }
    } else {
      prevRunning.current = nowRunning;
    }

    // Buzzer when entering pickup (phase edge only)
    if (ph === 'pickup' && prevPhaseRef.current !== 'pickup' && audioInit.current) {
      playBuzzerSound();
      setPickupTime(PICKUP_DURATION);
    }
    prevPhaseRef.current = ph;

    // View transition
    setSettings(s);
    if (s.audience_view && s.audience_view !== currentView) {
      setTransitioning(true);
      setTimeout(() => { setCurrentView(s.audience_view); setTransitioning(false); }, 350);
    }

    const match = s.active_match_id ? allMatches.find(m => m.id === s.active_match_id) : null;
    setActiveMatch(match || null);
  }, [currentView]);

  const refresh = useCallback(async () => {
    try {
      const [s, allMatches, r] = await Promise.all([api.fetchSettings(), api.fetchMatches(), api.fetchRankings()]);
      if (s) applySettings(s, allMatches);
      setRankings(r);
    } catch (e) { console.error(e); }
  }, [applySettings]);

  useEffect(() => { refresh(); }, []);

  // Supabase Realtime fallback to aggressive polling to ensure syncing
  useEffect(() => {
    let lastRefresh = 0;
    const ch = api.subscribeToSettings(async (s) => {
      lastRefresh = Date.now();
      const { data: allMatches } = await (async () => {
        try { return { data: await api.fetchMatches() }; } catch { return { data: [] }; }
      })();
      applySettings(s, allMatches);
    });
    
    // Aggressive polling fallback in case Realtime WebSockets are blocked/failing
    const pollInterval = setInterval(async () => {
      if (Date.now() - lastRefresh > 1500) {
        refresh(); // Force sync if no realtime updates heard recently
      }
    }, 1500);

    return () => { ch.unsubscribe(); clearInterval(pollInterval); };
  }, [applySettings, refresh]);

  // Poll matches and rankings aggressively
  useEffect(() => {
    const ch = api.subscribeToMatch(activeMatch?.id || '', (updatedMatch) => {
      setActiveMatch(updatedMatch);
    });
    const i = setInterval(async () => {
      try { 
        setRankings(await api.fetchRankings()); 
        if (activeMatch?.id) {
            const matches = await api.fetchMatches();
            const liveMatch = matches.find(m => m.id === activeMatch.id);
            if (liveMatch) setActiveMatch(liveMatch);
        }
      } catch {}
    }, 2000);
    return () => { ch.unsubscribe(); clearInterval(i); };
  }, [activeMatch?.id]);

  // Local timer countdown (synced from server, runs locally between polls)
  useEffect(() => {
    if (!timerRunning || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next === WARNING_TIME && !warningPlayed.current && audioInit.current) { warningPlayed.current = true; playWarningSound(); }
        if (next <= 0 && !endPlayed.current && audioInit.current) { endPlayed.current = true; playEndSound(); setTimerRunning(false); }
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timerRunning, timeLeft]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= WARNING_TIME ? '#f59e0b' : '#ffffff';
  const isAuto =
    timerPhase !== 'pickup' &&
    (timerPhase === 'autonomous' || (timerPhase === 'none' && isAutoPeriod(timeLeft)));

  // Pickup Countdown local timer
  useEffect(() => {
    if (timerPhase !== 'pickup' || pickupTime <= 0) return;
    const t = setInterval(() => setPickupTime(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [timerPhase, pickupTime]);

  const matchTotals = activeMatch ? computeMatchTotals(
    activeMatch.score_breakdown_red ?? {}, activeMatch.score_breakdown_blue ?? {},
    activeMatch.fouls_minor_red, activeMatch.fouls_major_red,
    activeMatch.fouls_minor_blue, activeMatch.fouls_major_blue,
  ) : null;

  return (
    <div className="audience-bg min-h-screen overflow-x-hidden">
      <div className="audience-grid" />

      {/* Header */}
      <div className="relative z-10 text-center pt-5 pb-2">
  {currentView !== 'standby' && (
    <img
      src="/standby/unibotics-banner.png"
      alt="UniBotics"
      className="mx-auto max-h-[80px] md:max-h-[100px] object-contain"
    />
  )}
</div>
      <div className={`relative z-10 transition-all duration-350 ${transitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
        style={{ minHeight: 'calc(100vh - 80px)' }}>

        {/* ─── STANDBY ──────────────────────────────────── */}
        {currentView === 'standby' && (
          <div className="flex flex-col items-center justify-center px-4 md:px-10 pb-12" style={{ minHeight: 'calc(100vh - 100px)' }}>
            <img
              src="/standby/unibotics-banner.png"
              alt="UniBotics Libya — National Robotics Championship for university students"
              className="w-full max-w-5xl object-contain max-h-[min(34vh,320px)] mb-10 drop-shadow-2xl"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 md:gap-8 w-full max-w-6xl items-stretch">
              {[
                { src: '/standby/lptic.png', alt: 'LPTIC — القابضة للاتصالات' },
                { src: '/standby/libyan-academy.png', alt: 'Libyan Academy for Telecommunications and Informatics' },
                { src: '/standby/libyan-students-union.png', alt: 'General Union of Libyan Students' },
              ].map((logo) => (
                <div
                  key={logo.src}
                  className="flex items-center justify-center rounded-2xl bg-white/[0.97] p-5 md:p-7 shadow-lg shadow-black/40 border border-white/10"
                >
                  <img src={logo.src} alt={logo.alt} className="w-full max-h-24 md:max-h-28 object-contain" />
                </div>
              ))}
            </div>
            <div className="mt-12 flex items-center gap-2 text-gray-500">
              <span className="status-dot live" />
              <span className="text-sm tracking-widest uppercase">Event in progress</span>
            </div>
          </div>
        )}

        {/* ─── LIVE MATCH ───────────────────────────────── */}
        {currentView === 'match' && !activeMatch && (
          <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 100px)' }}>
            <TimerIcon className="w-20 h-20 text-gray-700 mb-6" />
            <h2 className="text-3xl font-bold text-gray-500" style={{ fontFamily: "'Orbitron', sans-serif" }}>Waiting for next match...</h2>
          </div>
          
          
        )}

        {currentView === 'match' && activeMatch && (
          <div className="px-4 md:px-12 py-4">
            {/* Match Label */}
            <div className="text-center mb-4">
              <span className="badge badge-gray text-xs tracking-widest">{activeMatch.match_type} • Match #{activeMatch.match_number}</span>
            </div>

            {/* Transition Overlay */}
            {timerPhase === 'pickup' && (
              <div className="fixed inset-0 z-[100] bg-[#0f172a]/95 flex flex-col items-center justify-center p-10 animate-in fade-in zoom-in duration-500">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/10 rounded-full blur-[120px]" />
                </div>
                
                <div className="relative flex flex-col items-center text-center space-y-8">
                  <div className="bg-amber-500/20 p-8 rounded-full animate-pulse border border-amber-500/30">
                    <Gamepad2 className="w-24 h-24 text-amber-500" />
                  </div>
                  
                  <div className="space-y-4">
                    <h2 className="text-6xl md:text-8xl font-black text-amber-400 tracking-tighter italic uppercase" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                      DRIVERS PICK UP
                    </h2>
                    <h3 className="text-4xl md:text-5xl font-bold text-white tracking-widest uppercase opacity-80">
                      YOUR CONTROLLERS
                    </h3>
                  </div>

                  <div className="text-[12rem] font-black leading-none text-white transition-all transform scale-110 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                    {pickupTime}
                  </div>

                  <div className="flex gap-2">
                    {[...Array(PICKUP_DURATION)].map((_, i) => (
                      <div key={i} className={`h-2 w-12 rounded-full transition-all duration-500 ${i < pickupTime ? 'bg-amber-500' : 'bg-slate-800'}`} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Timer */}
            {(timerRunning || activeMatch.status === 'playing') && (
              <div className="text-center mb-6">
                <div className="font-black leading-none" style={{ fontFamily: "'Orbitron', sans-serif', color: timerColor", fontSize: 'clamp(80px, 15vw, 30px)', color: timerColor }}>
                  {fmt(timeLeft)}
                </div>
                <div className="text-sm font-bold tracking-widest mt-1 inline-block px-4 py-1 rounded-full"
                  style={{ background: isAuto ? '#eab30820' : '#6366f120', color: isAuto ? '#eab308' : '#818cf8', border: `1px solid ${isAuto ? '#eab30850' : '#6366f150'}` }}>
                  {isAuto ? '⚡ AUTO PERIOD' : '🕹 TELEOP PERIOD'}
                </div>
              </div>
            )}

            {/* Team Face-off — EQUAL SIZES */}
            <div className="flex items-stretch gap-3 md:gap-6 max-w-5xl mx-auto">
              {/* Red */}
              <div className="flex-1 glass-card-red p-6 md:p-10 text-center flex flex-col justify-between" style={{ minWidth: 0 }}>
                <div>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/60" />
                    <span className="text-xs text-red-400/70 tracking-[0.3em] uppercase font-semibold">Red Alliance</span>
                  </div>
                  {/* Team names — same font size regardless of length */}
                  <div className="font-black text-red-300 mb-1 truncate" style={{ fontSize: 'clamp(20px, 4vw, 40px)', fontFamily: "'Orbitron', sans-serif" }}>
                    {activeMatch.red_team1?.name}
                  </div>
                  {activeMatch.match_type === '2v2' && activeMatch.red_team2 && (
                    <div className="font-black text-red-400/70 truncate" style={{ fontSize: 'clamp(20px, 4vw, 40px)', fontFamily: "'Orbitron', sans-serif" }}>
                      {activeMatch.red_team2.name}
                    </div>
                  )}
                </div>
                {matchTotals && (
                  <div className="mt-6">
                    <div className="font-black text-red-200" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(48px, 8vw, 96px)' }}>
                      {matchTotals.redTotal}
                    </div>
                    <div className="text-xs text-red-400/60 mt-1">pts</div>
                  </div>
                )}
              </div>

              {/* VS */}
              <div className="flex items-center">
                <div className="vs-text text-2xl md:text-4xl">VS</div>
              </div>

              {/* Blue */}
              <div className="flex-1 glass-card-blue p-6 md:p-10 text-center flex flex-col justify-between" style={{ minWidth: 0 }}>
                <div>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/60" />
                    <span className="text-xs text-blue-400/70 tracking-[0.3em] uppercase font-semibold">Blue Alliance</span>
                  </div>
                  <div className="font-black text-blue-300 mb-1 truncate" style={{ fontSize: 'clamp(20px, 4vw, 40px)', fontFamily: "'Orbitron', sans-serif" }}>
                    {activeMatch.blue_team1?.name}
                  </div>
                  {activeMatch.match_type === '2v2' && activeMatch.blue_team2 && (
                    <div className="font-black text-blue-400/70 truncate" style={{ fontSize: 'clamp(20px, 4vw, 40px)', fontFamily: "'Orbitron', sans-serif" }}>
                      {activeMatch.blue_team2.name}
                    </div>
                  )}
                </div>
                {matchTotals && (
                  <div className="mt-6">
                    <div className="font-black text-blue-200" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(48px, 8vw, 96px)' }}>
                      {matchTotals.blueTotal}
                    </div>
                    <div className="text-xs text-blue-400/60 mt-1">pts</div>
                  </div>
                )}
              </div>
            </div>

            {/* Live scoring breakdown (shape counts) */}
            {(timerRunning || activeMatch.status === 'playing') && (
              <div className="mt-6 grid grid-cols-2 gap-4 max-w-5xl mx-auto">
                {(['red', 'blue'] as const).map(side => {
                  const bd = { ...EMPTY_BREAKDOWN, ...(side === 'red' ? activeMatch.score_breakdown_red : activeMatch.score_breakdown_blue) };
                  const color = side === 'red' ? '#ef4444' : '#3b82f6';
                  return (
                    <div key={side} className={side === 'red' ? 'glass-card-red p-4 rounded-xl' : 'glass-card-blue p-4 rounded-xl'}>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                          { icon: <ShapeBox size={20} />, auto: bd.boxes_low_auto + bd.boxes_high_auto, teleop: bd.boxes_low_teleop + bd.boxes_high_teleop },
                          { icon: <ShapeTriangle size={20} />, auto: bd.triangles_low_auto + bd.triangles_high_auto, teleop: bd.triangles_low_teleop + bd.triangles_high_teleop },
                          { icon: <ShapeCircle size={20} />, auto: bd.circles_low_auto + bd.circles_high_auto, teleop: bd.circles_low_teleop + bd.circles_high_teleop },
                        ].map((item, i) => (
                          <div key={i} className="flex flex-col items-center gap-1">
                            <div className="flex items-center justify-center h-6">{item.icon}</div>
                            <div className="text-xs font-bold" style={{ color }}>
                              A:{item.auto} T:{item.teleop}
                            </div>
                          </div>
                        ))}
                      </div>
                      {bd.special_orders > 0 && (
                        <div className="text-xs text-center mt-2" style={{ color }}>⭐ ×{bd.special_orders}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeMatch.status === 'playing' && (
              <div className="text-center mt-4">
                <span className="badge badge-yellow px-6 py-2 text-sm flex items-center gap-2 inline-flex">
                  <Zap className="w-4 h-4" /> MATCH IN PROGRESS
                </span>
              </div>
            )}
          </div>
        )}

        {/* ─── RESULTS ──────────────────────────────────── */}
        {currentView === 'results' && !activeMatch && (
          <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 100px)' }}>
            <Trophy className="w-20 h-20 text-gray-700 mb-4" />
            <h2 className="text-3xl font-bold text-gray-500" style={{ fontFamily: "'Orbitron', sans-serif" }}>No results available</h2>
          </div>
        )}

        {currentView === 'results' && activeMatch && matchTotals && (
          <div className="px-4 md:px-16 py-4 max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <span className="badge badge-green text-sm tracking-widest mb-3 inline-block">MATCH RESULTS</span>
              <h2 className="text-4xl md:text-5xl font-black" style={{ fontFamily: "'Orbitron', sans-serif" }}>Match {activeMatch.match_number}</h2>
            </div>

            <div className="glass-card overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-3 p-5 border-b border-gray-700/50">
                {(['red', 'blue'] as const).map((side, idx) => {
                  const t1 = side === 'red' ? activeMatch.red_team1 : activeMatch.blue_team1;
                  const t2 = side === 'red' ? activeMatch.red_team2 : activeMatch.blue_team2;
                  const c = side === 'red' ? '#ef4444' : '#3b82f6';
                  const pos = idx === 0 ? 'text-left' : 'text-right order-last';
                  return (
                    <div key={side} className={`${pos}`}>
                      <div className="flex items-center gap-1 mb-1" style={{ justifyContent: idx === 0 ? 'flex-start' : 'flex-end' }}>
                        <span className="w-3 h-3 rounded-full" style={{ background: c }} />
                        <span className="text-xs uppercase tracking-wider" style={{ color: c }}>{side}</span>
                      </div>
                      <div className="font-bold" style={{ color: c }}>{t1?.name}{t2 ? ` & ${t2.name}` : ''}</div>
                    </div>
                  );
                })}
                <div className="text-center text-gray-500 text-xs uppercase tracking-wider self-center">Category</div>
              </div>

              {/* Score rows */}
              {[
                { label: 'AUTO', red: activeMatch.score_breakdown_red ? (() => { const b = { ...EMPTY_BREAKDOWN, ...activeMatch.score_breakdown_red }; return (b.boxes_low_auto * POINTS.box_low_auto) + (b.boxes_high_auto * POINTS.box_high_auto) + (b.triangles_low_auto * POINTS.triangle_low_auto) + (b.triangles_high_auto * POINTS.triangle_high_auto) + (b.circles_low_auto * POINTS.circle_low_auto) + (b.circles_high_auto * POINTS.circle_high_auto); })() : 0, blue: activeMatch.score_breakdown_blue ? (() => { const b = { ...EMPTY_BREAKDOWN, ...activeMatch.score_breakdown_blue }; return (b.boxes_low_auto * POINTS.box_low_auto) + (b.boxes_high_auto * POINTS.box_high_auto) + (b.triangles_low_auto * POINTS.triangle_low_auto) + (b.triangles_high_auto * POINTS.triangle_high_auto) + (b.circles_low_auto * POINTS.circle_low_auto) + (b.circles_high_auto * POINTS.circle_high_auto); })() : 0 },
                { label: 'TELEOP', red: activeMatch.score_breakdown_red ? (() => { const b = { ...EMPTY_BREAKDOWN, ...activeMatch.score_breakdown_red }; return (b.boxes_low_teleop * POINTS.box_low) + (b.boxes_high_teleop * POINTS.box_high) + (b.triangles_low_teleop * POINTS.triangle_low) + (b.triangles_high_teleop * POINTS.triangle_high) + (b.circles_low_teleop * POINTS.circle_low) + (b.circles_high_teleop * POINTS.circle_high) + (b.special_orders * POINTS.special_order) + (b.back_to_place_auto ? POINTS.back_to_place_auto : 0) + (b.back_to_place_match ? POINTS.back_to_place_match : 0); })() : 0, blue: activeMatch.score_breakdown_blue ? (() => { const b = { ...EMPTY_BREAKDOWN, ...activeMatch.score_breakdown_blue }; return (b.boxes_low_teleop * POINTS.box_low) + (b.boxes_high_teleop * POINTS.box_high) + (b.triangles_low_teleop * POINTS.triangle_low) + (b.triangles_high_teleop * POINTS.triangle_high) + (b.circles_low_teleop * POINTS.circle_low) + (b.circles_high_teleop * POINTS.circle_high) + (b.special_orders * POINTS.special_order) + (b.back_to_place_auto ? POINTS.back_to_place_auto : 0) + (b.back_to_place_match ? POINTS.back_to_place_match : 0); })() : 0 },
                { label: 'PENALTY', red: (activeMatch.fouls_minor_blue * POINTS.minor_foul_to_opponent) + (activeMatch.fouls_major_blue * POINTS.major_foul_to_opponent), blue: (activeMatch.fouls_minor_red * POINTS.minor_foul_to_opponent) + (activeMatch.fouls_major_red * POINTS.major_foul_to_opponent) },
              ].map(row => (
                <div key={row.label} className="score-row grid grid-cols-3 px-5 py-4 border-b border-gray-700/20">
                  <div className="text-2xl font-bold text-red-300">{row.red}</div>
                  <div className="score-label text-center self-center">{row.label}</div>
                  <div className="text-2xl font-bold text-blue-300 text-right">{row.blue}</div>
                </div>
              ))}

              {/* Foul detail */}
              <div className="grid grid-cols-3 px-5 py-3 border-b border-gray-700/20 bg-yellow-500/5">
                <div className="text-sm text-yellow-400">{activeMatch.fouls_minor_red}× Minor / {activeMatch.fouls_major_red}× Major</div>
                <div className="text-xs text-gray-500 text-center self-center">FOULS COMMITTED</div>
                <div className="text-sm text-yellow-400 text-right">{activeMatch.fouls_minor_blue}× Minor / {activeMatch.fouls_major_blue}× Major</div>
              </div>

              {/* Total */}
              <div className="grid grid-cols-3 px-5 py-6" style={{ background: 'rgba(75,85,99,0.2)' }}>
                <div className="text-5xl md:text-6xl font-black text-red-200" style={{ fontFamily: "'Orbitron', sans-serif" }}>{matchTotals.redTotal}</div>
                <div className="score-label text-center self-center text-base">TOTAL</div>
                <div className="text-5xl md:text-6xl font-black text-blue-200 text-right" style={{ fontFamily: "'Orbitron', sans-serif" }}>{matchTotals.blueTotal}</div>
              </div>

              {/* Winner banner */}
              {(() => {
                const { redTotal, blueTotal } = matchTotals;
                if (redTotal === blueTotal) return (
                  <div className="p-6 text-center"><span className="text-2xl font-black text-yellow-400" style={{ fontFamily: "'Orbitron', sans-serif" }}>🤝 TIE MATCH</span></div>
                );
                const winner = redTotal > blueTotal ? 'RED' : 'BLUE';
                const c = redTotal > blueTotal ? '#ef4444' : '#3b82f6';
                return (
                  <div className="p-6 text-center">
                    <span className="block text-xs text-gray-500 tracking-[0.4em] uppercase mb-2">Winner</span>
                    <span className="text-3xl font-black" style={{ fontFamily: "'Orbitron', sans-serif", color: c }}>🏆 {winner} ALLIANCE</span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ─── RANKINGS ─────────────────────────────────── */}
        {currentView === 'rankings' && (
          <div className="px-4 md:px-16 py-4 max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <span className="badge badge-green text-sm tracking-widest mb-3 inline-block">LEADERBOARD</span>
              <h2 className="text-4xl md:text-5xl font-black gradient-text" style={{ fontFamily: "'Orbitron', sans-serif" }}>Rankings</h2>
            </div>

            {rankings.length === 0 ? (
              <div className="glass-card p-16 text-center"><Trophy className="w-16 h-16 mx-auto mb-4 text-gray-700" /><p className="text-gray-500 text-xl">No rankings yet</p></div>
            ) : (
              <div className="glass-card overflow-hidden">
                <div className="grid px-5 py-3 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-700/50 font-semibold"
                  style={{ gridTemplateColumns: '50px 1fr 80px 70px 90px 90px 90px' }}>
                  <div>#</div><div>Team</div><div className="text-center">W-L-T</div><div className="text-center">GP</div>
                  <div className="text-center">Total RP</div><div className="text-center">Avg RP</div><div className="text-center">Avg Score</div>
                </div>
                {rankings.map((team, i) => (
                  <div key={team.team_id}
                    className={`grid px-5 py-5 items-center border-b border-gray-700/20 hover:bg-gray-800/30 transition-colors rank-row ${i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : ''}`}
                    style={{ gridTemplateColumns: '50px 1fr 80px 70px 90px 90px 90px' }}>
                    <div className="text-2xl font-black" style={{ fontFamily: "'Orbitron', sans-serif", color: i === 0 ? '#facc15' : i === 1 ? '#d1d5db' : i === 2 ? '#b45309' : '#6b7280' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </div>
                    <div>
                      <div className="font-bold text-base md:text-lg">{team.team_name}</div>
                      {team.team_number && <div className="text-xs text-gray-500">#{team.team_number}</div>}
                    </div>
                    <div className="text-center text-sm">
                      <span className="text-green-400">{team.wins}</span>-<span className="text-red-400">{team.losses}</span>-<span className="text-yellow-400">{team.ties}</span>
                    </div>
                    <div className="text-center text-gray-400">{team.matches_played}</div>
                    <div className="text-center font-bold text-lg">{team.total_rp}</div>
                    <div className="text-center font-black text-xl" style={{ fontFamily: "'Orbitron', sans-serif", color: parseFloat(team.average_rp) >= 2.5 ? '#4ade80' : parseFloat(team.average_rp) >= 1.5 ? '#facc15' : '#9ca3af' }}>
                      {team.average_rp}
                    </div>
                    <div className="text-center text-gray-300 font-semibold">{team.avg_score}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {currentView !== 'standby' && (
  <div className="mt-10 pb-6 px-4">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 md:gap-8 w-full max-w-6xl mx-auto items-stretch">
      {[
        { src: '/standby/lptic.png', alt: 'LPTIC — القابضة للاتصالات' },
        { src: '/standby/libyan-academy.png', alt: 'Libyan Academy for Telecommunications and Informatics' },
        { src: '/standby/libyan-students-union.png', alt: 'General Union of Libyan Students' },
      ].map((logo) => (
        <div
          key={logo.src}
          className="flex items-center justify-center rounded-2xl bg-white/[0.97] p-4 md:p-6 shadow-lg shadow-black/30 border border-white/10"
        >
          <img
            src={logo.src}
            alt={logo.alt}
            className="w-full max-h-20 md:max-h-24 object-contain"
          />
        </div>
      ))}
    </div>
  </div>
)}
    </div>
  );
}
