
import React, { useState } from 'react';
import { Monster, Stats, Resources } from '../types';
import { ELEMENT_COLORS } from '../constants';
import { Heart, Shield, Sword, Brain, Activity, Dna, Sparkles, Leaf, Zap } from 'lucide-react';

interface MonsterCardProps {
  monster: Monster;
  onTrain?: (id: string, stat: keyof Stats) => void;
  canTrain?: boolean;
  trainingCosts?: Record<keyof Stats, Partial<Resources>>;
}

const StatBar: React.FC<{ icon: React.ReactNode; label: string; value: number; max?: number; color: string; buffValue?: number }> = ({ icon, label, value, max = 100, color, buffValue = 0 }) => (
  <div className="flex items-center gap-2 text-xs mb-1">
    <div className={`w-5 h-5 rounded flex items-center justify-center ${color} bg-opacity-20`}>
        {React.cloneElement(icon as React.ReactElement, { size: 12 })}
    </div>
    <span className="w-8 font-mono text-slate-400">{label}</span>
    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden relative">
      <div 
        className={`h-full rounded-full ${color} transition-all`} 
        style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
      />
      {buffValue > 0 && (
           <div 
           className={`absolute top-0 h-full bg-yellow-400 opacity-50 animate-pulse`} 
           style={{ left: `${Math.min((value / max) * 100, 100)}%`, width: `${Math.min((buffValue / max) * 100, 100)}%` }}
         />
      )}
    </div>
    <span className="font-bold w-6 text-right flex justify-end gap-1">
        {value}
        {buffValue > 0 && <span className="text-yellow-400 text-[10px] leading-none">+{buffValue}</span>}
    </span>
  </div>
);

const MonsterCard: React.FC<MonsterCardProps> = ({ monster, onTrain, canTrain, trainingCosts }) => {
  const [view, setView] = useState<'stats' | 'body'>('stats');
  const themeClass = ELEMENT_COLORS[monster.element];

  // Helper to get active buff value for a stat
  const getBuff = (stat: keyof Stats) => monster.activeBuffs?.filter(b => b.stat === stat).reduce((acc, curr) => acc + curr.value, 0) || 0;

  return (
    <div className={`relative bg-slate-800 border-2 rounded-xl p-4 transition-all hover:scale-[1.02] hover:shadow-xl ${themeClass} bg-opacity-10 h-full flex flex-col`}>
      <div className="flex justify-between items-start mb-2">
        <div>
            <span className={`text-[10px] font-bold uppercase tracking-widest border px-1.5 py-0.5 rounded ${themeClass.split(' ')[0]} ${themeClass.split(' ')[1]}`}>
                {monster.element}
            </span>
            <h3 className="text-lg font-bold font-orbitron mt-1 truncate">{monster.name}</h3>
        </div>
        <div className="text-right">
             <span className="text-xs text-slate-400">LVL</span>
             <div className="text-xl font-mono leading-none">{monster.level}</div>
        </div>
      </div>
      
      <div className="w-full h-24 bg-slate-900 rounded-lg mb-3 overflow-hidden flex items-center justify-center relative group shrink-0">
         <img 
            src={`https://picsum.photos/seed/${monster.id}/200/200`} 
            alt={monster.name}
            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
         />
         <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
         {monster.activeBuffs && monster.activeBuffs.length > 0 && (
             <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                 {monster.activeBuffs.map((b, i) => (
                     <span key={i} className="text-[10px] bg-yellow-500/20 border border-yellow-500 text-yellow-200 px-1 rounded backdrop-blur-md flex items-center gap-1">
                         <Sparkles size={8} /> {b.name}
                     </span>
                 ))}
             </div>
         )}
      </div>

      <div className="flex gap-2 mb-3 border-b border-slate-700/50 pb-2">
          <button 
            onClick={() => setView('stats')}
            className={`flex-1 text-xs py-1 rounded flex items-center justify-center gap-1 ${view === 'stats' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
              <Activity size={12} /> Stats
          </button>
          <button 
            onClick={() => setView('body')}
            className={`flex-1 text-xs py-1 rounded flex items-center justify-center gap-1 ${view === 'body' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
              <Dna size={12} /> Body Chart
          </button>
      </div>

      <div className="flex-1">
        {view === 'stats' ? (
            <>
                <p className="text-xs text-slate-400 italic mb-4 h-8 overflow-hidden line-clamp-2">
                    "{monster.description}"
                </p>

                <div className="space-y-1 mb-4">
                    <StatBar icon={<Heart />} label="HP" value={monster.currentHp} max={monster.maxHp} color="bg-green-500" />
                    <StatBar icon={<Sword />} label="ATK" value={monster.stats.attack} buffValue={getBuff('attack')} max={200} color="bg-red-500" />
                    <StatBar icon={<Shield />} label="DEF" value={monster.stats.defense} buffValue={getBuff('defense')} max={200} color="bg-blue-500" />
                    <StatBar icon={<Activity />} label="SPD" value={monster.stats.speed} buffValue={getBuff('speed')} max={200} color="bg-yellow-500" />
                    <StatBar icon={<Brain />} label="INT" value={monster.stats.intelligence} buffValue={getBuff('intelligence')} max={200} color="bg-purple-500" />
                </div>
            </>
        ) : (
            <div className="space-y-3">
                 <div className="bg-slate-900/50 p-2 rounded">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Trunk Type</span>
                    <span className="text-sm font-mono text-slate-200">{monster.anatomy?.trunk || 'Unknown'}</span>
                 </div>
                 <div className="bg-slate-900/50 p-2 rounded">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Head Morphology</span>
                    <span className="text-sm font-mono text-slate-200">{monster.anatomy?.head || 'Unknown'}</span>
                 </div>
                 <div className="bg-slate-900/50 p-2 rounded">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Appendages</span>
                    <div className="flex flex-wrap gap-1">
                        {monster.anatomy?.appendages?.map((app, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded bg-slate-700 text-teal-300">{app}</span>
                        )) || <span className="text-xs text-slate-500">None</span>}
                    </div>
                 </div>
                 <div className="mt-2">
                     <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Genetic Traits</span>
                     <div className="flex flex-wrap gap-1">
                         {monster.traits.map(t => (
                             <span key={t} className="text-[10px] border border-slate-600 px-1.5 rounded text-slate-400">{t}</span>
                         ))}
                     </div>
                 </div>
            </div>
        )}
      </div>

      {canTrain && onTrain && view === 'stats' && (
        <div className="grid grid-cols-2 gap-2 mt-2">
             <button onClick={() => onTrain(monster.id, 'attack')} className="flex flex-col items-center justify-center text-[10px] bg-red-900/40 hover:bg-red-900/60 text-red-200 py-1.5 rounded border border-red-900/50 transition-colors">
                 <span className="font-bold">Train ATK</span>
                 {trainingCosts && trainingCosts.attack && (
                     <div className="flex gap-1 mt-0.5 opacity-80">
                         <span className="flex items-center gap-0.5"><Leaf size={8}/>{trainingCosts.attack.biomass}</span>
                         <span className="flex items-center gap-0.5"><Zap size={8}/>{trainingCosts.attack.mana}</span>
                     </div>
                 )}
             </button>
             <button onClick={() => onTrain(monster.id, 'defense')} className="flex flex-col items-center justify-center text-[10px] bg-blue-900/40 hover:bg-blue-900/60 text-blue-200 py-1.5 rounded border border-blue-900/50 transition-colors">
                 <span className="font-bold">Train DEF</span>
                 {trainingCosts && trainingCosts.defense && (
                     <div className="flex gap-1 mt-0.5 opacity-80">
                         <span className="flex items-center gap-0.5"><Leaf size={8}/>{trainingCosts.defense.biomass}</span>
                         <span className="flex items-center gap-0.5"><Zap size={8}/>{trainingCosts.defense.mana}</span>
                     </div>
                 )}
             </button>
              <button onClick={() => onTrain(monster.id, 'speed')} className="flex flex-col items-center justify-center text-[10px] bg-yellow-900/40 hover:bg-yellow-900/60 text-yellow-200 py-1.5 rounded border border-yellow-900/50 transition-colors">
                 <span className="font-bold">Train SPD</span>
                 {trainingCosts && trainingCosts.speed && (
                     <div className="flex gap-1 mt-0.5 opacity-80">
                         <span className="flex items-center gap-0.5"><Leaf size={8}/>{trainingCosts.speed.biomass}</span>
                         <span className="flex items-center gap-0.5"><Zap size={8}/>{trainingCosts.speed.mana}</span>
                     </div>
                 )}
             </button>
              <button onClick={() => onTrain(monster.id, 'intelligence')} className="flex flex-col items-center justify-center text-[10px] bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 py-1.5 rounded border border-purple-900/50 transition-colors">
                 <span className="font-bold">Train INT</span>
                 {trainingCosts && trainingCosts.intelligence && (
                     <div className="flex gap-1 mt-0.5 opacity-80">
                         <span className="flex items-center gap-0.5"><Leaf size={8}/>{trainingCosts.intelligence.biomass}</span>
                         <span className="flex items-center gap-0.5"><Zap size={8}/>{trainingCosts.intelligence.mana}</span>
                     </div>
                 )}
             </button>
        </div>
      )}
    </div>
  );
};

export default MonsterCard;
