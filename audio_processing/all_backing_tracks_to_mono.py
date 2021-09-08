'''
mix an audio file down to a mono audio file using ffmpeg
this should account for the reencoding timing offset
'''
import glob
import subprocess as sp
import tempfile
import os
import shutil
import audio_conversion as ac
dir_path = os.path.dirname(os.path.realpath(__file__))
tmp_audio_dir = os.path.join(dir_path, 'tmp_audio')


for aac_fp in glob.glob('../songs/*/*.aac'):
    wav_tmp_fp = aac_fp.replace('.aac', '.wav')

    # mix down to a temp mono wav file
    cmd = 'ffmpeg -i {} -ac 1 {}'.format(aac_fp, wav_tmp_fp)
    sp.call(cmd, shell=True)

    # overwrite old aac with new one
    ac.wav_to_aac_no_offset(wav_tmp_fp)
    os.remove(wav_tmp_fp)
