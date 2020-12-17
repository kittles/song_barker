exports.models = [
    {
        table_name: 'users',
        obj_type: 'user',
        primary_key: 'user_id',
        primary_key_is_uuid: false,
        user_owned: false,
        immutable: true, // this stops rest api calls that change anything
        disable_all: true,
        // TODO: probably just want an allowed_methods array...
        schema: {
            columns: [
                {
                    name: 'user_id',
                    type: 'text primary key',
                    desc: 'primary key',
                },
                {
                    name: 'name',
                    type: 'text',
                    desc: 'the user specified name of the user',
                },
                {
                    name: 'email',
                    type: 'text',
                    desc: 'the user specified email of the user',
                },
                {
                    name: 'password',
                    type: 'text',
                    desc: 'heh',
                },
                {
                    name: 'hidden',
                    type: 'integer default 0',
                    desc: 'whether the account is active',
                },
                {
                    name: 'email_confirmation_string',
                    type: 'text',
                    desc: 'random string used to confirm an email',
                },
                {
                    name: 'pending_confirmation',
                    type: 'integer default 0',
                    desc: 'whether the account is waiting to be confirmed via email (this is for when users sign up manually)',
                },
                {
                    name: 'user_agreed_to_terms_v1',
                    type: 'integer DEFAULT 0',
                    desc: 'when the user agreed to terms',
                },
                {
                    name: 'account_uuid',
                    type: 'text',
                    desc: 'used for purchases',
                },
            ],
        },
    },
    {
        table_name: 'raws',
        obj_type: 'raw',
        primary_key: 'uuid',
        primary_key_is_uuid: true,
        user_owned: true,
        immutable: false,
        disable_all: false,
        schema: {
            columns: [
                {
                    name: 'uuid',
                    type: 'text primary key',
                    desc: 'uuid is both the primary key for the object in the database, as well as the filename in the bucket',
                },
                {
                    name: 'user_id',
                    type: 'text',
                    desc: 'the foreign key to the user object',
                },
                {
                    name: 'name',
                    type: 'text',
                    desc: 'the user specified name displayed in the app',
                },
                {
                    name: 'bucket_url',
                    type: 'text',
                    desc: 'the full url of the audio file in the bucket',
                },
                {
                    name: 'bucket_fp',
                    type: 'text',
                    desc: 'the relative path (to bucket root) of the audio file in the bucket',
                },
                {
                    name: 'stream_url',
                    type: 'text',
                    desc: 'the generated stream url (this is generated by the backend as needed)',
                },
                {
                    name: 'hidden',
                    type: 'integer default 0',
                    desc: 'set to 1 if the user has "deleted" this object',
                },
                {
                    name: 'is_stock',
                    type: 'integer default 0',
                    desc: 'set to 1 if this is a default bark that comes with account creation',
                },
            ],
        },
    },
    {
        table_name: 'songs',
        obj_type: 'song',
        primary_key: 'id',
        primary_key_is_uuid: false,
        user_owned: false,
        immutable: false,
        disable_all: false,
        schema: {
            columns: [
                {
                    name: 'id',
                    type: 'integer primary key',
                    desc: 'the primary key',
                },
                {
                    name: 'name',
                    type: 'text',
                    desc: 'the name of the song (like "Happy Birthday" or "Sweet Child O\' Mine")',
                },
                {
                    name: 'bucket_url',
                    type: 'text',
                    desc: 'the full url of the midi file in the bucket',
                },
                {
                    name: 'bucket_fp',
                    type: 'text',
                    desc: 'the relative path (to bucket root) of the midi file in the bucket',
                },
                {
                    name: 'track_count',
                    type: 'integer',
                    desc: 'number of tracks on the midi file, which means you need that many crops to generate a sequence',
                },
                {
                    name: 'bpm',
                    type: 'real',
                    desc: 'bpm specified in the midi file',
                },
                {
                    name: 'key',
                    type: 'integer',
                    desc: 'the key of the midi file (0 is C)',
                },
                {
                    name: 'price',
                    type: 'real',
                    desc: 'in app purchase price for song',
                },
                {
                    name: 'category',
                    type: 'text',
                    desc: 'genre / type of song',
                },
                {
                    name: 'song_family',
                    type: 'text',
                    desc: 'deprecated',
                },
                {
                    name: 'arrangement',
                    type: 'text',
                    desc: 'the arrangment',
                },
                {
                    name: 'style',
                    type: 'text',
                    desc: 'the style',
                },
                {
                    name: 'backing_track',
                    type: 'text',
                    desc: 'the backing track that goes with this song',
                },
                {
                    name: 'backingtrack_offset',
                    type: 'real',
                    desc: 'when the song actually starts in the audio file (in seconds)',
                },
                {
                    name: 'display_order',
                    type: 'integer',
                    desc: 'used by the front end for...you guessed it, display order',
                },
            ],
        },
    },
    {
        table_name: 'images',
        obj_type: 'image',
        primary_key: 'uuid',
        primary_key_is_uuid: true,
        order_by: 'created',
        user_owned: true,
        immutable: false,
        disable_all: false,
        schema: {
            columns: [
                {
                    name: 'uuid',
                    type: 'text primary key',
                    desc: 'uuid is both the primary key for the object in the database, as well as the filename in the bucket',
                },
                {
                    name: 'bucket_url',
                    type: 'text',
                    desc: 'the full url of the audio file in the bucket',
                },
                {
                    name: 'bucket_fp',
                    type: 'text',
                    desc: 'the relative path (to bucket root) of the audio file in the bucket',
                },
                {
                    name: 'user_id',
                    type: 'text',
                    desc: 'the foreign key to the user object',
                },
                {
                    name: 'name',
                    type: 'text',
                    desc: 'the user specified name of the image',
                },
                {
                    name: 'mouth_coordinates',
                    type: 'text',
                    desc: 'a string like [(x1, y1), (x2, y2), ...] storing the coordinates of landmarks on the image',
                },
                {
                    name: 'coordinates_json',
                    type: 'text',
                    desc: 'a freeform json string for storing data about image landmarks',
                },
                {
                    name: 'hidden',
                    type: 'integer default 0',
                    desc: 'whether the account is active',
                },
                {
                    name: 'created',
                    type: 'integer DEFAULT CURRENT_TIMESTAMP',
                    desc: 'when this object was created',
                },
                {
                    name: 'is_stock',
                    type: 'integer default 0',
                    desc: 'set to 1 if this is a default image that comes with account creation',
                },
                {
                    name: 'mouth_color',
                    type: 'text',
                    desc: 'a string representation of the mouth color',
                },
            ],
        },
    },
    {
        table_name: 'crops',
        obj_type: 'crop',
        primary_key: 'uuid',
        primary_key_is_uuid: true,
        order_by: 'created',
        user_owned: true,
        immutable: false,
        disable_all: false,
        schema: {
            columns: [
                {
                    name: 'uuid',
                    type: 'text primart key',
                    desc: 'uuid is both the primary key for the object in the database, as well as the filename in the bucket',
                },
                {
                    name: 'raw_id',
                    type: 'text',
                    desc: 'the foreign key to the raw object the crop was generated from',
                },
                {
                    name: 'user_id',
                    type: 'text',
                    desc: 'the foreign key to the user object',
                },
                {
                    name: 'name',
                    type: 'text',
                    desc: 'the user specified name displayed in the app',
                },
                {
                    name: 'bucket_url',
                    type: 'text',
                    desc: 'the full url of the audio file in the bucket',
                },
                {
                    name: 'bucket_fp',
                    type: 'text',
                    desc: 'the relative path (to bucket root) of the audio file in the bucket',
                },
                {
                    name: 'stream_url',
                    type: 'text',
                    desc: 'the generated stream url (this is generated by the backend as needed)',
                },
                {
                    name: 'hidden',
                    type: 'integer default 0',
                    desc: 'set to 1 if the user has "deleted" this object',
                },
                {
                    name: 'created',
                    type: 'integer DEFAULT CURRENT_TIMESTAMP',
                    desc: 'when this object was created',
                },
                {
                    name: 'is_stock',
                    type: 'integer default 0',
                    desc: 'set to 1 if this is a default bark that comes with account creation',
                },
                {
                    name: 'duration_seconds',
                    type: 'real default 0',
                    desc: 'the length of the crop',
                },
                {
                    name: 'crop_type',
                    type: 'text',
                    desc: 'something like "bark", "soundfx" etc...',
                },
            ],
        },
    },
    {
        table_name: 'sequences',
        obj_type: 'sequence',
        primary_key: 'uuid',
        primary_key_is_uuid: true,
        order_by: 'created',
        user_owned: true,
        immutable: false,
        disable_all: false,
        schema: {
            columns: [
                {
                    name: 'uuid',
                    type: 'text primary key',
                    desc: 'uuid is both the primary key for the object in the database, as well as the filename in the bucket',
                },
                {
                    name: 'song_id',
                    type: 'text',
                    desc: 'the foreign key to the song object the sequence was generated from',
                },
                {
                    name: 'crop_id',
                    type: 'text',
                    desc: 'the foreign key to the crop object the sequence was generated from',
                },
                {
                    name: 'user_id',
                    type: 'text',
                    desc: 'the foreign key to the user object',
                },
                {
                    name: 'name',
                    type: 'text',
                    desc: 'the user specified name displayed in the app',
                },
                {
                    name: 'backing_track_url',
                    type: 'text',
                    desc: 'the full url of the backing track audio file in the bucket',
                },
                {
                    name: 'backing_track_fp',
                    type: 'text',
                    desc: 'the relative path (to bucket root) of the audio file in the bucket',
                },
                {
                    name: 'bucket_url',
                    type: 'text',
                    desc: 'the full url of the audio file in the bucket',
                },
                {
                    name: 'bucket_fp',
                    type: 'text',
                    desc: 'the relative path (to bucket root) of the audio file in the bucket',
                },
                {
                    name: 'stream_url',
                    type: 'text',
                    desc: 'the generated stream url (this is generated by the backend as needed)',
                },
                {
                    name: 'hidden',
                    type: 'integer default 0',
                    desc: 'set to 1 if the user has "deleted" this object',
                },
                {
                    name: 'created',
                    type: 'integer DEFAULT CURRENT_TIMESTAMP',
                    desc: 'when this object was created',
                },
            ],
        },
    },
    {
        table_name: 'decoration_images',
        obj_type: 'decoration_image',
        primary_key: 'uuid',
        primary_key_is_uuid: true,
        order_by: 'created',
        user_owned: true,
        immutable: false,
        disable_all: false,
        schema: {
            columns: [
                {
                    name: 'uuid',
                    type: 'text primary key',
                    desc: 'uuid is both the primary key for the object in the database, as well as the filename in the bucket',
                },
                {
                    name: 'bucket_url',
                    type: 'text',
                    desc: 'the full url of the decoration image file in the bucket',
                },
                {
                    name: 'bucket_fp',
                    type: 'text',
                    desc: 'the relative path (to bucket root) of the decoration image file in the bucket',
                },
                {
                    name: 'user_id',
                    type: 'text',
                    desc: 'the foreign key to the user object',
                },
                {
                    name: 'name',
                    type: 'text',
                    desc: 'the user specified name of the decoration image',
                },
                {
                    name: 'hidden',
                    type: 'integer default 0',
                    desc: 'whether the account is active',
                },
                {
                    name: 'created',
                    type: 'integer DEFAULT CURRENT_TIMESTAMP',
                    desc: 'when this object was created',
                },
                {
                    name: 'has_frame_dimension',
                    type: 'integer',
                    desc: 'whether there is a frame dimension',
                },
            ],
        },
    },
    {
        table_name: 'card_audios',
        obj_type: 'card_audio',
        primary_key: 'uuid',
        primary_key_is_uuid: true,
        order_by: 'created',
        user_owned: true,
        immutable: false,
        disable_all: false,
        schema: {
            columns: [
                {
                    name: 'uuid',
                    type: 'text primary key',
                    desc: 'uuid is both the primary key for the object in the database, as well as the filename in the bucket',
                },
                {
                    name: 'bucket_url',
                    type: 'text',
                    desc: 'the full url of the audio file in the bucket',
                },
                {
                    name: 'bucket_fp',
                    type: 'text',
                    desc: 'the relative path (to bucket root) of the audio file in the bucket',
                },
                {
                    name: 'user_id',
                    type: 'text',
                    desc: 'the foreign key to the user object',
                },
                {
                    name: 'name',
                    type: 'text',
                    desc: 'the user specified name of the image',
                },
                {
                    name: 'hidden',
                    type: 'integer default 0',
                    desc: 'whether the account is active',
                },
                {
                    name: 'created',
                    type: 'integer DEFAULT CURRENT_TIMESTAMP',
                    desc: 'when this object was created',
                },
            ],
        },
    },
    {
        table_name: 'greeting_cards',
        obj_type: 'greeting_card',
        primary_key: 'uuid',
        primary_key_is_uuid: true,
        order_by: 'created',
        user_owned: true,
        immutable: false,
        disable_all: false,
        schema: {
            columns: [
                {
                    name: 'uuid',
                    type: 'text primary key',
                    desc: 'uuid is both the primary key for the object in the database, as well as the filename in the bucket',
                },
                {
                    name: 'user_id',
                    type: 'text',
                    desc: 'the foreign key to the user object',
                },
                {
                    name: 'card_audio_id',
                    type: 'text',
                    desc: 'the foreign key to the accompanying card audio file',
                },
                {
                    name: 'image_id',
                    type: 'text',
                    desc: 'the foreign key to the pet image',
                },
                {
                    name: 'decoration_image_id',
                    type: 'text',
                    desc: 'the foreign key to the decoration image',
                },
                {
                    name: 'animation_json',
                    type: 'text',
                    desc: 'a freeform json string for storing the animation data',
                },
                {
                    name: 'name',
                    type: 'text',
                    desc: 'the user specified name displayed in the app',
                },
                {
                    name: 'hidden',
                    type: 'integer default 0',
                    desc: 'set to 1 if the user has "deleted" this object',
                },
                {
                    name: 'created',
                    type: 'integer DEFAULT CURRENT_TIMESTAMP',
                    desc: 'when this object was created',
                },
                {
                    name: 'mouth_color',
                    type: 'text',
                    desc: 'deprecated',
                },
                {
                    name: 'recipient_name',
                    type: 'text',
                    desc: 'the name that shows up on the envelope',
                },
                {
                    name: 'song_id',
                    type: 'text',
                    desc: 'the foreign key to the song',
                },
            ],
        },
    },
];
