export const DeviceMotion = {
  Gravity: 9.80665,
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeAllListeners: jest.fn(),
  setUpdateInterval: jest.fn(),
  isAvailableAsync: jest.fn(() => Promise.resolve(true))
}
