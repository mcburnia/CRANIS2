/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { X, BookOpen, GripVertical } from 'lucide-react';
import { useHelpPanel } from '../context/HelpPanelContext';
import './styles/help-panel.css';

// Bump this when help content changes to bust iframe cache
const HELP_VERSION = '25';
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
        src={`${currentPage}?v=${HELP_VERSION}`}
        title="CRANIS2 Help"
        onLoad={(e) => {
          try {
            const doc = (e.target as HTMLIFrameElement).contentDocument;
            if (!doc) return;
            // Inject panel-specific CSS overrides
            if (!doc.getElementById('panel-overrides')) {
              const link = doc.createElement('link');
              link.id = 'panel-overrides';
              link.rel = 'stylesheet';
              link.href = '/help/panel-overrides.css?v=7';
              doc.head.appendChild(link);
            }
            // Auto-select first station, add active class toggling, and hint dismissal.
            if (!doc.getElementById('panel-autoselect')) {
              const script = doc.createElement('script');
              script.id = 'panel-autoselect';
              script.textContent = [
                // Create "You are here" arrow element
                'var _yah=document.createElement("div");',
                '_yah.className="you-are-here";',
                '_yah.id="you-are-here";',
                '_yah.innerHTML=\'<div class="you-are-here-arrow"></div><div class="you-are-here-label">YOU ARE HERE</div>\';',
                '_yah.style.display="none";',
                'var _mapWrap=document.querySelector(".map-wrap");',
                'if(_mapWrap){_mapWrap.style.position="relative";_mapWrap.appendChild(_yah);}',

                // Position the arrow on the opposite side from the label
                'function _positionArrow(id){',
                '  var el=document.getElementById("ms-"+id);',
                '  if(!el||!_mapWrap){_yah.style.display="none";return;}',
                '  var circle=el.querySelector("circle")||el.querySelector("rect");',
                '  if(!circle){_yah.style.display="none";return;}',
                '  var svg=_mapWrap.querySelector("svg");',
                '  if(!svg){_yah.style.display="none";return;}',
                // Detect label position: compare label y to circle cy
                '  var lbl=el.querySelector(".lbl");',
                '  var labelAbove=true;',
                '  if(lbl&&circle){',
                '    var lblY=parseFloat(lbl.getAttribute("y")||"0");',
                '    var circY=parseFloat(circle.getAttribute("cy")||circle.getAttribute("y")||"0");',
                '    labelAbove=lblY<circY;',
                '  }',
                '  var svgRect=svg.getBoundingClientRect();',
                '  var cRect=circle.getBoundingClientRect();',
                '  var left=cRect.left-svgRect.left+cRect.width/2;',
                '  if(labelAbove){',
                // Label is above → arrow goes below, pointing up
                '    _yah.style.top=(cRect.top-svgRect.top+cRect.height+2)+"px";',
                '    _yah.style.transform="translate(-50%, 0)";',
                '    _yah.innerHTML=\'<div class="you-are-here-arrow yah-up"></div><div class="you-are-here-label">YOU ARE HERE</div>\';',
                '  }else{',
                // Label is below → arrow goes above, pointing down
                '    _yah.style.top=(cRect.top-svgRect.top-2)+"px";',
                '    _yah.style.transform="translate(-50%, -100%)";',
                '    _yah.innerHTML=\'<div class="you-are-here-label">YOU ARE HERE</div><div class="you-are-here-arrow yah-down"></div>\';',
                '  }',
                '  _yah.style.left=left+"px";',
                '  _yah.style.display="flex";',
                '}',

                // Wrap show() to position arrow on active station
                'if(typeof show==="function"&&!show._wrapped){',
                '  var _origShow=show;',
                '  show=function(id){',
                '    _origShow(id);',
                '    _positionArrow(id);',
                '  };',
                '  show._wrapped=true;',
                '}',

                // Auto-select first station
                'if(typeof allIds!=="undefined"&&typeof show==="function"&&allIds.length>0){setTimeout(function(){show(allIds[0])},150);}',

                // Reposition arrow on window resize (SVG scales)
                'var _currentId=null;',
                'if(typeof show==="function"&&!show._trackId){',
                '  var _prevShow=show;',
                '  show=function(id){_currentId=id;_prevShow(id);};',
                '  show._wrapped=true;show._trackId=true;',
                '}',
                'window.addEventListener("resize",function(){if(_currentId)_positionArrow(_currentId);});',

                // Hint dismissal
                'window.dismissHint=function(){var h=document.getElementById("map-hint");if(h)h.style.display="none";try{localStorage.setItem("cranis2-beck-hint-dismissed","1")}catch(e){}};',
                'if(localStorage.getItem("cranis2-beck-hint-dismissed")==="1"){var h=document.getElementById("map-hint");if(h)h.style.display="none";}',
                // Add close button to existing hint if not already present
                'setTimeout(function(){var h=document.getElementById("map-hint");if(h&&!h.querySelector(".hint-close")){var b=document.createElement("button");b.className="hint-close";b.setAttribute("aria-label","Dismiss");b.innerHTML="\\u00d7";b.onclick=window.dismissHint;h.appendChild(b);}},50);',
              ].join('');
              doc.body.appendChild(script);
            }
          } catch { /* cross-origin safety — ignore */ }
        }}
      />
    </div>
  );
}
