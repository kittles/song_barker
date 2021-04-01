# songs
the `songs/` dir holds the information and audio for the backing tracks that go with the user
generated sequences.

there are a number of distinct things that youll need to do with songs.
most frequently, you will need to update / synchronize the songs with
whatever changes have been made by jeremy or whoever. this can be adding new songs,
changing the info for a song, changing the audio file for a song, etc. i will
describe the process for doing those things here, but first ill give a basic description of
a single song within the `/songs` dir.

## a single song directory structure
within a single song directory, there must be the following:
- `info.json`: a file that contains metadata about the song
- `song.mid`: a midi file that is used by the back end and cloud to generate sequences
- 12 aac files, named for the key they are in (use only sharps, not flats). these are backing tracks
that go with the generated sequence.

## song backing tracks
there are a couple things to remember about song backing tracks:

- they are aac files, and when converting to wav (or whatever) and then reencoding as aac, there will be a little
bit of extra silence added to the beginning. this is apparently part of the aac spec and is not a
bug with ffmpeg. make sure when you are reencoding things that you use code that is aware of this.
ive written some functions that do their best to undo the offset reencoding introduces- specifically the 
`wav_to_aac_no_offset` function in `audio_processing/audio_conversion.py`.
- make sure songs are homogenous in perceived loudness, samplerate and channel count. not just within
a directory, but across all songs. i think we currently use 44000 sample rate, mono, and i processed
the backing tracks with a perceptual loudness meter to get them even. there may be some scripts in
varying degrees of readiness for these kinds of tasks.

## the midi file
though you probably wont be writing midi tracks yourself, here are some guidelines just for reference:

be sure to set the midi file to the correct bpm (it defaults to 120 often, but you should always set it explicitly)
if you are editing in a daw with the audio track as a reference, make sure the midi events will
be happening at the correct time (daw specific, but possible that the "midi region" or track length etc could offset the midi timing)
this might include making the midi region start at the same place as the audio track
use midi tracks (not channels) to differentiate between sounds- the back end will assign one sound per track
prefix the track name with `nopitch_` if you want the back end not to alter the pitch of the sound its using for that track
prefix the track name with `relativepitch_` if you want the back end to shift the pitch of the sound based on the midi track, without transposing the sound to the midi pitch first
quantizng midi event durations will save the server from having to recompute stuff, so do that as much as you can

## syncing songs
to update song backing tracks or add new songs, run `audio_processing/sync_songs_with_db_and_bucket.py`.
it will upload the backing tracks and info and midi file, essentially overwriting whatever was
in the bucket already for that song. remember that your local server and the dev server use the same
bucket, so if you run this on your local machine, without then running it on the dev server,
you will confuse the dev server potentially. in general,
i try to work as much as possible by cloning the dev db to my local computer.
