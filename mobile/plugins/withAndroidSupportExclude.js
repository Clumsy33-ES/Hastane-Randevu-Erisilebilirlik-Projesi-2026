const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidSupportExclude(config) {
  return withProjectBuildGradle(config, async (config) => {
    const buildGradle = config.modResults.contents;

    // We inject the exclusion inside allprojects or at the end of the file.
    if (!buildGradle.includes('exclude group: "com.android.support"')) {
      const exclusionBlock = `
// Added by withAndroidSupportExclude plugin
allprojects {
    configurations.all {
        exclude group: "com.android.support"
    }
}
`;
      config.modResults.contents = buildGradle + exclusionBlock;
    }

    return config;
  });
};
