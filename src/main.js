const discogs = require('./discogs');
const parse = require('./parse');
const format = require('./format');
const rename = require('./rename');
const utils = require('./utils');

const msgReleaseNotFound = 'Discogs release id not found in the supplied URL';
const msgDiscNumberRequired = 'Discogs release constains multiple discs, please specify using --disc';
const msgTrackCountMismatch = 'Number of tracks found does not match the number of files supplied';

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
  const releaseId = discogs.getReleaseIdFromUrl(argv.url);

  if (!releaseId) {
    console.log(msgReleaseNotFound);
    return;
  }

  // Look up the Discogs release
  const releaseData = await discogs.getDiscogsRelease(releaseId);

  if (argv.debug) {
    console.dir(releaseData, { depth: null });
  }

  // Parse the release data
  const release = parse.parseRelease(releaseData);

  if (argv.debug) {
    console.dir(release, { depth: null });
  }

  // Check to see if we require a disc number
  if (utils.isReleaseMultiDisc(release) && argv.disc === undefined) {
    console.log(msgDiscNumberRequired);
    return;
  }

  // Get the tracks from the release
  let tracks = utils.getTracksFromRelease(release, argv.disc, argv.joinMulti);

  if (argv.debug) {
    console.dir(tracks, { depth: null });
  }

  // Optionally join the multi-part tracks
  if (argv.joinMulti) {
    tracks = utils.joinMultiPartTracks(tracks, argv.joinString);

    if (argv.debug) {
      console.dir(tracks, { depth: null });
    }
  }

  // Make sure that the number of tracks matches the files supplied
  if (!argv.ignoreCount && tracks.length !== argv.file.length) {
    console.log(msgTrackCountMismatch);
    console.log(`${tracks.length} track(s) found, ${argv.file.length} file(s) supplied`);
    return;
  }

  // Get the formatted track names
  const artist = utils.getReleaseArtist(release);
  const formattedTracks = format.getFormattedTracks(artist, tracks, argv.mix);

  if (argv.debug) {
    console.log(formattedTracks);
  }

  // Rename the files
  rename.renameFiles(argv.file, formattedTracks, argv.dryrun);
}

module.exports = {
  msgReleaseNotFound,
  msgDiscNumberRequired,
  msgTrackCountMismatch,
  main,
};
