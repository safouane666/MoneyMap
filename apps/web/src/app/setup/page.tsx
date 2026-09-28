'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSetupResumePath } from '@/lib/setup-session';

export default function SetupIndexPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    router.replace(getSetupResumePath());
    setReady(true);
  }, [router]);

  if (!ready) {
    return <div className="min-h-dvh bg-canvas" />;
  }
  return null;
}
