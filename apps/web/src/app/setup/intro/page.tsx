'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupIntroRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/setup/ready');
  }, [router]);

  return <div className="min-h-dvh bg-canvas" />;
}
