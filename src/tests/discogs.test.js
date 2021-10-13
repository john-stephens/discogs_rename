const disconnect = require('disconnect');
const { getReleaseIdFromUrl, getDiscogsRelease } = require('../discogs');

describe('discogs', () => {
  describe('getReleaseIdFromUrl', () => {
    test('returns release id, given an https url', () => {
      const url = 'https://www.discogs.com/Foo-Bar/release/123456';

      expect(getReleaseIdFromUrl(url)).toEqual('123456');
    });

    test('returns release id, given an http url', () => {
      const url = 'http://www.discogs.com/Foo-Bar/release/123456';

      expect(getReleaseIdFromUrl(url)).toEqual('123456');
    });

    test('returns release id, given a short hostname', () => {
      const url = 'http://discogs.com/Foo-Bar/release/123456';

      expect(getReleaseIdFromUrl(url)).toEqual('123456');
    });

    test('returns release id, given an uppercase hostname', () => {
      const url = 'HTTP://DISCOGS.COM/Foo-Bar/release/123456';

      expect(getReleaseIdFromUrl(url)).toEqual('123456');
    });

    test('returns false when the release id is not found', () => {
      const url = 'http://discogs.com/Foo-Bar/release/';

      expect(getReleaseIdFromUrl(url)).toBe(false);
    });

    test('returns release id for new url format', () => {
      const url = 'https://www.discogs.com/release/123456-Foo-Bar';

      expect(getReleaseIdFromUrl(url)).toEqual('123456');
    });
  });

  describe('getDiscogsRelease', () => {
    test('returns the discogs release data', async () => {
      const data = 'data';
      const releaseId = '123456';

      disconnect.setTestData(data);

      const result = await getDiscogsRelease(releaseId);

      expect(result).toEqual(data);
    });
  });
});
