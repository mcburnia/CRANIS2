import { useState, useCallback, useRef, useEffect } from 'react';
import { X, BookOpen, GripVertical } from 'lucide-react';
import { useHelpPanel } from '../context/HelpPanelContext';
import './styles/help-panel.css';

const MIN_WIDTH = 320;
const MAX_WIDTH = 700;
const DEFAULT_WIDTH = 440;
const WIDTH_KEY = 'cranis2_help_panel_width';

export default function HelpPanel() {
  const { isOpen, currentPage, close } = useHelpPanel();
  const [width, setWidth] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(WIDTH_KEY) || '', 10);
      return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : DEFAULT_WIDTH;
    } catch { return DEFAULT_WIDTH; }
  });
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Resize drag handler
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);

    const startX = e.clientX;
    const startWidth = width;

    function onMouseMove(e: MouseEvent) {
      const delta = startX - e.clientX; // dragging left = wider
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      setWidth(newWidth);
    }

    function onMouseUp() {
      setDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Save final width
      try { localStorage.setItem(WIDTH_KEY, String(width)); } catch {}
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [width]);

  // Persist width on change
  useEffect(() => {
    try { localStorage.setItem(WIDTH_KEY, String(width)); } catch {}
  }, [width]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={`help-panel ${dragging ? 'help-panel-dragging' : ''}`}
      style={{ width }}
    >
      {/* Resize handle */}
      <div className="help-panel-resize" onMouseDown={handleMouseDown}>
        <GripVertical size={12} />
      </div>

      {/* Panel header */}
      <div className="help-panel-header">
        <div className="help-panel-title">
          <BookOpen size={16} />
          <span>User Guide</span>
        </div>
        <button className="help-panel-close" onClick={close} title="Close help panel">
          <X size={16} />
        </button>
      </div>

      {/* Iframe content */}
      <iframe
        className="help-panel-iframe"
        src={currentPage}
        title="CRANIS2 Help"
      />
    </div>
  );
}
