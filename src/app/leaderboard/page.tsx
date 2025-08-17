"use client";
import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";

// Types shared with main page
interface Player {
  id: string;
  name?: string;
  score: number;
  attempts: number;
  lastPlayed: number;
}

interface GameSession {
  playerId: string;
  status: "inactive" | "active" | "scoring";
}

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
  });
  const [animNonce, setAnimNonce] = useState(0);

  // Load from localStorage
  const loadFromStorage = () => {
    try {
      const p = localStorage.getItem("reactionRingPlayers");
      const s = localStorage.getItem("reactionRingSession");
      if (p) setPlayers(JSON.parse(p));
      if (s) setSession(JSON.parse(s));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to load game state from localStorage", e);
    }
  };

  useEffect(() => {
    loadFromStorage();

    const onStorage = (e: StorageEvent) => {
      if (e.key === "reactionRingPlayers" || e.key === "reactionRingSession") {
        loadFromStorage();
      }
    };

    window.addEventListener("storage", onStorage);
    const interval = setInterval(loadFromStorage, 1000); // polling fallback

    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, []);

  const leaderboard = useMemo(() => {
    return Object.values(players)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [players]);

  // Trigger animation when leaderboard content changes
  useEffect(() => {
    setAnimNonce((n) => n + 1);
  }, [JSON.stringify(leaderboard.map((p) => ({ id: p.id, score: p.score })))]);

  const nowPlaying =
    session.status !== "inactive" ? players[session.playerId] : undefined;

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 relative">
      <PlainsBackground />

      <style>{`
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeSlideUp .35s ease both; }
      `}</style>

      <div className="relative z-10 w-full max-w-4xl mx-auto">
        <div className="p-8 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20">
          <h1
            className="text-6xl font-bold text-center mb-6 tracking-wider uppercase"
            style={{
              fontFamily: "Pagkaki, sans-serif",
              textShadow: "0px 4px 0px rgba(43, 84, 58, 0.4)",
              color: "rgba(34, 56, 34, 0.95)",
            }}
          >
            LEADERBOARD
          </h1>

          {nowPlaying ? (
            <div
              className="mb-6 p-4 rounded-xl bg-yellow-400/20 border border-yellow-300/40 text-white text-center animate-in uppercase"
              style={{
                fontFamily: "Pagkaki, sans-serif",
              }}
            >
              <p className="text-xl text-[rgba(34,56,34,0.95)]">Now Playing:</p>
              <p className="text-3xl font-extrabold mt-1 text-[rgba(34,56,34,0.95)]">
                {nowPlaying.name || nowPlaying.id}
              </p>
              <p className="text-sm opacity-80 mt-1 text-[rgba(34,56,34,0.95)]">
                Status: {session.status}
              </p>
            </div>
          ) : (
            <div className="mb-6 p-4 rounded-xl bg-white/10 border border-white/20 text-center text-sky-100 animate-in">
              Waiting for the next player...
            </div>
          )}

          <div className="space-y-3" key={animNonce}>
            {leaderboard.length > 0 ? (
              leaderboard.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-xl text-white transition-all duration-300 shadow-lg animate-in ${
                    index === 0
                      ? "bg-yellow-400/30 border-2 border-yellow-300 scale-[1.02]"
                      : index === 1
                      ? "bg-slate-50/20 border border-slate-300/50"
                      : index === 2
                      ? "bg-orange-500/20 border border-orange-400/50"
                      : "bg-white/10"
                  }`}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="flex items-center">
                    <div
                      className={`w-12 h-12 min-w-12 min-h-12 flex items-center justify-center font-extrabold text-white rounded-lg shadow-md border ring-1 ${
                        index === 0
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
                      {player.name || player.id}
                    </span>
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
