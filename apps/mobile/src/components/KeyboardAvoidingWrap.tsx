import {
  KeyboardAvoidingView,
  Platform,
  type KeyboardAvoidingViewProps,
  StyleSheet,
} from 'react-native';

/** Keyboard avoidance for forms — iOS padding, Android height resize. */
export function KeyboardAvoidingWrap({
  children,
  style,
  behavior,
  keyboardVerticalOffset = 0,
  ...rest
}: KeyboardAvoidingViewProps) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={behavior ?? (Platform.OS === 'ios' ? 'padding' : 'height')}
      keyboardVerticalOffset={keyboardVerticalOffset}
      {...rest}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
