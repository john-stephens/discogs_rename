const { argv } = require('../../args');

const { getReleaseIdFromUrl, getDiscogsRelease } = require('../../discogs');
const { parseRelease } = require('../../parse');
const { getFormattedTracks } = require('../../format');
const {
  isReleaseMultiDisc,
  getTracksFromRelease,
  joinMultiPartTracks,
  getReleaseArtist,
} = require('../../utils');

/**
 * Main program logic.
 */
async function main() {
  const output = {};

  output.argv = argv;

  // Parse the release id from the supplied URL
  const releaseId = getReleaseIdFromUrl(argv.url);

  if (!releaseId) {
    console.log('Discogs release id not found in the supplied URL');
    return;
  }

  // Look up the Discogs release
  const releaseData = await getDiscogsRelease(releaseId);

  output.release = {
    artists: releaseData.artists,
    format_quantity: releaseData.format_quantity,
    tracklist: releaseData.tracklist,
  };

  // Parse the release data
  const release = parseRelease(releaseData);

  // Check to see if we require a disc number
  if (isReleaseMultiDisc(release) && argv.disc === undefined) {
    console.log('Discogs release constains multiple discs, please specify using --disc');
    return;
  }

  // Get the tracks from the release
  let tracks = getTracksFromRelease(release, argv.disc, argv.joinMulti);

  // Optionally join the multi-part tracks
  if (argv.joinMulti) {
    tracks = joinMultiPartTracks(tracks, argv.joinString);
  }

  // Get the formatted track names
  const artist = getReleaseArtist(release);
  const formattedTracks = getFormattedTracks(artist, tracks, argv.mix);

  output.tracks = formattedTracks;

  console.log(JSON.stringify(output, undefined, 2));
}

main();
