import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PinLock } from '../components/PinLock';
import { useAuthStore } from '../stores/useAuthStore';

export function Unlock() {
  const unlocked = useAuthStore((s) => s.unlocked);
  const navigate = useNavigate();

  useEffect(() => {
    if (unlocked) navigate('/partidos', { replace: true });
  }, [unlocked, navigate]);

  return <PinLock message="Introduce el PIN para anotar" />;
}
