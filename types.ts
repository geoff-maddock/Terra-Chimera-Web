
export enum ElementType {
  PYRO = 'Pyro',
  HYDRO = 'Hydro',
  GEO = 'Geo',
  AERO = 'Aero',
  CHRONO = 'Chrono',
  BIO = 'Bio'
}

export enum FactionId {
  GEOFORGE = 'GeoForge Industries',
  BIOGENESIS = 'BioGenesis Corp',
  AETHER_VANGUARD = 'Aether Vanguard'
}

export type BiomeType = 'Volcanic' | 'Oceanic' | 'Mountain' | 'Tundra' | 'Forest' | 'Desert' | 'Wasteland';

export interface Stats {
  attack: number;
  defense: number;
  speed: number;
  intelligence: number;
}

export interface Anatomy {
  trunk: string;
  head: string;
  appendages: string[];
}

export interface Buff {
  id: string;
  name: string;
  stat: keyof Stats;
  value: number;
  description: string;
}

export interface Monster {
  id: string;
  name: string;
  description: string;
  element: ElementType;
  level: number;
  experience: number;
  stats: Stats;
  maxHp: number;
  currentHp: number;
  dnaQuality: number; // 0-100, affects growth
  traits: string[];
  anatomy: Anatomy;
  imageUrl?: string; // Placeholder or generated
  activeBuffs?: Buff[];
}

export interface Resources {
  credits: number; // Money
  biomass: number; // Food/Growth
  mana: number; // Magic/Enhancement
  research: number; // Tech/Upgrades
}

export interface HexCoordinates {
  q: number;
  r: number;
  s: number;
}

export interface HexTile {
  id: string; // "q,r"
  q: number;
  r: number;
  s: number;
  biomes: BiomeType[];
  owner: FactionId | null; // null means neutral/wild
  isExplored: boolean;
  hasTournament: boolean;
  resourceYield: Partial<Resources>;
  buildingId?: string;
  wildMonsterId?: string;
}

export interface Building {
  id: string;
  name: string;
  type: 'resource' | 'training' | 'lab' | 'defense';
  level: number;
  cost: Partial<Resources>;
  production?: Partial<Resources>; // Per tick
  description: string;
  location?: string; // hex id "q,r"
}

export interface Staff {
  id: string;
  name: string;
  role: 'Scientist' | 'Trainer' | 'Explorer' | 'Beast Master';
  skill: number;
  salary: number;
}

export interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  type: 'info' | 'combat' | 'discovery' | 'alert' | 'success' | 'magic';
}

export interface Spell {
  id: string;
  name: string;
  description: string;
  cost: Partial<Resources> & { hp?: number }; // Cost can be resources or HP
  effect?: Partial<Resources>; // Immediate resource gain
  buff?: {
    stat: keyof Stats;
    value: number;
    name: string;
  };
  targetRequired: boolean;
}

export interface GameSettings {
  textSize: 'small' | 'medium' | 'large';
}

export interface Trophy {
  id: string;
  name: string;
  description: string;
  bonus: string;
  icon: string; // Lucide icon name or simple string key
}

export interface BattleLog {
  round: number;
  message: string;
  type: 'attack' | 'defense' | 'effect' | 'info';
  damage?: number;
  source?: string;
}

export interface BattleState {
  isActive: boolean;
  round: number;
  playerMonsterId: string | null;
  opponentMonster: Monster | null;
  logs: BattleLog[];
  phase: 'planning' | 'resolution' | 'victory' | 'defeat';
  tournamentMatchId?: string; // Links battle to tournament bracket
}

export interface BattleRecord {
  id: string;
  timestamp: string;
  opponentName: string;
  result: 'win' | 'loss';
  reward: string;
  roundCount: number;
}

export interface FactionStats {
  wins: number;
  losses: number;
  score: number;
}

// --- Tournament Types ---
export interface TournamentParticipant {
  id: string;
  name: string; // "Player" or NPC Name
  isPlayer: boolean;
  monsterName?: string;
  faction?: string;
}

export interface TournamentMatch {
  id: string;
  round: number; // 1 (Quarter), 2 (Semi), 3 (Final)
  nextMatchId?: string; // ID of the match the winner advances to
  nextMatchSlot?: 'p1' | 'p2'; // Which slot in the next match (top or bottom)
  p1: TournamentParticipant | null;
  p2: TournamentParticipant | null;
  winnerId: string | null;
  status: 'pending' | 'ready' | 'active' | 'completed';
}

export interface Tournament {
  isActive: boolean;
  hexId: string | null;
  totalRounds: number;
  currentRound: number;
  matches: TournamentMatch[];
  participants: TournamentParticipant[];
}

export interface GameState {
  faction: FactionId | null;
  resources: Resources;
  monsters: Monster[];
  wildMonsters: Monster[]; // Monsters on the map not owned by player
  buildings: Building[];
  staff: Staff[];
  logs: LogEntry[];
  day: number;
  map: Record<string, HexTile>; // stored by id "q,r" for easy lookup
  settings: GameSettings;
  trophies: Trophy[];
  battle: BattleState;
  battleHistory: BattleRecord[];
  factionStats: Record<FactionId, FactionStats>;
  tournament: Tournament; // Active tournament state
}
