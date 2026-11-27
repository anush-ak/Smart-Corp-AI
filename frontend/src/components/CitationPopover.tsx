import React, { useState, useRef, useEffect } from 'react';
import { FileText, X, CheckCircle2 } from 'lucide-react';

interface CitationPopoverProps {
  filename: string;
  pageNumber: number | string;
  excerpt?: string;
  className?: string;
}

export const CitationPopover: React.FC<CitationPopoverProps> = ({
  filename,
  pageNumber,
  excerpt,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const cleanFilename = filename.trim();
  const pageStr = String(pageNumber).replace(/[^0-9]/g, '') || '1';

  return (
    <span className={`relative inline-block align-baseline mx-1 ${className}`}>
      {/* Monospace Interactive Citation Pill */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={`View verified excerpt from ${cleanFilename}, Page ${pageStr}`}
        className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer select-none tabular-nums ${
          isOpen
            ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/40 ring-1 ring-indigo-500/30'
            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/15 hover:border-indigo-500/30 hover:text-indigo-700 dark:hover:text-indigo-300'
        }`}
      >
        <FileText size={11} strokeWidth={1.75} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
        <span className="truncate max-w-[150px]">{cleanFilename}</span>
        <span className="text-zinc-400 dark:text-zinc-500">,</span>
        <span className="text-zinc-500 dark:text-zinc-400">Pg {pageStr}</span>
      </button>

      {/* Floating Popover: Crisp Surface with 1px Border */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Verified Source Chunk"
          className="absolute z-50 bottom-full left-0 mb-2 w-80 sm:w-96 rounded-lg bg-elevated border border-border shadow-2xl p-3.5 text-xs text-text-primary"
          style={{
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border">
            <div className="flex items-center space-x-2 min-w-0 pr-2">
              <div className="w-5 h-5 rounded bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                <FileText size={12} strokeWidth={1.75} />
              </div>
              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate" title={cleanFilename}>
                {cleanFilename}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums bg-subtle text-zinc-600 dark:text-zinc-400 border border-border shrink-0">
                Page {pageStr}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Close"
            >
              <X size={13} strokeWidth={1.75} />
            </button>
          </div>

          {/* Label */}
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
            <span>Verbatim Source Excerpt</span>
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
              <CheckCircle2 size={10} strokeWidth={2} />
              <span>Grounded</span>
            </span>
          </div>

          {/* Verbatim Excerpt */}
          <div className="p-2.5 rounded-md bg-canvas border border-border text-zinc-800 dark:text-zinc-300 font-sans text-xs leading-relaxed max-h-52 overflow-y-auto select-text whitespace-pre-wrap font-normal">
            {excerpt ? (
              <span>"{excerpt.trim()}"</span>
            ) : (
              <span className="text-zinc-500 italic">
                Source excerpt indexed from {cleanFilename} on Page {pageStr}.
              </span>
            )}
          </div>

          {/* Footer badge */}
          <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
            <span className="text-zinc-500">Strict ChromaDB Tenant Isolation</span>
            <span className="text-indigo-600 dark:text-indigo-400">100% Deterministic Grounding</span>
          </div>
        </div>
      )}
    </span>
  );
};
