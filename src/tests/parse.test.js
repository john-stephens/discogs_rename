const { parseTrackTitle } = require('../parse');

describe('parse', () => {
  describe('parseTrackTitle', () => {
    test('unmatched parenthesis', () => {
      const title = 'test )';

      const result = parseTrackTitle(title);

      expect(result.name).toEqual(title);
      expect(result.subtitles).toHaveLength(0);
    });
  });
});
