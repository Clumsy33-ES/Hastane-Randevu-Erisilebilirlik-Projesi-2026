export const colors = {
  primary: "#e11d2e",
  background: "#d8cccc",
  card: "#ffffff",
  text: "#111111",
  muted: "#666666",
  border: "#dddddd",
};

export const radius = {
  card: 22,
  input: 14,
  button: 15,
};

/**
 * Returns dynamic color values and scaled font sizes based on user accessibility preferences.
 * @param {Object} accessibilitySettings - Current settings from AsyncStorage
 * @returns {Object} Calculated theme configuration
 */
export const getTheme = (accessibilitySettings) => {
  const { largeText, highContrast } = accessibilitySettings || {};

  const themeColors = highContrast
    ? {
        primary: '#ffcc00',     // Yellow for high contrast visibility
        background: '#000000',  // Pure black
        card: '#121212',        // Dark grey container
        text: '#ffffff',        // High contrast white text
        muted: '#bbbbbb',       // Medium contrast text
        border: '#444444',
      }
    : {
        primary: '#e11d2e',     // Erişimli Randevu signature red
        background: '#d8cccc',  // Soft pink-grey
        card: '#ffffff',
        text: '#111111',
        muted: '#666666',
        border: '#dddddd',
      };

  const fontSizes = {
    small: largeText ? 15 : 12,
    medium: largeText ? 19 : 15,
    large: largeText ? 22 : 18,
    xlarge: largeText ? 29 : 24,
    xxlarge: largeText ? 34 : 28,
  };

  return { colors: themeColors, fontSizes, radius };
};
