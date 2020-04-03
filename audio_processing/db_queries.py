

def crop_sampler_from_uuid (uuid):
    cur.execute('select bucket_fp, uuid, raw_id from crops where uuid = ?', [uuid])
    remote_fp, crop_fk, raw_fk = cur.fetchone()
    crop_aac = os.path.join(tmp_dir, '{}.aac'.format(crop))
    if args.debug:
        print(remote_fp, crop_aac)
    bc.download_filename_from_bucket(remote_fp, crop_aac)
    # convert aac to wav and store the wav fp in the crop dict
    wav_fp = aac_to_wav(crop_aac)
    return CropSampler(wav_fp)


def midi_bridge_from_song_id (song_id, tmp_dir):
    cur.execute('SELECT name, bucket_fp FROM songs where id = :song_id', {
        'song_id': args.song_id,
    })
    song_name, song_fp = cur.fetchone()
    if args.debug:
        print('song name', song_name);
    return MidiBridge(song_fp, tmp_dir, True)


def persist_sequence ():
    remote_sequence_fp = '{}/sequences/{}.aac'.format(raw_fk, sequence_uuid)
    remote_sequence_url = 'gs://song_barker_sequences/{}'.format(remote_sequence_fp)
    cur.execute('''
            INSERT INTO sequences VALUES (
                :uuid,
                :song_id,
                :crop_id,
                :user_id,
                :name,
                :bucket_url,
                :bucket_fp,
                :stream_url,
                :hidden
            )
        ''', 
        {
            'uuid': str(sequence_uuid),
            'song_id': args.song_id,
            'crop_id': ' '.join(args.crops),
            'user_id': args.user_id, 
            'name': '{} {}'.format(song_name, sequence_count + 1),
            'bucket_url': remote_sequence_url,
            'bucket_fp': remote_sequence_fp,
            'stream_url': None,
            'hidden': 0,
        }
    )


def get_crop_defaults (cur, user_id, image_id):
    # if raw has name, use that, otherwise use sound_

    # get raw entry in db for base name
    raw_sql = '''
        SELECT name from images
        WHERE
        uuid = :image_id
    '''
    cur.execute(raw_sql, {
        'image_id': image_id,
    })
    try:
        base_name = cur.fetchone()[0]
    except:
        base_name = 'sound'
    if base_name is None:
        base_name = 'sound'

    # get crop count
    crop_count_sql = '''
        SELECT count(*) from crops 
        WHERE 
            user_id = :user_id
        AND
            name like '{}%'
        ;
    '''.format(base_name)
    cur.execute(crop_count_sql, {
        'user_id': user_id,
    })
    try:
        crop_count = int(cur.fetchone()[0])
    except:
        crop_count = 0

    return {
        'base_name': base_name,
        'crop_count': crop_count,
    }


def persist_raw ():
    try:
        raw_insert_sql = 'INSERT INTO raws (uuid, user_id) VALUES (:uuid, :user_id)' 
        cur.execute(raw_insert_sql, {
            'uuid': args.input_audio_uuid,
            'user_id': args.user_id,
        })
        conn.commit()


def persist_crop ():
    # record in db
    cur.execute('''
            INSERT INTO crops VALUES (
                :uuid,
                :raw_id,
                :user_id,
                :name,
                :bucket_url,
                :bucket_fp,
                :stream_url,
                :hidden
            )
        ''',
        {
            'uuid': str(crop_uuid),
            'raw_id': args.input_audio_uuid,
            'user_id': args.user_id, 
            'name': auto_name,
            'bucket_url': bucket_url,
            'bucket_fp': bucket_fp,
            'stream_url': None,
            'hidden': 0,
        }
    )
    bucket_crop_paths.append(bucket_url)
