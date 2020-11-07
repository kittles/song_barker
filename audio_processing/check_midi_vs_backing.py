import subprocess as sp
import argparse
from midi2audio import FluidSynth
fs = FluidSynth()


input_fp = '../songs/old_macdonald_harmonized/song.mid'
backing_fp_aac = '../songs/old_macdonald_harmonized/C.aac'

#input_fp = '../../../../Downloads/song (1).mid'
#backing_fp_aac = '../songs/old_macdonald_pitched/C.aac'

#input_fp = '../songs/old_macdonald_harmonized/song.mid'
#backing_fp_aac = '/home/patrick/Desktop/A-old.aac'

output_fp = 'midi-audio.wav'
output_louder_fp = 'midi-audio-louder.wav'
both_fp = 'midi-audio-with-backing.wav'

# make a wav of the backing track
backing_fp = 'backing.wav'
sp.call('ffmpeg -nostats -hide_banner -loglevel panic -y -i {} {}'.format(backing_fp_aac, backing_fp), shell=True)

# render the midi as a wav
fs.midi_to_audio(input_fp, output_fp)
sp.call('ffmpeg -i {} -filter:a "volume=5" {}'.format(output_fp, output_louder_fp), shell=True)

# join the two wavs together
cmd = 'ffmpeg -i {} -i {} -y -filter_complex amix=inputs=2:duration=longest {}'.format(
    output_louder_fp,
    backing_fp,
    both_fp
)
sp.call(cmd, shell=True)

sp.call('play {}'.format(both_fp), shell=True)
