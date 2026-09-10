module.exports = require('@infinitetoken/jest-config/react-native')({
  // Native modules this package imports have no real implementation under jsdom.
  moduleNameMapper: {
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts',
    '^react-native-reanimated$': '<rootDir>/src/__mocks__/react-native-reanimated.ts',
    // Real @tastic/core resolves (via its own "browser" export condition, which jsdom's default
    // customExportConditions matches) to raw .ts source under node_modules, which ts-jest then
    // refuses to transform — mocked instead, same treatment @tastic/hud's own identical mock takes.
    // Also no longer needs its own expo-sensors mock now that @tastic/core doesn't import it
    // directly either (see this package's own tastic-core.ts mock's useOrientationState stub).
    '^@tastic/core$': '<rootDir>/src/__mocks__/tastic-core.ts'
  }
})
