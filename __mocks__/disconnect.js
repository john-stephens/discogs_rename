const disconnect = jest.createMockFromModule('disconnect');

let data;

disconnect.setTestData = (newData) => {
  data = newData;
};

disconnect.Client = jest.fn(() => ({
  database: jest.fn(() => ({
    getRelease: jest.fn((releaseId, callback) => {
      callback(null, data);
    }),
  })),
}));

module.exports = disconnect;
