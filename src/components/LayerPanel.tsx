import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Plus, Trash2, Layers } from 'lucide-react';
import { useDrawingSelector, useDrawingDispatch, Layer } from '../context/DrawingContext';
import { ListItem, IconHeader, InputGroup } from './ui';

export function LayerPanel() {
  const layers = useDrawingSelector(s => s.layers);
  const currentLayerId = useDrawingSelector(s => s.currentLayerId);
  const elementCountByLayer = useDrawingSelector(s => {
    const counts: Record<string, number> = {};
    s.elements.forEach(el => { counts[el.layerId] = (counts[el.layerId] ?? 0) + 1; });
    return counts;
  });
  const dispatch = useDrawingDispatch();
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
    if (layers.length <= 1) return; // prevent deleting last layer
    dispatch({ type: 'DELETE_LAYER', id: layerId });
  };

  const toggleLayerVisibility = (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (layer) {
      dispatch({
        type: 'UPDATE_LAYER',
        id: layerId,
        layer: { visible: !layer.visible },
      });
    }
  };

  const toggleLayerLock = (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (layer) {
      dispatch({
        type: 'UPDATE_LAYER',
        id: layerId,
        layer: { locked: !layer.locked },
      });
    }
  };

  const setCurrentLayer = (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (layer && !layer.locked) {
      dispatch({ type: 'SET_CURRENT_LAYER', id: layerId });
    }
  };

  return (
    <div className="h-full flex flex-col text-white">
      <IconHeader 
        icon={<Layers size={20} />}
        title="Layers"
      />
      
      <InputGroup 
        placeholder="New layer name..."
        value={newLayerName}
        onChange={setNewLayerName}
        onSubmit={handleAddLayer}
        buttonIcon={<Plus size={18} />}
        buttonDisabled={!newLayerName.trim()}
        buttonTitle="Add Layer"
      />

      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {layers.map((layer) => (
          <ListItem
            key={layer.id}
            active={currentLayerId === layer.id}
            onClick={() => setCurrentLayer(layer.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div
                  className={`w-3 h-3 rounded-full shadow-sm ${currentLayerId === layer.id ? 'ring-2 ring-white/20' : ''}`}
                  style={{ backgroundColor: layer.color }}
                />
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm font-medium truncate ${layer.locked ? 'text-white/50' : 'text-white/90'}`}>
                    {layer.name}
                  </span>
                  <span className="text-[10px] text-white/40">
                    {elementCountByLayer[layer.id] ?? 0} objects
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

                {layers.length > 1 && (
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
            
            {currentLayerId === layer.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#cc8bed] rounded-r-full shadow-[0_0_10px_rgba(204,139,237,0.5)]"></div>
            )}
          </ListItem>
        ))}
      </div>
    </div>
  );
}