'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupWelcomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/setup/language');
  }, [router]);

  return <div className="min-h-dvh bg-canvas" />;
}
