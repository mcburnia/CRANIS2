import { Outlet } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { HelpPanelProvider } from '../context/HelpPanelContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <HelpPanelProvider>
        <Outlet />
      </HelpPanelProvider>
    </AuthProvider>
  );
}
