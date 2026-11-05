/**
 * EAS free-tier Android builders (4 vCPU / ~15.6 GB RAM) run out of memory
 * when Gradle compiles several native C++ modules (Reanimated, Worklets,
 * Skia, Nitro, expo-modules-core) in parallel: the OOM killer takes the
 * Gradle daemon and the build fails with "Gradle build daemon disappeared
 * unexpectedly".
 *
 * Each CMake/ninja task already uses every core, so running one Gradle task
 * at a time costs little speed but keeps peak memory within the machine.
 * Only applied on EAS (EAS_BUILD=true) so local builds keep full parallelism.
 */
const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withEasGradleMemory(config) {
  if (process.env.EAS_BUILD !== 'true') return config;

  return withGradleProperties(config, (cfg) => {
    const set = (key, value) => {
      cfg.modResults = cfg.modResults.filter(
        (item) => !(item.type === 'property' && item.key === key),
      );
      cfg.modResults.push({ type: 'property', key, value });
    };
    set('org.gradle.workers.max', '1');
    set('kotlin.daemon.jvmargs', '-Xmx2048m');
    return cfg;
  });
};
