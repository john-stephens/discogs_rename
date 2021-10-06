const { getReleaseIdFromUrl, getDiscogsRelease } = require('./discogs');
const { parseRelease } = require('./parse');
const { getFormattedTracks } = require('./format');
const { renameFiles } = require('./rename');
const {
  isReleaseMultiDisc,
  getTracksFromRelease,
  joinMultiPartTracks,
  getReleaseArtist,
} = require('./utils');

/**
 * Main program logic.
 *
 * @param {object} argv - Command line arguments
 */
async function main(argv) {
  if (argv.debug) {
    console.log(argv);
  }

  // Parse the release id from the supplied URL
  const releaseId = getReleaseIdFromUrl(argv.url);

  if (!releaseId) {
    console.log('Discogs release id not found in the supplied URL');
    return;
  }

  // Look up the Discogs release
  const releaseData = await getDiscogsRelease(releaseId);

  if (argv.debug) {
    console.dir(releaseData, { depth: null });
  }

  // Parse the release data
  const release = parseRelease(releaseData);

  if (argv.debug) {
    console.dir(release, { depth: null });
  }

  // Check to see if we require a disc number
  if (isReleaseMultiDisc(release) && argv.disc === undefined) {
    console.log('Discogs release constains multiple discs, please specify using --disc');
    return;
  }

  // Get the tracks from the release
  let tracks = getTracksFromRelease(release, argv.disc, argv.joinMulti);

  if (argv.debug) {
    console.dir(tracks, { depth: null });
  }

  // Optionally join the multi-part tracks
  if (argv.joinMulti) {
    tracks = joinMultiPartTracks(tracks, argv.joinString);

    if (argv.debug) {
      console.dir(tracks, { depth: null });
    }
  }

  // Make sure that the number of tracks matches the files supplied
  if (!argv.ignoreCount && tracks.length !== argv.file.length) {
    console.log('Number of tracks found does not match the number of files supplied');
    console.log(`${tracks.length} track(s) found, ${argv.file.length} file(s) supplied`);
    return;
  }

  // Get the formatted track names
  const artist = getReleaseArtist(release);
  const formattedTracks = getFormattedTracks(artist, tracks, argv.mix);

  if (argv.debug) {
    console.log(formattedTracks);
  }

  // Rename the files
  renameFiles(argv.file, formattedTracks, argv.dryrun);
}

module.exports = {
  main,
};
