const Discogs = require('disconnect').Client;
const {version} = require('./package.json');
const yargs = require('yargs');
const urlparse = require('url-parse');
const replaceSpecialCharacters = require('replace-special-characters');
const capitalizeTitle = require('title');
const fs = require('fs/promises');

const AGENT=`DiscogsRename/${version}`;
const DISCOGS_HOST='discogs.com';
const RELEASE_PATH_REGEX=/\/release\/(?<releaseId>[0-9]+)$/;
const POSITION_REGEX=/^(?<disc>[0-9]+(-))?(?<side>[AB])?(?<track>[0-9]+)(?<part>\.[0-9]+)?$/;
const FILE_PATH_REGEX=/^(?<path>.*\/)?(?<name>.*)(?<extension>\..*$)/;

// Parse the command line arguments
const argv = yargs
    .command('* <url> <file..>', 'Rename music files based on track listings from Discogs')
    .positional('url', {
        description: 'The Discogs release URL to use',
        type: 'string'
    })
    .positional('file', {
        description: 'The file (track) to rename',
        type: 'string'
    })
    .option('mix', {
        description: 'Include artist in file name as part of a multi-artist mix',
        type: 'boolean'
    })
    .option('disc', {
        description: 'Disc number. Required for multi-disc albums',
        type: 'number'
    })
    .option('ignore-count', {
        description: 'Ignore a mismatch in file/track count',
        type: 'boolean'
    })
    .option('dryrun', {
        description: 'Show all output like normal, but don\'t actually rename files',
        type: 'boolean'
    })
    .help()
    .argv;

/**
 * Main program logic.
 */
async function main() {
    // Parse the release id from the supplied URL
    const releaseId = getReleaseIdFromUrl(argv.url);

    if(!releaseId) {
        console.log('Discogs release id not found in the supplied URL');
        return;
    }

    // Look up the Discogs release
    const releaseData = await getDiscogsRelease(releaseId);

    // Parse the release data
    const release = parseRelease(releaseData);

    // Check to see if we require a disc number
    if(isReleaseMultiDisc(release) && argv.disc === undefined) {
        console.log('Discogs release constains multiple discs, please specify using --disc');
        return;
    }

    // Get the tracks from the release
    const tracks = getTracksFromRelease(release, argv.disc);

    // Make sure that the number of tracks matches the files supplied
    if(!argv.ignoreCount && tracks.length != argv.file.length) {
        console.log('Number of tracks found does not match the number of files supplied');
        console.log(`${tracks.length} track(s) found, ${argv.file.length} file(s) supplied`);
        return;
    }

    // Get the formatted track names
    const artist = getReleaseArtist(release);
    const formattedTracks = getFormattedTracks(artist, tracks, argv.mix);

    // Rename the files
    renameFiles(argv.file, formattedTracks, argv.dryrun);
}

/**
 * Validate the provided Discogs release URL.
 *
 * @param {object} parsedUrl - The parsed Discogs URL
 * @returns {boolean} True if the supplied URL is a Discogs release URL
 */
function validateDiscogsUrl(parsedUrl) {
    const {protocol, hostname, pathname} = parsedUrl;

    return ((protocol === 'http:' || protocol === 'https:') &&
        (hostname === `www.${DISCOGS_HOST}` || hostname === DISCOGS_HOST) &&
        pathname.match(RELEASE_PATH_REGEX));
}

/**
 * Parse the release id out of the provided Discogs release URL.
 *
 * @param {string} url - The Discogs URL to parse the release id from
 * @returns {(string|undefined)} The release id, if found
 */
function getReleaseIdFromUrl(url) {
    const parsedUrl = urlparse(url);

    if(!validateDiscogsUrl(parsedUrl)) {
        return;
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
    return new Promise(resolve => {
        try {
            const discogs = new Discogs(AGENT);
            const db = discogs.database();

            db.getRelease(releaseId, function(err, data){
                resolve(data);
            });
        } catch( e ) {
            resolve(false);
        }
    });
}

/**
 * Parse the release data.
 *
 * @param {object} releaseData - The release data to parse
 * @returns {object} The parsed release data
 */
function parseRelease(releaseData) {
    return {
        ...releaseData,
        tracklist: parseTracklist(releaseData.tracklist),
    };
}

/**
 * Parse the release track list data.
 *
 * This parses the track position and title for each track into smaller pieces.
 *
 * @param {array} tracklist - The release track list data to parse
 * @returns {object[]} The parsed release track list data
 */
function parseTracklist(tracklist) {
    return tracklist.map(track => {
        // Parse the track position and title
        return {
            ...track,
            position: parseTrackPosition(track.position),
            title: parseTrackTitle(track.title)
        };
    });
}

/**
 * Parse the release track position into smaller pieces.
 *
 * This splits the release track position into an object containing the "disc",
 * "side", "track", and "part" components.
 *
 * @param {string} position - The release track position
 * @returns {(object|undefined)} The parsed release track position
 */
function parseTrackPosition(position) {
    const match = position.match(POSITION_REGEX);

    if(!match) {
        return;
    }

    let {disc, side, track, part} = match.groups;

    if(disc !== undefined) {
        disc = disc.substring(0, disc.length - 1);
    }

    if(part !== undefined) {
        part = part.substring(1);
    }

    return {
        disc,
        side,
        track,
        part
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
    let rawTitle = title
    const subtitles = [];

    while(rawTitle.substr(rawTitle.length - 1) === ')') {
        const index = rawTitle.lastIndexOf(' (');
        if(index !== -1) {
            let rawSubtitle = rawTitle.substr(index);
            rawTitle = rawTitle.substr(0, rawTitle.length - rawSubtitle.length);

            rawSubtitle = rawSubtitle.replace(/^ \((.*)\)$/, '$1');

            subtitles.unshift(rawSubtitle);
        }
    }

    return {
        name: rawTitle,
        subtitles
    };
}

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
function isTrackFromDisc(track, disc=undefined) {
    const {position} = track;

    // Note: For multi-part tracks, this only matches the first part
    return (position.disc == disc);
}

/**
 * Determine if the give track is the first part of a track.
 *
 * @param {object} track - The track data
 * @returns {boolean} Whether or not the track is the first part
 */
function isTrackFirstPart(track) {
    const {position} = track;

    return (position.part === undefined || position.part === '1');
}

/**
 * Get the primary artist for the release.
 *
 * @param {object} release - The release data
 * @returns {string} The primary artist for the release
 */
function getReleaseArtist(release) {
    const {artists} = release;

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
 * @returns {object[]} The tracks for the release
 */
function getTracksFromRelease(release, disc=undefined) {
    const {tracklist} = release;
    const tracks = tracklist.filter(track => {
        return (isTrack(track) && isTrackFromDisc(track, disc) && isTrackFirstPart(track))
    });

    return tracks;
}

/**
 * Get the tracks formatted as filenames.
 *
 * @param {string} artist - The primary artist for the release
 * @param {object[]} tracks - The tracks for the release
 * @param {boolean} mix - Whether or not this is a multi-artist mix
 * @returns {string[]} The tracks formatted as filenames
 */
function getFormattedTracks(artist, tracks, mix=false) {
    return tracks.map(track => formatTrack(artist, track, mix));
}

/**
 * Get the track formatted as a filename.
 *
 * @param {string} artist - The primary artist for the release
 * @param {object} track - The track data
 * @param {boolean} mix - Whether or not this is a multi-artist mix
 * @returns {string} The track formatted as a filename
 */
function formatTrack(artist, track, mix=false) {
    const {position, artists, title} = track;

    const formattedPosition = formatTrackPosition(position);
    const formattedTrackArtist = formatTrackArtist(artists?.[0]?.name || artist);
    const formattedTrackTitle = formatTrackTitle(title);

    if(mix) {
        return `${formattedPosition}-${formattedTrackArtist}-${formattedTrackTitle}`;
    } else {
        return `${formattedPosition}-${formattedTrackTitle}`;
    }
}

/**
 * Get the track position filename component.
 *
 * @param {object} position - The track position 
 * @returns {string} The track position filename component
 */
function formatTrackPosition(position) {
    const {track} = position;

    if(track.length < 2) {
        return `0${track}`;
    } else {
        return track;
    }
}

/**
 * Get the track artist filename component.
 *
 * @param {string} artist - The track artist
 * @returns {string} The track artist filename component
 */
function formatTrackArtist(artist) {
    return formatName(artist);
}

/**
 * Get the track title filename component.
 *
 * @param {object} title - The track title
 * @returns {string} The track title filename component
 */
function formatTrackTitle(title) {
    const {name, subtitles} = title;
    const subtitle = undefined;

    if(subtitles && subtitles.length > 0) {
        return formatName(name) + '-' + formatName(subtitles[subtitles.length -1]);
    } else {
        return formatName(name);
    }
}

/**
 * Get the formatted artist or title name.
 *
 * @param {string} name - The name to format
 * @returns {string} The formatted name
 */
function formatName(name) {
    return capitalizeTitle(replaceSpecialCharacters(name))
        .replace(/&/g,'and')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+$/, '')
        .replace(/([0-9]+)\"/, '$1in')
        .replace(/[^[0-9A-Za-z ]/g, '')
        .replace(/ /g, '_');
}

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
    const ret = {...match.groups};

    // Make sure we have a path string
    if(!ret.path) {
        ret.path = "";
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
    for(let x = 0; x < files.length; x++) {
        const filePath = files[x];
        const track = tracks[x];
        const fileParts = parseFilePath(filePath);
        const newFilePath = `${fileParts.path}${track}${fileParts.extension}`;

        console.log(`${filePath} => ${newFilePath}...`);

        if(!dryrun) {
            await fs.rename(filePath, newFilePath);
        }
    }
}

main();
