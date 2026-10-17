import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  title?: string;
  content: string | React.ReactNode;
  iconClassName?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  title,
  content,
  iconClassName = 'w-3 h-3 text-slate-400 hover:text-cyan-400 transition-colors',
  side = 'top',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        setIsVisible(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible]);

  const getPositionClasses = () => {
    switch (side) {
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-1.5';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-1.5';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-1.5';
      case 'top':
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-1.5';
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsVisible((prev) => !prev);
        }}
        aria-label="More Information"
        className="focus:outline-none p-0.5 rounded cursor-help"
      >
        <Info className={iconClassName} />
      </button>

      {isVisible && (
        <div
          role="tooltip"
          className={`absolute z-50 w-64 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md shadow-xl text-left font-sans text-xs animate-in fade-in zoom-in-95 duration-100 ${getPositionClasses()}`}
        >
          {title && (
            <div className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-100 pb-1 mb-1 border-b border-slate-100 dark:border-slate-800/80">
              {title}
            </div>
          )}
          <div className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            {content}
          </div>
        </div>
      )}
    </div>
  );
};
