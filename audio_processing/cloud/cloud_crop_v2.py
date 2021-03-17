'''
this is for splitting audio based on silence / whatever
for generating usable "barks" for sequences


it should accept an audio file
return options:
    1. timestamps of crops
    2. actual crop arrays
'''
import sys
import glob
import json
import uuid
import scipy
import math
import time
import argparse
import tempfile
import os
from scipy.io import wavfile
import subprocess as sp
import numpy as np
import bucket_client as bc
import audio_conversion as ac
import pyloudnorm as pyln
from matplotlib import pyplot as plt
from a_weighting import a_weight


def preprocess_data (data, samplerate):
    B, A = a_weight(samplerate)
    weighted = scipy.signal.lfilter(B, A, data)
    smooth = scipy.signal.savgol_filter(np.abs(weighted), 8001, 3)
    return smooth


def idx_window (idx, window_size, data):
    start = max(0, idx - window_size)
    end = min(len(data), idx + window_size)
    return start, end


def onset_and_decay_events (data, samplerate, plot=False):
    smooth = preprocess_data(data, samplerate)
    if plot:
        plt.plot(smooth)
    threshold = np.average(smooth)
    if plot:
        plt.hlines(threshold, 0, len(smooth), colors='red', zorder=3, linestyle='dotted')
    crossings = []
    for idx, i in enumerate(smooth):
        if abs(i - threshold) / threshold > 0.1:
            continue
        else:
            crossings.append(idx)

    # identify leftmost and rightmost points of regions
    leftmost = []
    rightmost = []
    window_size = int(0.01 * samplerate)
    # remember, crossings are indicies!
    for idx, crossing in enumerate(crossings):
        if idx == 0:
            leftmost.append(crossing)
            continue
        if idx == len(crossings) - 1:
            rightmost.append(crossing)
            continue
        if (crossing - crossings[idx - 1]) > window_size:
            leftmost.append(crossing)
        if (crossings[idx + 1] - crossing) > window_size:
            rightmost.append(crossing)
    if plot:
        plt.scatter(leftmost, [threshold for _ in leftmost], color='green', zorder=5, marker='x')
        plt.scatter(rightmost, [threshold for _ in rightmost], color='red', zorder=5, marker='x')

    onsets = []
    decays = []
    for idx in leftmost:
        # is this an attack or decay
        start, end = idx_window(idx, 200, smooth)
        if sum(smooth[start:idx]) < sum(smooth[idx:end]):
            # attack
            onsets.append(idx)
        else:
            pass
    for idx in rightmost:
        start, end = idx_window(idx, 200, smooth)
        if sum(smooth[start:idx]) < sum(smooth[idx:end]):
            pass
        else:
            # decay
            decays.append(idx)

    if plot:
        plt.scatter(onsets, [-0.01 for _ in onsets], color='green', zorder=5, marker='o')
        plt.scatter(decays, [-0.01 for _ in decays], color='red', zorder=5, marker='o')

    return onsets, decays


def events_to_regions (onsets, decays, data, samplerate, min_duration=0.15, max_duration=0.7):
    ''' join onset and decay events into a region (to
    be used as a crop start and end, after a little more processing)
    '''
    # onsets and decays are indicies of the data array
    min_samples = int(samplerate * min_duration)
    max_samples = int(samplerate * max_duration)
    onsets.sort()
    decays.sort()
    regions = []
    for onset in onsets:
        decay = [d for d in decays if d > onset]
        if len(decay):
            # look for the shortest region within the duration window
            for d in decay:
                if ((d - onset) >= min_samples) and ((d - onset) <= max_samples):
                    regions.append([onset, d])
                    break
        else:
            continue
    return regions


def threshold_crossings (threshold, data):
    crossings = 0
    for i, j in zip(data[:-1], data[1:]):
        if ((i < threshold and j > threshold) or
           (i > threshold and j < threshold)):
            crossings += 1
    return crossings


def single_peaked (crop, samplerate):
    smooth = preprocess_data(crop, samplerate)
    threshold = np.average(smooth)
    return threshold_crossings(threshold, smooth) == 2


def pad_region (region, data, samplerate):
    start, end = region[0], region[1]
    end += int(0.1 * samplerate)
    end = min(len(data), end)
    return [start, end]


def crop_to_aac (crop_bounds, data, samplerate, temp_dir, debug=False):
    # NOTE data should be float64
    # add a bit of extra at the beginning to handle the -.023 seconds
    # lost from aac reencoding
    extra_sample_count = int(samplerate * 0.0231)
    extra_samples = np.zeros(extra_sample_count, dtype=np.float64)
    data = np.concatenate((extra_samples, data, extra_samples))
    crop_bounds[0] += extra_sample_count
    crop_bounds[1] += extra_sample_count
    duration = (crop_bounds[1] - crop_bounds[0]) / samplerate
    # ramp in and out
    crop = pyln.normalize.peak(data[crop_bounds[0]:crop_bounds[1]], -1.0)
    fades = np.ones(len(crop), dtype=np.float64)
    fades[:100] = np.arange(0, 1, 0.01)
    fades[-100:] = np.arange(1, 0, -0.01)
    final = crop * fades
    if debug:
        print('    duration: {:.2f}'.format(len(final) / samplerate))
    # NOTE do volume adjustment in ffmpeg?
    tmp_wav_fp = os.path.join(temp_dir, '{}.wav'.format(str(uuid.uuid4())))
    wavfile.write(tmp_wav_fp, samplerate, final)
    tmp_aac_fp = ac.wav_to_aac_no_offset(tmp_wav_fp)
    if debug:
        sp.call('play {} -q -V1'.format(tmp_wav_fp), shell=True)
    return {
        'fp': tmp_aac_fp,
        'duration': duration,
    }


def cloud_endpoint (raw_uuid, bucket_name, debug=False):
    ''' what the cloud server actually hits up
    '''
    # download the file
    with tempfile.TemporaryDirectory() as tmp_dir:
        ## mac symlinks the provided temp path
        ## to where it actually is, which is in private/
        #if sys.platform == 'darwin':
        #    print(os.realpath(tmp_dir), tmp_dir)
        #    tmp_dir = os.path.join('private', tmp_dir)
        #    print(os.realpath(tmp_dir), tmp_dir)
        remote_fp = os.path.join(raw_uuid, 'raw.aac')
        if debug:
            print('downloading from: ', remote_fp)
        local_fp_aac = os.path.join(tmp_dir, 'raw.aac')
        bc.download_file_from_bucket(remote_fp, local_fp_aac, bucket_name)
        # NOTE from ffmpeg docs: The default for muxing into WAV files is pcm_s16le
        # so that is what we will get here
        local_fp_wav = ac.aac_to_wav(local_fp_aac)

        # make the actual crops
        samplerate, data = wavfile.read(local_fp_wav)
        # TODO need to make sure of dtype
        data = data / 2**15
        #plt.figure(figsize=(30,18))
        #plt.plot(np.abs(data))
        onsets, decays = onset_and_decay_events(data, samplerate, False)
        #for region in regions:
        #    plt.plot([region[0], region[1]], [-0.1, -0.1], marker='o')

        short_crops = []
        short_regions = events_to_regions(onsets, decays, data, samplerate, min_duration=0.15, max_duration=0.7)
        for region in short_regions:
            start, end = pad_region(region, data, samplerate)
            crop = data[start:end]
            if not single_peaked(crop, samplerate):
                continue
            else:
                short_crops.append([start, end])

        # get medium crops
        medium_crops = []
        medium_regions = events_to_regions(onsets, decays, data, samplerate, min_duration=0.7, max_duration=1.2)
        for region in medium_regions:
            start, end = pad_region(region, data, samplerate)
            crop = data[start:end]
            medium_crops.append([start, end])

        # get long crops
        long_crops = []
        long_regions = events_to_regions(onsets, decays, data, samplerate, min_duration=1.2, max_duration=3.5)
        for region in long_regions:
            start, end = pad_region(region, data, samplerate)
            crop = data[start:end]
            long_crops.append([start, end])

        if debug:
            print('---')
            print('CROPS FOUND:')
            print('    {} short crops'.format(len(short_crops)))
            print('    {} medium crops'.format(len(medium_crops)))
            print('    {} long crops'.format(len(long_crops)))

        # filter crops if needed
        #if len(short_crops) > 3:
        #    # first, last and middle
        #    idxs = [
        #        0,
        #        int(len(short_crops) / 2)
        #        -1
        #    ]
        #    short_crops = [short_crops[idx] for idx in idxs]

        # make sure a short crop exists
        if not short_crops:
            if debug:
                print(' ! generating short crop')
            sc = None
            # TODO probably should make sure to avoid multi peaked
            if medium_crops:
                sc = medium_crops[0][:]
                sc[1] = sc[0] + int(0.5 * samplerate)
            elif long_crops:
                sc = long_crops[0][:]
                sc[1] = sc[0] + int(0.5 * samplerate)
            if sc:
                short_crops.append(sc)

        # ensure a medium
        if not medium_crops:
            if debug:
                print(' ! generating medium crop')
            mc = None
            if long_crops:
                mc = long_crops[0][:]
                mc[1] = mc[0] + int(samplerate * 1.0)
            elif short_crops:
                mc = short_crops[0][:]
                mc[1] = mc[0] + int(samplerate * 0.8)
            if mc:
                medium_crops.append(mc)

        # ensure a long
        # TODO should use some kind of ranking of all candidates to
        # choose a desirable long crop
        if not long_crops:
            if debug:
                print(' ! generating long crop')
            lc = None
            if medium_crops:
                lc = medium_crops[0][:]
                lc[1] = lc[0] + int(samplerate * 1.3)
            elif short_crops:
                lc = short_crops[0][:]
                lc[1] = lc[0] + int(samplerate * 1.3)
            if lc:
                long_crops.append(lc)

        # these are the crops that are actually going to be generated
        # for the user
        all_crops = short_crops + medium_crops[:1] + long_crops[:1]

        # make sure there is no sound left behind
        # based on whats in all_crops, look at all the spaces where there is no crop
        # see if there are any sounds there, and make crops for them if yes
        supplementary_crops = []
        # these are just the indexes of the gaps where there is no crop
        ignored_regions = []
        # as crops are stepped through, keep track of last silence start point
        ignored_idx = 0
        for crop in sorted(all_crops, key=lambda x: x[0]):
            c_onset, c_decay = crop
            if c_onset > ignored_idx:
                ignored_regions.append([ignored_idx, c_onset])
                ignored_idx = c_decay
            else:
                ignored_idx = max(c_decay, ignored_idx)

        # skip ignored regions without sound
        keeper_regions = []
        for ig_region in ignored_regions:
            ig_on, ig_dec = ig_region
            for o, d in zip(onsets, decays):
                if (ig_on < o < ig_dec or
                    ig_on < d < ig_dec or
                    o > ig_on and d < ig_dec or
                    o < ig_on and d > ig_dec):
                    # there is a sound there, so dont skip
                    keeper_regions.append(ig_region)
                    break

        # find good start and end for each region by finding
        # nearest onset and decay to the region bounds
        for reg in keeper_regions:
            o, d = reg
            # skip super short stuff
            if ((d - o) / samplerate) < 0.1:
                continue
            start = onsets[np.argmin([(i - o)**2 for i in onsets])]
            end = decays[np.argmin([(i - o)**2 for i in decays])]
            start, end = pad_region([start, end], data, samplerate)
            supplementary_crops.append([start, end])

        if debug:
            print('SUPPLEMENTARY CROPS:')
            print(supplementary_crops)

        # add the supplementary crops to the existing crops!
        all_crops = all_crops + supplementary_crops

        # make them fp, duration dicts, with the side effect
        # of actually creating the file as well
        # sorry- this is kind of a confusing way of doing it
        all_crops = [
            crop_to_aac(c, data, samplerate, tmp_dir, debug)
            for c in all_crops
        ]

        response_data = {
            'data': {
                'crops': [],
            },
        }
        for crop in all_crops:
            crop_fp_aac = crop['fp']
            crop_duration = crop['duration']
            crop_uuid = str(uuid.uuid4())

            # upload to bucket
            bucket_filename = '{}.aac'.format(crop_uuid)
            bucket_fp = os.path.join(raw_uuid, 'cropped', bucket_filename)
            bucket_url = os.path.join('gs://', bucket_name, bucket_fp)
            bc.upload_file_to_bucket(crop_fp_aac, bucket_fp, bucket_name)

            # store in a list for returning to server
            response_data['data']['crops'].append({
                'uuid': crop_uuid,
                'bucket_filepath': bucket_url,
                'duration': crop_duration,
            })

        # return json to server to send to server lol
        print(json.dumps(response_data))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--uuid', '-i', help='raw audio file to be split')
    parser.add_argument('--debug', '-d', help='debug', action='store_true', default=False)
    parser.add_argument('--bucket', '-b', help='bucket name')
    args = parser.parse_args()
    cloud_endpoint(args.uuid, args.bucket, args.debug)
