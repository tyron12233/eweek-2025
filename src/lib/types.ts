export interface Player {
    id: string;
    name?: string;
    score: number;
    attempts: number;
    lastPlayed: number;
}

export interface GameSession {
    playerId: string;
    name: string;
    status: "inactive" | "active" | "scoring";
}