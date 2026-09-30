import { Redirect } from 'expo-router';

/** Legacy route → web-aligned 6-step setup. */
export default function WelcomeRedirect() {
  return <Redirect href="/setup/language" />;
}
