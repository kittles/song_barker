var _ = require('lodash');
var _db = require('./database.js');
var spawn = require('child_process');
var uuid = require('uuid');
var gsutil = require('./gsutil_wrapper.js');


async function handle_create_new_song (req, res) {
    // store info here for the song in the db
    console.log(req.body);
    var db_insert_info = {
        name: req.body.name,
        price: req.body.price,
        category: req.body.category,
        song_family: req.body.song_family,
        track_count: req.body.track_count,
        key: req.body.key,
        //bucket_fp: comes from below,
        //backing_track: comes from below,
    };

    // temp directory for holding files on the server
    // before uploading to bucket
    var tmp_uuid = uuid.v4();
    var tmp_dir = `${__dirname}/uploads/${tmp_uuid}`;
    spawn.execSync(`mkdir ${tmp_dir}`);

    // backing track dir on bucket
    var backing_dir_uuid = uuid.v4();
    db_insert_info.backing_track = backing_dir_uuid;

    var midi_file;
    var backing_tracks = [];

    // seperate the backing tracks from the midi file
    _.each(req.files, (file, k) => {
        if (k === 'midi_file') {
            midi_file = file;
        } else {
            backing_tracks.push(file);
        }
    });

    // upload the midi file
    var midi_local_fp = `${tmp_dir}/${midi_file.name}`;
    var midi_remote_fp = `midi_files/${midi_file.name}`;
    db_insert_info.bucket_fp = midi_remote_fp;
    db_insert_info.bucket_url = 'gs://song_barker_sequences/' + midi_remote_fp;
    midi_file.mv(midi_local_fp, () => {
        gsutil.upload_file(midi_local_fp, db_insert_info.bucket_url, () => {
            console.log('finished uploading midi file');
        });
        // need track count... could come from client i guess
    });

    // move backing tracks to a directory that can be uploaded
    var moves = _.map(backing_tracks, (file, k) => {
        // move all backing tracks to a dir and rename them
        var fname = _.split(file.name, '.')[0];
        var extension = _.split(file.name, '.')[1];
        var key_name = _.get(key_map, _.toLower(fname), 0);
        var local_fp = `${tmp_dir}/${backing_dir_uuid}/${key_name}.${extension}`;
        return new Promise((resolve, reject) => {
            file.mv(local_fp, resolve);
        });
    });

    console.log('backing tracks to be uploaded:', _.map(backing_tracks, 'name'));

    // upload backing tracks to bucket
    Promise.all(moves).then(() => {
        console.log('uploading backing tracks');
        gsutil.upload_dir(`${tmp_dir}/${backing_dir_uuid}`, 'gs://song_barker_sequences/backing_tracks', () => {
            console.log('finished uploading backing tracks');
            // TODO callback to remove temp dir when done
        });
    });

    insert_song_to_db(db_insert_info);

    // send response to client- the tracks wont be in the bucket yet
    res.send({
        status: true,
        message: 'ok',
    });
}
exports.handle_create_new_song = handle_create_new_song;


// for setting files names of backing tracks
var key_map = {
    c: 0,

    db: 1,
    'c#': 1,

    d: 2,

    'd#': 3,
    eb: 3,

    e: 4,

    'e#': 5,
    f: 5,

    'f#': 6,
    gb: 6,

    g: 7,

    'g#': 8,
    ab: 8,

    a: 9,

    'a#': 10,
    bb: 10,

    b: 11,
    cb: 11,
};


// persisting the song data
async function insert_song_to_db (db_insert_info) {
    var db = await _db.dbPromise;
    console.log(db_insert_info);
    db.run(`
        INSERT into songs (
            name, price, category, song_family, bucket_url, bucket_fp, backing_track, track_count, key
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        db_insert_info.name,
        db_insert_info.price,
        db_insert_info.category,
        db_insert_info.song_family,
        db_insert_info.bucket_url,
        db_insert_info.bucket_fp,
        db_insert_info.backing_track,
        db_insert_info.track_count,
        db_insert_info.key,
    ]);
}
