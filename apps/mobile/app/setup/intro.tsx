import { Redirect } from 'expo-router';

/** Legacy route → ready step. */
export default function IntroRedirect() {
  return <Redirect href="/setup/ready" />;
}
