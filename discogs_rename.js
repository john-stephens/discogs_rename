const Discogs = require('disconnect').Client;
const {version} = require('./package.json');
const yargs = require('yargs');
const urlparse = require('url-parse');
const replaceSpecialCharacters = require('replace-special-characters');
const {toTitleCase, alwaysLowercaseWords} = require('@artsy/to-title-case');
const {deromanize} = require('romans');
const fs = require('fs/promises');

const AGENT=`DiscogsRename/${version}`;
const DISCOGS_HOST='discogs.com';
const RELEASE_PATH_REGEX=/\/release\/(?<releaseId>[0-9]+)$/;
const POSITION_MULTI_REGEX=/^(?<disc>[0-9]+[-\.])?(?<side>[AB])?(?<track>[0-9]+)(?<part>\.[0-9]+|[a-z]+)?$/;
const POSITION_SINGLE_REGEX=/^(?<side>[AB])?(?<track>[0-9]+)(?<part>\.[0-9]+|[a-z]+)?$/;
const FILE_PATH_REGEX=/^(?<path>.*\/)?(?<name>.*)(?<extension>\..*$)/;

// Don't allow words 4-letters or more to be capitalized (APA style)
for(let x = 0; x < alwaysLowercaseWords.length; x++) {
    const word = alwaysLowercaseWords[x];

    if(word.length >= 4) {
        alwaysLowercaseWords.splice(x, 1);
        x--;
    }
}

// Add missing lower-case words
alwaysLowercaseWords.push('in');
alwaysLowercaseWords.push('by');
alwaysLowercaseWords.push('off');
alwaysLowercaseWords.push('out');

// Lower-case common joining words
alwaysLowercaseWords.push('pres');
alwaysLowercaseWords.push('vs');
alwaysLowercaseWords.push('feat');

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
    .option('join-multi', {
        description: 'Join multi-part song titles into a single title',
        type: 'boolean'
    })
    .option('join-string', {
        description: 'String to use to when joining multi-part song titles',
        default: ' ',
        type: 'string'
    })
    .option('dryrun', {
        description: 'Show all output like normal, but don\'t actually rename files',
        type: 'boolean'
    })
    .option('debug', {
        description: 'Output debug-level details',
        type: 'boolean'
    })
    .help()
    .argv;

/**
 * Main program logic.
 */
async function main() {
    if(argv.debug) {
        console.log(argv);
    }

    // Parse the release id from the supplied URL
    const releaseId = getReleaseIdFromUrl(argv.url);

    if(!releaseId) {
        console.log('Discogs release id not found in the supplied URL');
        return;
    }

    // Look up the Discogs release
    const releaseData = await getDiscogsRelease(releaseId);

    if(argv.debug) {
        console.dir(releaseData, {depth: null});
    }

    // Parse the release data
    const release = parseRelease(releaseData);

    if(argv.debug) {
        console.dir(release, {depth: null});
    }

    // Check to see if we require a disc number
    if(isReleaseMultiDisc(release) && argv.disc === undefined) {
        console.log('Discogs release constains multiple discs, please specify using --disc');
        return;
    }

    // Get the tracks from the release
    let tracks = getTracksFromRelease(release, argv.disc, argv.joinMulti);

    if(argv.debug) {
        console.dir(tracks, {depth: null});
    }

    // Optionally join the multi-part tracks
    if(argv.joinMulti) {
        tracks = joinMultiPartTracks(tracks, argv.joinString);

        if(argv.debug) {
            console.dir(tracks, {depth: null});
        }
    }

    // Make sure that the number of tracks matches the files supplied
    if(!argv.ignoreCount && tracks.length != argv.file.length) {
        console.log('Number of tracks found does not match the number of files supplied');
        console.log(`${tracks.length} track(s) found, ${argv.file.length} file(s) supplied`);
        return;
    }

    // Get the formatted track names
    const artist = getReleaseArtist(release);
    const formattedTracks = getFormattedTracks(artist, tracks, argv.mix);

    if(argv.debug) {
        console.log(formattedTracks);
    }

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
 * @param {array} tracklist - The release track list data to parse
 * @param {boolean} multiDisc - Whether or not the release is multi-disc
 * @returns {object[]} The parsed release track list data
 */
function parseTracklist(tracklist, multiDisc) {
    const flatTracklist = flattenTracklist(tracklist);

    return flatTracklist.map(track => {
        // Parse the track position and title
        return {
            ...track,
            position: parseTrackPosition(track.position, multiDisc),
            title: parseTrackTitle(track.title)
        };
    });
}

/**
 * Flatten tracklist entries that have sub-tracks, taking the title from
 * the main track entry.
 *
 * @param {array} tracklist - The release track list data to parse
 * @returns {object} The flattened tracklist
 */
function flattenTracklist(tracklist) {
    // Test cases:
    // https://www.discogs.com/Orbital-The-Box/release/870
    // https://www.discogs.com/BT-%E4%BB%8A-Ima/release/23064
    const ret = [];

    for(let x = 0; x < tracklist.length; x++) {
        const track = tracklist[x];

        if(track.type_ === 'index' && track.sub_tracks && track.sub_tracks.length > 0) {
            const subtracks = flattenTracklist(track.sub_tracks);

            for(let y = 0; y < subtracks.length; y++) {
                ret.push({
                    ...subtracks[y],
                    title: track.title
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
        tempPosition = deromanize(position.toUpperCase()) + '';
    } catch(e) {
    }

    const regex = (multiDisc ? POSITION_MULTI_REGEX : POSITION_SINGLE_REGEX);
    const match = tempPosition.match(regex);

    if(!match) {
        return {};
    }

    let {disc, side, track, part} = match.groups;

    if(disc !== undefined) {
        disc = disc.substring(0, disc.length - 1);
    }

    if(part !== undefined && part.substring(0, 1) === '.') {
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
        } else {
            break;
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

    return (position.disc == disc && position.track !== undefined && position.track !== '');
}

/**
 * Determine if the give track is the first part of a track.
 *
 * @param {object} track - The track data
 * @returns {boolean} Whether or not the track is the first part
 */
function isTrackFirstPart(track) {
    const {position} = track;

    return (position.part === undefined || position.part === '1' || position.part === 'a');
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
 * @param {boolean} allParts - Whether or not all track parts should be returned
 * @returns {object[]} The tracks for the release
 */
function getTracksFromRelease(release, disc=undefined, allParts=false) {
    const {tracklist} = release;
    const tracks = tracklist.filter(track => {
        return (isTrack(track) && isTrackFromDisc(track, disc) && (allParts || isTrackFirstPart(track)))
    });

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

    for(let x = 0; x < tracks.length; x++) {
        const track = tracks[x];
        const {position} = track;

        if(position.part === undefined) {
            ret.push(track);
        } else {
            const titles = [track.title.name];

            for(let y = x + 1; y < tracks.length; y++) {
                const nextTrack = tracks[y];

                if(position.track == nextTrack.position.track) {
                    titles.push(nextTrack.title.name);
                    x++;
                } else {
                    break;
                }
            }

            ret.push({
                ...track,
                title: {
                    name: titles.join(joinString),
                    subtitles: []
                }
            });
        }
    }

    return ret;
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
    const formattedTrackArtist = formatTrackArtist(artist, artists);
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
function formatTrackArtist(releaseArtist, artists) {
    // Test cases:
    // - Multi-artist tracks with alternate names: https://www.discogs.com/John-Digweed-014-Hong-Kong/release/3308237
    // --Feat joins: https://www.discogs.com/Armin-van-Buuren-A-State-Of-Trance-2007/release/987443
    // --Presents join: https://www.discogs.com/DJ-Ti%C3%ABsto-In-Search-Of-Sunrise/release/23750
    // --Numeric artist number: https://www.discogs.com/Various-Discovery-Sampler-Alternative-Volume-One/release/2729201
    let formattedArtist;

    if(!artists || artists.length === 0) {
        formattedArtist = releaseArtist;
    } else {
        let parts = [];

        for(let x = 0; x < artists.length; x++) {
            let artist = artists[x].name;

            if(artists[x].anv && artists[x].anv !== '') {
                artist = artists[x].anv;
            }

            // Remove trailing artist number
            artist = artist.replace(/ \([0-9]+\)$/, '');

            parts.push(artist);

            if(artists[x].join && artists[x].join !== '') {
                let join = artists[x].join.toLowerCase();

                // Standardize joins
                if(join == 'v.' || join == 'v') {
                    join = 'vs';
                } else if(join == 'presents') {
                    join = 'pres';
                } else if(join == 'featuring') {
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
    return toTitleCase(replaceSpecialCharacters(name))
        .replace(/ [&\+] /g,' and ')
        .replace(/[&\+]/g,' and ')
        .replace(/ A /g, ' a ')
        .replace(/([0-9]+)\"/, '$1in')
        .replace(/[\'\.]/g, '')
        .replace(/[^0-9A-Za-z ]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+$/, '')
        .replace(/^\s+/, '')
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
