import { Redirect } from 'expo-router';

/** Settings linked from account; stack route. */
export default function AccountStackAlias() {
  return <Redirect href="/(tabs)/account" />;
}
