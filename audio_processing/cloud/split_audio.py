'''
this is for splitting audio based on silence / whatever
for generating usable "barks" for sequences


it should accept an audio file
return options:
    1. timestamps of crops
    2. actual crop arrays
'''
import glob
import audioread as ar
import subprocess as sp
from scipy.io import wavfile
import scipy
import numpy as np
import math
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


def crop_to_wav (crop_bounds, data, samplerate):
    # make sure crops outside data region dont fail
    if crop_bounds[1] > len(data):
        _data = np.zeros(crop_bounds[1], dtype=np.int16)
        _data[0:len(data)] = data
        data = _data
    # ramp in and out
    crop = data[crop_bounds[0]:crop_bounds[1]]
    fades = np.ones(len(crop))
    fades[:100] = np.arange(0, 1, 0.01)
    fades[-100:] = np.arange(1, 0, -0.01)
    final = crop * fades
    print('    duration: {:.2f}'.format(len(final) / samplerate))
    # NOTE do volume adjustment in ffmpeg?
    wavfile.write('./split_samples/crops/temp.wav', samplerate, final)
    sp.call('play ./split_samples/crops/temp.wav -q -V1', shell=True)


for fp in glob.glob('split_samples/*.wav')[:]:
    raw_name = fp.split('/')[-1].replace('.wav','')
    samplerate, data = wavfile.read(fp)
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
    if not long_crops:
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

    all_crops = short_crops + medium_crops[:1] + long_crops[:1]
    medium_crops = medium_crops[:1]
    long_crops = long_crops[:1]
    print('SHORT CROPS')
    for crop in short_crops:
        crop_to_wav(crop, data, samplerate)
        if input('    next? ') == 'n':
            break
    print('MEDIUM CROPS')
    for crop in medium_crops:
        crop_to_wav(crop, data, samplerate)
        if input('    next? ') == 'n':
            break
    print('LONG CROPS')
    for crop in long_crops:
        crop_to_wav(crop, data, samplerate)
        if input('    next? ') == 'n':
            break


    # supplement missing crops

    #events = to_events(data, samplerate)
    #for e in events:
    #    plt.plot([e['start'], e['end']], [-.02, -.02])

    #new_events = check_events(events, data, samplerate)
    #for e in new_events:
    #    plt.plot([e['start'], e['end']], [-.03, -.03], marker='x')

    #fc = 0
    #for idx, event in enumerate(events):
    #    fc += 1
    #    start, end = event['start'], event['end']
    #    # pad around start and end
    #    start -= int(0.1 * samplerate)
    #    start = max(0, start)
    #    end += int(0.1 * samplerate)
    #    end = min(len(data), end)
    #    crop = data[start:end]
    #    # ramp in and out
    #    fades = np.ones(len(crop))
    #    fades[:100] = np.arange(0, 1, 0.01)
    #    fades[-100:] = np.arange(1, 0, -0.01)
    #    final = crop * fades
    #    wavfile.write('./split_samples/crops/{}-{:03}.wav'.format(raw_name, fc), samplerate, final)


def check_events (events, data, samplerate):
    ''' takes the basic events coming from signal analysis
    and makes sure they conform to the client expectation

    the client needs to receive at least one
    of each of the following:

    short crop
        - 0.15 < duration < 0.7
        - must be single peaked

    medium crop
        - 0.7 <= duration < 1.2
        - do not end mid peak

    long crop
        - 1.2 <= duration < 3.5
        - do not end mid peak

    resolving missing lengths:
        no crops: return empty array or error code
        no short crop: find shortest crop and shrink it temporally
        no medium or long crop:
            1. look for a time window that starts with a onset event,
            and ends with a decay event that fits the window.
            2. if that fails, stretch or shrink nearest length
            crop to desired duration
    '''
    # make sure there is at least one crop
    # shorts must be single peaked, less than 0.7 seconds
    # less than .7 seconds
    # one crop > .7 and less than 1.2 seconds
    # and one crop > 1.2 and less than 3.5 seconds
    needs_short = True
    needs_medium = True
    needs_long = True
    has_extra_long = False
    total_duration = len(data) / samplerate
    too_short_for_medium = total_duration < 0.71
    too_short_for_long = total_duration < 1.21

    for e in events:
        duration = (e['end'] - e['start']) / samplerate
        if duration < 0.7:
            needs_short = False
        if 0.7 <= duration < 1.2:
            needs_medium = False
        if 1.2 <= duration < 3.5:
            needs_long = False
        if 3.5 <= duration:
            has_extra_long = True

    new_events = []

    if needs_short:
        # take events and shorten them
        shortest = sorted(events, key=lambda x: x['end'] - x['start'])[0]
        new_event = {
            'start': shortest['start'],
            'end': shortest['start'] + (samplerate * 0.65)
        }
        new_events.append(new_event)
    if needs_medium:
        evs = sorted(events, key=lambda x: x['end'] - x['start'])
        long_evs = [e for e in evs if e['end'] - e['start'] >= 1.2]
        if len(long_evs):
            # there is a long that can be shortened
            shortest = long_evs[0]
            new_event = {
                'start': shortest['start'],
                'end': shortest['start'] + (samplerate * 1.1)
            }
            new_events.append(new_event)
        else:
            # lengthen a short
            longest = evs[-1]
            new_event = {
                'start': longest['start'],
                'end': longest['start'] + (samplerate * 0.8)
            }
            new_events.append(new_event)
    if needs_long:
        evs = sorted(events, key=lambda x: x['end'] - x['start'])
        long_evs = [e for e in evs if e['end'] - e['start'] >= 3.5]
        if len(long_evs):
            # shorten a long one
            shortest = long_evs[0]
            new_event = {
                'start': shortest['start'],
                'end': shortest['start'] + (samplerate * 3.3)
            }
            new_events.append(new_event)
        else:
            # lengthen a short
            longest = evs[-1]
            new_event = {
                'start': longest['start'],
                'end': longest['start'] + (samplerate * 1.3)
            }
            new_events.append(new_event)

    return new_events


    #removed_events = []
    #while len(events) > 1 and any(needs_short, needs_medium, needs_long):
    #    print(len(events), needs_short, needs_medium, needs_long)
    #    # find the closest end - start and merge the events
    #    gaps = [e2['start'] - e1['end'] for e1, e2 in zip(events[:-1], events[1:])]
    #    idx = gaps.index(min(gaps))
    #    e1, e2 = events[idx], events[idx + 1]
    #    removed_events.append(e1)
    #    removed_events.append(e2)
    #    del events[idx + 1]
    #    events[idx]['end'] = e2['end']
    #    update_needed()
