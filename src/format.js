const replaceSpecialCharacters = require('replace-special-characters');
const { toTitleCase, alwaysLowercaseWords } = require('@artsy/to-title-case');

// Don't allow words 4-letters or more to be capitalized (APA style)
for (let x = 0; x < alwaysLowercaseWords.length; x += 1) {
  const word = alwaysLowercaseWords[x];

  if (word.length >= 4) {
    alwaysLowercaseWords.splice(x, 1);
    x -= 1;
  }
}

// Lower-case common joining words
alwaysLowercaseWords.push('pres');
alwaysLowercaseWords.push('vs');
alwaysLowercaseWords.push('feat');

/**
 * Get the tracks formatted as filenames.
 *
 * @param {string} artist - The primary artist for the release
 * @param {object[]} tracks - The tracks for the release
 * @param {boolean} mix - Whether or not this is a multi-artist mix
 * @returns {string[]} The tracks formatted as filenames
 */
function getFormattedTracks(artist, tracks, mix = false) {
  return tracks.map((track) => formatTrack(artist, track, mix));
}

/**
 * Get the track formatted as a filename.
 *
 * @param {string} artist - The primary artist for the release
 * @param {object} track - The track data
 * @param {boolean} mix - Whether or not this is a multi-artist mix
 * @returns {string} The track formatted as a filename
 */
function formatTrack(artist, track, mix = false) {
  const { position, artists, title } = track;

  const formattedPosition = formatTrackPosition(position);
  const formattedTrackArtist = formatTrackArtist(artist, artists);
  const formattedTrackTitle = formatTrackTitle(title);

  if (mix) {
    return `${formattedPosition}-${formattedTrackArtist}-${formattedTrackTitle}`;
  }
  return `${formattedPosition}-${formattedTrackTitle}`;
}

/**
 * Get the track position filename component.
 *
 * @param {object} position - The track position
 * @returns {string} The track position filename component
 */
function formatTrackPosition(position) {
  const { track } = position;

  if (track.length < 2) {
    return `0${track}`;
  }
  return track;
}

/**
 * Get the track artist filename component.
 *
 * @param {string} releaseArtist - The artist for the whole release
 * @param {object[]} artists - The track artists
 * @returns {string} The track artist filename component
 */
function formatTrackArtist(releaseArtist, artists) {
  // Test cases:
  // - Multi-artist tracks with alternate names: https://www.discogs.com/John-Digweed-014-Hong-Kong/release/3308237
  // --Feat joins: https://www.discogs.com/Armin-van-Buuren-A-State-Of-Trance-2007/release/987443
  // --Presents join: https://www.discogs.com/DJ-Ti%C3%ABsto-In-Search-Of-Sunrise/release/23750
  // --Numeric artist number: https://www.discogs.com/Various-Discovery-Sampler-Alternative-Volume-One/release/2729201
  let formattedArtist;

  if (!artists || artists.length === 0) {
    formattedArtist = releaseArtist;
  } else {
    const parts = [];

    for (let x = 0; x < artists.length; x += 1) {
      let artist = artists[x].name;

      if (artists[x].anv && artists[x].anv !== '') {
        artist = artists[x].anv;
      }

      // Remove trailing artist number
      artist = artist.replace(/ \([0-9]+\)$/, '');

      parts.push(artist);

      if (artists[x].join && artists[x].join !== '') {
        let join = artists[x].join.toLowerCase();

        // Standardize joins
        if (join === 'v.' || join === 'v') {
          join = 'vs';
        } else if (join === 'presents') {
          join = 'pres';
        } else if (join === 'featuring') {
          join = 'feat';
        }

        parts.push(join);
      } else {
        break;
      }
    }

    formattedArtist = parts.join(' ');
  }

  return formatName(formattedArtist);
}

/**
 * Get the track title filename component.
 *
 * @param {object} title - The track title
 * @returns {string} The track title filename component
 */
function formatTrackTitle(title) {
  const { name, subtitles } = title;

  if (subtitles && subtitles.length > 0) {
    return `${formatName(name)}-${formatName(subtitles[subtitles.length - 1])}`;
  }
  return formatName(name);
}

/**
 * Get the formatted artist or title name.
 *
 * @param {string} name - The name to format
 * @returns {string} The formatted name
 */
function formatName(name) {
  return toTitleCase(replaceSpecialCharacters(name))
    .replace(/ [&+] /g, ' and ')
    .replace(/[&+]/g, ' and ')
    .replace(/ A /g, ' a ')
    .replace(/([0-9]+)"/, '$1in')
    .replace(/['.]/g, '')
    .replace(/[^0-9A-Za-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+$/, '')
    .replace(/^\s+/, '')
    .replace(/ /g, '_');
}

module.exports = {
  getFormattedTracks,
  formatTrack,
  formatTrackPosition,
  formatTrackArtist,
  formatTrackTitle,
  formatName,
};
