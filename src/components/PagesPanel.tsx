import React, { useState, useRef } from 'react';
import { useDrawingContext } from '../context/DrawingContext';
import { Plus, Trash2, FileText, Star, Copy, Search, X } from 'lucide-react';

export function PagesPanel() {
  const { state, dispatch } = useDrawingContext();
  const [draggedPage, setDraggedPage] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  const dragOverIndexRef = useRef<number | null>(null);

  const handleSelect = (page: number) => {
    dispatch({ type: 'SET_CURRENT_PAGE', page });
  };

  const handleDelete = (page: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (state.totalPages <= 1) return;
    if (confirm(`Delete Page ${page}?`)) {
      dispatch({ type: 'DELETE_PAGE', page });
    }
  };

  const handleDuplicate = (page: number, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'DUPLICATE_PAGE', page });
  };

  const handleBookmark = (page: number, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'BOOKMARK_PAGE', page });
  };

  const handleAdd = () => {
    dispatch({ type: 'ADD_PAGE' });
  };

  const handleDragStart = (page: number) => {
    setDraggedPage(page);
  };

  const handleDragOver = (e: React.DragEvent, targetPage: number) => {
    e.preventDefault();
    dragOverIndexRef.current = targetPage;
  };

  const handleDrop = (e: React.DragEvent, targetPage: number) => {
    e.preventDefault();
    if (draggedPage !== null && draggedPage !== targetPage) {
      dispatch({ 
        type: 'REORDER_PAGES', 
        fromIndex: draggedPage - 1, 
        toIndex: targetPage - 1 
      });
    }
    setDraggedPage(null);
    dragOverIndexRef.current = null;
  };

  const handleDragEnd = () => {
    setDraggedPage(null);
    dragOverIndexRef.current = null;
  };

  // Approximate thumbnail aspect ratio for A4 portrait
  const thumbWidth = 64;
  const thumbHeight = Math.round(thumbWidth * (297 / 210));

  // Filter pages
  const pages = Array.from({ length: state.totalPages }, (_, i) => i + 1);
  const filteredPages = pages.filter(page => {
    const matchesSearch = searchQuery === '' || `Page ${page}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBookmark = !filterBookmarked || state.bookmarkedPages.has(page);
    return matchesSearch && matchesBookmark;
  });

  // Stats
  const bookmarkCount = state.bookmarkedPages.size;

  return (
    <div className="h-full flex flex-col text-white">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#cc8bed]/20 rounded-lg text-[#cc8bed]">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-lg tracking-wide">Pages</h3>
              <p className="text-xs text-white/40">{state.totalPages} total · {bookmarkCount} starred</p>
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="p-2 bg-[#cc8bed] hover:bg-[#b070d0] rounded-lg transition-all duration-200 text-white shadow-lg hover:shadow-[#cc8bed]/20 active:scale-95"
            title="Add Page"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Search and filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-9 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#cc8bed]/50 focus:border-[#cc8bed]/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setFilterBookmarked(!filterBookmarked)}
            className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              filterBookmarked
                ? 'bg-[#cc8bed]/20 text-[#cc8bed] border border-[#cc8bed]/30'
                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
            }`}
          >
            <Star size={14} fill={filterBookmarked ? 'currentColor' : 'none'} />
            <span>{filterBookmarked ? 'Show All' : 'Starred Only'}</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {filteredPages.map((page) => {
          const isCurrent = state.currentPage === page;
          const isBookmarked = state.bookmarkedPages.has(page);
          const isDragging = draggedPage === page;
          
          return (
            <div
              key={page}
              draggable
              onDragStart={() => handleDragStart(page)}
              onDragOver={(e) => handleDragOver(e, page)}
              onDrop={(e) => handleDrop(e, page)}
              onDragEnd={handleDragEnd}
              className={`group relative flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                isDragging ? 'opacity-50 scale-95' : ''
              } ${
                isCurrent
                  ? 'bg-[#cc8bed]/20 border-[#cc8bed]/30 shadow-[0_0_15px_-5px_rgba(204,139,237,0.3)]'
                  : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
              }`}
              onClick={() => handleSelect(page)}
            >
              {/* Bookmark star */}
              <button
                onClick={(e) => handleBookmark(page, e)}
                className={`absolute -top-1.5 -right-1.5 p-1 rounded-full transition-all z-10 ${
                  isBookmarked
                    ? 'bg-yellow-500 text-white shadow-lg'
                    : 'bg-white/10 text-white/30 opacity-0 group-hover:opacity-100 hover:bg-white/20 hover:text-yellow-400'
                }`}
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark page'}
              >
                <Star size={12} fill={isBookmarked ? 'currentColor' : 'none'} />
              </button>

              <div className="flex items-center space-x-3">
                <div
                  className="bg-white/90 rounded shadow-sm transition-transform group-hover:scale-105 flex items-center justify-center text-gray-400 text-xs font-mono"
                  style={{ width: thumbWidth, height: thumbHeight }}
                >
                  {page}
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-medium flex items-center space-x-2 ${
                    isCurrent ? 'text-white' : 'text-white/80'
                  }`}>
                    <span>Page {page}</span>
                  </span>
                  <span className="text-[10px] text-white/40">
                    A4 Portrait
                  </span>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleDuplicate(page, e)}
                  className="p-1.5 rounded-lg hover:bg-blue-500/20 hover:text-blue-400 text-white/40 transition-colors"
                  title="Duplicate Page"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={(e) => handleDelete(page, e)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    state.totalPages <= 1 
                      ? 'opacity-30 cursor-not-allowed' 
                      : 'hover:bg-red-500/20 hover:text-red-400 text-white/40'
                  }`}
                  title="Delete Page"
                  disabled={state.totalPages <= 1}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {isCurrent && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-[#cc8bed] rounded-r-full shadow-[0_0_10px_rgba(204,139,237,0.5)]"></div>
              )}
            </div>
          );
        })}

        {filteredPages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-white/40">
            <Search size={32} className="mb-2" />
            <p className="text-sm">No pages found</p>
          </div>
        )}
      </div>
    </div>
  );
} 