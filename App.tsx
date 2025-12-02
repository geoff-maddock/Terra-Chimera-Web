
import React, { useState, useEffect, useCallback, useReducer } from 'react';
import { 
  Menu, Pickaxe, TestTube, Swords, Activity, Users, Hammer, Plus, 
  ChevronRight, Beaker, Dna, Trophy, AlertCircle, Map as MapIcon, Shield,
  Key, Flag, HandCoins, UserPlus, Flame, Leaf, TrendingUp, TrendingDown, DollarSign,
  Building2, Trash2, X, HelpCircle, RefreshCw, Scroll, Sparkles, BookOpen, Settings, ArrowUpCircle, PawPrint, Radar, Crosshair, Clock, Crown, Heart, Skull, BarChart3, Medal, ChevronDown, ChevronUp, Globe
} from 'lucide-react';

import ResourceBar from './components/ResourceBar';
import MonsterCard from './components/MonsterCard';
import HexMap from './components/HexMap';
import RulesModal from './components/RulesModal';
import SettingsModal from './components/SettingsModal';
import { 
  Building, ElementType, FactionId, GameState, Monster, Resources, Stats, LogEntry, HexTile, BiomeType, Staff, Spell, GameSettings, Trophy as TrophyType, BattleLog, FactionStats, BattleRecord, Tournament, TournamentMatch, TournamentParticipant
} from './types';
import { 
  INITIAL_RESOURCES, FACTION_BONUSES, BUILDINGS_CATALOG, ELEMENT_COLORS, MAP_RADIUS, COSTS, getHexNeighborCoords, getHexId, ANATOMY_PARTS, REFUND_RATE, EXCHANGE_RATES, SPELLS, CAPTURE_CHANCE, SALARIES, TROPHIES, TYPE_CHART, ANATOMY_MODIFIERS, RIVAL_NAMES
} from './constants';
import * as GeminiService from './services/geminiService';

// --- Types for Reducer ---
type Action =
  | { type: 'SELECT_FACTION'; payload: FactionId }
  | { type: 'TICK'; payload: { production: Partial<Resources>; mapUpdate?: Record<string, HexTile> } }
  | { type: 'BUILD'; payload: { building: Building; cost: Partial<Resources>; hexId: string } }
  | { type: 'UPGRADE_BUILDING'; payload: { buildingId: string; hexId: string; cost: Partial<Resources>; newProduction: Partial<Resources> } }
  | { type: 'ADD_MONSTER'; payload: Monster }
  | { type: 'UPDATE_RESOURCES'; payload: Partial<Resources> }
  | { type: 'ADD_LOG'; payload: Omit<LogEntry, 'id' | 'timestamp'> }
  | { type: 'DISMISS_LOG'; payload: { id: number } }
  | { type: 'CLEAR_LOGS' }
  | { type: 'TRAIN_MONSTER'; payload: { id: string; stat: keyof Stats; cost: Partial<Resources> } }
  | { type: 'HEAL_ALL'; payload: { cost: number } }
  | { type: 'EXPLORE_HEX'; payload: { hexId: string; reward: Partial<Resources>; wildMonster?: Monster } }
  | { type: 'CLAIM_HEX'; payload: { hexId: string; cost: number } }
  | { type: 'SABOTAGE_HEX'; payload: { hexId: string; cost: number } }
  | { type: 'INIT_MAP'; payload: Record<string, HexTile> }
  | { type: 'HIRE_STAFF'; payload: { staff: Staff; cost: number } }
  | { type: 'DISMISS_STAFF'; payload: { id: string } }
  | { type: 'SELL_BUILDING'; payload: { buildingId: string; hexId: string } }
  | { type: 'TRADE_RESOURCES'; payload: { costType: keyof Resources; costAmount: number; gainType: keyof Resources; gainAmount: number } }
  | { type: 'CAST_SPELL'; payload: { spell: Spell; targetId?: string } }
  | { type: 'CAPTURE_MONSTER'; payload: { hexId: string; success: boolean; cost: number } }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<GameSettings> }
  // Battle & Tournament Actions
  | { type: 'INIT_TOURNAMENT'; payload: { hexId: string; rounds: number } }
  | { type: 'PREPARE_BATTLE'; payload: { opponent: Monster; tournamentMatchId?: string } }
  | { type: 'START_BATTLE'; payload: { playerMonsterId: string; opponent: Monster } }
  | { type: 'NEXT_ROUND'; payload: { playerAction: string } } 
  | { type: 'END_BATTLE'; payload: { won: boolean } }
  | { type: 'RESET_BATTLE' };

// --- Helper: Map Generation ---
const generateMap = (radius: number, playerFaction: FactionId | null): Record<string, HexTile> => {
    const map: Record<string, HexTile> = {};
    const biomes: BiomeType[] = ['Volcanic', 'Oceanic', 'Mountain', 'Tundra', 'Forest', 'Desert', 'Wasteland'];
    
    // Rivals
    const rivals = Object.values(FactionId).filter(f => f !== playerFaction);
    const rival1 = rivals[0] || FactionId.BIOGENESIS;
    const rival2 = rivals[1] || FactionId.AETHER_VANGUARD;

    for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
            const s = -q - r;
            const id = `${q},${r}`;
            
            // Random Biomes (1-3)
            const numBiomes = Math.random() > 0.9 ? 3 : (Math.random() > 0.8 ? 2 : 1);
            const tileBiomes: BiomeType[] = [];
            for(let i=0; i<numBiomes; i++) tileBiomes.push(biomes[Math.floor(Math.random() * biomes.length)]);

            // Determine Owner (Simulate starting positions)
            let owner = null;
            let isExplored = false;
            let buildingId = undefined;

            // Player Start at Center (0,0)
            if (q === 0 && r === 0) {
                owner = playerFaction;
                isExplored = true;
                tileBiomes.length = 0; 
                tileBiomes.push('Forest'); // Friendly start
            } 
            // Neighbors of center are explored but empty
            else if (Math.abs(q) <= 1 && Math.abs(r) <= 1 && Math.abs(s) <= 1) {
                isExplored = true;
            }
            // Rival Bases (Far edges)
            else if (q === -radius && r === 0) owner = rival1;
            else if (q === radius && r === -radius) owner = rival2;

            map[id] = {
                id, q, r, s,
                biomes: tileBiomes,
                owner,
                isExplored,
                hasTournament: Math.random() > 0.9, // 10% chance
                resourceYield: {
                    credits: Math.floor(Math.random() * 5),
                    biomass: Math.floor(Math.random() * 5),
                    mana: Math.floor(Math.random() * 5),
                },
                buildingId
            };
        }
    }
    return map;
};

// --- Initial State ---
const initialFactionStats: Record<FactionId, FactionStats> = {
    [FactionId.GEOFORGE]: { wins: 0, losses: 0, score: 100 },
    [FactionId.BIOGENESIS]: { wins: 0, losses: 0, score: 100 },
    [FactionId.AETHER_VANGUARD]: { wins: 0, losses: 0, score: 100 },
};

const initialTournament: Tournament = {
    isActive: false,
    hexId: null,
    totalRounds: 0,
    currentRound: 0,
    matches: [],
    participants: []
};

const initialState: GameState = {
  faction: null,
  resources: INITIAL_RESOURCES,
  monsters: [],
  wildMonsters: [],
  buildings: [],
  staff: [],
  logs: [],
  day: 1,
  map: {},
  settings: { textSize: 'medium' },
  trophies: [],
  battle: {
      isActive: false,
      round: 0,
      playerMonsterId: null,
      opponentMonster: null,
      logs: [],
      phase: 'planning'
  },
  battleHistory: [],
  factionStats: initialFactionStats,
  tournament: initialTournament
};

// --- Helper Logic for Battle ---
const calculateDamage = (attacker: Monster, defender: Monster): { damage: number; isCrit: boolean; isEffective: boolean; message: string } => {
    // 1. Base Damage
    // Apply Buffs
    const getBuff = (m: Monster, stat: keyof Stats) => m.activeBuffs?.filter(b => b.stat === stat).reduce((a,b) => a + b.value, 0) || 0;
    
    const atk = attacker.stats.attack + getBuff(attacker, 'attack');
    const def = defender.stats.defense + getBuff(defender, 'defense');
    
    let baseDmg = Math.max(5, (atk * 0.5) - (def * 0.25));

    // 2. Elemental Interaction
    let isEffective = false;
    if (TYPE_CHART[attacker.element]?.includes(defender.element)) {
        baseDmg *= 1.5;
        isEffective = true;
    }

    // 3. Anatomy Modifiers (Appendages & Trunk)
    let anatomyMsg = "strikes";
    let critChance = 0.05;
    
    attacker.anatomy.appendages.forEach(part => {
        if (part.includes("Claw") || part.includes("Spike")) {
            baseDmg *= 1.1;
            critChance += 0.1;
            anatomyMsg = `slashes with ${part}`;
        } else if (part.includes("Wing") || part.includes("Jet")) {
            anatomyMsg = `dives using ${part}`;
        }
    });

    // 4. Critical Hit
    const isCrit = Math.random() < critChance;
    if (isCrit) baseDmg *= 1.5;

    // 5. Random Variance
    const variance = (Math.random() * 0.2) + 0.9; // 0.9 to 1.1
    const finalDmg = Math.floor(baseDmg * variance);

    return { damage: finalDmg, isCrit, isEffective, message: anatomyMsg };
};

// --- Tournament Generation Logic ---
const createBracket = (numRounds: number): { matches: TournamentMatch[], participants: TournamentParticipant[] } => {
    const numParticipants = Math.pow(2, numRounds);
    const participants: TournamentParticipant[] = [];
    const matches: TournamentMatch[] = [];

    // Create Participants
    participants.push({ id: 'player', name: 'You', isPlayer: true });
    for (let i = 1; i < numParticipants; i++) {
        const rivalName = RIVAL_NAMES[Math.floor(Math.random() * RIVAL_NAMES.length)];
        const elements = Object.values(ElementType);
        const el = elements[Math.floor(Math.random() * elements.length)];
        participants.push({ 
            id: `npc-${i}`, 
            name: rivalName, 
            isPlayer: false,
            monsterName: `${el} Specimen X-${Math.floor(Math.random() * 900)}`
        });
    }

    // Create First Round Matches
    for (let i = 0; i < numParticipants / 2; i++) {
        const p1 = participants[i * 2];
        const p2 = participants[i * 2 + 1];
        matches.push({
            id: `r1-m${i}`,
            round: 1,
            p1,
            p2,
            winnerId: null,
            status: i === 0 ? 'ready' : 'ready' // Player match is usually match 0
        });
    }

    // Create Subsequent Rounds (Placeholders)
    let prevRoundMatchStartIndex = 0;
    let prevRoundMatchCount = numParticipants / 2;

    for (let r = 2; r <= numRounds; r++) {
        const matchesInRound = numParticipants / Math.pow(2, r);
        for (let i = 0; i < matchesInRound; i++) {
            const matchId = `r${r}-m${i}`;
            const m1 = matches[prevRoundMatchStartIndex + (i * 2)];
            const m2 = matches[prevRoundMatchStartIndex + (i * 2) + 1];
            
            // Link previous matches to this one
            m1.nextMatchId = matchId;
            m1.nextMatchSlot = 'p1';

            m2.nextMatchId = matchId;
            m2.nextMatchSlot = 'p2';

            matches.push({
                id: matchId,
                round: r,
                p1: null,
                p2: null,
                winnerId: null,
                status: 'pending'
            });
        }
        prevRoundMatchStartIndex += prevRoundMatchCount;
        prevRoundMatchCount = matchesInRound;
    }

    return { matches, participants };
};


// --- Reducer ---
const gameReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'SELECT_FACTION':
      // Apply starting bonuses based on faction
      let bonusResources = { ...state.resources };
      if (action.payload === FactionId.GEOFORGE) bonusResources.credits += 200;
      if (action.payload === FactionId.BIOGENESIS) bonusResources.biomass += 100;
      if (action.payload === FactionId.AETHER_VANGUARD) bonusResources.mana += 50;
      
      return { 
        ...state, 
        faction: action.payload,
        resources: bonusResources,
        logs: [...state.logs, {
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          message: `Company ${action.payload} founded. Planetary landing successful at Sector (0,0).`,
          type: 'info'
        }]
      };
    
    case 'INIT_MAP':
        return { ...state, map: action.payload };

    case 'TICK':
        const newResources = { ...state.resources };
        // Apply trophy bonuses (e.g., +Credits)
        const creditBonus = state.trophies.some(t => t.id === 'bronze_cup') ? 5 : 0;
        newResources.credits += creditBonus;

        if (action.payload.production.credits) newResources.credits += action.payload.production.credits;
        if (action.payload.production.biomass) newResources.biomass += action.payload.production.biomass;
        if (action.payload.production.mana) newResources.mana += action.payload.production.mana;
        if (action.payload.production.research) newResources.research += action.payload.production.research;

        // Simulate Rival Ranking Changes
        const newFactionStats = { ...state.factionStats };
        const rivals = Object.values(FactionId).filter(f => f !== state.faction);
        
        // 10% chance per tick for a rival to win a "virtual" tournament
        if (Math.random() < 0.1) {
             const luckyRival = rivals[Math.floor(Math.random() * rivals.length)];
             if (newFactionStats[luckyRival]) {
                 newFactionStats[luckyRival] = {
                     ...newFactionStats[luckyRival],
                     wins: newFactionStats[luckyRival].wins + 1,
                     score: newFactionStats[luckyRival].score + Math.floor(Math.random() * 20) + 10
                 };
             }
        }

        return {
            ...state,
            resources: newResources,
            day: state.day + 1,
            map: action.payload.mapUpdate ? { ...state.map, ...action.payload.mapUpdate } : state.map,
            factionStats: newFactionStats
        };

    case 'BUILD':
        return {
            ...state,
            resources: {
                credits: state.resources.credits - (action.payload.cost.credits || 0),
                biomass: state.resources.biomass - (action.payload.cost.biomass || 0),
                mana: state.resources.mana - (action.payload.cost.mana || 0),
                research: state.resources.research - (action.payload.cost.research || 0),
            },
            buildings: [...state.buildings, action.payload.building],
            map: {
                ...state.map,
                [action.payload.hexId]: {
                    ...state.map[action.payload.hexId],
                    buildingId: action.payload.building.id,
                }
            },
            logs: [...state.logs, {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                message: `Construction complete: ${action.payload.building.name} at [${action.payload.hexId}]`,
                type: 'success'
            }]
        };

    case 'UPGRADE_BUILDING':
        const upgradedBuildings = state.buildings.map(b => {
            if (b.id === action.payload.buildingId) {
                return {
                    ...b,
                    level: b.level + 1,
                    production: action.payload.newProduction
                };
            }
            return b;
        });

        return {
            ...state,
            resources: {
                credits: state.resources.credits - (action.payload.cost.credits || 0),
                biomass: state.resources.biomass - (action.payload.cost.biomass || 0),
                mana: state.resources.mana - (action.payload.cost.mana || 0),
                research: state.resources.research - (action.payload.cost.research || 0),
            },
            buildings: upgradedBuildings,
            logs: [...state.logs, {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                message: `Facility upgraded at [${action.payload.hexId}]`,
                type: 'success'
            }]
        };

    case 'CLAIM_HEX':
        return {
            ...state,
            resources: {
                ...state.resources,
                credits: state.resources.credits - action.payload.cost
            },
            map: {
                ...state.map,
                [action.payload.hexId]: {
                    ...state.map[action.payload.hexId],
                    owner: state.faction
                }
            },
            logs: [...state.logs, {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                message: `Territory claimed: Sector [${action.payload.hexId}] secured.`,
                type: 'success'
            }]
        };

    case 'ADD_MONSTER':
        return {
            ...state,
            monsters: [...state.monsters, action.payload],
            logs: [...state.logs, {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                message: `New specimen acquired: ${action.payload.name} (${action.payload.element})`,
                type: 'discovery'
            }]
        };
    
    case 'UPDATE_RESOURCES':
        const updatedRes = { ...state.resources };
        (Object.keys(action.payload) as (keyof Resources)[]).forEach(k => {
             updatedRes[k] = (updatedRes[k] || 0) + (action.payload[k] || 0);
        });
        return { ...state, resources: updatedRes };

    case 'ADD_LOG':
        return {
            ...state,
            logs: [{
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                message: action.payload.message,
                type: action.payload.type
            }, ...state.logs].slice(0, 50)
        };
    
    case 'DISMISS_LOG':
        return {
            ...state,
            logs: state.logs.filter(l => l.id !== action.payload.id)
        };
    
    case 'CLEAR_LOGS':
        return {
            ...state,
            logs: []
        };

    case 'TRAIN_MONSTER':
        return {
            ...state,
            resources: {
                ...state.resources,
                biomass: state.resources.biomass - (action.payload.cost.biomass || 0),
                mana: state.resources.mana - (action.payload.cost.mana || 0),
            },
            monsters: state.monsters.map(m => {
                if (m.id === action.payload.id) {
                    return {
                        ...m,
                        stats: {
                            ...m.stats,
                            [action.payload.stat]: m.stats[action.payload.stat] + (Math.floor(Math.random() * 3) + 1)
                        },
                        experience: m.experience + 10
                    }
                }
                return m;
            }),
            logs: [{
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                message: `Training complete for monster. Stat ${action.payload.stat} increased.`,
                type: 'info'
            }, ...state.logs]
        };

    case 'EXPLORE_HEX':
         const exploredRes = { ...state.resources };
         if (action.payload.reward.credits) exploredRes.credits += action.payload.reward.credits;
         if (action.payload.reward.biomass) exploredRes.biomass += action.payload.reward.biomass;
         if (action.payload.reward.mana) exploredRes.mana += action.payload.reward.mana;
         
         return {
             ...state,
             resources: exploredRes,
             map: {
                 ...state.map,
                 [action.payload.hexId]: {
                     ...state.map[action.payload.hexId],
                     isExplored: true,
                     wildMonsterId: action.payload.wildMonster?.id
                 }
             },
             wildMonsters: action.payload.wildMonster ? [...state.wildMonsters, action.payload.wildMonster] : state.wildMonsters
         };
    
    case 'SABOTAGE_HEX':
        return {
            ...state,
            resources: { ...state.resources, credits: state.resources.credits - action.payload.cost },
            map: {
                ...state.map,
                [action.payload.hexId]: {
                    ...state.map[action.payload.hexId],
                    owner: null, // Neutralize it
                    buildingId: undefined // Destroy building (simplified)
                }
            },
            logs: [{
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                message: `Sabotage successful! Sector [${action.payload.hexId}] neutralized.`,
                type: 'success'
            }, ...state.logs]
        };

    case 'HIRE_STAFF':
        return {
            ...state,
            resources: { ...state.resources, credits: state.resources.credits - action.payload.cost },
            staff: [...state.staff, action.payload.staff],
            logs: [{
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                message: `New Staff hired: ${action.payload.staff.name} (${action.payload.staff.role})`,
                type: 'info'
            }, ...state.logs]
        };
    
    case 'DISMISS_STAFF':
        const staffToRemove = state.staff.find(s => s.id === action.payload.id);
        return {
            ...state,
            staff: state.staff.filter(s => s.id !== action.payload.id),
             logs: [{
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                message: `Staff member ${staffToRemove?.name} dismissed.`,
                type: 'info'
            }, ...state.logs]
        };

    case 'SELL_BUILDING':
        const buildingToSell = state.buildings.find(b => b.id === action.payload.buildingId);
        if (!buildingToSell) return state;

        const refundRes = { ...state.resources };
        if (buildingToSell.cost.credits) refundRes.credits += Math.floor(buildingToSell.cost.credits * REFUND_RATE);
        if (buildingToSell.cost.biomass) refundRes.biomass += Math.floor(buildingToSell.cost.biomass * REFUND_RATE);
        if (buildingToSell.cost.mana) refundRes.mana += Math.floor(buildingToSell.cost.mana * REFUND_RATE);
        if (buildingToSell.cost.research) refundRes.research += Math.floor(buildingToSell.cost.research * REFUND_RATE);

        return {
            ...state,
            resources: refundRes,
            buildings: state.buildings.filter(b => b.id !== action.payload.buildingId),
            map: {
                ...state.map,
                [action.payload.hexId]: {
                    ...state.map[action.payload.hexId],
                    buildingId: undefined
                }
            },
            logs: [{
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                message: `Facility ${buildingToSell.name} demolished. Resources salvaged.`,
                type: 'info'
            }, ...state.logs]
        };

    case 'TRADE_RESOURCES':
        const tradeRes = { ...state.resources };
        tradeRes[action.payload.costType] -= action.payload.costAmount;
        tradeRes[action.payload.gainType] += action.payload.gainAmount;

        return {
            ...state,
            resources: tradeRes,
            logs: [{
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                message: `Trade Executed: ${action.payload.costAmount} ${action.payload.costType} for ${action.payload.gainAmount} ${action.payload.gainType}.`,
                type: 'info'
            }, ...state.logs]
        };

    case 'CAST_SPELL':
        const spell = action.payload.spell;
        const spellRes = { ...state.resources };
        let updatedMonsters = [...state.monsters];
        let updatedBattle = { ...state.battle };

        // Deduct Resource Cost
        if (spell.cost.mana) spellRes.mana -= spell.cost.mana;
        if (spell.cost.biomass) spellRes.biomass -= spell.cost.biomass;
        if (spell.cost.credits) spellRes.credits -= spell.cost.credits;

        // Effect application helper
        const applyEffectToMonster = (m: Monster) => {
             // HP Cost
            let newHp = m.currentHp;
            if (spell.cost.hp) newHp = Math.max(1, m.currentHp - spell.cost.hp);
            
            // Heal Effect
            if (spell.id === 'heal_minor') newHp = Math.min(m.maxHp, newHp + 30);
            
            // Buffs
            let newBuffs = m.activeBuffs || [];
            if (spell.buff) {
                newBuffs = [...newBuffs, { 
                    id: Date.now().toString(), 
                    name: spell.buff!.name, 
                    stat: spell.buff!.stat, 
                    value: spell.buff!.value, 
                    description: `+${spell.buff!.value} ${spell.buff!.stat}` 
                }];
            }
            return { ...m, currentHp: newHp, activeBuffs: newBuffs };
        };

        // Update Global Roster
        if (action.payload.targetId) {
            updatedMonsters = updatedMonsters.map(m => m.id === action.payload.targetId ? applyEffectToMonster(m) : m);
        }

        // Update Battle State if active and target matches
        if (state.battle.isActive && state.battle.playerMonsterId === action.payload.targetId) {
            const currentMon = state.monsters.find(m => m.id === state.battle.playerMonsterId);
            if (currentMon) {
                updatedBattle.logs = [...updatedBattle.logs, {
                    round: state.battle.round,
                    message: `Spell Cast: ${spell.name} on ${currentMon.name}.`,
                    type: 'effect'
                }];
            }
        }

        return {
            ...state,
            resources: spellRes,
            monsters: updatedMonsters,
            battle: updatedBattle,
            logs: [{
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                message: `Spell Cast: ${spell.name}.`,
                type: 'magic'
            }, ...state.logs]
        };
    
    case 'CAPTURE_MONSTER':
        const targetMonster = state.wildMonsters.find(m => m.id === state.map[action.payload.hexId].wildMonsterId);
        
        if (!targetMonster) return state;

        if (action.payload.success) {
            return {
                ...state,
                resources: { ...state.resources, credits: state.resources.credits - action.payload.cost },
                monsters: [...state.monsters, targetMonster],
                wildMonsters: state.wildMonsters.filter(m => m.id !== targetMonster.id),
                map: {
                    ...state.map,
                    [action.payload.hexId]: {
                        ...state.map[action.payload.hexId],
                        wildMonsterId: undefined
                    }
                },
                logs: [{
                    id: Date.now(),
                    timestamp: new Date().toLocaleTimeString(),
                    message: `Capture Successful! ${targetMonster.name} has been added to the roster.`,
                    type: 'success'
                }, ...state.logs]
            }
        } else {
             return {
                ...state,
                resources: { ...state.resources, credits: state.resources.credits - action.payload.cost },
                wildMonsters: state.wildMonsters.filter(m => m.id !== targetMonster.id),
                map: {
                    ...state.map,
                    [action.payload.hexId]: {
                        ...state.map[action.payload.hexId],
                        wildMonsterId: undefined
                    }
                },
                logs: [{
                    id: Date.now(),
                    timestamp: new Date().toLocaleTimeString(),
                    message: `Capture Failed. The creature fled into the wilderness. Resources lost.`,
                    type: 'alert'
                }, ...state.logs]
            }
        }

    case 'UPDATE_SETTINGS':
        return {
            ...state,
            settings: { ...state.settings, ...action.payload }
        };

    // --- BATTLE & TOURNAMENT LOGIC ---
    case 'INIT_TOURNAMENT':
        const { matches, participants } = createBracket(action.payload.rounds);
        return {
            ...state,
            tournament: {
                isActive: true,
                hexId: action.payload.hexId,
                totalRounds: action.payload.rounds,
                currentRound: 1,
                matches,
                participants
            }
        };

    case 'PREPARE_BATTLE':
        return {
            ...state,
            battle: {
                ...state.battle,
                isActive: false,
                opponentMonster: action.payload.opponent,
                playerMonsterId: null, // Clear previous selection
                round: 0,
                logs: [],
                phase: 'planning',
                tournamentMatchId: action.payload.tournamentMatchId
            }
        };

    case 'START_BATTLE':
        return {
            ...state,
            battle: {
                ...state.battle,
                isActive: true,
                round: 1,
                playerMonsterId: action.payload.playerMonsterId,
                opponentMonster: action.payload.opponent,
                logs: [{ round: 1, message: "Battle Commencing!", type: 'info' }],
                phase: 'planning'
            }
        };
    
    case 'RESET_BATTLE':
        return {
            ...state,
            battle: {
                isActive: false,
                round: 0,
                playerMonsterId: null,
                opponentMonster: null,
                logs: [],
                phase: 'planning'
            }
        };

    case 'NEXT_ROUND':
        if (!state.battle.playerMonsterId || !state.battle.opponentMonster) return state;
        
        const playerMon = state.monsters.find(m => m.id === state.battle.playerMonsterId)!;
        const enemyMon = state.battle.opponentMonster;
        
        let pStats = { ...playerMon.stats, speed: playerMon.stats.speed + (playerMon.activeBuffs?.filter(b => b.stat === 'speed').reduce((a,b)=>a+b.value,0)||0) };
        let eStats = enemyMon.stats;
        
        // Speed Check
        const playerGoesFirst = pStats.speed >= eStats.speed;
        
        const firstAttacker = playerGoesFirst ? playerMon : enemyMon;
        const secondAttacker = playerGoesFirst ? enemyMon : playerMon;

        // --- TURN 1 ---
        const hit1 = calculateDamage(firstAttacker, secondAttacker);
        let hpAfterHit1 = secondAttacker.currentHp - hit1.damage;
        
        const logs: BattleLog[] = [...state.battle.logs];
        
        logs.push({
            round: state.battle.round,
            source: firstAttacker.name,
            message: `${firstAttacker.name} ${hit1.message} ${secondAttacker.name}!`,
            damage: hit1.damage,
            type: 'attack'
        });
        if (hit1.isCrit) logs.push({ round: state.battle.round, message: "Critical Hit!", type: 'info' });
        if (hit1.isEffective) logs.push({ round: state.battle.round, message: "Super Effective!", type: 'info' });

        // Check Death Turn 1
        if (hpAfterHit1 <= 0) {
            hpAfterHit1 = 0;
            const isPlayerWin = playerGoesFirst;
            
            return {
                ...state,
                battle: {
                    ...state.battle,
                    logs: [...logs, { round: state.battle.round, message: `${secondAttacker.name} was defeated!`, type: 'info' }],
                    phase: isPlayerWin ? 'victory' : 'defeat',
                    opponentMonster: { 
                        ...enemyMon, 
                        currentHp: playerGoesFirst ? 0 : enemyMon.currentHp // If player won, enemy dead.
                    } 
                },
                monsters: state.monsters.map(m => m.id === playerMon.id ? { ...m, currentHp: isPlayerWin ? playerMon.currentHp : 0 } : m)
            };
        }

        // --- TURN 2 (Counter Attack) ---
        const hit2 = calculateDamage(secondAttacker, firstAttacker);
        let hpAfterHit2 = firstAttacker.currentHp - hit2.damage;

        logs.push({
            round: state.battle.round,
            source: secondAttacker.name,
            message: `${secondAttacker.name} ${hit2.message} ${firstAttacker.name}!`,
            damage: hit2.damage,
            type: 'attack'
        });
        if (hit2.isCrit) logs.push({ round: state.battle.round, message: "Critical Hit!", type: 'info' });
        if (hit2.isEffective) logs.push({ round: state.battle.round, message: "Super Effective!", type: 'info' });

        // Check Death Turn 2
        if (hpAfterHit2 <= 0) {
            hpAfterHit2 = 0;
            const isPlayerWin = !playerGoesFirst;

            return {
                ...state,
                monsters: state.monsters.map(m => m.id === playerMon.id ? { ...m, currentHp: isPlayerWin ? (secondAttacker as Monster).currentHp - hit1.damage : 0 } : m),
                battle: {
                    ...state.battle,
                    logs: [...logs, { round: state.battle.round, message: `${firstAttacker.name} was defeated!`, type: 'info' }],
                    phase: isPlayerWin ? 'victory' : 'defeat', 
                    opponentMonster: { ...enemyMon, currentHp: isPlayerWin ? 0 : (secondAttacker as Monster).currentHp - hit1.damage } 
                }
            };
        }

        // Both Survived
        const newPlayerHp = playerGoesFirst ? hpAfterHit2 : hpAfterHit1;
        const newEnemyHp = playerGoesFirst ? hpAfterHit1 : hpAfterHit2;

        return {
            ...state,
            monsters: state.monsters.map(m => m.id === playerMon.id ? { ...m, currentHp: newPlayerHp } : m),
            battle: {
                ...state.battle,
                round: state.battle.round + 1,
                logs,
                phase: 'planning',
                opponentMonster: { ...enemyMon, currentHp: newEnemyHp }
            }
        };

    case 'END_BATTLE':
        const trophies = [...state.trophies];
        let rewardCredits = 0;
        let newTrophy: TrophyType | undefined = undefined;
        let rewardText = "";

        // Remove buffs from player monster
        const resetMonsters = state.monsters.map(m => {
            if (m.id === state.battle.playerMonsterId) return { ...m, activeBuffs: [] };
            return m;
        });

        // TOURNAMENT LOGIC INTEGRATION
        let updatedTournament = { ...state.tournament };
        let finalTournamentWin = false;

        if (state.battle.tournamentMatchId && state.tournament.isActive) {
             const matchIndex = updatedTournament.matches.findIndex(m => m.id === state.battle.tournamentMatchId);
             if (matchIndex !== -1) {
                 const match = updatedTournament.matches[matchIndex];
                 
                 if (action.payload.won) {
                     // Player Won
                     updatedTournament.matches[matchIndex] = { ...match, winnerId: 'player', status: 'completed' };
                     
                     // Advance to next match if exists
                     if (match.nextMatchId) {
                         const nextMatchIndex = updatedTournament.matches.findIndex(m => m.id === match.nextMatchId);
                         if (nextMatchIndex !== -1) {
                             const nextMatch = updatedTournament.matches[nextMatchIndex];
                             const slot = match.nextMatchSlot || 'p1'; // Use correct slot assignment
                             
                             updatedTournament.matches[nextMatchIndex] = {
                                 ...nextMatch,
                                 [slot]: { id: 'player', name: 'You', isPlayer: true }
                             };
                         }
                     } else {
                         // No next match = Final Victory
                         finalTournamentWin = true;
                     }

                     // SIMULATE OTHER MATCHES IN THIS ROUND
                     const currentRound = match.round;
                     updatedTournament.matches.forEach((m, idx) => {
                         if (m.round === currentRound && m.id !== match.id && !m.winnerId) {
                             // Pick random winner
                             const winner = Math.random() > 0.5 ? m.p1 : m.p2;
                             const actualWinner = winner || m.p1 || { id: 'ghost', name: 'Unknown', isPlayer: false };
                             
                             updatedTournament.matches[idx] = { ...m, winnerId: actualWinner.id, status: 'completed' };
                             
                             // Propagate to next round
                             if (m.nextMatchId) {
                                 const nextIdx = updatedTournament.matches.findIndex(nm => nm.id === m.nextMatchId);
                                 if (nextIdx !== -1) {
                                     const nextM = updatedTournament.matches[nextIdx];
                                     const slot = m.nextMatchSlot || 'p1'; // Use correct slot
                                     updatedTournament.matches[nextIdx] = { ...nextM, [slot]: actualWinner };
                                 }
                             }
                         }
                     });
                     
                     // Advance Round Counter if not finished
                     if (!finalTournamentWin) {
                         updatedTournament.currentRound += 1;
                         // Set next round matches to 'ready'
                         updatedTournament.matches.forEach((m, idx) => {
                             if (m.round === updatedTournament.currentRound) {
                                  updatedTournament.matches[idx] = { ...m, status: 'ready' };
                             }
                         });
                     } else {
                         updatedTournament.isActive = false; // Finished
                     }

                 } else {
                     // Player Lost
                     updatedTournament.matches[matchIndex] = { ...match, winnerId: match.p2?.id || 'npc', status: 'completed' };
                     updatedTournament.isActive = false; // Knocked out
                 }
             }
        }

        // Rewards
        if (action.payload.won) {
            rewardCredits = 150 + (state.battle.round * 10);
            if (finalTournamentWin) rewardCredits += 1000; // Grand Prize
            
            rewardText = `${rewardCredits} Credits`;
            
            // Trophy Logic (Only on tournament win)
            if (finalTournamentWin) {
                if (Math.random() > 0.5) {
                    const availTrophies = TROPHIES.filter(t => !trophies.find(ot => ot.id === t.id));
                    if (availTrophies.length > 0) {
                        newTrophy = availTrophies[Math.floor(Math.random() * availTrophies.length)];
                        trophies.push(newTrophy);
                        rewardText += `, ${newTrophy.name}`;
                    }
                }
            }
        } else {
            rewardText = "None";
        }

        // Update History & Stats
        const newHistory: BattleRecord = {
            id: Date.now().toString(),
            timestamp: new Date().toLocaleTimeString(),
            opponentName: state.battle.opponentMonster?.name || "Unknown",
            result: action.payload.won ? 'win' : 'loss',
            reward: rewardText,
            roundCount: state.battle.round
        };

        const updatedFactionStats = { ...state.factionStats };
        if (state.faction) {
            const current = updatedFactionStats[state.faction] || { wins: 0, losses: 0, score: 0 };
            updatedFactionStats[state.faction] = {
                wins: current.wins + (action.payload.won ? 1 : 0),
                losses: current.losses + (action.payload.won ? 0 : 1),
                score: current.score + (action.payload.won ? 50 : 5)
            };
        }

        // Log Message
        let logMsg = action.payload.won ? `Match Won! Earned ${rewardCredits} Credits.` : `Match Lost. Specimen injured.`;
        if (finalTournamentWin) logMsg = `TOURNAMENT CHAMPION! Grand Prize Awarded: ${rewardCredits} Credits.`;

        return {
            ...state,
            resources: { ...state.resources, credits: state.resources.credits + rewardCredits },
            monsters: resetMonsters,
            trophies,
            tournament: updatedTournament,
            battle: {
                ...state.battle,
                isActive: false,
                logs: [],
                phase: 'planning'
            },
            battleHistory: [newHistory, ...state.battleHistory],
            factionStats: updatedFactionStats,
            logs: [...state.logs, {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                message: logMsg,
                type: action.payload.won ? 'success' : 'alert'
            }]
        };

    default:
      return state;
  }
};

// --- View Components ---

// ... (ApiKeySelection, FactionSelect, BattleLogView are unchanged) ...

const ApiKeySelection: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const handleSelectKey = async () => {
        try {
            await window.aistudio.openSelectKey();
            onComplete(); 
        } catch (e) {
            console.error("Failed to select key", e);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
            <div className="max-w-md w-full text-center">
                <h1 className="text-4xl font-orbitron text-teal-400 mb-6">TerraChimera</h1>
                <p className="text-slate-400 mb-8">
                    To access the planetary network and bio-synthesis systems, 
                    a valid corporate API key is required.
                </p>
                <button 
                    onClick={handleSelectKey}
                    className="px-8 py-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-3 mx-auto transition-transform hover:scale-105"
                >
                    <Key size={24} />
                    Authenticate Terminal
                </button>
                <p className="mt-8 text-xs text-slate-600">
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-teal-400">
                        View Billing Documentation
                    </a>
                </p>
            </div>
        </div>
    );
};

const FactionSelect: React.FC<{ onSelect: (id: FactionId) => void }> = ({ onSelect }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
    <div className="max-w-4xl w-full">
      <h1 className="text-5xl font-orbitron text-center text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-purple-500 mb-4">
        TERRA<span className="text-slate-100">CHIMERA</span>
      </h1>
      <p className="text-center text-slate-400 mb-12">Select your corporate sponsor for the planetary expedition.</p>
      
      <div className="grid md:grid-cols-3 gap-6">
        {Object.values(FactionId).map((fid) => (
          <div key={fid} className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-teal-400 transition-all cursor-pointer group"
               onClick={() => onSelect(fid)}>
            <div className="h-32 mb-4 bg-slate-900 rounded-lg flex items-center justify-center group-hover:bg-slate-950 transition-colors">
              {fid === FactionId.GEOFORGE && <Hammer size={48} className="text-amber-500" />}
              {fid === FactionId.BIOGENESIS && <Dna size={48} className="text-green-500" />}
              {fid === FactionId.AETHER_VANGUARD && <Swords size={48} className="text-purple-500" />}
            </div>
            <h3 className="text-xl font-bold mb-2 text-slate-100">{fid}</h3>
            <p className="text-sm text-slate-400">{FACTION_BONUSES[fid]}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const BattleLogView: React.FC<{ logs: BattleLog[] }> = ({ logs }) => {
    const bottomRef = React.useRef<HTMLDivElement>(null);
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

    return (
        <div className="bg-black/40 border border-slate-700 rounded-lg h-48 overflow-y-auto p-4 font-mono text-sm shadow-inner">
            {logs.length === 0 && <p className="text-slate-500 italic">Waiting for combat to begin...</p>}
            {logs.map((log, i) => (
                <div key={i} className="mb-2 border-l-2 border-slate-700 pl-2">
                    <span className="text-slate-500 text-xs mr-2">R{log.round}</span>
                    <span className={`${
                        log.type === 'attack' ? 'text-slate-200' : 
                        log.type === 'effect' ? 'text-purple-400' : 'text-yellow-400'
                    }`}>
                        {log.message}
                    </span>
                    {log.damage && <span className="ml-2 text-red-500 font-bold">-{log.damage} HP</span>}
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    );
};

// --- Component Definitions ---

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all w-16 ${
            active 
            ? 'bg-teal-500/10 text-teal-400 border border-teal-500/50 shadow-[0_0_10px_rgba(20,184,166,0.2)]' 
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
        }`}
    >
        {icon}
        <span className="text-[10px] font-bold uppercase">{label}</span>
    </button>
);

// --- Main App ---

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'lab' | 'map' | 'battle' | 'build' | 'staff' | 'occult' | 'league' | 'tournament'>('dashboard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedHexId, setSelectedHexId] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // Battle UI State
  const [selectedFighterId, setSelectedFighterId] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGrimoireInBattle, setShowGrimoireInBattle] = useState(false);
  const [selectedSpellTargetId, setSelectedSpellTargetId] = useState<string | null>(null);
  
  // Notification UI State
  const [isLogsMinimized, setIsLogsMinimized] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
            const has = await window.aistudio.hasSelectedApiKey();
            setHasApiKey(has);
        } else {
             setHasApiKey(!!process.env.API_KEY);
        }
    };
    checkKey();
  }, []);
  
  useEffect(() => {
      const root = document.documentElement;
      if (state.settings.textSize === 'small') root.style.fontSize = '14px';
      else if (state.settings.textSize === 'medium') root.style.fontSize = '16px';
      else if (state.settings.textSize === 'large') root.style.fontSize = '20px';
  }, [state.settings.textSize]);

  useEffect(() => {
      if (state.faction && Object.keys(state.map).length === 0) {
          const newMap = generateMap(MAP_RADIUS, state.faction);
          dispatch({ type: 'INIT_MAP', payload: newMap });
      }
  }, [state.faction]);

  // --- Game Loop & AI Expansion ---
  useEffect(() => {
    if (!state.faction) return;

    const interval = setInterval(() => {
        // ... (Same Logic as before for salary/production) ...
        const scientists = state.staff.filter(s => s.role === 'Scientist').length;
        const totalSalary = state.staff.reduce((acc, s) => acc + s.salary, 0);

        const production: Partial<Resources> = { 
            credits: 1 - totalSalary, 
            research: scientists * 0.5 
        }; 

        state.buildings.forEach(b => {
            if (b.production) {
                if (b.production.credits) production.credits = (production.credits || 0) + b.production.credits;
                if (b.production.biomass) production.biomass = (production.biomass || 0) + b.production.biomass;
                if (b.production.mana) production.mana = (production.mana || 0) + b.production.mana;
                if (b.production.research) production.research = (production.research || 0) + b.production.research;
            }
        });

        const mapUpdate: Record<string, HexTile> = {};
        const allHexes = Object.values(state.map) as HexTile[];
        
        if (Math.random() > 0.6) {
            const rivals = Object.values(FactionId).filter(f => f !== state.faction);
            rivals.forEach(rival => {
                const rivalHexes = allHexes.filter(h => h.owner === rival);
                if (rivalHexes.length > 0) {
                    const base = rivalHexes[Math.floor(Math.random() * rivalHexes.length)];
                    const neighbors = getHexNeighborCoords(base.q, base.r);
                    const candidates = neighbors
                        .map(n => state.map[getHexId(n.q, n.r)])
                        .filter((h): h is HexTile => !!h && !h.owner);
                    
                    if (candidates.length > 0) {
                        const target = candidates[Math.floor(Math.random() * candidates.length)];
                        mapUpdate[target.id] = { ...target, owner: rival, isExplored: false }; 
                    }
                }
            });
        }

        dispatch({ type: 'TICK', payload: { production, mapUpdate } });
    }, 5000);

    return () => clearInterval(interval);
  }, [state.faction, state.buildings, state.staff, state.map]);

  // Calculations
  const getExplorationCost = () => {
      const explorers = state.staff.filter(s => s.role === 'Explorer').length;
      const discount = explorers * 5;
      return Math.max(10, COSTS.EXPLORE_BASE - discount);
  };

  const isAdjacentToExplored = useCallback((hexId: string) => {
      const hex = state.map[hexId];
      if (!hex || hex.isExplored) return false;
      const neighbors = getHexNeighborCoords(hex.q, hex.r);
      return neighbors.some(n => {
          const id = getHexId(n.q, n.r);
          return state.map[id]?.isExplored;
      });
  }, [state.map]);

  const handleHatch = async (element: ElementType) => {
     // ... (Existing implementation unchanged) ...
     const cost = 100;
      if (state.resources.biomass < cost) {
          dispatch({ type: 'ADD_LOG', payload: { message: "Insufficient Biomass!", type: 'alert' }});
          return;
      }

      setIsProcessing(true);
      dispatch({ type: 'UPDATE_RESOURCES', payload: { biomass: -cost }});

      try {
        const baseStats: Stats = {
            attack: 10 + Math.floor(Math.random() * 10),
            defense: 10 + Math.floor(Math.random() * 10),
            speed: 10 + Math.floor(Math.random() * 10),
            intelligence: 10 + Math.floor(Math.random() * 10),
        };

        if (element === ElementType.PYRO) baseStats.attack += 10;
        if (element === ElementType.GEO) baseStats.defense += 10;
        if (element === ElementType.AERO) baseStats.speed += 10;
        if (element === ElementType.CHRONO) baseStats.intelligence += 10;

        const lore = await GeminiService.generateMonsterLore(element, baseStats);

        const newMonster: Monster = {
            id: Math.random().toString(36).substr(2, 9),
            name: lore.name,
            description: lore.description,
            element,
            level: 1,
            experience: 0,
            stats: baseStats,
            maxHp: 50 + baseStats.defense * 2,
            currentHp: 50 + baseStats.defense * 2,
            dnaQuality: Math.floor(Math.random() * 100),
            traits: lore.traits,
            anatomy: lore.anatomy || { 
                trunk: ANATOMY_PARTS.TRUNKS[0], 
                head: ANATOMY_PARTS.HEADS[0], 
                appendages: [] 
            }
        };

        dispatch({ type: 'ADD_MONSTER', payload: newMonster });
        dispatch({ type: 'ADD_LOG', payload: { message: `Synthesis Complete: ${lore.name} born.`, type: 'success' }});
      } catch (error) {
          console.error("Hatch failed", error);
          dispatch({ type: 'ADD_LOG', payload: { message: "Incubation failure. Biomass lost.", type: 'alert' }});
      } finally {
        setIsProcessing(false);
      }
  };

  const handleBuild = (template: Omit<Building, 'id' | 'level'>) => {
      // ... (Existing implementation) ...
      if (!selectedHexId) return;

      const hex = state.map[selectedHexId];
      if (!hex.isExplored) return;
      
      if (hex.owner !== state.faction) {
           dispatch({ type: 'ADD_LOG', payload: { message: "Territory must be claimed before building.", type: 'alert' }});
           return;
      }
      if (hex.buildingId) {
           dispatch({ type: 'ADD_LOG', payload: { message: "Sector already occupied.", type: 'alert' }});
           return;
      }

      if (
          (template.cost.credits && state.resources.credits < template.cost.credits) ||
          (template.cost.biomass && state.resources.biomass < template.cost.biomass) ||
          (template.cost.mana && state.resources.mana < template.cost.mana)
      ) {
        dispatch({ type: 'ADD_LOG', payload: { message: "Insufficient resources.", type: 'alert' }});
        return;
      }

      const newBuilding: Building = {
          ...template,
          id: Math.random().toString(36).substr(2, 9),
          level: 1,
          location: selectedHexId
      };

      dispatch({ type: 'BUILD', payload: { building: newBuilding, cost: template.cost, hexId: selectedHexId }});
      setActiveTab('map');
  };

  const handleUpgradeBuilding = (building: Building) => {
      // ... (Existing implementation) ...
      const baseTemplate = BUILDINGS_CATALOG.find(b => b.name === building.name);
      if (!baseTemplate) return;

      const multiplier = building.level;
      const upgradeCost: Partial<Resources> = {};
      
      if (baseTemplate.cost.credits) upgradeCost.credits = Math.floor(baseTemplate.cost.credits * multiplier);
      if (baseTemplate.cost.biomass) upgradeCost.biomass = Math.floor(baseTemplate.cost.biomass * multiplier);
      if (baseTemplate.cost.mana) upgradeCost.mana = Math.floor(baseTemplate.cost.mana * multiplier);
      if (baseTemplate.cost.research) upgradeCost.research = Math.floor(baseTemplate.cost.research * multiplier);

      if (
          (upgradeCost.credits && state.resources.credits < upgradeCost.credits) ||
          (upgradeCost.biomass && state.resources.biomass < upgradeCost.biomass) ||
          (upgradeCost.mana && state.resources.mana < upgradeCost.mana) ||
          (upgradeCost.research && state.resources.research < upgradeCost.research)
      ) {
          dispatch({ type: 'ADD_LOG', payload: { message: "Insufficient resources for upgrade.", type: 'alert' }});
          return;
      }

      const newProduction: Partial<Resources> = {};
      if (baseTemplate.production) {
          const prodMultiplier = building.level + 1;
          if (baseTemplate.production.credits) newProduction.credits = baseTemplate.production.credits * prodMultiplier;
          if (baseTemplate.production.biomass) newProduction.biomass = baseTemplate.production.biomass * prodMultiplier;
          if (baseTemplate.production.mana) newProduction.mana = baseTemplate.production.mana * prodMultiplier;
          if (baseTemplate.production.research) newProduction.research = baseTemplate.production.research * prodMultiplier;
      }

      dispatch({ 
          type: 'UPGRADE_BUILDING', 
          payload: { 
              buildingId: building.id, 
              hexId: building.location!, 
              cost: upgradeCost,
              newProduction
          } 
      });
  };

  const handleClaimHex = (hexId: string) => {
      // ... (Existing implementation) ...
      const cost = COSTS.CLAIM_BASE;
      if (state.resources.credits < cost) {
          dispatch({ type: 'ADD_LOG', payload: { message: "Insufficient credits to claim territory.", type: 'alert' }});
          return;
      }
      dispatch({ type: 'CLAIM_HEX', payload: { hexId, cost }});
  };

  const handleExploreHex = async (hexId: string) => {
      // ... (Existing implementation) ...
      const cost = getExplorationCost();
      if (state.resources.credits < cost) {
          dispatch({ type: 'ADD_LOG', payload: { message: "Insufficient credits for expedition.", type: 'alert' }});
          return;
      }

      setIsProcessing(true);
      dispatch({ type: 'UPDATE_RESOURCES', payload: { credits: -cost }});

      try {
        const hex = state.map[hexId];
        const event = await GeminiService.generateExplorationEvent(state.faction || "Unknown", hex.biomes);
        
        let wildMonster: Monster | undefined = undefined;
        let reward: Partial<Resources> = {};

        if (Math.random() < 0.25) {
             const elements = Object.values(ElementType);
             const el = elements[Math.floor(Math.random() * elements.length)];
             
             const baseStats: Stats = {
                attack: 8 + Math.floor(Math.random() * 10),
                defense: 8 + Math.floor(Math.random() * 10),
                speed: 8 + Math.floor(Math.random() * 10),
                intelligence: 8 + Math.floor(Math.random() * 10),
            };

            const lore = await GeminiService.generateMonsterLore(el, baseStats);
            wildMonster = {
                id: Math.random().toString(36).substr(2, 9),
                name: lore.name,
                description: `Wild Specimen. ${lore.description}`,
                element: el,
                level: 1 + Math.floor(Math.random() * 3), 
                experience: 0,
                stats: baseStats,
                maxHp: 40 + baseStats.defense * 2,
                currentHp: 40 + baseStats.defense * 2,
                dnaQuality: Math.floor(Math.random() * 60) + 10,
                traits: ['Wild', ...lore.traits],
                anatomy: lore.anatomy || { 
                    trunk: ANATOMY_PARTS.TRUNKS[0], 
                    head: ANATOMY_PARTS.HEADS[0], 
                    appendages: [] 
                }
            };
            dispatch({ type: 'ADD_LOG', payload: { message: `ALERT: Wild Lifeform detected in Sector ${hexId}.`, type: 'alert' }});
        } else {
             if (event.rewardType !== 'none' && event.amount > 0) {
                 reward[event.rewardType] = event.amount;
             }
             dispatch({ type: 'ADD_LOG', payload: { message: event.message, type: 'discovery' }});
        }

        dispatch({ type: 'EXPLORE_HEX', payload: { hexId, reward, wildMonster }});
        
      } catch (error) {
          dispatch({ type: 'ADD_LOG', payload: { message: "Expedition lost contact.", type: 'alert' }});
      } finally {
        setIsProcessing(false);
      }
  };

  const handleCaptureMonster = (hexId: string, monsterId: string) => {
     // ... (Existing implementation) ...
      const monster = state.wildMonsters.find(m => m.id === monsterId);
      if (!monster) return;

      if (state.resources.credits < COSTS.CAPTURE_BASE) {
          dispatch({ type: 'ADD_LOG', payload: { message: "Insufficient credits to deploy capture drone.", type: 'alert' }});
          return;
      }

      const beastMasters = state.staff.filter(s => s.role === 'Beast Master').length;
      let chance = CAPTURE_CHANCE.BASE + (beastMasters * CAPTURE_CHANCE.PER_BEAST_MASTER);
      chance -= (monster.level * CAPTURE_CHANCE.LEVEL_PENALTY);
      chance = Math.min(chance, 0.95);

      const success = Math.random() < chance;
      dispatch({ type: 'CAPTURE_MONSTER', payload: { hexId, success, cost: COSTS.CAPTURE_BASE }});
  };

  const handleForage = (hexId: string) => {
      // ... (Existing implementation) ...
      const hex = state.map[hexId];
      if (!hex.isExplored) return;

      const amount = Math.floor(Math.random() * 10) + 1;
      const type = Math.random() > 0.6 ? 'biomass' : (Math.random() > 0.5 ? 'mana' : 'credits');
      
      dispatch({ type: 'UPDATE_RESOURCES', payload: { [type]: amount }});
      dispatch({ type: 'ADD_LOG', payload: { message: `Foraged ${amount} ${type} from Sector.`, type: 'info' }});
  };

  const handleSabotage = (hexId: string) => {
      // ... (Existing implementation) ...
      const cost = 300;
      if (state.resources.credits < cost) {
          dispatch({ type: 'ADD_LOG', payload: { message: "Insufficient credits for sabotage mission.", type: 'alert' }});
          return;
      }
      dispatch({ type: 'SABOTAGE_HEX', payload: { hexId, cost }});
  };

  const calculateTrainingCost = useCallback((monster: Monster, stat: keyof Stats) => {
      // ... (Existing implementation) ...
      const level = monster.level;
      const baseCost = level * 10;
      
      let biomassCost = baseCost;
      let manaCost = baseCost;

      const trainers = state.staff.filter(s => s.role === 'Trainer').length;
      const staffDiscount = Math.min(0.5, trainers * 0.1); 

      const claimedBiomes = new Set((Object.values(state.map) as HexTile[])
          .filter(h => h.owner === state.faction)
          .flatMap(h => h.biomes));
      
      let biomeMultiplier = 1;
      if (stat === 'attack' && claimedBiomes.has('Volcanic')) biomeMultiplier = 0.8;
      if (stat === 'defense' && claimedBiomes.has('Mountain')) biomeMultiplier = 0.8;
      if (stat === 'speed' && (claimedBiomes.has('Desert') || claimedBiomes.has('Wasteland'))) biomeMultiplier = 0.8;
      if (stat === 'intelligence' && (claimedBiomes.has('Oceanic') || claimedBiomes.has('Tundra'))) biomeMultiplier = 0.8;

      const totalMultiplier = (1 - staffDiscount) * biomeMultiplier;
      
      biomassCost = Math.floor(biomassCost * totalMultiplier);
      manaCost = Math.floor(manaCost * totalMultiplier);

      return { biomass: biomassCost, mana: manaCost };
  }, [state.staff, state.map, state.faction]);

  const handleTrain = (id: string, stat: keyof Stats) => {
      // ... (Existing implementation) ...
      const monster = state.monsters.find(m => m.id === id);
      if (!monster) return;

      const cost = calculateTrainingCost(monster, stat);

      if (state.resources.biomass < cost.biomass || state.resources.mana < cost.mana) {
           dispatch({ type: 'ADD_LOG', payload: { message: `Insufficient resources to train. Need ${cost.biomass} Bio / ${cost.mana} Mana.`, type: 'alert' }});
           return;
      }

      dispatch({ type: 'TRAIN_MONSTER', payload: { id, stat, cost }});
  };

  const handleHire = (role: 'Scientist' | 'Trainer' | 'Explorer' | 'Beast Master') => {
      // ... (Existing implementation) ...
      let cost = 0;
      let salary = 0;

      if (role === 'Scientist') { cost = COSTS.HIRE_SCIENTIST; salary = SALARIES.SCIENTIST; }
      if (role === 'Trainer') { cost = COSTS.HIRE_TRAINER; salary = SALARIES.TRAINER; }
      if (role === 'Explorer') { cost = COSTS.HIRE_EXPLORER; salary = SALARIES.EXPLORER; }
      if (role === 'Beast Master') { cost = COSTS.HIRE_BEAST_MASTER; salary = SALARIES.BEAST_MASTER; }

      if (state.resources.credits < cost) {
          dispatch({ type: 'ADD_LOG', payload: { message: "Insufficient credits to hire staff.", type: 'alert' }});
          return;
      }

      const newStaff: Staff = {
          id: Date.now().toString(),
          name: `Staff ${Math.floor(Math.random() * 1000)}`,
          role,
          skill: 1,
          salary
      };

      dispatch({ type: 'HIRE_STAFF', payload: { staff: newStaff, cost }});
  };
  
  const handleDismiss = (id: string) => {
      dispatch({ type: 'DISMISS_STAFF', payload: { id }});
  };

  const handleSellBuilding = (buildingId: string, hexId: string) => {
      dispatch({ type: 'SELL_BUILDING', payload: { buildingId, hexId } });
  };

  const handleTrade = (actionType: 'buy' | 'sell', amount: number) => {
     // ... (Existing implementation) ...
      if (actionType === 'buy') {
          const cost = amount * EXCHANGE_RATES.BUY_BIOMASS_COST;
          if (state.resources.credits < cost) {
              dispatch({ type: 'ADD_LOG', payload: { message: `Insufficient Credits to buy ${amount} Biomass. Need ${cost} Cr.`, type: 'alert' }});
              return;
          }
          dispatch({ type: 'TRADE_RESOURCES', payload: { costType: 'credits', costAmount: cost, gainType: 'biomass', gainAmount: amount }});
      } else {
          const gain = amount * EXCHANGE_RATES.SELL_BIOMASS_VALUE;
          if (state.resources.biomass < amount) {
               dispatch({ type: 'ADD_LOG', payload: { message: `Insufficient Biomass to sell.`, type: 'alert' }});
               return;
          }
          dispatch({ type: 'TRADE_RESOURCES', payload: { costType: 'biomass', costAmount: amount, gainType: 'credits', gainAmount: gain }});
      }
  };

  const handleCastSpell = (spell: Spell) => {
     // ... (Existing implementation) ...
      if (spell.cost.mana && state.resources.mana < spell.cost.mana) {
          dispatch({ type: 'ADD_LOG', payload: { message: `Not enough Mana for ${spell.name}.`, type: 'alert' }});
          return;
      }
      
      if (spell.targetRequired) {
          if (!selectedSpellTargetId) {
              dispatch({ type: 'ADD_LOG', payload: { message: `Select a target creature for ${spell.name}.`, type: 'alert' }});
              return;
          }
          const target = state.monsters.find(m => m.id === selectedSpellTargetId);
          if (spell.cost.hp && target && target.currentHp <= spell.cost.hp) {
              dispatch({ type: 'ADD_LOG', payload: { message: `Target too weak to survive ritual.`, type: 'alert' }});
              return;
          }
      }

      dispatch({ type: 'CAST_SPELL', payload: { spell, targetId: selectedSpellTargetId || undefined } });
  };

  // --- Tournament Handlers ---
  const handleEnterTournament = (hexId: string) => {
      // Determine rounds based on faction wins
      const playerWins = state.factionStats[state.faction!]?.wins || 0;
      let rounds = 2; // 4 participants
      if (playerWins > 3) rounds = 3; // 8 participants
      if (playerWins > 8) rounds = 4; // 16 participants

      dispatch({ type: 'INIT_TOURNAMENT', payload: { hexId, rounds } });
      setActiveTab('tournament');
  };

  const handleStartTournamentMatch = (match: TournamentMatch) => {
      if (!match.p2) return; // Error case

      // Calculate opponent difficulty based on round
      // Round 1: Player Level - 1
      // Round 2: Player Level
      // Round 3+: Player Level + 1
      const avgPlayerLevel = state.monsters.reduce((acc, m) => acc + m.level, 0) / (state.monsters.length || 1);
      let targetLevel = Math.floor(avgPlayerLevel);
      if (match.round === 1) targetLevel = Math.max(1, targetLevel - 1);
      if (match.round >= 3) targetLevel += (match.round - 2);

      // Generate Opponent Monster
      const elements = Object.values(ElementType);
      const el = elements[Math.floor(Math.random() * elements.length)];
      
      const opponent: Monster = {
        id: 'rival-mon-' + Date.now(),
        name: match.p2.monsterName || 'Unknown Beast',
        description: 'A tournament challenger.',
        element: el,
        level: targetLevel,
        experience: 0,
        stats: { 
            attack: 15 + (targetLevel * 2), 
            defense: 15 + (targetLevel * 2), 
            speed: 15 + (targetLevel * 2), 
            intelligence: 10 + (targetLevel * 2) 
        },
        maxHp: 60 + (targetLevel * 10),
        currentHp: 60 + (targetLevel * 10),
        dnaQuality: 50,
        traits: ['Competitive'],
        anatomy: {
            trunk: ANATOMY_PARTS.TRUNKS[Math.floor(Math.random() * ANATOMY_PARTS.TRUNKS.length)],
            head: ANATOMY_PARTS.HEADS[Math.floor(Math.random() * ANATOMY_PARTS.HEADS.length)],
            appendages: [ANATOMY_PARTS.APPENDAGES[Math.floor(Math.random() * ANATOMY_PARTS.APPENDAGES.length)]]
        }
      };

      setSelectedFighterId(null);
      dispatch({ type: 'PREPARE_BATTLE', payload: { opponent, tournamentMatchId: match.id } });
      setActiveTab('battle');
  };

  const handleNextRound = () => {
      dispatch({ type: 'NEXT_ROUND', payload: { playerAction: 'attack' } });
  };

  const handleEndBattle = (won: boolean) => {
      dispatch({ type: 'END_BATTLE', payload: { won }});
      setActiveTab('tournament'); // Go back to bracket
  };

  // --- Map Selection Side Panel ---
  const renderMapPanel = () => {
      // ... (Existing implementation) ...
      if (!selectedHexId) return (
          <div className="p-4 bg-slate-900 border-l border-slate-800 w-80 flex flex-col justify-center items-center text-center">
              <MapIcon className="text-slate-600 mb-4" size={48} />
              <p className="text-slate-500">Select a hex sector to view details.</p>
          </div>
      );

      const hex = state.map[selectedHexId] as HexTile | undefined;
      if (!hex) return null;

      const building = hex.buildingId ? state.buildings.find(b => b.id === hex.buildingId) : null;
      const wildMonster = hex.wildMonsterId ? state.wildMonsters.find(m => m.id === hex.wildMonsterId) : null;
      const isOwner = hex.owner === state.faction;
      const isRival = hex.owner && !isOwner;
      const canExplore = !hex.isExplored && isAdjacentToExplored(hex.id);
      const hasDroneHub = state.buildings.some(b => b.name === 'Drone Hub');
      const beastMasters = state.staff.filter(s => s.role === 'Beast Master').length;
      
      const baseBuildingTemplate = building ? BUILDINGS_CATALOG.find(b => b.name === building.name) : null;
      const upgradeCostCredits = baseBuildingTemplate?.cost.credits ? baseBuildingTemplate.cost.credits * building!.level : 0;

      return (
        <div className="p-6 bg-slate-900 border-l border-slate-800 w-80 overflow-y-auto">
            <div className="mb-6">
                <h3 className="text-2xl font-orbitron font-bold text-slate-100">Sector {hex.q}, {hex.r}</h3>
                {hex.isExplored ? (
                    <div className="flex gap-2 mt-2">
                        {hex.biomes.map(b => (
                            <span key={b} className="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300">
                                {b}
                            </span>
                        ))}
                    </div>
                ) : (
                    <div className="flex gap-2 mt-2">
                         <span className="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-500 italic">
                            Uncharted Data
                        </span>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <div className="bg-slate-800/50 p-4 rounded-lg">
                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Control</p>
                    {hex.owner ? (
                        <span className={`font-bold ${isOwner ? 'text-teal-400' : 'text-red-400'}`}>
                            {hex.owner}
                        </span>
                    ) : (
                        <span className="text-slate-500 italic">Unclaimed Wilderness</span>
                    )}
                </div>

                {wildMonster && (
                    <div className="bg-slate-800/50 border border-orange-500/30 p-4 rounded-lg animate-in fade-in">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-orange-400 flex items-center gap-2"><PawPrint size={14}/> Wild Beast</h4>
                            <span className="text-xs bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">Lvl {wildMonster.level}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-200">{wildMonster.name}</p>
                        <p className="text-xs text-slate-500 mb-3">{wildMonster.element} / {wildMonster.anatomy.trunk}</p>

                        {hasDroneHub ? (
                            <div className="space-y-2">
                                <div className="text-xs flex justify-between text-slate-400">
                                    <span>Capture Chance:</span>
                                    <span className="text-teal-400 font-bold">
                                        {Math.min(95, Math.floor((CAPTURE_CHANCE.BASE + (beastMasters * CAPTURE_CHANCE.PER_BEAST_MASTER) - (wildMonster.level * CAPTURE_CHANCE.LEVEL_PENALTY)) * 100))}%
                                    </span>
                                </div>
                                <button 
                                    onClick={() => handleCaptureMonster(hex.id, wildMonster.id)}
                                    className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded flex items-center justify-center gap-2 text-sm"
                                >
                                    <Crosshair size={14} /> Attempt Capture ({COSTS.CAPTURE_BASE} Cr)
                                </button>
                            </div>
                        ) : (
                             <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded flex items-start gap-2">
                                 <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                 Requires <strong>Drone Hub</strong> to attempt capture.
                             </div>
                        )}
                    </div>
                )}

                {hex.isExplored && (
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                        <p className="text-xs text-slate-400 uppercase font-bold mb-1">Infrastructure</p>
                        {building ? (
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <p className="font-bold text-indigo-400">{building.name}</p>
                                    <span className="text-[10px] bg-indigo-900/50 text-indigo-300 px-1.5 py-0.5 rounded">Lv {building.level}</span>
                                </div>
                                <p className="text-xs text-slate-500">{building.type}</p>
                                
                                {building.production && (
                                    <div className="mt-2 space-y-1">
                                        {building.production.credits && <div className="text-xs text-green-400">+{building.production.credits} Credits/t</div>}
                                        {building.production.biomass && <div className="text-xs text-green-400">+{building.production.biomass} Biomass/t</div>}
                                        {building.production.mana && <div className="text-xs text-blue-400">+{building.production.mana} Mana/t</div>}
                                        {building.production.research && <div className="text-xs text-purple-400">+{building.production.research} Research/t</div>}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">No structures present.</p>
                        )}
                        {hex.hasTournament && !building && !wildMonster && (
                             <div className="mt-2 flex items-center gap-2 text-yellow-400">
                                <Trophy size={14} />
                                <span className="text-xs font-bold uppercase">Tournament Active</span>
                             </div>
                        )}
                    </div>
                )}
                
                <div className="space-y-2 mt-4">
                    {!hex.isExplored && (
                         <button 
                            onClick={() => handleExploreHex(hex.id)}
                            disabled={!canExplore || isProcessing}
                            className={`w-full py-3 font-bold rounded flex items-center justify-center gap-2 ${
                                canExplore 
                                ? 'bg-teal-600 hover:bg-teal-500 text-slate-900' 
                                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                            }`}
                         >
                             {isProcessing ? <Activity className="animate-spin" size={16}/> : <MapIcon size={16} />}
                             {canExplore ? `Explore (${getExplorationCost()} Cr)` : 'Too far to explore'}
                         </button>
                    )}

                    {hex.isExplored && !hex.owner && (
                        <button 
                            onClick={() => handleClaimHex(hex.id)}
                            className="w-full py-3 bg-teal-800 hover:bg-teal-700 text-white font-bold rounded flex items-center justify-center gap-2"
                        >
                            <Flag size={16} /> Claim Territory ({COSTS.CLAIM_BASE} Cr)
                        </button>
                    )}
                    
                    {hex.isExplored && !building && (
                        <button 
                            onClick={() => handleForage(hex.id)}
                            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded flex items-center justify-center gap-2 text-sm"
                        >
                            <HandCoins size={14} /> Forage
                        </button>
                    )}

                    {isOwner && !hex.buildingId && (
                        <button 
                            onClick={() => setActiveTab('build')}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded flex items-center justify-center gap-2"
                        >
                            <Hammer size={16} /> Build Facility
                        </button>
                    )}
                    
                    {isOwner && building && baseBuildingTemplate && (
                        <div className="mt-4 border-t border-slate-800 pt-4">
                             <button 
                                onClick={() => handleUpgradeBuilding(building)}
                                className="w-full py-2 bg-indigo-900/40 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-500/30 font-bold rounded flex items-center justify-center gap-2 text-sm mb-2"
                            >
                                <ArrowUpCircle size={16} /> Upgrade (Cost: {upgradeCostCredits} Cr)
                            </button>
                        </div>
                    )}

                    {isOwner && building && (
                        <button 
                            onClick={() => handleSellBuilding(building.id, hex.id)}
                            className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 font-bold rounded flex items-center justify-center gap-2 text-sm"
                        >
                            <Trash2 size={16} /> Demolish (50% Refund)
                        </button>
                    )}

                    {hex.isExplored && hex.hasTournament && !wildMonster && (
                        <button 
                            onClick={() => handleEnterTournament(hex.id)}
                            className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-slate-900 font-bold rounded flex items-center justify-center gap-2"
                        >
                            <Swords size={16} /> Enter Tournament
                        </button>
                    )}

                    {isRival && (
                        <button 
                            onClick={() => handleSabotage(hex.id)}
                            className="w-full py-3 bg-red-900/50 hover:bg-red-800 border border-red-800 text-red-200 font-bold rounded flex items-center justify-center gap-2"
                        >
                            <Shield size={16} /> Sabotage (300 Cr)
                        </button>
                    )}
                </div>
            </div>
        </div>
      );
  };
  
  // ... (renderLeagueView unchanged) ...
  const renderLeagueView = () => {
    // Sort factions by score
    const rankedFactions = (Object.entries(state.factionStats) as [string, FactionStats][]).sort(([,a], [,b]) => b.score - a.score);
    const playerStats = state.factionStats[state.faction!] || { wins: 0, losses: 0, score: 0 };
    const winRate = playerStats.wins + playerStats.losses > 0 
      ? ((playerStats.wins / (playerStats.wins + playerStats.losses)) * 100).toFixed(1) 
      : "0.0";

    return (
        <div className="p-6 h-full flex flex-col overflow-hidden">
            <h2 className="text-3xl font-orbitron mb-6 flex items-center gap-2">
                <Trophy className="text-yellow-500" /> Planetary League
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full overflow-hidden">
                
                {/* Left Column: Rankings & Stats */}
                <div className="space-y-6">
                    {/* Stats Card */}
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex justify-between items-center">
                        <div className="text-center">
                            <p className="text-xs text-slate-500 uppercase font-bold">Total Wins</p>
                            <p className="text-3xl font-mono text-green-400">{playerStats.wins}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-slate-500 uppercase font-bold">Total Losses</p>
                            <p className="text-3xl font-mono text-red-400">{playerStats.losses}</p>
                        </div>
                         <div className="text-center">
                            <p className="text-xs text-slate-500 uppercase font-bold">Win Rate</p>
                            <p className="text-3xl font-mono text-yellow-400">{winRate}%</p>
                        </div>
                    </div>

                    {/* Leaderboard */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="p-4 bg-slate-950 border-b border-slate-800">
                            <h3 className="font-bold flex items-center gap-2"><BarChart3 size={18}/> Corporation Rankings</h3>
                        </div>
                        <div className="p-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-500 border-b border-slate-800">
                                        <th className="pb-2">Rank</th>
                                        <th className="pb-2">Corporation</th>
                                        <th className="pb-2 text-right">Wins</th>
                                        <th className="pb-2 text-right">Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankedFactions.map(([fid, stats], index) => (
                                        <tr key={fid} className={`border-b border-slate-800/50 ${fid === state.faction ? 'bg-teal-900/10' : ''}`}>
                                            <td className="py-3">
                                                {index === 0 && <span className="text-yellow-400 font-bold">1st</span>}
                                                {index === 1 && <span className="text-slate-300 font-bold">2nd</span>}
                                                {index === 2 && <span className="text-orange-700 font-bold">3rd</span>}
                                                {index > 2 && <span className="text-slate-500">{index + 1}th</span>}
                                            </td>
                                            <td className={`py-3 font-bold ${fid === state.faction ? 'text-teal-400' : 'text-slate-300'}`}>
                                                {fid} {fid === state.faction && '(You)'}
                                            </td>
                                            <td className="py-3 text-right font-mono">{stats.wins}</td>
                                            <td className="py-3 text-right font-mono font-bold text-yellow-500">{stats.score}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Trophy Case (Moved/Copied here) */}
                     {state.trophies.length > 0 && (
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                          <h3 className="font-bold mb-4 flex items-center gap-2"><Medal size={18} /> Trophy Case</h3>
                          <div className="flex flex-wrap gap-4">
                              {state.trophies.map(t => (
                                  <div key={t.id} className="bg-black/30 border border-yellow-500/30 p-3 rounded flex items-center gap-3">
                                      <div className="text-yellow-400"><Crown size={20} /></div>
                                      <div>
                                          <p className="font-bold text-slate-200 text-sm">{t.name}</p>
                                          <p className="text-xs text-yellow-500/80">{t.bonus}</p>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                    )}
                </div>

                {/* Right Column: History */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                    <div className="p-4 bg-slate-950 border-b border-slate-800">
                        <h3 className="font-bold flex items-center gap-2"><Clock size={18}/> Tournament History</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {state.battleHistory.length === 0 ? (
                            <p className="text-slate-500 italic text-center mt-10">No tournament participation records found.</p>
                        ) : (
                            state.battleHistory.map(record => (
                                <div key={record.id} className="bg-slate-950/50 p-3 rounded border border-slate-800 flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
                                                record.result === 'win' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
                                            }`}>
                                                {record.result}
                                            </span>
                                            <span className="text-slate-400 text-sm">{record.timestamp}</span>
                                        </div>
                                        <p className="text-sm text-slate-200">vs {record.opponentName}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-500 uppercase">Rewards</div>
                                        <div className="text-sm font-bold text-yellow-500">{record.reward || '-'}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
  }

  // --- Render Helpers ---
  // ... (renderDashboard, renderSpellMenu unchanged) ...
  const renderDashboard = () => {
    // Inventory Summaries
    const claimedHexes = (Object.values(state.map) as HexTile[]).filter(h => h.owner === state.faction);
    const biomeCounts = claimedHexes.reduce((acc, hex) => {
        const primary = hex.biomes[0];
        acc[primary] = (acc[primary] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const buildingCounts = state.buildings.reduce((acc, b) => {
        acc[b.name] = (acc[b.name] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const staffCounts = state.staff.reduce((acc, s) => {
        acc[s.role] = (acc[s.role] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const monsterCounts = state.monsters.reduce((acc, m) => {
        acc[m.element] = (acc[m.element] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Financials
    const totalSalary = state.staff.reduce((acc, s) => acc + s.salary, 0);
    let incomeCredits = 1; // Base
    let incomeBiomass = 0;
    let incomeMana = 0;
    let incomeResearch = state.staff.filter(s => s.role === 'Scientist').length * 0.5;

    state.buildings.forEach(b => {
        if(b.production) {
            incomeCredits += b.production.credits || 0;
            incomeBiomass += b.production.biomass || 0;
            incomeMana += b.production.mana || 0;
            incomeResearch += b.production.research || 0;
        }
    });

    const netCredits = incomeCredits - totalSalary;

    return (
        <div className="p-6 space-y-6">
            <h2 className="text-3xl font-orbitron mb-6">Operations Overview</h2>
            
            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                 <div className="bg-slate-900 p-4 rounded border border-slate-800">
                     <p className="text-xs text-slate-500 uppercase font-bold">Territories Claimed</p>
                     <p className="text-2xl font-mono text-teal-400">
                         {claimedHexes.length}
                     </p>
                 </div>
                 <div className="bg-slate-900 p-4 rounded border border-slate-800">
                     <p className="text-xs text-slate-500 uppercase font-bold">Staff Count</p>
                     <p className="text-2xl font-mono text-indigo-400">{state.staff.length}</p>
                 </div>
                 <div className="bg-slate-900 p-4 rounded border border-slate-800">
                     <p className="text-xs text-slate-500 uppercase font-bold">Buildings</p>
                     <p className="text-2xl font-mono text-amber-400">{state.buildings.length}</p>
                 </div>
                 <div className="bg-slate-900 p-4 rounded border border-slate-800">
                     <p className="text-xs text-slate-500 uppercase font-bold">Specimens</p>
                     <p className="text-2xl font-mono text-pink-400">{state.monsters.length}</p>
                 </div>
            </div>

            {/* Financial Report & Market */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6">
                    <h3 className="text-xl font-orbitron font-bold text-slate-200 mb-4 flex items-center gap-2">
                        <TrendingUp className="text-yellow-500" /> Financial Report
                    </h3>
                    <div className="space-y-4">
                        <div className="bg-black/30 p-4 rounded">
                            <p className="text-sm text-slate-400 uppercase font-bold mb-2">Cash Flow (per Tick)</p>
                            <div className="flex justify-between items-center mb-1 text-sm">
                                <span className="text-green-400 flex items-center gap-1"><Plus size={12}/> Gross Income</span>
                                <span className="font-mono">{incomeCredits} Cr</span>
                            </div>
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <span className="text-red-400 flex items-center gap-1"><TrendingDown size={12}/> Expenses (Salary)</span>
                                <span className="font-mono">-{totalSalary} Cr</span>
                            </div>
                            <div className="border-t border-slate-700 pt-2 flex justify-between items-center font-bold">
                                <span className="text-slate-300">Net Profit</span>
                                <span className={`font-mono text-lg ${netCredits >= 0 ? 'text-teal-400' : 'text-red-500'}`}>
                                    {netCredits >= 0 ? '+' : ''}{netCredits} Cr
                                </span>
                            </div>
                        </div>
                        <div className="bg-black/30 p-4 rounded">
                             <p className="text-sm text-slate-400 uppercase font-bold mb-2">Production Rates</p>
                             <div className="grid grid-cols-3 gap-2">
                                 <div>
                                     <span className="text-xs text-green-500 block">Biomass</span>
                                     <span className="font-mono font-bold text-lg">+{incomeBiomass}/t</span>
                                 </div>
                                 <div>
                                     <span className="text-xs text-blue-500 block">Mana</span>
                                     <span className="font-mono font-bold text-lg">+{incomeMana}/t</span>
                                 </div>
                                 <div>
                                     <span className="text-xs text-purple-500 block">Research</span>
                                     <span className="font-mono font-bold text-lg">+{incomeResearch}/t</span>
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Market / Exchange */}
                <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6">
                    <h3 className="text-xl font-orbitron font-bold text-slate-200 mb-4 flex items-center gap-2">
                        <RefreshCw className="text-teal-500" /> Resource Exchange
                    </h3>
                    <div className="space-y-4">
                        <div className="bg-black/30 p-4 rounded flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-green-400">Buy Biomass</h4>
                                <p className="text-xs text-slate-500">Rate: {EXCHANGE_RATES.BUY_BIOMASS_COST} Credits = 1 Biomass</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleTrade('buy', 10)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs border border-slate-600">Buy 10</button>
                                <button onClick={() => handleTrade('buy', 100)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs border border-slate-600">Buy 100</button>
                            </div>
                        </div>

                         <div className="bg-black/30 p-4 rounded flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-yellow-500">Sell Biomass</h4>
                                <p className="text-xs text-slate-500">Rate: 1 Biomass = {EXCHANGE_RATES.SELL_BIOMASS_VALUE} Credits</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleTrade('sell', 10)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs border border-slate-600">Sell 10</button>
                                <button onClick={() => handleTrade('sell', 100)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs border border-slate-600">Sell 100</button>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 italic text-center mt-2">Exchange fees apply. Market rates are fixed by Interstellar Trade Commission.</p>
                    </div>
                </div>
            </div>

            {/* Asset Breakdown Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Territory */}
                <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <h4 className="font-bold text-teal-400 mb-4 flex items-center gap-2"><MapIcon size={16}/> Territory by Biome</h4>
                    <div className="space-y-2">
                        {Object.entries(biomeCounts).length === 0 ? <p className="text-slate-500 italic text-sm">No territory claimed.</p> : null}
                        {Object.entries(biomeCounts).map(([biome, count]) => (
                            <div key={biome} className="flex justify-between items-center text-sm bg-slate-900/50 px-3 py-2 rounded">
                                <span className="text-slate-300">{biome}</span>
                                <span className="font-mono font-bold bg-slate-700 px-2 rounded text-slate-200">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Infrastructure */}
                <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <h4 className="font-bold text-amber-400 mb-4 flex items-center gap-2"><Building2 size={16}/> Infrastructure</h4>
                    <div className="space-y-2">
                         {Object.entries(buildingCounts).length === 0 ? <p className="text-slate-500 italic text-sm">No buildings constructed.</p> : null}
                         {Object.entries(buildingCounts).map(([name, count]) => (
                            <div key={name} className="flex justify-between items-center text-sm bg-slate-900/50 px-3 py-2 rounded">
                                <span className="text-slate-300">{name}</span>
                                <span className="font-mono font-bold bg-slate-700 px-2 rounded text-slate-200">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                 {/* Personnel */}
                 <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <h4 className="font-bold text-indigo-400 mb-4 flex items-center gap-2"><Users size={16}/> Personnel</h4>
                    <div className="space-y-2">
                        {Object.entries(staffCounts).length === 0 ? <p className="text-slate-500 italic text-sm">No staff hired.</p> : null}
                        {Object.entries(staffCounts).map(([role, count]) => (
                            <div key={role} className="flex justify-between items-center text-sm bg-slate-900/50 px-3 py-2 rounded">
                                <span className="text-slate-300">{role}</span>
                                <span className="font-mono font-bold bg-slate-700 px-2 rounded text-slate-200">{count}</span>
                            </div>
                        ))}
                         <div className="mt-4 pt-2 border-t border-slate-700 text-xs flex justify-between text-slate-400">
                             <span>Total Payroll</span>
                             <span>{totalSalary} Cr/tick</span>
                         </div>
                    </div>
                </div>
            </div>

            {state.monsters.length > 0 && (
                <>
                    <h3 className="text-xl font-bold font-orbitron mb-4 flex items-center gap-2">
                        <Dna className="text-pink-400"/> Active Specimens 
                        <span className="text-sm font-sans font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded ml-2">
                            {Object.entries(monsterCounts).map(([el, c]) => `${el}: ${c}`).join(' | ')}
                        </span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                        {state.monsters.map(m => (
                            <div key={m.id} className="h-full">
                                <MonsterCard 
                                    monster={m} 
                                    canTrain={true} 
                                    onTrain={handleTrain}
                                />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
  };
  
  const renderSpellMenu = (targetId: string | null) => (
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 max-h-96 overflow-y-auto">
          <h4 className="font-orbitron font-bold text-purple-400 mb-3">Quick Grimoire</h4>
          <div className="space-y-2">
              {SPELLS.filter(s => !s.targetRequired || (s.targetRequired && targetId)).map(s => (
                  <button 
                    key={s.id}
                    onClick={() => {
                        handleCastSpell(s);
                        setShowGrimoireInBattle(false);
                    }}
                    className="w-full text-left p-2 rounded hover:bg-purple-900/30 border border-transparent hover:border-purple-500/50 flex justify-between items-center group"
                  >
                      <div>
                          <span className="text-sm font-bold text-slate-200 group-hover:text-white block">{s.name}</span>
                          <span className="text-[10px] text-slate-400">{s.description}</span>
                      </div>
                      <div className="text-xs bg-slate-900 px-2 py-1 rounded text-purple-400">
                          {s.cost.mana} MP
                      </div>
                  </button>
              ))}
          </div>
          <button onClick={() => setShowGrimoireInBattle(false)} className="w-full mt-4 py-2 bg-slate-700 text-slate-300 rounded text-sm font-bold">Cancel</button>
      </div>
  );

  const renderTournamentBracket = () => {
      const { matches, currentRound, isActive, totalRounds } = state.tournament;

      // Group matches by round
      const rounds = [];
      for(let i=1; i<=totalRounds; i++) {
          rounds.push(matches.filter(m => m.round === i));
      }

      if (!isActive) {
           return (
              <div className="p-6 h-full flex flex-col items-center justify-center text-center">
                  <Trophy size={64} className="text-yellow-600 mb-4" />
                  <h2 className="text-3xl font-orbitron font-bold text-slate-200">Tournament Concluded</h2>
                  <p className="text-slate-400 mb-6">Return to the map to find another challenge.</p>
                  <button onClick={() => setActiveTab('map')} className="px-6 py-2 bg-slate-700 rounded hover:bg-slate-600">Back to Map</button>
              </div>
           );
      }

      return (
          <div className="p-6 h-full flex flex-col">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-orbitron font-bold text-yellow-500 flex items-center gap-2">
                      <Swords /> Tournament Bracket
                  </h2>
                  <span className="text-sm bg-slate-800 px-3 py-1 rounded text-slate-300">
                      Round {currentRound} / {totalRounds}
                  </span>
              </div>
              
              <div className="flex-1 overflow-x-auto">
                  <div className="flex gap-12 min-w-max h-full">
                      {rounds.map((roundMatches, rIdx) => (
                          <div key={rIdx} className="flex flex-col justify-around gap-8 w-64">
                              <h3 className="text-center text-slate-500 font-bold uppercase text-sm mb-4">
                                  {rIdx === rounds.length - 1 ? 'Finals' : 
                                   rIdx === rounds.length - 2 ? 'Semi-Finals' : 
                                   `Round ${rIdx + 1}`}
                              </h3>
                              {roundMatches.map(match => {
                                  const isPlayerMatch = match.p1?.isPlayer || match.p2?.isPlayer;
                                  const isCurrentMatch = match.round === currentRound && match.status === 'ready' && isPlayerMatch;

                                  return (
                                      <div key={match.id} className={`bg-slate-900 border rounded-lg p-3 relative ${
                                          match.status === 'completed' ? 'border-slate-700 opacity-70' :
                                          isCurrentMatch ? 'border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]' :
                                          'border-slate-700'
                                      }`}>
                                          <div className={`text-sm mb-1 flex justify-between ${match.winnerId === match.p1?.id ? 'text-green-400 font-bold' : 'text-slate-400'}`}>
                                              <span>{match.p1?.name || 'TBD'}</span>
                                              {match.winnerId === match.p1?.id && <Trophy size={12} />}
                                          </div>
                                          <div className={`text-sm flex justify-between ${match.winnerId === match.p2?.id ? 'text-green-400 font-bold' : 'text-slate-400'}`}>
                                              <span>{match.p2?.name || 'TBD'}</span>
                                              {match.winnerId === match.p2?.id && <Trophy size={12} />}
                                          </div>
                                          
                                          {isCurrentMatch && !match.winnerId && (
                                              <button 
                                                onClick={() => handleStartTournamentMatch(match)}
                                                className="mt-2 w-full py-1 text-xs bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded animate-pulse"
                                              >
                                                  FIGHT
                                              </button>
                                          )}
                                          {match.round === currentRound && match.status === 'ready' && !isPlayerMatch && (
                                              <div className="mt-2 text-[10px] text-center text-slate-500 italic">Awaiting Results</div>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      );
  };

  const renderBattleView = () => {
    // ... (Existing implementation, only modification is removing fallback for "Combatants Missing" since we handle init better now)
    const { isActive, playerMonsterId, opponentMonster, logs, phase } = state.battle;
    const playerMon = state.monsters.find(m => m.id === playerMonsterId);
    
    // Only show "Start" screen if no active battle AND no opponent set (Clean Start)
    if (!isActive && !opponentMonster) {
         return (
             <div className="p-6 h-full flex flex-col">
                 <h2 className="text-3xl font-orbitron mb-6 flex items-center gap-3">
                     Battle Arena <Flame className="text-red-500" />
                 </h2>
                 <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                     <Swords size={64} className="mb-4 text-slate-600" />
                     <h3 className="text-xl font-bold">No Active Combat</h3>
                     <p className="text-slate-500">Locate a Tournament on the Map to engage in combat.</p>
                     <button 
                         onClick={() => setActiveTab('map')} 
                         className="mt-4 px-6 py-2 bg-slate-800 rounded hover:bg-slate-700"
                     >
                         Return to Map
                     </button>
                 </div>
             </div>
         );
    }

    // PRE-BATTLE SELECTION (Opponent set, but not Active yet)
    if (!isActive && opponentMonster) {
        const eligibleMonsters = state.monsters.filter(m => m.currentHp > 0);
        
        return (
            <div className="p-6 h-full flex flex-col">
                <h2 className="text-3xl font-orbitron mb-6">Battle Setup</h2>
                 <div className="flex-1 flex flex-col md:flex-row gap-8 items-center justify-center">
                    {/* Player Side */}
                    <div className="w-full md:w-1/3 space-y-4">
                        <h3 className="text-center font-orbitron text-teal-400 font-bold">SELECT COMBATANT</h3>
                            <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2">
                                {state.monsters.length === 0 && (
                                    <div className="text-center text-slate-500 p-4 border border-dashed border-slate-700 rounded">
                                        No specimens available. Visit Bio-Lab.
                                    </div>
                                )}
                                {state.monsters.map(m => {
                                    const isAlive = m.currentHp > 0;
                                    return (
                                    <div 
                                        key={m.id}
                                        onClick={() => isAlive && setSelectedFighterId(m.id)}
                                        className={`p-3 border rounded transition-all flex justify-between items-center ${
                                            !isAlive ? 'opacity-50 grayscale cursor-not-allowed bg-slate-900 border-slate-800' :
                                            selectedFighterId === m.id 
                                            ? 'border-teal-400 bg-teal-900/20 cursor-pointer' 
                                            : 'border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{m.name}</span>
                                                {!isAlive && <span className="text-[10px] bg-red-900 text-red-200 px-1 rounded">FAINTED</span>}
                                            </div>
                                            <div className="flex gap-2 text-xs text-slate-500 mt-1">
                                                <span className={m.currentHp < m.maxHp * 0.3 ? 'text-red-400' : ''}>HP {m.currentHp}/{m.maxHp}</span>
                                                <span>ATK {m.stats.attack}</span>
                                            </div>
                                        </div>
                                        <div className="text-xs bg-slate-800 px-2 py-1 rounded">Lvl {m.level}</div>
                                    </div>
                                    )
                                })}
                            </div>
                            {eligibleMonsters.length === 0 && state.monsters.length > 0 && (
                                <div className="text-xs text-red-400 text-center bg-red-900/20 p-2 rounded">
                                    All specimens are incapacitated. Heal them using spells or time.
                                </div>
                            )}
                    </div>
                    {/* VS */}
                    <div className="text-4xl font-black italic text-slate-700">VS</div>
                    {/* Opponent */}
                    <div className="w-full md:w-1/3 opacity-80 grayscale">
                         <h3 className="text-center font-orbitron text-red-400 font-bold mb-4">OPPONENT</h3>
                         <MonsterCard monster={opponentMonster} />
                    </div>
                 </div>
                 <div className="mt-8 flex justify-center gap-4">
                    <button 
                        onClick={() => dispatch({ type: 'RESET_BATTLE' })}
                        className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-lg"
                    >
                        Cancel
                    </button>
                    <button 
                        disabled={!selectedFighterId}
                        onClick={() => selectedFighterId && dispatch({ type: 'START_BATTLE', payload: { playerMonsterId: selectedFighterId, opponent: opponentMonster } })}
                        className={`px-12 py-4 text-xl font-bold uppercase tracking-wider rounded-lg shadow-xl flex items-center gap-4 ${
                            selectedFighterId
                            ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        <Swords size={24} /> ENTER ARENA
                    </button>
                </div>
            </div>
        )
    }

    // ACTIVE BATTLE
    // Fallback if state is corrupted or monster ID is missing despite being active
    if (!playerMon || !opponentMonster) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6">
                <AlertCircle size={48} className="text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Combat Data Corrupted</h3>
                <p className="text-slate-500 mb-6">Lost connection to combatants.</p>
                <button 
                    onClick={() => dispatch({ type: 'RESET_BATTLE' })}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold"
                >
                    Reset Interface
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 h-full flex flex-col relative">
            {/* Top Bar */}
            <div className="flex justify-between items-center mb-4 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                <div className="font-orbitron font-bold text-xl flex items-center gap-2">
                    <Swords className="text-red-500" /> ROUND {state.battle.round}
                </div>
                <div className="text-sm text-slate-400">
                    Phase: <span className="text-white uppercase font-bold">{phase}</span>
                </div>
            </div>

            {/* Arena */}
            <div className="flex-1 flex flex-col md:flex-row gap-6 items-stretch justify-center mb-4 overflow-hidden">
                {/* Player Card */}
                <div className="flex-1 flex flex-col relative group">
                     {/* Spell Overlay */}
                     {showGrimoireInBattle && selectedSpellTargetId === playerMon.id && (
                         <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 rounded-xl">
                             {renderSpellMenu(playerMon.id)}
                         </div>
                     )}

                    <div className="text-center mb-2">
                         <span className="text-teal-400 font-bold uppercase tracking-widest text-sm">You</span>
                         <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
                             <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${(playerMon.currentHp / playerMon.maxHp) * 100}%` }}></div>
                         </div>
                         <div className="flex justify-between text-xs font-mono mt-1">
                             <span>{playerMon.currentHp} HP</span>
                             <span>{playerMon.maxHp} MAX</span>
                         </div>
                    </div>
                    <div className="flex-1">
                        <MonsterCard monster={playerMon} />
                    </div>
                </div>

                {/* Opponent Card */}
                <div className="flex-1 flex flex-col relative">
                    <div className="text-center mb-2">
                         <span className="text-red-400 font-bold uppercase tracking-widest text-sm">Opponent</span>
                         <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
                             <div className="bg-red-500 h-full transition-all duration-500" style={{ width: `${(opponentMonster.currentHp / opponentMonster.maxHp) * 100}%` }}></div>
                         </div>
                         <div className="flex justify-between text-xs font-mono mt-1">
                             <span>{opponentMonster.currentHp} HP</span>
                             <span>{opponentMonster.maxHp} MAX</span>
                         </div>
                    </div>
                    <div className="flex-1">
                        <MonsterCard monster={opponentMonster} />
                    </div>
                </div>
            </div>

            {/* Battle Log & Controls */}
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col md:flex-row gap-4 h-64">
                <div className="flex-1 h-full overflow-hidden">
                     <h4 className="text-xs text-slate-500 uppercase font-bold mb-2">Combat Log</h4>
                     <BattleLogView logs={logs} />
                </div>
                
                <div className="w-full md:w-64 flex flex-col justify-center gap-3 border-l border-slate-800 pl-4">
                     {phase === 'planning' ? (
                        <>
                            <button 
                                onClick={handleNextRound}
                                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-lg text-lg flex items-center justify-center gap-2"
                            >
                                <Swords size={20} /> FIGHT
                            </button>
                            <button 
                                onClick={() => {
                                    setSelectedSpellTargetId(playerMon.id);
                                    setShowGrimoireInBattle(true);
                                }}
                                className="w-full py-3 bg-purple-900/50 hover:bg-purple-800 text-purple-200 border border-purple-600/50 font-bold rounded flex items-center justify-center gap-2"
                            >
                                <Sparkles size={18} /> SPELL
                            </button>
                        </>
                     ) : (
                         <div className="text-center">
                             {phase === 'victory' && (
                                 <div className="mb-4">
                                     <h3 className="text-2xl font-bold text-yellow-400 mb-1">VICTORY</h3>
                                     <p className="text-sm text-slate-400">Opponent neutralized.</p>
                                 </div>
                             )}
                             {phase === 'defeat' && (
                                 <div className="mb-4">
                                     <h3 className="text-2xl font-bold text-red-500 mb-1">DEFEAT</h3>
                                     <p className="text-sm text-slate-400">Specimen incapacitated.</p>
                                 </div>
                             )}
                             <button 
                                onClick={() => handleEndBattle(phase === 'victory')}
                                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded"
                             >
                                 Continue
                             </button>
                         </div>
                     )}
                </div>
            </div>
        </div>
    );
  };

  if (!hasApiKey) {
    return <ApiKeySelection onComplete={() => setHasApiKey(true)} />;
  }

  if (!state.faction) {
    return <FactionSelect onSelect={(id) => dispatch({ type: 'SELECT_FACTION', payload: id })} />;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-rajdhani overflow-hidden selection:bg-teal-500/30">
      {/* Sidebar Navigation */}
      <div className="w-20 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-6 gap-6 z-20 shrink-0">
        <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(20,184,166,0.5)] mb-4">
            <Globe size={24} className="text-slate-900" />
        </div>
        
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Activity size={20} />} label="Dash" />
        <NavButton active={activeTab === 'map'} onClick={() => setActiveTab('map')} icon={<MapIcon size={20} />} label="Map" />
        <NavButton active={activeTab === 'build'} onClick={() => setActiveTab('build')} icon={<Hammer size={20} />} label="Build" />
        <NavButton active={activeTab === 'lab'} onClick={() => setActiveTab('lab')} icon={<TestTube size={20} />} label="Lab" />
        <NavButton active={activeTab === 'staff'} onClick={() => setActiveTab('staff')} icon={<Users size={20} />} label="HQ" />
        <NavButton active={activeTab === 'occult'} onClick={() => setActiveTab('occult')} icon={<BookOpen size={20} />} label="Occult" />
        <NavButton active={activeTab === 'league'} onClick={() => setActiveTab('league')} icon={<Trophy size={20} />} label="League" />

        <div className="flex-1" />

        <NavButton active={showRules} onClick={() => setShowRules(true)} icon={<HelpCircle size={20} />} label="Help" />
        <NavButton active={showSettings} onClick={() => setShowSettings(true)} icon={<Settings size={20} />} label="Config" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <ResourceBar resources={state.resources} />

        <div className="flex-1 overflow-auto bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
          {activeTab === 'dashboard' && renderDashboard()}
          
          {activeTab === 'map' && (
            <div className="h-full flex">
                <div className="flex-1 h-full relative">
                     <HexMap 
                        map={state.map} 
                        buildings={state.buildings}
                        selectedHexId={selectedHexId} 
                        onHexClick={(hex) => setSelectedHexId(hex.id)}
                        playerFaction={state.faction}
                     />
                </div>
                {selectedHexId && renderMapPanel()}
            </div>
          )}

          {activeTab === 'lab' && (
             <div className="p-6">
                <h2 className="text-3xl font-orbitron mb-6 flex items-center gap-2">
                    <TestTube className="text-teal-400" /> Bio-Synthesis Lab
                </h2>
                {/* ... (Lab content existing) ... */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                     {Object.values(ElementType).map((el) => (
                         <div key={el} className={`bg-slate-900 border-2 rounded-xl p-6 relative overflow-hidden group ${ELEMENT_COLORS[el]} bg-opacity-10 border-opacity-30 hover:border-opacity-80 transition-all`}>
                             <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none z-0">
                                 <Dna size={120} />
                             </div>
                             
                             <div className="relative z-10">
                                 <h3 className="text-xl font-bold font-orbitron mb-2 uppercase">{el} Incubator</h3>
                                 <p className="text-sm text-slate-400 mb-4 h-10">
                                     Synthesize a creature with {el} affinity. 
                                 </p>
                                 <div className="flex items-center gap-2 mb-4 text-xs font-mono text-green-400">
                                     <Leaf size={14} /> Cost: 100 Biomass
                                 </div>
                                 <button 
                                     onClick={() => handleHatch(el)}
                                     disabled={isProcessing}
                                     className="w-full py-3 bg-slate-800 hover:bg-teal-600 hover:text-white border border-slate-600 rounded font-bold transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                 >
                                     {isProcessing ? <Activity className="animate-spin" /> : <Dna />}
                                     INITIATE CLONING
                                 </button>
                             </div>
                         </div>
                     ))}
                </div>

                <h3 className="text-xl font-orbitron mb-4 text-slate-300 border-b border-slate-800 pb-2">Active Test Subjects</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {state.monsters.map(m => (
                        <div key={m.id} className="h-full">
                            <MonsterCard monster={m} canTrain={true} onTrain={handleTrain} trainingCosts={{
                                attack: calculateTrainingCost(m, 'attack'),
                                defense: calculateTrainingCost(m, 'defense'),
                                speed: calculateTrainingCost(m, 'speed'),
                                intelligence: calculateTrainingCost(m, 'intelligence')
                            }}/>
                        </div>
                    ))}
                     {state.monsters.length === 0 && <p className="text-slate-500 italic">No specimens in containment.</p>}
                </div>
             </div>
          )}
          
          {activeTab === 'build' && (
              <div className="p-6">
                  {/* ... (Existing build content) ... */}
                  <h2 className="text-3xl font-orbitron mb-6 flex items-center gap-2">
                      <Hammer className="text-indigo-400" /> Infrastructure
                  </h2>
                  <p className="text-slate-400 mb-8 max-w-2xl">
                      Select a sector on the map to construct facilities. You must own the territory first. 
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {BUILDINGS_CATALOG.map((b) => {
                          const canAfford = 
                            (!b.cost.credits || state.resources.credits >= b.cost.credits) &&
                            (!b.cost.biomass || state.resources.biomass >= b.cost.biomass) &&
                            (!b.cost.mana || state.resources.mana >= b.cost.mana) &&
                            (!b.cost.research || state.resources.research >= b.cost.research);
                            
                          return (
                          <div key={b.name} className={`bg-slate-900 p-6 rounded-xl border-l-4 ${canAfford ? 'border-indigo-500 hover:border-indigo-400' : 'border-red-900 opacity-75'} shadow-lg transition-all`}>
                              <div className="flex justify-between items-start mb-2">
                                  <h3 className="text-xl font-bold text-white">{b.name}</h3>
                                  <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400 uppercase">{b.type}</span>
                              </div>
                              <p className="text-sm text-slate-400 mb-4 h-10">{b.description}</p>
                              
                              <div className="space-y-1 mb-4 text-sm font-mono">
                                  {b.cost.credits && <div className={state.resources.credits < b.cost.credits ? 'text-red-500' : 'text-slate-300'}>- {b.cost.credits} Credits</div>}
                                  {b.cost.biomass && <div className={state.resources.biomass < b.cost.biomass ? 'text-red-500' : 'text-green-400'}>- {b.cost.biomass} Biomass</div>}
                                  {b.cost.mana && <div className={state.resources.mana < b.cost.mana ? 'text-red-500' : 'text-blue-400'}>- {b.cost.mana} Mana</div>}
                                  {b.cost.research && <div className={state.resources.research < b.cost.research ? 'text-red-500' : 'text-purple-400'}>- {b.cost.research} Research</div>}
                              </div>

                              <button 
                                onClick={() => handleBuild(b)}
                                disabled={!canAfford}
                                className={`w-full py-2 rounded font-bold transition-all ${
                                    canAfford 
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white' 
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                }`}
                              >
                                  Construct
                              </button>
                          </div>
                      )})}
                  </div>
              </div>
          )}

          {activeTab === 'staff' && (
              <div className="p-6">
                 {/* ... (Existing staff content) ... */}
                   <h2 className="text-3xl font-orbitron mb-6 flex items-center gap-2">
                      <Users className="text-blue-400" /> Human Resources
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                       <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl flex flex-col">
                           <h3 className="text-xl font-bold text-blue-300 mb-2">Explorer</h3>
                           <p className="text-sm text-slate-400 mb-4 flex-1">Reduces the cost of exploring new sectors by 5 credits per explorer.</p>
                           <div className="mb-4 space-y-1 text-sm font-mono">
                               <div className="text-yellow-400">Hire: {COSTS.HIRE_EXPLORER} Cr</div>
                               <div className="text-red-400">Wage: {SALARIES.EXPLORER} Cr/t</div>
                           </div>
                           <button onClick={() => handleHire('Explorer')} className="py-2 bg-blue-900 hover:bg-blue-800 text-blue-100 rounded flex items-center justify-center gap-2"><UserPlus size={16}/> Hire</button>
                       </div>
                       <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl flex flex-col">
                           <h3 className="text-xl font-bold text-purple-300 mb-2">Scientist</h3>
                           <p className="text-sm text-slate-400 mb-4 flex-1">Generates 0.5 Research points per tick. Unlocks tech.</p>
                           <div className="mb-4 space-y-1 text-sm font-mono">
                               <div className="text-yellow-400">Hire: {COSTS.HIRE_SCIENTIST} Cr</div>
                               <div className="text-red-400">Wage: {SALARIES.SCIENTIST} Cr/t</div>
                           </div>
                           <button onClick={() => handleHire('Scientist')} className="py-2 bg-purple-900 hover:bg-purple-800 text-purple-100 rounded flex items-center justify-center gap-2"><UserPlus size={16}/> Hire</button>
                       </div>
                       <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl flex flex-col">
                           <h3 className="text-xl font-bold text-red-300 mb-2">Trainer</h3>
                           <p className="text-sm text-slate-400 mb-4 flex-1">Reduces biomass cost of training monsters by 10% (max 50%).</p>
                           <div className="mb-4 space-y-1 text-sm font-mono">
                               <div className="text-yellow-400">Hire: {COSTS.HIRE_TRAINER} Cr</div>
                               <div className="text-red-400">Wage: {SALARIES.TRAINER} Cr/t</div>
                           </div>
                           <button onClick={() => handleHire('Trainer')} className="py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded flex items-center justify-center gap-2"><UserPlus size={16}/> Hire</button>
                       </div>
                       <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl flex flex-col">
                           <h3 className="text-xl font-bold text-orange-300 mb-2">Beast Master</h3>
                           <p className="text-sm text-slate-400 mb-4 flex-1">Increases capture chance of wild monsters by 15%.</p>
                           <div className="mb-4 space-y-1 text-sm font-mono">
                               <div className="text-yellow-400">Hire: {COSTS.HIRE_BEAST_MASTER} Cr</div>
                               <div className="text-red-400">Wage: {SALARIES.BEAST_MASTER} Cr/t</div>
                           </div>
                           <button onClick={() => handleHire('Beast Master')} className="py-2 bg-orange-900 hover:bg-orange-800 text-orange-100 rounded flex items-center justify-center gap-2"><UserPlus size={16}/> Hire</button>
                       </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-400 mb-4">Active Roster</h3>
                  <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                      <table className="w-full text-left">
                          <thead className="bg-slate-950 text-slate-400 text-sm uppercase">
                              <tr>
                                  <th className="p-4">Name</th>
                                  <th className="p-4">Role</th>
                                  <th className="p-4">Salary</th>
                                  <th className="p-4 text-right">Action</th>
                              </tr>
                          </thead>
                          <tbody>
                              {state.staff.map((s, i) => (
                                  <tr key={s.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                                      <td className="p-4 font-bold text-slate-200">{s.name}</td>
                                      <td className="p-4">
                                          <span className={`text-xs px-2 py-1 rounded ${
                                              s.role === 'Scientist' ? 'bg-purple-900 text-purple-200' :
                                              s.role === 'Trainer' ? 'bg-red-900 text-red-200' :
                                              s.role === 'Beast Master' ? 'bg-orange-900 text-orange-200' :
                                              'bg-blue-900 text-blue-200'
                                          }`}>{s.role}</span>
                                      </td>
                                      <td className="p-4 font-mono text-red-400">-{s.salary} Cr</td>
                                      <td className="p-4 text-right">
                                           <button 
                                              onClick={() => handleDismiss(s.id)}
                                              className="p-2 hover:bg-red-900/30 text-slate-500 hover:text-red-400 rounded transition-colors"
                                              title="Dismiss"
                                           >
                                               <X size={16} />
                                           </button>
                                      </td>
                                  </tr>
                              ))}
                              {state.staff.length === 0 && (
                                  <tr>
                                      <td colSpan={4} className="p-8 text-center text-slate-500 italic">No staff employed.</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {activeTab === 'occult' && (
              <div className="p-6">
                 {/* ... (Existing Occult content) ... */}
                  <h2 className="text-3xl font-orbitron mb-6 flex items-center gap-2">
                      <BookOpen className="text-purple-400" /> Occult Grimoire
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {SPELLS.map(spell => (
                          <div key={spell.id} className="bg-slate-900 border border-purple-500/30 p-6 rounded-xl hover:border-purple-500 transition-colors group">
                              <div className="flex justify-between items-start mb-2">
                                  <h3 className="text-lg font-bold text-purple-200 group-hover:text-white">{spell.name}</h3>
                                  <Sparkles size={16} className="text-purple-500" />
                              </div>
                              <p className="text-sm text-slate-400 mb-4 h-12">{spell.description}</p>
                              
                              <div className="flex flex-wrap gap-2 text-xs font-mono mb-4">
                                  {spell.cost.mana && <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded border border-blue-800">{spell.cost.mana} Mana</span>}
                                  {spell.cost.hp && <span className="bg-red-900/50 text-red-300 px-2 py-1 rounded border border-red-800">{spell.cost.hp} HP</span>}
                              </div>

                              {spell.targetRequired ? (
                                  <div className="relative">
                                      <select 
                                        onChange={(e) => setSelectedSpellTargetId(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm mb-2 focus:border-purple-500 outline-none"
                                        defaultValue=""
                                      >
                                          <option value="" disabled>Select Target</option>
                                          {state.monsters.map(m => (
                                              <option key={m.id} value={m.id}>{m.name} (HP: {m.currentHp})</option>
                                          ))}
                                      </select>
                                      <button 
                                        onClick={() => handleCastSpell(spell)}
                                        className="w-full py-2 bg-purple-900 hover:bg-purple-800 text-purple-100 font-bold rounded"
                                      >
                                          Perform Ritual
                                      </button>
                                  </div>
                              ) : (
                                  <button 
                                    onClick={() => handleCastSpell(spell)}
                                    className="w-full py-2 bg-purple-900 hover:bg-purple-800 text-purple-100 font-bold rounded"
                                  >
                                      Perform Ritual
                                  </button>
                              )}
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {activeTab === 'league' && renderLeagueView()}

          {activeTab === 'tournament' && renderTournamentBracket()}

          {activeTab === 'battle' && renderBattleView()}

        </div>

        {/* Global Notifications / Log Overlay - IMPROVED */}
        <div className={`absolute bottom-4 right-4 w-96 flex flex-col gap-2 pointer-events-none z-50 transition-all duration-300 ${isLogsMinimized ? 'translate-y-[calc(100%-40px)]' : ''}`}>
             
             {/* Header Control */}
             <div className="bg-slate-800 border border-slate-700 rounded-t-lg p-2 flex justify-between items-center pointer-events-auto shadow-lg">
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                     <Activity size={14} /> System Logs ({state.logs.length})
                 </div>
                 <div className="flex items-center gap-1">
                     <button 
                        onClick={() => dispatch({ type: 'CLEAR_LOGS' })} 
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"
                        title="Clear All"
                     >
                         <Trash2 size={14} />
                     </button>
                     <button 
                        onClick={() => setIsLogsMinimized(!isLogsMinimized)} 
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                     >
                         {isLogsMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                     </button>
                 </div>
             </div>

             {/* Logs List */}
             <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pointer-events-auto bg-slate-900/50 p-2 rounded-b-lg backdrop-blur-sm">
                {state.logs.slice(0, 8).map((log) => (
                    <div key={log.id} className={`p-2 rounded shadow-sm border text-xs animate-in slide-in-from-right fade-in duration-300 flex justify-between items-start gap-2 ${
                        log.type === 'alert' ? 'bg-red-900/80 border-red-500 text-white' :
                        log.type === 'success' ? 'bg-teal-900/80 border-teal-500 text-white' :
                        log.type === 'discovery' ? 'bg-indigo-900/80 border-indigo-500 text-white' :
                        log.type === 'magic' ? 'bg-purple-900/80 border-purple-500 text-white' :
                        'bg-slate-800/80 border-slate-600 text-slate-200'
                    }`}>
                        <div className="flex-1">
                            <span className="opacity-50 text-[10px] mr-2">{log.timestamp}</span>
                            {log.message}
                        </div>
                        <button 
                            onClick={() => dispatch({ type: 'DISMISS_LOG', payload: { id: log.id } })}
                            className="opacity-50 hover:opacity-100 p-0.5 hover:bg-black/20 rounded"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
                {state.logs.length === 0 && <p className="text-center text-xs text-slate-600 italic py-2">No active logs.</p>}
             </div>
        </div>
      </div>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showSettings && <SettingsModal settings={state.settings} onUpdate={(s) => dispatch({ type: 'UPDATE_SETTINGS', payload: s })} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
