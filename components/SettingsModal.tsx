
import React from 'react';
import { X, Type } from 'lucide-react';
import { GameSettings } from '../types';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdate: (newSettings: Partial<GameSettings>) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onUpdate, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-xl shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <h2 className="text-2xl font-orbitron text-white tracking-wider">System Settings</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
              <Type size={16} /> Interface Text Size
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => onUpdate({ textSize: 'small' })}
                className={`py-3 px-4 rounded border transition-all text-sm ${
                  settings.textSize === 'small' 
                  ? 'bg-teal-600 border-teal-500 text-white font-bold' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                Small
              </button>
              <button 
                onClick={() => onUpdate({ textSize: 'medium' })}
                className={`py-3 px-4 rounded border transition-all text-base ${
                  settings.textSize === 'medium' 
                  ? 'bg-teal-600 border-teal-500 text-white font-bold' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                Medium
              </button>
              <button 
                onClick={() => onUpdate({ textSize: 'large' })}
                className={`py-3 px-4 rounded border transition-all text-lg ${
                  settings.textSize === 'large' 
                  ? 'bg-teal-600 border-teal-500 text-white font-bold' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                Large
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-500 italic">
                Adjusts the global font scaling for the entire application interface.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
