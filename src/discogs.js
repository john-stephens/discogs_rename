const Discogs = require('disconnect').Client;
const urlparse = require('url-parse');
const { version } = require('../package.json');

const AGENT = `DiscogsRename/${version}`;
const DISCOGS_HOST = 'discogs.com';
const RELEASE_PATH_REGEX = /\/release\/(?<releaseId>[0-9]+)$/;

/**
 * Validate the provided Discogs release URL.
 *
 * @param {object} parsedUrl - The parsed Discogs URL
 * @returns {boolean} True if the supplied URL is a Discogs release URL
 */
function validateDiscogsUrl(parsedUrl) {
  const { protocol, hostname, pathname } = parsedUrl;

  return ((protocol === 'http:' || protocol === 'https:')
        && (hostname === `www.${DISCOGS_HOST}` || hostname === DISCOGS_HOST)
        && pathname.match(RELEASE_PATH_REGEX));
}

/**
 * Parse the release id out of the provided Discogs release URL.
 *
 * @param {string} url - The Discogs URL to parse the release id from
 * @returns {(string|boolean)} The release id, if found, false otherwise
 */
function getReleaseIdFromUrl(url) {
  const parsedUrl = urlparse(url);

  if (!validateDiscogsUrl(parsedUrl)) {
    return false;
  }

  const match = parsedUrl.pathname.match(RELEASE_PATH_REGEX);

  return match.groups.releaseId;
}

/**
 * Retrieve the release details from Discogs.
 *
 * @param {string} releaseId - The Discogs release id to retrieve
 * @returns {(object|boolean)} The release details, false returned upon error
 */
function getDiscogsRelease(releaseId) {
  return new Promise((resolve) => {
    const discogs = new Discogs(AGENT);
    const db = discogs.database();

    db.getRelease(releaseId, (err, data) => {
      resolve(data);
    });
  });
}

module.exports = {
  validateDiscogsUrl,
  getReleaseIdFromUrl,
  getDiscogsRelease,
};
