import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { loadSetupSession } from '../src/lib/setup-session';

export default function Index() {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    void loadSetupSession().then((session) => {
      switch (session.step) {
        case 'welcome':
          setHref('/setup/welcome');
          break;
        case 'language':
          setHref('/setup/language');
          break;
        case 'currency':
          setHref('/setup/currency');
          break;
        case 'notifications':
          setHref('/setup/notifications');
          break;
        case 'intro':
          setHref('/setup/intro');
          break;
        default:
          setHref('/(tabs)/home');
      }
    });
  }, []);

  if (!href) return null;
  return <Redirect href={href as '/(tabs)/home'} />;
}
