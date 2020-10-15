import glob
import subprocess
import subprocess as sp

def normalize_all_songs ():
    peak = '-12.0'
    loudness = '-16.0'
    for fp in glob.glob('../../songs/*/*.aac'):
        cmd = 'python to_normalized_loudness.py -i "{}" -p "{}" -l "{}"'.format(fp, peak, loudness)
        print(cmd)
        sp.call(cmd, shell=True)


def normalize_all_barks ():
    peak = '-12.0'
    loudness = '-16.0'
    for fp in glob.glob('../../stock_assets/barks/*/*.aac'):
        cmd = 'python to_normalized_loudness.py -i "{}" -p "{}" -l "{}"'.format(fp, peak, loudness)
        print(cmd)
        sp.call(cmd, shell=True)

if __name__ == '__main__':
    #normalize_all_barks()
