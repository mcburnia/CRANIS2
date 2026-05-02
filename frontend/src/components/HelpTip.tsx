/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Info } from 'lucide-react';
import './HelpTip.css';

interface HelpTipProps {
  text: string;
  size?: number;
}

export default function HelpTip({ text, size = 14 }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, updatePosition]);

  // Adjust if bubble extends beyond viewport
  useEffect(() => {
    if (!open || !bubbleRef.current || !pos) return;
    const bubble = bubbleRef.current;
    const bRect = bubble.getBoundingClientRect();
    let left = pos.left;
    if (bRect.left < 8) left += (8 - bRect.left);
    else if (bRect.right > window.innerWidth - 8) left -= (bRect.right - window.innerWidth + 8);
    if (left !== pos.left) setPos(p => p ? { ...p, left } : p);
  }, [open, pos]);

  if (!text) return null;

  return (
    <span
      className="helptip"
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(prev => !prev); }}
    >
      <Info size={size} />
      {open && pos && (
        <span
          className="helptip-bubble"
          ref={bubbleRef}
          style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)' }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
