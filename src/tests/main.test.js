const discogs = require('../discogs');
const parse = require('../parse');
const format = require('../format');
const rename = require('../rename');
const utils = require('../utils');

const {
  msgReleaseNotFound,
  msgDiscNumberRequired,
  msgTrackCountMismatch,
  main,
} = require('../main');

describe('main', () => {
  describe('main', () => {
    const url = 'url';
    const files = ['file1', 'file2', 'file3'];
    const releaseId = 'releaseId';
    const releaseData = 'releaseData';
    const release = 'release';
    const tracks = ['track1', 'track2', 'track3'];
    const joinedTracks = ['jointrack1', 'jointrack2', 'jointrack3'];
    const artist = 'artists';
    const formattedTracks = 'formattedTracks';
    const defaultArgv = {
      url,
      file: files,
    };

    beforeEach(() => {
      console.log = jest.fn();
      console.dir = jest.fn();

      discogs.getReleaseIdFromUrl = jest.fn(() => releaseId);
      discogs.getDiscogsRelease = jest.fn(() => new Promise((resolve) => {
        resolve(releaseData);
      }));

      parse.parseRelease = jest.fn(() => release);

      format.getFormattedTracks = jest.fn(() => formattedTracks);

      utils.isReleaseMultiDisc = jest.fn(() => false);
      utils.getTracksFromRelease = jest.fn(() => tracks);
      utils.joinMultiPartTracks = jest.fn(() => joinedTracks);
      utils.getReleaseArtist = jest.fn(() => artist);

      rename.renameFiles = jest.fn();
    });

    test('should get the release data from discogs and rename files', async () => {
      await main(defaultArgv);

      expect(rename.renameFiles).toHaveBeenCalledWith(files, formattedTracks, undefined);
    });

    test('should handle an invalid discogs url', async () => {
      discogs.getReleaseIdFromUrl = jest.fn(() => undefined);

      await main(defaultArgv);

      expect(console.log).toHaveBeenCalledWith(msgReleaseNotFound);
      expect(discogs.getDiscogsRelease).not.toHaveBeenCalled();
    });

    test('should handle case when disc flag is required but not supplied', async () => {
      utils.isReleaseMultiDisc = jest.fn(() => true);

      await main(defaultArgv);

      expect(console.log).toHaveBeenCalledWith(msgDiscNumberRequired);
      expect(utils.getTracksFromRelease).not.toHaveBeenCalled();
    });

    test('should properly handle the --disc flag', async () => {
      const disc = '1';
      const argv = {
        ...defaultArgv,
        disc,
      };

      utils.isReleaseMultiDisc = jest.fn(() => true);

      await main(argv);

      expect(utils.getTracksFromRelease).toHaveBeenCalledWith(release, disc, undefined);
      expect(rename.renameFiles).toHaveBeenCalled();
    });

    test('should properly handle the --join-multi flag', async () => {
      const argv = {
        ...defaultArgv,
        joinMulti: true,
      };

      await main(argv);

      expect(utils.getTracksFromRelease).toHaveBeenCalledWith(release, undefined, true);
      expect(format.getFormattedTracks).toHaveBeenCalledWith(artist, joinedTracks, undefined);
    });

    test('should properly handle the --join-string flag', async () => {
      const joinString = 'joinString';
      const argv = {
        ...defaultArgv,
        joinMulti: true,
        joinString,
      };

      await main(argv);

      expect(utils.joinMultiPartTracks).toHaveBeenCalledWith(tracks, joinString);
    });

    test('should handle track count mismatch', async () => {
      const argv = {
        ...defaultArgv,
        file: ['file1', 'file2'],
      };

      await main(argv);

      expect(console.log).toHaveBeenCalledWith(msgTrackCountMismatch);
      expect(format.getFormattedTracks).not.toHaveBeenCalled();
    });

    test('should properly handle the --ignore-count flag', async () => {
      const argv = {
        ...defaultArgv,
        file: ['file1', 'file2'],
        ignoreCount: true,
      };

      await main(argv);

      expect(console.log).not.toHaveBeenCalled();
      expect(rename.renameFiles).toHaveBeenCalled();
    });

    test('should properly handle the --mix flag', async () => {
      const argv = {
        ...defaultArgv,
        mix: true,
      };

      await main(argv);

      expect(format.getFormattedTracks).toHaveBeenCalledWith(artist, tracks, true);
    });

    test('should properly handle the --dryrun flag', async () => {
      const argv = {
        ...defaultArgv,
        dryrun: true,
      };

      await main(argv);

      expect(rename.renameFiles).toHaveBeenCalledWith(argv.file, formattedTracks, true);
    });

    test('should properly handle the --debug flag', async () => {
      const argv = {
        ...defaultArgv,
        debug: true,
        joinMulti: true,
      };

      await main(argv);

      expect(console.log).toHaveBeenCalled();
      expect(console.dir).toHaveBeenCalled();
      expect(rename.renameFiles).toHaveBeenCalled();
    });
  });
});
