import { Outlet } from 'react-router-dom';
import { Toaster } from '../components/ui/sonner';

export default function AuthLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
