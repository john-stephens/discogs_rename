const yargs = require('yargs');

// Parse the command line arguments
const { argv } = yargs
  .command('* <url> <file..>', 'Rename music files based on track listings from Discogs')
  .positional('url', {
    description: 'The Discogs release URL to use',
    type: 'string',
  })
  .positional('file', {
    description: 'The file (track) to rename',
    type: 'string',
  })
  .option('mix', {
    description: 'Include artist in file name as part of a multi-artist mix',
    type: 'boolean',
  })
  .option('disc', {
    description: 'Disc number. Required for multi-disc albums',
    type: 'string',
  })
  .option('ignore-count', {
    description: 'Ignore a mismatch in file/track count',
    type: 'boolean',
  })
  .option('join-multi', {
    description: 'Join multi-part song titles into a single title',
    type: 'boolean',
  })
  .option('join-string', {
    description: 'String to use to when joining multi-part song titles',
    default: ' ',
    type: 'string',
  })
  .option('dryrun', {
    description: 'Show all output like normal, but don\'t actually rename files',
    type: 'boolean',
  })
  .option('debug', {
    description: 'Output debug-level details',
    type: 'boolean',
  })
  .help();

module.exports = {
  argv,
};
