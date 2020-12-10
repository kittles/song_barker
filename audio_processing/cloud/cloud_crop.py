import json
import argparse
import numpy as np
import tempfile
import scipy.io.wavfile as wavfile
import uuid
import subprocess as sp
import glob
import os
import bucket_client as bc
import time
import audio_conversion as ac
import pyloudnorm as pyln


THRESHOLD = 200


def crop_raw_audio (raw_uuid, debug=False):
    # raw insert into db happens on the server, not here
    with tempfile.TemporaryDirectory() as tmp_dir:

        # get the raw input file
        remote_fp = os.path.join(raw_uuid, 'raw.aac')
        if debug:
            print('downloading from: ', remote_fp)
        local_fp_aac = os.path.join(tmp_dir, 'raw.aac')
        bc.download_file_from_bucket(remote_fp, local_fp_aac)

        # convert to wav
        # NOTE from ffmpeg docs: The default for muxing into WAV files is pcm_s16le
        # so that is what we will get here
        local_fp_wav = ac.aac_to_wav(local_fp_aac)

        if debug:
            samplerate, data = wavfile.read(local_fp_wav)
            print('raw file sample rate', samplerate, 'data shape', data.shape)
            print('data min', min(data), 'max', max(data))

        # split with sox
        # the parameters here are fairly arcane, see https://digitalcardboard.com/blog/2009/08/25/the-sox-of-silence/
        # its really two groups:
        #    above-periods: 1
        #    duration: 0.3
        #    threshold: 0.001%
        # and
        #    below-periods: 1
        #    duration: 0.1
        #    threshold: 1%
        #
        # the first triplet is for the beginning of sounds, and the second triplet is for the end
        #
        # - "above-periods" is how many times does the loudness need to cross the threshold before
        # we care. if its 0, then no silence is stripped, if its > 1 then it needs to cross more than
        # once before the silence kicks in. so for most uses, its set to 1, as in our case
        #
        # - "duration" how long the sound must be before it counts as non silence.
        # you can treat bursts or quick transients as silence if you make the duration longer than the bursts
        #
        # - "threshold" is the sample value that counts as sound. this is a percent based on ??
        #
        # the "-l" flag: "The option -l indicates that below-periods duration length of audio
        # should be left intact at the beginning of each period of silence.
        # For example, if you want to remove long pauses between words but do
        # not want to remove the pauses completely."
        split_cmd = '''
            sox "{in_fp}" "{out_fp_prefix}"
                silence -l {start-above-periods} {start-duration} {start-threshold}
                {end-above-periods} {end-duration} {end-threshold}
                : newfile : restart
        '''
        split_args = {
            'in_fp': local_fp_wav,
            'out_fp_prefix': os.path.join(tmp_dir, 'crop_.wav'),
            'start-above-periods': 1,
            'start-duration': 0.1,
            'start-threshold': '1%',
            'end-above-periods': 1,
            'end-duration': 0.3,
            'end-threshold': '1%',
        }
        split_cmd = ' '.join(split_cmd.format(**split_args).split())
        if debug:
            print(split_cmd)
        sp.call(split_cmd.format(**split_args), shell=True)

        # log initial split count
        result = sp.run('ls {} | wc -l'.format(os.path.join(tmp_dir, 'crop_*.wav')),
                stdout=sp.PIPE, stderr=sp.PIPE, universal_newlines=True, shell=True)
        if debug:
            print(raw_uuid, 'initial split count {}'.format(
                result.stdout
            ))

        # find the good crops, generate missing crops
        good_crops = []
        for crop_fp in sorted(glob.glob(os.path.join(tmp_dir, 'crop_*.wav'))):
            try:
                samplerate, data = wavfile.read(crop_fp)
                data = data.astype(np.int16)
                avg = np.average(abs(data))
                if debug:
                    print('\n\n\n---------------- NEW CROP ---------------\n\n')
                    print('dtype', data.dtype)
                    print('crop avg', avg)
                    print('SAMPLERATE:', samplerate, 'data min, max', data.min(), data.max())
                if avg > THRESHOLD:
                    loudness_normed_audio = pyln.normalize.peak(data[:], -1.0)

                    # do a little fade in and out
                    ramp_length = 200
                    fade_in = np.linspace(0, 1, ramp_length)
                    fade_out = np.linspace(1, 0, ramp_length)
                    loudness_normed_audio[:ramp_length] = loudness_normed_audio[:ramp_length] * fade_in
                    loudness_normed_audio[-ramp_length:] = loudness_normed_audio[-ramp_length:] * fade_out

                    wavfile.write(crop_fp, samplerate, loudness_normed_audio)

                    good_crops.append({
                        'crop_fp': crop_fp,
                        'crop_duration': len(data) / samplerate,
                    })
            except Exception as e:
                if debug:
                    print('couldnt get crop avg')
                    print(e)
        if debug:
            print(raw_uuid, '\n filtered split count {}'.format(
                len(good_crops)
            ))
            for crop in good_crops:
                sp.call('play {}'.format(crop['crop_fp']), shell=True)

                keep_going = input()
                if keep_going != 'q':
                    continue
                else:
                    break

        # TODO:
        # make sure there is at least one crop
        # less than .7 seconds
        # one crop > .7 and less than 1.2 seconds
        # and one crop > 1.2 and less than 3.5 seconds
        # ... in cases where this does not happen naturally
        # join longest crops until you get this
        # if you still dont have it, repeat the crops
        # and use ffmpeg to join them
        # make sure to append to the list of good crops
        has_short = False
        has_medium = False
        has_long = False
        for crop in good_crops:
            if 0 < crop['crop_duration'] <= .7:
                has_short = True
            if 0.7 < crop['crop_duration'] <= 1.1:
                has_medium = True
            if 1.1 < crop['crop_duration']:
                has_long = True

        if debug:
            print('short, medium, long', has_short, has_medium, has_long)

        durations = [c['crop_duration'] for c in good_crops]

        # avoid potential infinite while loops
        if len(good_crops) > 0:
            # handle missing short: truncate shortest clip on either side?
            if not has_short:
                if debug:
                    print('creating a short crop!')
                shortest_duration = min(durations)
                shortest_index = durations.index(shortest_duration)
                shortest_crop = good_crops[shortest_index]

                samplerate, data = wavfile.read(shortest_crop['crop_fp'])
                #print(len(data), max(data), min(data))
                data = data.astype(np.float64)
                #print(len(data), max(data), min(data))

                # slice samples for correct duration
                samples_needed = int(samplerate * 0.60)
                short_data = data[:samples_needed]
                #midpoint = int(len(data) / 2)
                #half_samples = int(samples_needed / 2)
                #short_data = data[midpoint - half_samples : midpoint + half_samples]
                if debug:
                    print('modifying', shortest_crop)
                    print(samplerate, samples_needed, len(short_data))
                    print(min(short_data), max(short_data))

                # need to re fade out since end has been cut off
                ramp_length = 200
                fade_in = np.linspace(0, 1, ramp_length)
                fade_out = np.linspace(1, 0, ramp_length)
                short_data[:ramp_length] = short_data[:ramp_length] * fade_in
                short_data[-ramp_length:] = short_data[-ramp_length:] * fade_out

                crop_fp = os.path.join(tmp_dir, 'crop_short.wav')
                wavfile.write(crop_fp, samplerate, short_data)

                good_crops.append({
                    'crop_fp': crop_fp,
                    'crop_duration': len(short_data) / samplerate,
                })

                if debug:
                    sp.call('play {}'.format(crop_fp), shell=True)
                    keep_going = input()

            # handle missing medium
            # has shorts: pad with silence
            # has longs: truncate
            # has shorts and longs: truncate
            if not has_medium:
                if debug:
                    print('creating a medium!')
                longest_duration = max(durations)
                longest_index = durations.index(longest_duration)
                longest_crop = good_crops[longest_index]
                samplerate, data = wavfile.read(longest_crop['crop_fp'])
                data = data.astype(np.float64)

                if longest_duration > 1.09:
                    # truncate
                    if debug:
                        print('creating a medium from longer sample by truncating')
                    # slice samples for correct duration
                    samples_needed = int(samplerate * 1)
                    midpoint = int(len(data) / 2)
                    half_samples = int(samples_needed / 2)
                    medium_data = data[midpoint - half_samples : midpoint + half_samples]
                else:
                    # pad
                    if debug:
                        print('creating a medium from shorter sample by repeating')
                    medium_data = data
                    # repeat the sound to get above 1 second
                    while (len(medium_data) / samplerate) < 1:
                        medium_data = np.concatenate((medium_data, data))
                    # crop the end off if needed to keep it under 1.1
                    if (len(medium_data) / samplerate) > 1.1:
                        medium_data = medium_data[:samplerate * 1]

                # need to re fade out since end has been cut off
                ramp_length = 200
                fade_in = np.linspace(0, 1, ramp_length)
                fade_out = np.linspace(1, 0, ramp_length)
                medium_data[:ramp_length] = medium_data[:ramp_length] * fade_in
                medium_data[-ramp_length:] = medium_data[-ramp_length:] * fade_out

                crop_fp = os.path.join(tmp_dir, 'crop_medium.wav')
                wavfile.write(crop_fp, samplerate, medium_data)

                good_crops.append({
                    'crop_fp': crop_fp,
                    'crop_duration': len(medium_data) / samplerate,
                })

                if debug:
                    sp.call('play {}'.format(crop_fp), shell=True)
                    keep_going = input()

            # handle missing long: take longest crop and
            # if its close, pad it
            # if its not, double it until its close
            if not has_long:
                if debug:
                    print('creating a long!')
                longest_duration = max(durations)
                longest_index = durations.index(longest_duration)
                longest_crop = good_crops[longest_index]
                samplerate, data = wavfile.read(longest_crop['crop_fp'])
                data = data.astype(np.float64)

                # now accept all crops > 1.1 as longs, no truncating needed

                # pad
                if debug:
                    print('creating a long by padding')
                # slice samples for correct duration
                long_data = data
                while (len(long_data) / samplerate) < 1.5:
                    long_data = np.concatenate((long_data, data))

                # need to re fade out since end has been cut off
                ramp_length = 200
                fade_in = np.linspace(0, 1, ramp_length)
                fade_out = np.linspace(1, 0, ramp_length)
                long_data[:ramp_length] = long_data[:ramp_length] * fade_in
                long_data[-ramp_length:] = long_data[-ramp_length:] * fade_out

                crop_fp = os.path.join(tmp_dir, 'crop_long.wav')
                wavfile.write(crop_fp, samplerate, long_data)

                good_crops.append({
                    'crop_fp': crop_fp,
                    'crop_duration': len(long_data) / samplerate,
                })

                if debug:
                    sp.call('play {}'.format(crop_fp), shell=True)
                    keep_going = input()


        # upload good crops to bucket
        # and prepare json to return to server
        response_data = {
            'data': {
                'crops': [],
            },
        }
        for good_crop in good_crops:
            crop_fp_wav = good_crop['crop_fp']
            crop_duration = good_crop['crop_duration']
            if debug:
                print(crop_fp_wav)
                from matplotlib import pyplot as plt
                plt.plot(loudness_normed_audio)
                plt.show()

            crop_uuid = str(uuid.uuid4())

            # convert to aac
            crop_fp_aac = ac.wav_to_aac(crop_fp_wav)

            # upload to bucket
            bucket_filename = '{}.aac'.format(crop_uuid)
            bucket_fp = os.path.join(raw_uuid, 'cropped', bucket_filename)
            bucket_url = os.path.join('gs://', bc.BUCKET_NAME, bucket_fp)
            bc.upload_file_to_bucket(crop_fp_aac, bucket_fp)

            # store in a list for returning to server
            response_data['data']['crops'].append({
                'uuid': crop_uuid,
                'bucket_filepath': bucket_url,
                'duration': crop_duration,
            })

    # return json to server to send to server lol
    print(json.dumps(response_data))

    ## send to stdout for consumption by server
    #for cuuid, cpath in zip(crop_uuids, bucket_crop_paths):
    #    print(cuuid, cpath)

    #log(raw_uuid, 'finished')




if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--uuid', '-i', help='raw audio file to be split')
    parser.add_argument('--debug', '-d', help='debug', action='store_true', default=False)
    args = parser.parse_args()

    crop_raw_audio(args.uuid, args.debug)
