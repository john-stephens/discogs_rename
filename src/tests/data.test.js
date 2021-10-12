const fs = require('fs/promises');

const { parseRelease } = require('../parse');
const { getFormattedTracks } = require('../format');
const {
  getTracksFromRelease,
  joinMultiPartTracks,
  getReleaseArtist,
} = require('../utils');

// Read in the JSON data files
const jsonData = {};

const readJsonFiles = async () => {
  const files = await fs.readdir(`${__dirname}/data`);
  const jsonFiles = files.filter((item) => item.match(/\.json$/));

  for (let x = 0; x < jsonFiles.length; x += 1) {
    const jsonFile = jsonFiles[x];
    const name = jsonFile.replace(/\.json$/, '');

    // eslint-disable-next-line
    jsonData[name] = require(`./data/${jsonFile}`);
  }
};

describe('actual data', () => {
  beforeAll(() => readJsonFiles());

  test('validation', () => {
    const keys = Object.keys(jsonData);

    for (let x = 0; x < keys.length; x += 1) {
      const data = jsonData[keys[x]];
      const { argv } = data;
      const releaseData = data.release;

      const release = parseRelease(releaseData);
      let tracks = getTracksFromRelease(release, argv.disc, argv.joinMulti);

      if (argv.joinMulti) {
        tracks = joinMultiPartTracks(tracks, argv.joinString);
      }

      const artist = getReleaseArtist(release);
      const formattedTracks = getFormattedTracks(artist, tracks, argv.mix);

      expect(formattedTracks).toEqual(data.tracks);
    }
  });
});
