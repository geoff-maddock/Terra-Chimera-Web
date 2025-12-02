import React from 'react';
import { Resources } from '../types';
import { CircleDollarSign, Leaf, Zap, Microscope } from 'lucide-react';

interface ResourceBarProps {
  resources: Resources;
}

const ResourceBar: React.FC<ResourceBarProps> = ({ resources }) => {
  return (
    <div className="bg-slate-900 border-b border-slate-700 p-4 flex flex-wrap gap-6 items-center justify-between sticky top-0 z-10 shadow-lg">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded bg-yellow-500/20 flex items-center justify-center text-yellow-500">
          <CircleDollarSign size={20} />
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase font-bold">Credits</p>
          <p className="text-xl font-mono font-bold">{Math.floor(resources.credits)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded bg-green-500/20 flex items-center justify-center text-green-500">
          <Leaf size={20} />
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase font-bold">Biomass</p>
          <p className="text-xl font-mono font-bold">{Math.floor(resources.biomass)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center text-blue-500">
          <Zap size={20} />
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase font-bold">Mana</p>
          <p className="text-xl font-mono font-bold">{Math.floor(resources.mana)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center text-purple-500">
          <Microscope size={20} />
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase font-bold">Research</p>
          <p className="text-xl font-mono font-bold">{Math.floor(resources.research)}</p>
        </div>
      </div>
    </div>
  );
};

export default ResourceBar;