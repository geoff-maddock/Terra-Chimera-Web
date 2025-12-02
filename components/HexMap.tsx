
import React from 'react';
import { HexTile, FactionId, Building } from '../types';
import { BIOME_COLORS, getHexNeighborCoords, getHexId } from '../constants';
import { Building2, Trophy, Skull, Eye, Leaf, Zap, Pickaxe, Microscope, Swords, PawPrint, Radar } from 'lucide-react';

interface HexMapProps {
  map: Record<string, HexTile>;
  buildings: Building[];
  selectedHexId: string | null;
  onHexClick: (hex: HexTile) => void;
  playerFaction: FactionId;
}

const getBuildingIcon = (name: string) => {
    switch (name) {
        case 'Bio-Reactor': return Leaf;
        case 'Mana Pylon': return Zap;
        case 'Mining Rig': return Pickaxe;
        case 'Research Lab': return Microscope;
        case 'Training Dojo': return Swords;
        case 'Drone Hub': return Radar;
        default: return Building2;
    }
};

const Hexagon: React.FC<{
  hex: HexTile;
  building?: Building;
  size: number;
  isSelected: boolean;
  onClick: () => void;
  playerFaction: FactionId;
  isExplorable: boolean;
}> = ({ hex, building, size, isSelected, onClick, playerFaction, isExplorable }) => {
  // Pointy top hexagon calculations
  const width = Math.sqrt(3) * size;
  const height = 2 * size;
  
  // Center coordinates
  const x = size * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
  const y = size * (3 / 2 * hex.r);

  // Generate points
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle_deg = 60 * i - 30;
    const angle_rad = Math.PI / 180 * angle_deg;
    points.push(`${x + size * Math.cos(angle_rad)},${y + size * Math.sin(angle_rad)}`);
  }

  const gradientId = `grad-${hex.id}`;
  const isVisible = hex.isExplored;

  // Visual Logic
  let fill = '#020617'; // Default Slate 950 (Fog of War)
  let strokeColor = '#1e293b'; // Default Slate 800
  let strokeWidth = 1;

  if (isVisible) {
      fill = BIOME_COLORS[hex.biomes[0]][0];
      if (hex.biomes.length > 1) {
        fill = `url(#${gradientId})`;
      }
      strokeColor = hex.owner ? '#fbbf24' : '#475569'; // Amber if owned, Slate 600 if neutral
  } else if (isExplorable) {
      strokeColor = '#2dd4bf'; // Teal highlight for explorable
      strokeWidth = 2;
  }

  if (isSelected) {
      strokeColor = '#f8fafc'; // White selection
      strokeWidth = 3;
  }

  const BuildingIcon = building ? getBuildingIcon(building.name) : Building2;
  const iconSize = building ? 14 + (Math.min(building.level, 3) * 2) : 20;

  return (
    <g onClick={onClick} className={`cursor-pointer transition-all ${isExplorable && !isVisible ? 'hover:opacity-100' : 'hover:opacity-90'}`}>
       {isVisible && hex.biomes.length > 1 && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {hex.biomes.map((b, i) => (
              <stop 
                key={i} 
                offset={`${(i / (hex.biomes.length - 1)) * 100}%`} 
                stopColor={BIOME_COLORS[b][0]} 
              />
            ))}
          </linearGradient>
        </defs>
      )}
      
      <polygon
        points={points.join(' ')}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        className="transition-all duration-300"
      />
      
      {/* Fog of War / Explorable Indicator */}
      {!isVisible && (
          <g transform={`translate(${x}, ${y})`}>
              {isExplorable ? (
                  <Eye size={12} className="text-teal-500/50" x="-6" y="-6" />
              ) : (
                  <text x="0" y="0" textAnchor="middle" dy=".3em" fontSize="10" fill="#1e293b" className="select-none">?</text>
              )}
          </g>
      )}

      {/* Visible Content */}
      {isVisible && (
        <g transform={`translate(${x}, ${y})`}>
           {hex.buildingId && building && (
               <foreignObject x="-15" y="-15" width="30" height="30" className="pointer-events-none flex flex-col items-center justify-center">
                   <div className="relative flex flex-col items-center">
                        <BuildingIcon 
                            size={iconSize} 
                            className={`${hex.owner === playerFaction ? "text-teal-400" : "text-red-500"} drop-shadow-md`} 
                            strokeWidth={2.5}
                        />
                        {/* Level Indicators (Pips) */}
                        <div className="flex gap-0.5 mt-0.5">
                            {Array.from({length: building.level}).map((_, i) => (
                                <div 
                                    key={i} 
                                    className={`w-1 h-1 rounded-full ${hex.owner === playerFaction ? "bg-teal-200" : "bg-red-200"} shadow-sm`} 
                                />
                            ))}
                        </div>
                   </div>
               </foreignObject>
           )}
           
           {/* Fallback if building ID exists but building data missing (shouldn't happen) */}
           {hex.buildingId && !building && (
                <foreignObject x="-10" y="-10" width="20" height="20" className="pointer-events-none">
                     <Building2 size={20} className={hex.owner === playerFaction ? "text-teal-400" : "text-red-500"} />
                </foreignObject>
           )}
           
           {/* Wild Monster Indicator */}
           {hex.wildMonsterId && !hex.buildingId && (
               <foreignObject x="-10" y="-10" width="20" height="20" className="pointer-events-none">
                    <PawPrint size={20} className="text-orange-400 animate-bounce" />
               </foreignObject>
           )}

           {hex.hasTournament && !hex.buildingId && !hex.wildMonsterId && (
               <foreignObject x="-10" y="-10" width="20" height="20" className="pointer-events-none">
                   <Trophy size={20} className="text-yellow-400 animate-pulse" />
               </foreignObject>
           )}
           {hex.owner && hex.owner !== playerFaction && !hex.buildingId && (
                <foreignObject x="-10" y="-10" width="20" height="20" className="pointer-events-none">
                    <Skull size={20} className="text-red-500 opacity-50" />
                </foreignObject>
           )}
        </g>
      )}
    </g>
  );
};

const HexMap: React.FC<HexMapProps> = ({ map, buildings, selectedHexId, onHexClick, playerFaction }) => {
  const hexSize = 35;
  
  // Helper to determine if a hex is adjacent to ANY explored hex
  const isExplorable = (hex: HexTile): boolean => {
      if (hex.isExplored) return false;
      const neighbors = getHexNeighborCoords(hex.q, hex.r);
      return neighbors.some(n => {
          const id = getHexId(n.q, n.r);
          return map[id]?.isExplored;
      });
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden relative">
      <svg 
        viewBox="-250 -220 500 440" 
        className="w-full h-full max-w-4xl max-h-[80vh] select-none"
        style={{ filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' }}
      >
        <g>
          {Object.values(map).map((hex: HexTile) => (
            <Hexagon
              key={hex.id}
              hex={hex}
              building={hex.buildingId ? buildings.find(b => b.id === hex.buildingId) : undefined}
              size={hexSize}
              isSelected={selectedHexId === hex.id}
              onClick={() => onHexClick(hex)}
              playerFaction={playerFaction}
              isExplorable={isExplorable(hex)}
            />
          ))}
        </g>
      </svg>
      
      <div className="absolute bottom-4 left-4 text-xs text-slate-500 font-mono pointer-events-none bg-black/50 p-2 rounded">
          <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-teal-500/20 border border-teal-500 rounded-sm"></div> Explorable</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-900 border border-slate-800 rounded-sm"></div> Unknown</div>
      </div>
    </div>
  );
};

export default HexMap;
