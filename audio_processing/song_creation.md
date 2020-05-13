# song creation guide

## midi file
- be sure to set the midi file to the correct bpm (it defaults to 120 often, but you should always set it explicitly)
- if you are editing in a daw with the audio track as a reference, make sure the midi events will
be happening at the correct time (daw specific, but possible that the "midi region" or track length etc could offset the midi timing)
this might include making the midi region start at the same place as the audio track
- use midi tracks (not channels) to differentiate between sounds- the back end will assign one sound per track
- prefix the track name with "nopitch_" if you want the back end not to alter the pitch of the sound its using for that track
- prefix the track name with "relativepitch_" if you want the back end to shift the pitch of the sound based on the midi track, without transposing the sound to the midi pitch first
- quantizng midi event durations will save the server from having to recompute stuff, so do that as much as you can

## audio files
- an audio file for each key is recommended, pitch shifting them more than one or two half steps can start to sound bad
- audio must be in .aac format
- audio should be 44100 sample rate
