const fs = require('fs/promises');
const { renameFiles } = require('../rename');

describe('rename', () => {
  describe('renameFiles', () => {
    const files = [
      'long/path/track.mp3',
      'track.mp3',
    ];
    const tracks = [
      'Foo-Bar',
      'Foo-Baz',
    ];

    beforeEach(() => {
      console.log = jest.fn();
      fs.rename = jest.fn();
    });

    test('should rename files', async () => {
      await renameFiles(files, tracks);

      expect(console.log).toHaveBeenCalledTimes(2);
      expect(fs.rename).toHaveBeenNthCalledWith(1, 'long/path/track.mp3', 'long/path/Foo-Bar.mp3');
      expect(fs.rename).toHaveBeenNthCalledWith(2, 'track.mp3', 'Foo-Baz.mp3');
    });

    test('should rename files, dry run', async () => {
      await renameFiles(files, tracks, true);

      expect(console.log).toHaveBeenCalledTimes(2);
      expect(fs.rename).not.toHaveBeenCalled();
    });
  });
});
