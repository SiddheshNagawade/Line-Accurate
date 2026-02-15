import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Plus, Trash2, Layers } from 'lucide-react';
import { useDrawingContext, Layer } from '../context/DrawingContext';

export function LayerPanel() {
  const { state, dispatch } = useDrawingContext();
  const [newLayerName, setNewLayerName] = useState('');

  const handleAddLayer = () => {
    if (newLayerName.trim()) {
      const newLayer: Layer = {
        id: `layer-${Date.now()}`,
        name: newLayerName.trim(),
        visible: true,
        locked: false,
        color: '#ffffff',
      };
      dispatch({ type: 'ADD_LAYER', layer: newLayer });
      setNewLayerName('');
    }
  };

  const handleDeleteLayer = (layerId: string) => {
    if (state.layers.length <= 1) return; // prevent deleting last layer
    dispatch({ type: 'DELETE_LAYER', id: layerId });
  };

  const toggleLayerVisibility = (layerId: string) => {
    const layer = state.layers.find(l => l.id === layerId);
    if (layer) {
      dispatch({
        type: 'UPDATE_LAYER',
        id: layerId,
        layer: { visible: !layer.visible },
      });
    }
  };

  const toggleLayerLock = (layerId: string) => {
    const layer = state.layers.find(l => l.id === layerId);
    if (layer) {
      dispatch({
        type: 'UPDATE_LAYER',
        id: layerId,
        layer: { locked: !layer.locked },
      });
    }
  };

  const setCurrentLayer = (layerId: string) => {
    const layer = state.layers.find(l => l.id === layerId);
    if (layer && !layer.locked) {
      dispatch({ type: 'SET_CURRENT_LAYER', id: layerId });
    }
  };

  return (
    <div className="h-full flex flex-col text-white">
      <div className="p-5 border-b border-white/10 flex items-center space-x-3">
        <div className="p-2 bg-[#cc8bed]/20 rounded-lg text-[#cc8bed]">
          <Layers size={20} />
        </div>
        <h3 className="font-semibold text-lg tracking-wide">Layers</h3>
      </div>
      
      <div className="p-4 border-b border-white/10 bg-white/5">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            placeholder="New layer name..."
            className="flex-1 px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-[#cc8bed]/50 focus:ring-1 focus:ring-[#cc8bed]/50 placeholder-white/30 transition-all"
            onKeyPress={(e) => e.key === 'Enter' && handleAddLayer()}
          />
          <button
            onClick={handleAddLayer}
            disabled={!newLayerName.trim()}
            className="px-4 py-2.5 bg-[#cc8bed] hover:bg-[#b070d0] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all duration-200 text-white shadow-lg hover:shadow-[#cc8bed]/20 active:scale-95"
            title="Add Layer"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {state.layers.map((layer) => (
          <div
            key={layer.id}
            className={`group relative p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
              state.currentLayerId === layer.id
                ? 'bg-[#cc8bed]/20 border-[#cc8bed]/30 shadow-[0_0_15px_-5px_rgba(204,139,237,0.3)]'
                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
            }`}
            onClick={() => setCurrentLayer(layer.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div
                  className={`w-3 h-3 rounded-full shadow-sm ${state.currentLayerId === layer.id ? 'ring-2 ring-white/20' : ''}`}
                  style={{ backgroundColor: layer.color }}
                />
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm font-medium truncate ${layer.locked ? 'text-white/50' : 'text-white/90'}`}>
                    {layer.name}
                  </span>
                  <span className="text-[10px] text-white/40">
                    {state.elements.filter(el => el.layerId === layer.id).length} objects
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-1 opacity-60 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLayerVisibility(layer.id);
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${
                    layer.visible ? 'hover:bg-white/10 text-white/80' : 'bg-white/10 text-white/40'
                  }`}
                  title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                >
                  {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLayerLock(layer.id);
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${
                    !layer.locked ? 'hover:bg-white/10 text-white/80' : 'bg-white/10 text-[#cc8bed]'
                  }`}
                  title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
                >
                  {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>

                {state.layers.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLayer(layer.id);
                    }}
                    className="p-1.5 hover:bg-red-500/20 hover:text-red-400 text-white/40 rounded-lg transition-colors"
                    title="Delete Layer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            
            {state.currentLayerId === layer.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#cc8bed] rounded-r-full shadow-[0_0_10px_rgba(204,139,237,0.5)]"></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}