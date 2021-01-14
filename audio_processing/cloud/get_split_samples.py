import os
import subprocess as sp
import glob


if __name__ == '__main__':
    input('download all raws in bucket?')
    out = sp.check_output('gsutil ls gs://song_barker_sequences/*/raw.aac', shell=True)
    c = 0
    out = out.decode('utf-8')
    for fp in out.split('\n'):
        if len(fp) == 0:
            continue
        c += 1
        sp.call('gsutil cp {} {}'.format(
            fp,
            'split_samples/{:05}.aac'.format(c)
        ), shell=True)
