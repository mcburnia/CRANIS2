import { Outlet } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import HelpPanel from '../components/HelpPanel';
import { useHelpPanel } from '../context/HelpPanelContext';
import './PublicLayout.css';

export default function PublicLayout() {
  const { isOpen, toggle } = useHelpPanel();

  return (
    <div className="public-layout">
      <div className="public-layout-content">
        <Outlet />
      </div>
      <HelpPanel />
      {!isOpen && (
        <button
          className="help-fab"
          onClick={toggle}
          title="Open user guide"
          aria-label="Open user guide"
        >
          <HelpCircle size={22} />
        </button>
      )}
    </div>
  );
}
