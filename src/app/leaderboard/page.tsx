"use client";
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { fetchStudentInfo } from "@/lib/student";
import { Player, GameSession } from "@/lib/types"

const PlainsBackground = () => (
  <div className="absolute inset-0 w-full h-full overflow-hidden z-0">
    <Image
      src="/bg.png"
      alt="Plains Background"
      fill
      className="absolute inset-0 object-cover w-full h-full"
      priority
    />

    <div
      style={{
        position: "absolute",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        width: 380, // Increased width
        aspectRatio: "5/2",
        zIndex: 2,
      }}
    >
      <Image
        src="/logo.png"
        alt="Logo"
        fill
        style={{ objectFit: "contain" }}
        priority
      />
    </div>

    <Image
      src="/pond.png"
      alt="Pond"
      width={600}
      height={400}
      className="absolute right-0 transform translate-x-1/2 translate-y-1/2"
    />

    <Image
      src="/pond.png"
      alt="Pond"
      width={600}
      height={400}
      className="absolute left-0 transform -translate-x-1/2 translate-y-1/2"
    />
  </div>
);

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [session, setSession] = useState<GameSession>({
    playerId: "",
    status: "inactive",
    name: ""
  });
  const [animNonce, setAnimNonce] = useState(0);
  const [showStartAnim, setShowStartAnim] = useState(false);
  const prevHasPlayerRef = useRef(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingId, setIsLoadingId] = useState(false);
  const ID_INPUT_TIMEOUT = 500;
  const idTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [studentIdBuffer, setStudentIdBuffer] = useState('');

  // Particle effect state
  type Particle = {
    id: number;
    dx: number;
    dy: number;
    color: string;
    duration: number;
    delay: number;
    size: number;
    batch: number;
  };
  const [particleMap, setParticleMap] = useState<Record<string, Particle[]>>({});
  const prevScoresRef = useRef<Record<string, number>>({});
  // Floating delta labels
  type LabelBurst = {
    id: number;
    text: string;
    kind: "add" | "sub";
    duration: number;
    delay: number;
    color: string;
    batch: number;
  };
  const [labelsMap, setLabelsMap] = useState<Record<string, LabelBurst[]>>({});

  const handleIdSubmission = useCallback(async () => {
    const trimmedId = studentIdBuffer.trim();
    if (!trimmedId || isLoadingId) { setStudentIdBuffer(''); return; }

    // if current session is active, do not proceed
    if (session.status !== 'inactive') {
      return;
    }

    setIsLoadingId(true);
    setErrorMessage(null);
    try {
      const info = await fetchStudentInfo(trimmedId);
      const isValid = !!(info && info.email && info.email.endsWith('@dlsl.edu.ph') && info.name && info.name.trim().length > 0 && info.whitelist);
      if (!isValid) {
        setErrorMessage('Invalid student ID. Please try again.');
      } else {
        // update session
        supabase.from('session')
          .upsert({
            id: 0,
            player_id: trimmedId,
            name: info!.name,
            status: 'active'
          })
          .then(({ error }) => {
            if (error) {
              console.error("Failed to update leaderboard:", error);
              setErrorMessage('Failed to start session. Please try again.');
            }
          });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Validation error:', e);
      setErrorMessage('Unable to validate ID. Check connection and try again.');
    } finally {
      setIsLoadingId(false);
      setStudentIdBuffer('');
    }
  }, [studentIdBuffer, isLoadingId, session.status]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (session.status !== 'inactive' || isLoadingId) return;
      if (idTimeoutRef.current) clearTimeout(idTimeoutRef.current);
      if (event.key === 'Enter') {
        void handleIdSubmission();
      } else if (event.key.length === 1) {
        setStudentIdBuffer(prev => prev + event.key);
      }
      idTimeoutRef.current = setTimeout(() => { void handleIdSubmission(); }, ID_INPUT_TIMEOUT);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (idTimeoutRef.current) clearTimeout(idTimeoutRef.current);
    };
  }, [handleIdSubmission, session.status, isLoadingId]);



  useEffect(() => {
    console.log("Fetching from supabase");

    supabase.from("leaderboard")
      .select("*")
      .order("score", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to fetch leaderboard:", error);
          return;
        }
        const playersMap: Record<string, Player> = {};
        data?.forEach((player) => {
          playersMap[player.id] = {
            id: player.id,
            name: player.name,
            score: player.score,
            attempts: player.attempts,
            lastPlayed: player.last_played,
          };
        });
        setPlayers(playersMap);
      });
  }, []);

  useEffect(() => {
    // fetch session
    console.log("FETCHING SESSION")

    supabase.from("session")
      .select("*")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to fetch session:", error);
          return;
        }
        if (data) {
          setSession({
            playerId: data.player_id,
            name: data.name,
            status: data.status,
          });
        } else {
          // no session found
          console.log("No session found")
        }
      });
  }, []);

  useEffect(() => {
    // realtime subscriptions

    const leaderboardSubscription = supabase.channel("leaderboard")
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaderboard' },
        (payload) => {
          console.log("Leaderboard payload:", payload);

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newPlayer = payload.new;
            setPlayers((prev) => ({ ...prev, [newPlayer.id]: newPlayer }));
          } else if (payload.eventType === 'DELETE') {
            const deletedPlayerId = payload.old.id;
            setPlayers((prev) => {
              const newPlayers = { ...prev };
              delete newPlayers[deletedPlayerId];
              return newPlayers;
            });
          }
        }
      )

    const sessionSubscription = supabase.channel("session")
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session' },
        (payload) => {
          console.log("Session payload:", payload);

          if (payload.eventType === 'INSERT') {
            const newSession = payload.new;
            setSession((prev) => ({ ...prev, ...newSession }));
          } else if (payload.eventType === 'UPDATE') {
            const updatedSession = payload.new;
            setSession((prev) => ({ ...prev, ...updatedSession }));
          } else if (payload.eventType === 'DELETE') {
            setSession({ playerId: "", status: "inactive", name: "" });
          }
        });

    sessionSubscription.subscribe();
    leaderboardSubscription.subscribe();

    return () => {
      sessionSubscription.unsubscribe();
      leaderboardSubscription.unsubscribe();
    };
  }, [])


  const spawnParticles = useCallback((playerId: string, kind: "add" | "sub", delta: number) => {
    const N = 16;
    const batch = Date.now() + Math.random();
    const colorsAdd = ["#34d399", "#10b981", "#a7f3d0", "#fbbf24"]; // greens + gold accent
    const colorsSub = ["#f87171", "#ef4444", "#fecaca", "#fb923c"]; // reds + warm accent
    const parts: Particle[] = Array.from({ length: N }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 40 + Math.random() * 80; // 40-120px
      const directionalY = kind === "add" ? -1 : 1;
      const spreadBias = Math.random() * 0.6 + 0.4; // reduce extremes
      const dx = Math.cos(angle) * radius * spreadBias;
      const dy = Math.sin(angle) * radius * 0.6 + directionalY * (40 + Math.random() * 60);
      const duration = 650 + Math.random() * 500; // 650-1150ms
      const delay = Math.random() * 120; // 0-120ms
      const size = 4 + Math.random() * 6; // 4-10px
      const color = (kind === "add" ? colorsAdd : colorsSub)[i % 4];
      return {
        id: batch + i,
        dx,
        dy,
        color,
        duration,
        delay,
        size,
        batch,
      };
    });
    setParticleMap((prev) => ({
      ...prev,
      [playerId]: [...(prev[playerId] || []), ...parts],
    }));

    // Add a prominent floating delta label
    const label: LabelBurst = {
      id: batch + 100000,
      text: `${delta > 0 ? "+" : ""}${delta}`,
      kind,
      duration: 1100,
      delay: 0,
      color: kind === "add" ? "#22c55e" : "#ef4444",
      batch,
    };
    setLabelsMap((prev) => ({
      ...prev,
      [playerId]: [...(prev[playerId] || []), label],
    }));

    const ttl = Math.max(...parts.map((p) => p.duration + p.delay), label.duration + label.delay) + 250;
    window.setTimeout(() => {
      setParticleMap((prev) => ({
        ...prev,
        [playerId]: (prev[playerId] || []).filter((p) => p.batch !== batch),
      }));
      setLabelsMap((prev) => ({
        ...prev,
        [playerId]: (prev[playerId] || []).filter((l) => l.batch !== batch),
      }));
    }, ttl);
  }, []);


  // Detect transition from waiting -> now playing and trigger intro animation
  useEffect(() => {
    const hasPlayer = session.status !== "inactive" && !!session.playerId;
    if (hasPlayer && !prevHasPlayerRef.current) {
      setShowStartAnim(true);
      const t = setTimeout(() => setShowStartAnim(false), 1100);
      return () => clearTimeout(t);
    }
    prevHasPlayerRef.current = hasPlayer;
  }, [session.status, session.playerId]);

  const leaderboard = useMemo(() => {
    return Object.values(players)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [players]);

  // Trigger animation when leaderboard content changes
  useEffect(() => {
    setAnimNonce((n) => n + 1);
  }, [JSON.stringify(leaderboard.map((p) => ({ id: p.id, score: p.score })))]);

  // Detect score changes and spawn particles
  useEffect(() => {
    const prev = prevScoresRef.current;
    const curr: Record<string, number> = {};
    for (const p of Object.values(players)) {
      curr[p.id] = p.score;
      if (prev[p.id] !== undefined && prev[p.id] !== p.score) {
        const kind = p.score > prev[p.id] ? "add" : "sub";
        const delta = p.score - prev[p.id];
        spawnParticles(p.id, kind, delta);
      }
    }
    prevScoresRef.current = curr;
  }, [players, spawnParticles]);

  const nowPlaying =
    session.status !== "inactive" ? players[session.playerId] : undefined;

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 relative">
      <PlainsBackground />

      <style>{`
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeSlideUp .35s ease both; }
        @keyframes particleBurst { to { transform: translate(var(--dx), var(--dy)) scale(0.9); opacity: 0; } }
        @keyframes labelUp { to { transform: translate(-50%, -140%); opacity: 0; } }
        @keyframes labelDown { to { transform: translate(-50%, -10%); opacity: 0; } }
        @keyframes popIn { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes pulseRing { from { transform: scale(.92); opacity: .6; } to { transform: scale(1.25); opacity: 0; } }
        @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 5px rgba(255,255,255,0.2); } 50% { box-shadow: 0 0 20px rgba(255,255,255,0.4), 0 0 30px rgba(255,255,255,0.2); } }
        @keyframes waitingPulse { 0%, 100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.02); } }
        @keyframes sparkle { 0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); } 50% { opacity: 1; transform: scale(1) rotate(180deg); } }
        .sparkle { animation: sparkle 2s ease-in-out infinite; }
        .sparkle:nth-child(2) { animation-delay: 0.4s; }
        .sparkle:nth-child(3) { animation-delay: 0.8s; }
        .sparkle:nth-child(4) { animation-delay: 1.2s; }
        .sparkle:nth-child(5) { animation-delay: 1.6s; }
      `}</style>

      <div className="relative z-10 w-full max-w-4xl mx-auto">

        <div
          className="p-8 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20"
          style={{
            // animation: 'glow 4s ease-in-out infinite, shimmer 6s ease-in-out infinite',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.1) 100%)'
          }}
        >
          <h1
            className="text-6xl font-bold text-center my-6 tracking-wider uppercase"
            style={{
              fontFamily: "Pagkaki, sans-serif",
              textShadow: "0px 4px 0px rgba(43, 84, 58, 0.4)",
              color: "rgba(34, 56, 34, 0.95)",
            }}
          >
            LEADERBOARD
          </h1>

          <div key={session.status !== 'inactive' ? session.playerId : 'waiting'} className="relative">
            {isLoadingId ? (
              <div
                className="mb-6 p-4 rounded-xl bg-white/10 border border-white/20 text-center text-[rgba(34,56,34,0.95)]"
                style={{
                  animation: 'waitingPulse 2s ease-in-out infinite, shimmer 3s ease-in-out infinite'
                }}
              >
                Validating student ID...
              </div>
            ) : errorMessage ? (
              <div
                className="mb-6 p-4 rounded-xl bg-red-100/30 border border-red-300/40 text-center text-red-700 font-semibold"
                style={{
                  animation: 'popIn 420ms ease-out both'
                }}
              >
                {errorMessage}
              </div>
            ) : session.status !== "inactive" ? (
              <div
                className="mb-6 p-4 rounded-xl bg-yellow-400/20 border border-yellow-300/40 text-white text-center uppercase"
                style={{
                  fontFamily: "Pagkaki, sans-serif",
                  animation: "popIn 420ms ease-out both",
                  position: 'relative'
                }}
              >
                {showStartAnim && (
                  <>
                    <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-yellow-300/60" style={{ animation: 'pulseRing 900ms ease-out forwards' }} />
                    <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-amber-400/50" style={{ animation: 'pulseRing 1100ms ease-out 120ms forwards' }} />
                  </>
                )}
                <p className="text-xl text-[rgba(34,56,34,0.95)]">Now Playing:</p>
                <p className="text-3xl font-extrabold mt-1 text-[rgba(34,56,34,0.95)]">
                  {session.name}
                </p>
                <p className="text-sm opacity-80 mt-1 text-[rgba(34,56,34,0.95)]">
                  Status: {session.status}
                </p>
              </div>
            ) : (
              <div
                className="mb-6 p-4 rounded-xl bg-white/10 border border-white/20 text-center text-[rgba(34,56,34,0.95)]"
                style={{
                  animation: 'waitingPulse 2s ease-in-out infinite, shimmer 3s ease-in-out infinite'
                }}
              >
                Waiting for the next player...
              </div>
            )}
          </div>

          <div className="space-y-3" key={animNonce}>
            {leaderboard.length > 0 ? (
              leaderboard.map((player, index) => (
                <div
                  key={player.id}
                  className={`relative overflow-visible flex items-center justify-between p-4 rounded-xl text-white transition-all duration-300 shadow-lg animate-in ${index === 0
                    ? "bg-yellow-400/30 border-2 border-yellow-300 scale-[1.02]"
                    : index === 1
                      ? "bg-slate-50/20 border border-slate-300/50"
                      : index === 2
                        ? "bg-orange-500/20 border border-orange-400/50"
                        : "bg-white/10"
                    }`}
                  style={{
                    animationDelay: `${index * 60}ms`,
                    animation: `float 4s ease-in-out infinite ${index * 0.5}s`
                  }}
                >
                  <div className="flex items-center">
                    <div
                      className={`w-12 h-12 min-w-12 min-h-12 flex items-center justify-center font-extrabold text-white rounded-lg shadow-md border ring-1 ${index === 0
                        ? "bg-gradient-to-br from-yellow-300 to-amber-500 border-amber-300 ring-amber-200/60"
                        : index === 1
                          ? "bg-gradient-to-br from-gray-300 to-gray-500 border-gray-300 ring-gray-200/60"
                          : index === 2
                            ? "bg-gradient-to-br from-orange-400 to-amber-600 border-amber-400 ring-amber-200/60"
                            : "bg-gradient-to-br from-emerald-900/70 to-emerald-800/70 border-emerald-700/70 ring-white/10"
                        }`}
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
                    >
                      #{index + 1}
                    </div>
                    <span
                      className="text-2xl font-medium ml-4 pt-3 uppercase text-[rgba(34,56,34,0.95)]"
                      style={{
                        fontFamily: "Pagkaki, sans-serif",
                      }}
                    >
                      {player.name || player.id} {" "}
                      {player.attempts === 0 ? "(First attempt)" : `(${player.attempts} attemps)`}
                    </span>
                  </div>

                  {/* Particle overlay */}
                  <div className="pointer-events-none absolute inset-0 overflow-visible">
                    {(particleMap[player.id] || []).map((p) => (
                      <span
                        key={p.id}
                        className="absolute rounded-full"
                        style={{
                          left: "50%",
                          top: "50%",
                          width: p.size,
                          height: p.size,
                          background: p.color,
                          transform: "translate(-50%, -50%)",
                          animation: `particleBurst ${p.duration}ms ease-out ${p.delay}ms forwards`,
                          // @ts-ignore: CSS custom props
                          "--dx": `${p.dx}px`,
                          // @ts-ignore: CSS custom props
                          "--dy": `${p.dy}px`,
                          boxShadow: "0 0 0 1px rgba(0,0,0,0.05)",
                          opacity: 1,
                        }}
                      />
                    ))}
                    {(labelsMap[player.id] || []).map((l) => (
                      <span
                        key={l.id}
                        className="absolute font-extrabold uppercase"
                        style={{
                          zIndex: 10,
                          left: "50%",
                          top: "50%",
                          transform: "translate(-50%, -50%)",
                          color: l.color,
                          textShadow: "0 2px 8px rgba(0,0,0,0.35)",
                          filter: "drop-shadow(0 0 4px rgba(255,255,255,0.25))",
                          letterSpacing: "1px",
                          fontSize: 68,
                          animation: `${l.kind === 'add' ? 'labelUp' : 'labelDown'} ${3000}ms cubic-bezier(.2,.9,.2,1) ${l.delay}ms forwards`,
                        }}
                      >
                        {l.text}
                      </span>
                    ))}
                  </div>

                  <span className="text-3xl font-bold text-white">
                    {player.score} pts
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-sky-100 text-xl py-8">
                No players yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
