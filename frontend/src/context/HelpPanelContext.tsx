import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface HelpPanelState {
  isOpen: boolean;
  currentPage: string;
  toggle: () => void;
  open: (page?: string) => void;
  close: () => void;
  navigate: (page: string) => void;
}

const HelpPanelContext = createContext<HelpPanelState | null>(null);

const STORAGE_KEY = 'cranis2_help_panel';
const DEFAULT_PAGE = '/help/ch1_01_account_creation.html';

export function HelpPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'open'; } catch { return false; }
  });
  const [currentPage, setCurrentPage] = useState(DEFAULT_PAGE);

  const toggle = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? 'open' : 'closed'); } catch {}
      return next;
    });
  }, []);

  const open = useCallback((page?: string) => {
    if (page) setCurrentPage(page);
    setIsOpen(true);
    try { localStorage.setItem(STORAGE_KEY, 'open'); } catch {}
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    try { localStorage.setItem(STORAGE_KEY, 'closed'); } catch {}
  }, []);

  const navigate = useCallback((page: string) => {
    setCurrentPage(page);
    if (!isOpen) {
      setIsOpen(true);
      try { localStorage.setItem(STORAGE_KEY, 'open'); } catch {}
    }
  }, [isOpen]);

  return (
    <HelpPanelContext.Provider value={{ isOpen, currentPage, toggle, open, close, navigate }}>
      {children}
    </HelpPanelContext.Provider>
  );
}

export function useHelpPanel() {
  const ctx = useContext(HelpPanelContext);
  if (!ctx) throw new Error('useHelpPanel must be used within HelpPanelProvider');
  return ctx;
}
