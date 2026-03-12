// src/pages/ResetPassword.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../components/Auth';

export function ResetPassword() {
  const navigate = useNavigate();

  useEffect(() => {
    // 检查 URL 中是否有重置令牌
    const hash = window.location.hash;
    if (!hash || !hash.includes('type=recovery')) {
      navigate('/');
    }
  }, [navigate]);

  return <Auth onAuthSuccess={() => navigate('/dashboard')} />;
}
