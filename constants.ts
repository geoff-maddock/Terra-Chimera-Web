
import { BiomeType, Building, ElementType, FactionId, Resources, Stats, Spell, Trophy } from "./types";

export const INITIAL_RESOURCES: Resources = {
  credits: 500,
  biomass: 200,
  mana: 100,
  research: 0
};

export const REFUND_RATE = 0.5;

// Building Upgrade Logic
// Cost for Level L -> L+1 = BaseCost * L
// Production at Level L = BaseProduction * L
export const BUILDING_UPGRADE_COST_MULTIPLIER = 1; 

export const EXCHANGE_RATES = {
  BUY_BIOMASS_COST: 2, // Credits needed to buy 1 Biomass
  SELL_BIOMASS_VALUE: 0.5, // Credits gained per 1 Biomass sold
};

export const COSTS = {
  EXPLORE_BASE: 50,
  CLAIM_BASE: 100,
  HIRE_EXPLORER: 150,
  HIRE_SCIENTIST: 200,
  HIRE_TRAINER: 150,
  HIRE_BEAST_MASTER: 300,
  CAPTURE_BASE: 150,
};

export const SALARIES = {
  EXPLORER: 5,
  SCIENTIST: 10,
  TRAINER: 8,
  BEAST_MASTER: 12
};

export const CAPTURE_CHANCE = {
  BASE: 0.40, // 40%
  PER_BEAST_MASTER: 0.15, // +15% per staff
  LEVEL_PENALTY: 0.05, // -5% per monster level
};

export const FACTION_BONUSES: Record<FactionId, string> = {
  [FactionId.GEOFORGE]: "Start with extra Credits. +10% Defense to all monsters. Base located in Mountainous regions.",
  [FactionId.BIOGENESIS]: "Start with extra Biomass. +10% HP to all monsters. Base located in Bio-rich Forests.",
  [FactionId.AETHER_VANGUARD]: "Start with extra Mana. +10% Intelligence to all monsters. Base located in Energetic Wastelands."
};

export const BUILDINGS_CATALOG: Omit<Building, 'id' | 'level'>[] = [
  {
    name: "Bio-Reactor",
    type: "resource",
    cost: { credits: 150, research: 10 }, // No research cost initially to avoid softlock
    production: { biomass: 5 },
    description: "Generates Biomass from organic waste."
  },
  {
    name: "Mana Pylon",
    type: "resource",
    cost: { credits: 200, biomass: 50 },
    production: { mana: 3 },
    description: "Harvests ambient magical energy."
  },
  {
    name: "Mining Rig",
    type: "resource",
    cost: { credits: 200, biomass: 20 },
    production: { credits: 5 },
    description: "Extracts valuable minerals."
  },
  {
    name: "Research Lab",
    type: "lab",
    cost: { credits: 300, mana: 20 },
    production: { research: 2 },
    description: "Generates Research points. Allows advanced bio-synthesis."
  },
  {
    name: "Training Dojo",
    type: "training",
    cost: { credits: 250, biomass: 100 },
    description: "Allows training of monsters to increase stats."
  },
  {
    name: "Drone Hub",
    type: "defense",
    cost: { credits: 400, research: 50 },
    description: "Unlocks the ability to Capture wild monsters detected on the map."
  }
];

export const ELEMENT_COLORS: Record<ElementType, string> = {
  [ElementType.PYRO]: "text-red-500 border-red-500 bg-red-900/20",
  [ElementType.HYDRO]: "text-blue-500 border-blue-500 bg-blue-900/20",
  [ElementType.GEO]: "text-amber-600 border-amber-600 bg-amber-900/20",
  [ElementType.AERO]: "text-teal-400 border-teal-400 bg-teal-900/20",
  [ElementType.CHRONO]: "text-purple-500 border-purple-500 bg-purple-900/20",
  [ElementType.BIO]: "text-green-500 border-green-500 bg-green-900/20",
};

export const BIOME_COLORS: Record<BiomeType, [string, string]> = {
  Volcanic: ['#450a0a', '#b91c1c'], // Red 950 to Red 700
  Oceanic: ['#0f172a', '#1d4ed8'], // Slate 900 to Blue 700
  Mountain: ['#1c1917', '#57534e'], // Stone 900 to Stone 600
  Tundra: ['#172554', '#60a5fa'], // Blue 950 to Blue 400
  Forest: ['#052e16', '#15803d'], // Green 950 to Green 700
  Desert: ['#422006', '#a16207'], // Yellow 950 to Yellow 700
  Wasteland: ['#2e1065', '#7e22ce'], // Violet 950 to Violet 700
};

export const MAP_RADIUS = 4;

// --- Hex Utils ---
export const getHexNeighborCoords = (q: number, r: number) => {
  return [
    { q: q + 1, r: r - 1 }, { q: q + 1, r: r }, { q: q, r: r + 1 },
    { q: q - 1, r: r + 1 }, { q: q - 1, r: r }, { q: q, r: r - 1 }
  ];
};

export const getHexId = (q: number, r: number) => `${q},${r}`;

// --- Anatomy Constants ---
export const ANATOMY_PARTS = {
  TRUNKS: ['Humanoid', 'Bestial', 'Insectoid', 'Amorphous', 'Serpentine', 'Avian', 'Mechanical', 'Plantoid'],
  HEADS: ['Reptilian', 'Canine', 'Insectoid', 'Featureless', 'Horned', 'Glowing', 'Skull', 'Floral'],
  APPENDAGES: ['Wings', 'Claws', 'Tentacles', 'Cybernetic Arms', 'Fins', 'Spikes', 'Vines', 'Jets']
};

export const SPELLS: Spell[] = [
  { 
    id: 'alch_transmute', 
    name: "Alchemical Transmutation", 
    description: "Convert 50 Mana into 100 Credits.", 
    cost: { mana: 50 }, 
    effect: { credits: 100 },
    targetRequired: false 
  },
  { 
    id: 'verdant_surge', 
    name: "Verdant Surge", 
    description: "Accelerate growth. 40 Mana -> 80 Biomass.", 
    cost: { mana: 40 }, 
    effect: { biomass: 80 },
    targetRequired: false 
  },
  { 
    id: 'blood_rite', 
    name: "Crimson Rite", 
    description: "Drain 20 HP from a creature to gain 40 Mana.", 
    cost: { hp: 20 }, 
    effect: { mana: 40 },
    targetRequired: true 
  },
  { 
    id: 'enrage', 
    name: "Feral Rage", 
    description: "+20 Attack for the next battle.", 
    cost: { mana: 30 }, 
    buff: { stat: 'attack', value: 20, name: 'Enraged' },
    targetRequired: true 
  },
  { 
    id: 'stone_skin', 
    name: "Stone Skin", 
    description: "+20 Defense for the next battle.", 
    cost: { mana: 30 }, 
    buff: { stat: 'defense', value: 20, name: 'Armored' },
    targetRequired: true 
  },
  { 
    id: 'haste', 
    name: "Temporal Haste", 
    description: "+20 Speed for the next battle.", 
    cost: { mana: 30 }, 
    buff: { stat: 'speed', value: 20, name: 'Quickened' },
    targetRequired: true 
  },
  {
    id: 'heal_minor',
    name: 'Minor Regeneration',
    description: "Restore 30 HP.",
    cost: { mana: 25 },
    effect: {}, // handled in reducer custom logic often, or add heal effect to Type
    targetRequired: true
  }
];

export const TROPHIES: Trophy[] = [
    { id: 'bronze_cup', name: "Novice Cup", description: "Winner of a Regional Skirmish.", bonus: "+5 Credits/tick", icon: "Trophy" },
    { id: 'silver_shield', name: "Iron Shield", description: "Survivor of the Badlands Tournament.", bonus: "+10% Defense to all", icon: "Shield" },
    { id: 'gold_crown', name: "Chimera Crown", description: "Champion of the Planetary League.", bonus: "+20% Attack to all", icon: "Crown" },
];

export const TYPE_CHART: Record<ElementType, string[]> = {
    [ElementType.PYRO]: [ElementType.BIO, ElementType.AERO], // Strong against
    [ElementType.HYDRO]: [ElementType.PYRO, ElementType.GEO],
    [ElementType.GEO]: [ElementType.AERO, ElementType.CHRONO], // Simplified
    [ElementType.AERO]: [ElementType.BIO, ElementType.HYDRO],
    [ElementType.CHRONO]: [ElementType.HYDRO, ElementType.PYRO],
    [ElementType.BIO]: [ElementType.GEO, ElementType.CHRONO]
};

// Mapping anatomy to battle modifiers
export const ANATOMY_MODIFIERS: Record<string, { stat: keyof Stats; mod: number; desc: string }> = {
    'Wings': { stat: 'speed', mod: 1.2, desc: 'High Evasion' },
    'Jets': { stat: 'speed', mod: 1.3, desc: 'Extreme Speed' },
    'Claws': { stat: 'attack', mod: 1.15, desc: 'Rending Dmg' },
    'Spikes': { stat: 'defense', mod: 1.1, desc: 'Thorns' },
    'Shell': { stat: 'defense', mod: 1.25, desc: 'Armored' },
    'Tentacles': { stat: 'intelligence', mod: 1.1, desc: 'Grapple' },
};

export const RIVAL_NAMES = [
  "Shadow Syndicate",
  "Iron Legion",
  "Crimson Raiders",
  "Void Walkers",
  "Solar Sentinels",
  "Lunar Cult",
  "Toxic Avengers",
  "Cyber Psychos"
];
