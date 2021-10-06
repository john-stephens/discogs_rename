const fs = require('fs/promises');

const FILE_PATH_REGEX = /^(?<path>.*\/)?(?<name>.*)(?<extension>\..*$)/;

/**
 * Parse the given file path into components.
 *
 * The components returned are "path", "name", and "extension".
 *
 * @param {string} filePath - The file path to parse
 * @returns {object} The parsed file path
 */
function parseFilePath(filePath) {
  const match = filePath.match(FILE_PATH_REGEX);
  const ret = { ...match.groups };

  // Make sure we have a path string
  if (!ret.path) {
    ret.path = '';
  }

  return ret;
}

/**
 * Match the file paths with the formatted track names, renaming the files.
 *
 * @param {string[]} files - The file paths to rename
 * @param {string[]} tracks - The formatted track names
 * @param {boolean} dryrun - Whether or not we should actually rename the files
 */
async function renameFiles(files, tracks, dryrun) {
  for (let x = 0; x < files.length; x += 1) {
    const filePath = files[x];
    const track = tracks[x];
    const fileParts = parseFilePath(filePath);
    const newFilePath = `${fileParts.path}${track}${fileParts.extension}`;

    console.log(`${filePath} => ${newFilePath}...`);

    if (!dryrun) {
      // eslint-disable-next-line no-await-in-loop
      await fs.rename(filePath, newFilePath);
    }
  }
}

module.exports = {
  parseFilePath,
  renameFiles,
};
