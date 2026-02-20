import { Outlet } from 'react-router-dom';
import './PublicLayout.css';

export default function PublicLayout() {
  return (
    <div className="public-layout">
      <Outlet />
    </div>
  );
}
