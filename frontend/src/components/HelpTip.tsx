import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';
import './HelpTip.css';

interface HelpTipProps {
  text: string;
  size?: number;
}

export default function HelpTip({ text, size = 14 }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

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
      {open && <span className="helptip-bubble">{text}</span>}
    </span>
  );
}
