/**
 * Determine if the given release is a multi-disc release.
 *
 * @param {object} release - The release data
 * @returns {boolean} Whether or not the release is multi-disc
 */
function isReleaseMultiDisc(release) {
  return release.format_quantity > 1;
}

/**
 * Determine if the given track list entry is actually a "track" type.
 *
 * @param {object} track - The track data
 * @returns {boolean} Whether or not the track list entry is of type "track"
 */
function isTrack(track) {
  // eslint-disable-next-line no-underscore-dangle
  return (track.type_ === 'track');
}

/**
 * Determine if the given track is from the given disc.
 *
 * An undefined disc means that the track should be from a single-disc release.
 *
 * @param {object} track - The track data
 * @param {(string|undefined)} disc - The desired disc
 * @returns {boolean} Whether or not the track is from the disc specified
 */
function isTrackFromDisc(track, disc = undefined) {
  const { position } = track;

  return (position.disc === disc && position.track !== undefined && position.track !== '');
}

/**
 * Determine if the give track is the first part of a track.
 *
 * @param {object} track - The track data
 * @returns {boolean} Whether or not the track is the first part
 */
function isTrackFirstPart(track) {
  const { position } = track;

  return (position.part === undefined || position.part === '1' || position.part === 'a');
}

/**
 * Get the primary artist for the release.
 *
 * @param {object} release - The release data
 * @returns {string} The primary artist for the release
 */
function getReleaseArtist(release) {
  const { artists } = release;

  return artists[0].name;
}

/**
 * Get all of the tracks for the release, limited to the specified disc.
 *
 * Note: For multi-part tracks, only the first part is returned, assuming that
 * the file has not been split into those parts.
 *
 * @param {object} release - The release data
 * @param {(undefined|string)} disc - The disc to get tracks for
 * @param {boolean} allParts - Whether or not all track parts should be returned
 * @returns {object[]} The tracks for the release
 */
function getTracksFromRelease(release, disc = undefined, allParts = false) {
  const { tracklist } = release;
  const tracks = tracklist.filter((track) => (isTrack(track)
    && isTrackFromDisc(track, disc)
    && (allParts || isTrackFirstPart(track))));

  return tracks;
}

/**
 * Join multi-part tracks into a single track, combining the titles.
 *
 * @param {object[]} tracks - The tracks to join
 * @param {string} joinString - The string to use when combining track titles
 * @returns {object[]} The joined tracks
 */
function joinMultiPartTracks(tracks, joinString) {
  // Test case:
  // https://www.discogs.com/Daft-Punk-Alive-2007/release/1209459
  const ret = [];

  for (let x = 0; x < tracks.length; x += 1) {
    const track = tracks[x];
    const { position } = track;

    if (position.part === undefined) {
      ret.push(track);
    } else {
      const titles = [track.title.name];

      for (let y = x + 1; y < tracks.length; y += 1) {
        const nextTrack = tracks[y];

        if (position.track === nextTrack.position.track) {
          titles.push(nextTrack.title.name);
          x += 1;
        } else {
          break;
        }
      }

      ret.push({
        ...track,
        title: {
          name: titles.join(joinString),
          subtitles: [],
        },
      });
    }
  }

  return ret;
}

module.exports = {
  isReleaseMultiDisc,
  isTrack,
  isTrackFromDisc,
  isTrackFirstPart,
  getReleaseArtist,
  getTracksFromRelease,
  joinMultiPartTracks,
};
