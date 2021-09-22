# discogs_rename
Script to rename audio files (mp3, wav, ogg, etc) by using release data from
Discogs.

### Features

* Quick per-disc rename of audio files using Discogs
* Proper capitalization of artist and track names
* "Mix" mode to handle DJ mixes and Various Artist releases
* Check to ensure that the number of files match the release, optional override
* Dry-run option to see what the script will do

### Requirements
These packages will need to be installed before using this script.

* node

### Basic Usage
`discogs_rename {DISCOGS_RELEASE_URL} {AUDIO_FILES}`

### Advanced Usage
```
discogs_rename.js <url> <file..>

Rename music files based on track listings from Discogs

Positionals:
  url   The Discogs release URL to use                                  [string]
  file  The file (track) to rename                                      [string]

Options:
  --version       Show version number                                  [boolean]
  --mix           Include artist in file name as part of a multi-artist mix
                                                                       [boolean]
  --disc          Disc number. Required for multi-disc albums           [number]
  --ignore-count  Ignore a mismatch in file/track count                [boolean]
  --dryrun        Show all output like normal, but don't actually rename files
                                                                       [boolean]
  --debug         Output debug-level details                           [boolean]
  --help          Show help                                            [boolean]
```

### Example
```
> discogs_rename https://www.discogs.com/BT-Movement-In-Still-Life/release/15674230 *.mp3
track01.mp3 => 01-Movement_in_Still_Life.mp3...
track02.mp3 => 02-Ride.mp3...
track03.mp3 => 03-Madskillz_Mic_Chekka.mp3...
track04.mp3 => 04-The_Hip_Hop_Phenomenon.mp3...
track05.mp3 => 05-Mercury_and_Solace.mp3...
track06.mp3 => 06-Dreaming.mp3...
track07.mp3 => 07-Giving_up_the_Ghost.mp3...
track08.mp3 => 08-Godspeed.mp3...
track09.mp3 => 09-Namistai.mp3...
track10.mp3 => 10-Running_down_the_Way_Up.mp3...
track11.mp3 => 11-Satellite.mp3...
```
