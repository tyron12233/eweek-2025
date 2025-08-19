"use client";

// NOTE: Changed path aliases (e.g., "@/lib/supabase") to relative paths 
// to resolve a compilation error in the environment.
import { supabase } from "../../lib/supabase";
import { GameSession } from "../../lib/types";

import { useEffect, useState } from "react";
import type React from "react";
import { clsx } from "clsx";

interface SupabaseSessionData {
  player_id: string;
  name: string;
  status: "inactive" | "active" | "scoring";
}

/**
 * A loading spinner component.
 */
const Loader = () => (
  <div className="flex flex-col items-center justify-center gap-4 p-8">
    <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
    <p className="text-gray-400">Connecting to session...</p>
  </div>
);

/**
 * Displays the current player's information.
 */
const PlayerInfo = ({ name }: { name: string }) => (
  <div className="text-center mb-6">
    <p className="text-sm text-gray-400">Current Player</p>
    <h2 className="text-3xl font-bold text-white tracking-wide">{name}</h2>
  </div>
);

/**
 * A visual indicator for the session status.
 */
const StatusIndicator = ({ status }: { status: GameSession["status"] }) => {
  const statusConfig = {
    inactive: { text: "Waiting for Player", color: "bg-gray-500" },
    active: { text: "Player Ready", color: "bg-yellow-500" },
    scoring: { text: "Scoring Active", color: "bg-green-500" },
  };

  const { text, color } = statusConfig[status];

  return (
    <div className="absolute top-4 right-4 flex items-center gap-2 bg-gray-900/50 px-3 py-1.5 rounded-full text-xs">
      <div className={clsx("w-2.5 h-2.5 rounded-full animate-pulse", color)}></div>
      <span className="font-medium text-gray-300">{text}</span>
    </div>
  );
};


/**
 * The main Admin Page component.
 */
export default function AdminPage() {
  const [session, setSession] = useState<GameSession>({
    playerId: "",
    status: "inactive",
    name: ""
  });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Helper function to map Supabase's snake_case data to the app's camelCase state
  const mapDataToSession = (data: SupabaseSessionData): GameSession => {
    return {
      playerId: data.player_id,
      name: data.name,
      status: data.status,
    };
  };

  useEffect(() => {
    // This effect handles both the initial fetch and the realtime subscription.
    const fetchSession = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("session")
        .select("*")
        .maybeSingle<SupabaseSessionData>();

      if (error) {
        console.error("Failed to fetch session:", error);
      } else if (data) {
        setSession(mapDataToSession(data));
      } else {
        setSession({ playerId: "", status: "inactive", name: "" });
      }
      setLoading(false);
    };

    fetchSession();

    const sessionSubscription = supabase.channel("session-admin-channel")
      .on<SupabaseSessionData>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session' },
        (payload) => {
          console.log("Session change received:", payload);
          switch (payload.eventType) {
            case 'INSERT':
            case 'UPDATE':
              setSession(mapDataToSession(payload.new));
              break;
            case 'DELETE':
              setSession({ playerId: "", status: "inactive", name: "" });
              break;
          }
        }
      )
      .subscribe();

    // Cleanup the subscription when the component unmounts
    return () => {
      supabase.removeChannel(sessionSubscription);
    };
  }, []);

  // Handles updating the player's score by calling the Supabase RPC
  const handleScoreUpdate = async (score: number) => {
    if (isSubmitting || !session.playerId) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc("update_score", {
        player_id: session.playerId,
        new_score: score,
      });
      if (error) {
        console.error("Failed to update score:", error);
        // You could add a user-facing error message here
      }
    } finally {
      // A short delay prevents accidental double-taps
      setTimeout(() => setIsSubmitting(false), 500);
    }
  };

  // Renders the main content based on the current session status
  const renderContent = () => {
    switch (session.status) {
      case "active":
      case "scoring":
        return (
          <>
            <PlayerInfo name={session.name} />
            <div className="text-center mb-6">
              <p className="text-lg text-blue-300">How many sticks did they catch?</p>
            </div>
            <div className="grid grid-cols-4 gap-3 md:gap-4">
              {[...Array(7).keys()].map((score) => (
                <button
                  key={score}
                  onClick={() => handleScoreUpdate(score)}
                  disabled={isSubmitting}
                  className={clsx(
                    "h-16 w-16 md:h-20 md:w-20 rounded-full flex items-center justify-center text-2xl md:text-3xl font-bold transition-all duration-200 ease-in-out transform focus:outline-none focus:ring-4 focus:ring-blue-500/50",
                    "bg-gray-700 text-white shadow-md",
                    "hover:bg-blue-600 hover:shadow-lg hover:-translate-y-1",
                    "disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  )}
                >
                  {score}
                </button>
              ))}
            </div>
          </>
        );
      case "inactive":
      default:
        return (
          <div className="text-center p-8">
            <svg className="mx-auto h-16 w-16 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="mt-4 text-2xl font-bold text-white">No Active Session</h2>
            <p className="mt-2 text-gray-400">Waiting for a new player to join the game.</p>
          </div>
        );
    }
  };

  return (
    <main className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans antialiased">
      <div className="w-full max-w-sm mx-auto bg-gray-800 rounded-2xl shadow-2xl shadow-blue-500/10 p-6 md:p-8 relative overflow-hidden">
        <StatusIndicator status={session.status} />
        <header className="text-center mb-6 border-b border-gray-700 pb-4">
          <h1 className="text-2xl font-bold tracking-tighter text-gray-200">
            Reaction Ring <span className="text-blue-400">Admin Panel</span>
          </h1>
        </header>

        {loading ? <Loader /> : <div className="flex flex-col items-center">{renderContent()}</div>}

        {/* Import JSON Section */}
        <section className="mt-8 pt-6 border-t border-gray-700">
          <h2 className="text-lg font-semibold text-gray-200 mb-3">Import Leaderboard JSON</h2>
          <p className="text-sm text-gray-400 mb-3">Upload your exported JSON to upsert players into the leaderboard.</p>

          <ImportJsonForm
            importing={importing}
            message={importMessage}
            error={importError}
            onImportStart={() => { setImportMessage(null); setImportError(null); setImporting(true); }}
            onImportEnd={() => setImporting(false)}
            onMessage={(m) => setImportMessage(m)}
            onError={(e) => setImportError(e)}
          />
        </section>
      </div>
    </main>
  );
}

type ExportJson = {
  players: Record<string, {
    id: string;
    name?: string;
    score: number;
    attempts: number;
    lastPlayed: number; // epoch ms
  }>;
  version?: number;
  exportedAt?: string;
};

/**
 * A small form to import JSON and upsert to Supabase `leaderboard`.
 */
function ImportJsonForm(props: {
  importing: boolean;
  message: string | null;
  error: string | null;
  onImportStart: () => void;
  onImportEnd: () => void;
  onMessage: (m: string | null) => void;
  onError: (e: string | null) => void;
}) {
  const { importing, message, error, onImportStart, onImportEnd, onMessage, onError } = props;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImportStart();
    try {
      const text = await file.text();
      await importJson(text, onMessage);
    } catch (err: any) {
      console.error("Import failed:", err);
      onError(err?.message ?? "Failed to import file");
    } finally {
      onImportEnd();
      // Clear the input value so the same file can be selected again if needed
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        accept="application/json,.json"
        onChange={handleFileChange}
        disabled={importing}
        className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 disabled:file:opacity-50"
      />
      {importing && (
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          Importing...
        </div>
      )}
      {!!message && (
        <p className="text-sm text-green-300">{message}</p>
      )}
      {!!error && (
        <p className="text-sm text-red-300">{error}</p>
      )}
      <p className="text-xs text-gray-500">Expected keys: players[id] with id, name, score, attempts, lastPlayed (epoch ms).</p>
    </div>
  );
}

async function importJson(text: string, onMessage: (m: string) => void) {
  let parsed: ExportJson;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON: could not parse file");
  }

  if (!parsed || typeof parsed !== "object" || !parsed.players || typeof parsed.players !== "object") {
    throw new Error("Invalid format: missing players map");
  }

  const entries = Object.entries(parsed.players);
  if (entries.length === 0) {
    onMessage("No players found in the file.");
    return;
  }

  // Transform to DB rows
  const rows = entries.map(([key, p]) => {
    if (!p || typeof p !== 'object') {
      throw new Error(`Invalid player record for key ${key}`);
    }
    const id = String(p.id ?? key);
    if (!id) throw new Error(`Missing id for player key ${key}`);
    const score = Number(p.score ?? 0);
    const attempts = Number(p.attempts ?? 0);
    const name = (p.name ?? "").toString();
    const ts = Number(p.lastPlayed ?? 0);
    const last_played = Number.isFinite(ts) && ts > 0 ? new Date(ts).toISOString() : new Date().toISOString();
    return { id, name, score, attempts, last_played };
  });

  // Upsert in chunks to be safe
  const CHUNK = 500;
  let imported = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from('leaderboard')
      .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false, count: 'exact' });
    if (error) throw error as unknown as Error;
    imported += count ?? chunk.length;
    onMessage(`Imported ${Math.min(imported, rows.length)} of ${rows.length} players...`);
  }

  onMessage(`Successfully imported ${rows.length} player${rows.length === 1 ? '' : 's'}.`);
}