import React from 'react';
import { useDrawingContext, Point } from '../context/DrawingContext';
import { MousePointer2, Layers, Grid, ZoomIn, Box, CloudOff } from 'lucide-react';

interface StatusBarProps {
  cursorPosition: Point;
}

export function StatusBar({ cursorPosition }: StatusBarProps) {
  const { state, saveStatus } = useDrawingContext();

  const formatCoordinate = (value: number) => {
    return value.toFixed(2);
  };

  const saveStatusConfig = {
    unsaved: { icon: <CloudOff size={11} />, text: 'Unsaved — Click Save', color: 'text-orange-400', dot: 'bg-orange-500', pulse: true },
  };

  const status = saveStatusConfig[saveStatus];

  return (
    <div className="w-full glass-panel rounded-t-2xl px-2 sm:px-4 py-1 flex items-center justify-between text-[10px] text-white/80 shadow-lg border-t border-x border-white/10 backdrop-blur-xl min-h-8">
      <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
        <div className="flex items-center space-x-1.5 group">
          <MousePointer2 size={12} className="text-[#cc8bed]" />
          <span className="font-medium capitalize group-hover:text-white transition-colors">{state.currentTool}</span>
        </div>

        <div className="hidden sm:block w-px h-3 bg-white/10"></div>

        <div className="hidden md:flex items-center space-x-1.5 group">
          <Layers size={12} className="text-[#cc8bed]" />
          <span className="font-medium group-hover:text-white transition-colors max-w-[80px] truncate">
            {state.layers.find(l => l.id === state.currentLayerId)?.name || 'Unknown'}
          </span>
        </div>

        <div className="hidden md:block w-px h-3 bg-white/10"></div>

        <div className="hidden lg:flex items-center space-x-1.5 group">
          <Grid size={12} className={state.snapToGrid ? "text-[#cc8bed]" : "text-white/40"} />
          <span className="font-medium group-hover:text-white transition-colors">
            {state.gridSize} {state.units}
          </span>
          <span className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${state.snapToGrid ? 'bg-[#cc8bed]/20 text-[#cc8bed]' : 'bg-white/5 text-white/40'}`}>
            {state.snapToGrid ? 'Snap' : 'Off'}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
        <div className={`flex items-center space-x-1.5 group ${status.color}`} title="Save your work before leaving">
          <div className={`w-1.5 h-1.5 rounded-full ${status.dot} ${status.pulse ? 'animate-pulse' : ''}`}></div>
          {status.icon}
          <span className="font-medium text-[10px] max-w-[90px] sm:max-w-[110px] truncate">{status.text}</span>
        </div>

        <div className="hidden sm:block w-px h-3 bg-white/10"></div>

        <div className="hidden sm:flex items-center space-x-1.5 group">
          <ZoomIn size={12} className="text-[#cc8bed]" />
          <span className="font-medium group-hover:text-white transition-colors">{(state.zoom * 100).toFixed(0)}%</span>
        </div>

        <div className="hidden md:block w-px h-3 bg-white/10"></div>

        <div className="hidden md:flex items-center space-x-1.5 group">
          <Box size={12} className="text-[#cc8bed]" />
          <span className="font-medium group-hover:text-white transition-colors">{state.elements.length} Obj</span>
        </div>

        <div className="hidden lg:block w-px h-3 bg-white/10"></div>

        <div className="hidden lg:flex items-center space-x-3 font-mono text-[10px] bg-black/20 px-2 py-0.5 rounded-md border border-white/5">
          <div className="flex items-center space-x-1.5">
            <span className="text-[#cc8bed] font-bold">X</span>
            <span className="w-10 text-right text-white">
              {formatCoordinate(cursorPosition.x)}
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-[#cc8bed] font-bold">Y</span>
            <span className="w-10 text-right text-white">
              {formatCoordinate(cursorPosition.y)}
            </span>
          </div>
          <span className="text-white/40">{state.units}</span>
        </div>
      </div>
    </div>
  );
}