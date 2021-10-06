const { deromanize } = require('romans');
const { isReleaseMultiDisc } = require('./utils');

const POSITION_MULTI_REGEX = /^(?<disc>[0-9]+[-.])?(?<side>[AB])?(?<track>[0-9]+)(?<part>\.[0-9]+|[a-z]+)?$/;
const POSITION_SINGLE_REGEX = /^(?<side>[AB])?(?<track>[0-9]+)(?<part>\.[0-9]+|[a-z]+)?$/;

/**
 * Parse the release data.
 *
 * @param {object} releaseData - The release data to parse
 * @returns {object} The parsed release data
 */
function parseRelease(releaseData) {
  const multiDisc = isReleaseMultiDisc(releaseData);

  return {
    ...releaseData,
    tracklist: parseTracklist(releaseData.tracklist, multiDisc),
  };
}

/**
 * Parse the release track list data.
 *
 * This parses the track position and title for each track into smaller pieces.
 *
 * @param {Array} tracklist - The release track list data to parse
 * @param {boolean} multiDisc - Whether or not the release is multi-disc
 * @returns {object[]} The parsed release track list data
 */
function parseTracklist(tracklist, multiDisc) {
  const flatTracklist = flattenTracklist(tracklist);

  // Parse the track position and title
  return flatTracklist.map((track) => ({
    ...track,
    position: parseTrackPosition(track.position, multiDisc),
    title: parseTrackTitle(track.title),
  }));
}

/**
 * Flatten tracklist entries that have sub-tracks, taking the title from
 * the main track entry.
 *
 * @param {Array} tracklist - The release track list data to parse
 * @returns {object} The flattened tracklist
 */
function flattenTracklist(tracklist) {
  // Test cases:
  // https://www.discogs.com/Orbital-The-Box/release/870
  // https://www.discogs.com/BT-%E4%BB%8A-Ima/release/23064
  const ret = [];

  for (let x = 0; x < tracklist.length; x += 1) {
    const track = tracklist[x];

    // eslint-disable-next-line no-underscore-dangle
    if (track.type_ === 'index' && track.sub_tracks && track.sub_tracks.length > 0) {
      const subtracks = flattenTracklist(track.sub_tracks);

      for (let y = 0; y < subtracks.length; y += 1) {
        ret.push({
          ...subtracks[y],
          title: track.title,
        });
      }
    } else {
      ret.push(track);
    }
  }

  return ret;
}

/**
 * Parse the release track position into smaller pieces.
 *
 * This splits the release track position into an object containing the "disc",
 * "side", "track", and "part" components.
 *
 * @param {string} position - The release track position
 * @param {boolean} multiDisc - Whether or not the release is multi-disc
 * @returns {object} The parsed release track position
 */
function parseTrackPosition(position, multiDisc) {
  // Test cases:
  // - Multi disc, decimal disc split: https://www.discogs.com/John-B-Redox-Catalyst-Reprocessed/release/9935899
  // - Single disc, decimal part split: https://www.discogs.com/Paul-Oakenfold-Tranceport/release/3428
  // - Alpha part (a/b/c): https://www.discogs.com/Cirrus-Back-On-A-Mission/release/13581
  // - Roman numerals: https://www.discogs.com/Chvrches-The-Bones-Of-What-You-Believe/release/6480272
  let tempPosition = position;

  try {
    tempPosition = `${deromanize(position.toUpperCase())}`;
  } catch (e) {
    // Ignore error
  }

  const regex = (multiDisc ? POSITION_MULTI_REGEX : POSITION_SINGLE_REGEX);
  const match = tempPosition.match(regex);

  if (!match) {
    return {};
  }

  const { side, track } = match.groups;
  let { disc, part } = match.groups;

  if (disc !== undefined) {
    disc = disc.substring(0, disc.length - 1);
  }

  if (part !== undefined && part.substring(0, 1) === '.') {
    part = part.substring(1);
  }

  return {
    disc,
    side,
    track,
    part,
  };
}

/**
 * Parse the release track title into smaller pieces.
 *
 * This splits the title into "name" and "subtitles" components.
 *
 * @param {string} title - The release track title
 * @returns {object} The parsed release track title
 */
function parseTrackTitle(title) {
  // Parse out the subtitles
  let rawTitle = title;
  const subtitles = [];

  while (rawTitle.substr(rawTitle.length - 1) === ')') {
    const index = rawTitle.lastIndexOf(' (');
    if (index !== -1) {
      let rawSubtitle = rawTitle.substr(index);
      rawTitle = rawTitle.substr(0, rawTitle.length - rawSubtitle.length);

      rawSubtitle = rawSubtitle.replace(/^ \((.*)\)$/, '$1');

      subtitles.unshift(rawSubtitle);
    } else {
      break;
    }
  }

  return {
    name: rawTitle,
    subtitles,
  };
}

module.exports = {
  parseRelease,
  parseTracklist,
  flattenTracklist,
  parseTrackPosition,
  parseTrackTitle,
};
