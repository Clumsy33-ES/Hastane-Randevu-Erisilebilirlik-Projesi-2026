import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, radius } from '../styles/theme';
import { MIN_TOUCH_TARGET } from '../utils/buildConfig';

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

export default function AccessibleButton({
  onPress,
  title,
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  textStyle,
}) {
  const isButtonDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isButtonDisabled}
      hitSlop={HIT_SLOP}
      style={[
        styles.button,
        isButtonDisabled && styles.disabledButton,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint || 'Çift dokunarak etkinleştirin'}
      accessibilityState={{
        disabled: isButtonDisabled,
        busy: loading,
      }}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <Text style={[styles.text, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    borderRadius: radius.button,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
  },
  disabledButton: {
    backgroundColor: '#888888',
    opacity: 0.7,
  },
  text: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
