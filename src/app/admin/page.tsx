"use client";
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { fetchStudentInfo } from '../../lib/student';

interface Player {
  id: string;
  name?: string;
  score: number;
  attempts: number;
  lastPlayed: number;
}

interface GameSession {
  playerId: string;
  status: 'inactive' | 'active' | 'scoring';
}

export default function AdminScorePage() {
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [session, setSession] = useState<GameSession>({ playerId: '', status: 'inactive' });
  const [selectedId, setSelectedId] = useState('');
  const [sticksCaught, setSticksCaught] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingId, setIsLoadingId] = useState(false);

  const TOTAL_STICKS = 6;
  const ID_INPUT_TIMEOUT = 500;
  const idTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [studentIdBuffer, setStudentIdBuffer] = useState('');

  useEffect(() => {
    const load = () => {
      try {
        const p = localStorage.getItem('reactionRingPlayers');
        const s = localStorage.getItem('reactionRingSession');
        if (p) setPlayers(JSON.parse(p));
        if (s) setSession(JSON.parse(s));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load storage', e);
      }
    };

    load();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'reactionRingPlayers' || e.key === 'reactionRingSession') load();
    };
    window.addEventListener('storage', onStorage);
    const interval = setInterval(load, 1000);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(interval); };
  }, []);

  // Persist players and session when they change locally
  useEffect(() => {
    try { localStorage.setItem('reactionRingPlayers', JSON.stringify(players)); } catch {}
  }, [players]);
  useEffect(() => {
    try { localStorage.setItem('reactionRingSession', JSON.stringify(session)); } catch {}
  }, [session]);

  const ids = useMemo(() => Object.keys(players).sort(), [players]);

  const startSession = useCallback((studentId: string, name?: string) => {
    if (session.status !== 'inactive') return;
    setSession({ playerId: studentId, status: 'active' });
    setPlayers(prev => {
      const existing = prev[studentId];
      if (existing) {
        return { ...prev, [studentId]: { ...existing, name: name ?? existing.name } };
      }
      const newPlayer: Player = { id: studentId, name, score: 0, attempts: 0, lastPlayed: Date.now() };
      return { ...prev, [studentId]: newPlayer };
    });
  }, [session.status]);

  const handleIdSubmission = useCallback(async () => {
    const trimmedId = studentIdBuffer.trim();
    if (!trimmedId || isLoadingId) { setStudentIdBuffer(''); return; }

    setIsLoadingId(true);
    setErrorMessage(null);
    try {
      const info = await fetchStudentInfo(trimmedId);
      const isValid = !!(info && info.email && info.email.endsWith('@dlsl.edu.ph') && info.name && info.name.trim().length > 0 && info.whitelist);
      if (!isValid) {
        setErrorMessage('Invalid student ID. Please try again.');
      } else {
        startSession(trimmedId, info!.name);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Validation error:', e);
      setErrorMessage('Unable to validate ID. Check connection and try again.');
    } finally {
      setIsLoadingId(false);
      setStudentIdBuffer('');
    }
  }, [studentIdBuffer, isLoadingId, startSession]);

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

  const applyScore = (e: React.FormEvent) => {
    e.preventDefault();
    const id = selectedId || session.playerId;
    const player = players[id];
    const val = parseInt(sticksCaught, 10);
    if (!player || Number.isNaN(val) || val < 0 || val > TOTAL_STICKS) return;

    let newScore = player.score;
    const missed = TOTAL_STICKS - val;
    if (player.attempts > 0) newScore -= missed;
    newScore += val;

    const updated: Player = { ...player, score: newScore, attempts: player.attempts + 1, lastPlayed: Date.now() };
    const nextPlayers = { ...players, [id]: updated };
    setPlayers(nextPlayers);
    try { localStorage.setItem('reactionRingPlayers', JSON.stringify(nextPlayers)); } catch {}

    // End session after scoring
    const nextSession: GameSession = { playerId: '', status: 'inactive' };
    setSession(nextSession);
    try { localStorage.setItem('reactionRingSession', JSON.stringify(nextSession)); } catch {}

    setSticksCaught('');
  };

  return (
    <main className="min-h-screen w-full p-6 bg-slate-900 text-white relative">
      <div className="max-w-3xl mx-auto relative z-10">
        <h1 className="text-3xl font-bold mb-4">Admin Score Update</h1>
        <div className="mb-6 p-4 bg-white/10 rounded-lg">
          <p>Session: <span className="font-mono">{session.status}</span> {session.playerId && `- ${players[session.playerId]?.name || session.playerId}`}</p>
          {errorMessage && <p className="mt-2 text-red-300">{errorMessage}</p>}
          {studentIdBuffer && session.status === 'inactive' && !isLoadingId && (
            <p className="mt-2 text-sky-300">ID Buffer: <span className="font-mono">{studentIdBuffer}</span></p>
          )}
        </div>

        <form onSubmit={applyScore} className="space-y-4 bg-white/10 p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Player ID</label>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full p-2 bg-black/30 rounded border border-white/20">
                <option value="">{session.playerId ? `Current: ${players[session.playerId]?.name || session.playerId}` : 'Select player'}</option>
                {ids.map(id => (
                  <option key={id} value={id}>{players[id].name || id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Sticks Caught (0-{TOTAL_STICKS})</label>
              <input value={sticksCaught} onChange={e => setSticksCaught(e.target.value)} type="number" min={0} max={TOTAL_STICKS} className="w-full p-2 bg-black/30 rounded border border-white/20" />
            </div>
          </div>
          <button type="submit" className="px-4 py-2 bg-yellow-400 text-slate-900 font-semibold rounded hover:bg-yellow-300">Apply Score</button>
        </form>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2">Players</h2>
          <ul className="space-y-2">
            {ids.map(id => (
              <li key={id} className="flex justify-between bg-white/5 p-3 rounded">
                <span>{players[id].name || id}</span>
                <span className="font-bold">{players[id].score} pts</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {isLoadingId && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-4 text-white">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-lg">Validating ID...</p>
          </div>
        </div>
      )}
    </main>
  );
}
