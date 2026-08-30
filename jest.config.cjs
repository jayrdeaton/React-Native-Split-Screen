module.exports = require('@infinitetoken/jest-config/react-native')({
  // Native modules this package imports have no real implementation under jsdom.
  moduleNameMapper: {
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts',
    '^react-native-reanimated$': '<rootDir>/src/__mocks__/react-native-reanimated.ts',
    '^expo-sensors$': '<rootDir>/src/__mocks__/expo-sensors.ts'
  }
})
