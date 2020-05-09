var express = require('express');
var fileUpload = require('express-fileupload');
var _ = require('lodash');
var exec = require('child_process').exec;
var morgan = require('morgan');
var path = require('path');
var app = express();
var rest_api = require('./rest_api.js');
var models = require('./models.js').models;
var _db = require('./database.js');
var signed = require('./signed_url.js');
var spawn = require('child_process');
var uuid = require('uuid');

var port = process.env.PORT || 3000;

// server config
app.use(express.json({
    type: 'application/json',
}));
app.set('json spaces', 2);
app.use(morgan('combined')); // logging
app.use(express.static('./public'));
app.use(fileUpload({
    createParentPath: true
}));


//
// routes
//

// admin
function local_fp (file) {
    return './uploads/' + file.name;
}

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


var backing_track_prefix = 'backing_track_';


app.post('/admin/create_new_song', async (req, res) => {
    // should receive a midi file and backing track

    var db_insert_info = {
        name: req.body.name,
        //bucket_url: "gs://song_barker_sequences/midi_files/happy_birthday_graig_1_semitone.mid",
        //bucket_fp: "midi_files/happy_birthday_graig_1_semitone.mid",
        //track_count: 3,
        //bpm: 120,
        //key: 4,
        price: req.body.price,
        category: req.body.category,
        song_family: req.body.song_family,
        //backing_track: "happy_birthday",
    };


    // clear uploads
    // TODO probably want to handle multiple users uploading...
    // should put a lock on the dir
    spawn.execSync('rm ./uploads/*');

    var backing_remote_dir = uuid.v4();
    db_insert_info.backing_track = backing_remote_dir;

    _.each(req.files, async (file, k) => {
        file.mv(local_fp(file));
        if (k === 'midi_file') {
            var remote_fp = `midi_files/${file.name}`;
            db_insert_info.bucket_fp = remote_fp;
            db_insert_info.bucket_url = 'gs://song_barker_sequences/' + remote_fp;
            console.log('uploading midi');
            await signed.upload(local_fp(file), remote_fp);
        } else {
            // if backing track, convert name to integer key and upload
            var fname = _.split(file.name, '.')[0];
            var key_name = _.get(key_map, _.toLower(fname), 0);
            console.log(fname, key_name, `backing_tracks/${backing_remote_dir}/${key_name}.aac`);
            console.log('uploading backing track');
            await signed.upload(local_fp(file), `backing_tracks/${backing_remote_dir}/${key_name}.aac`);
        }
    });

    //console.log(db_insert_info);

    // backing tracks are all prefixed with "backing_track_"
    // make a backing track dir (uuid)

    // need to format backing tracks to 0-11 names

    // need to generate bucker_url and bucket_fp for midi file
    // need bpm and key in integer

    //send response
    res.send({
        status: true,
        message: 'ok',
    });

    // create backing track in all keys
});


// index
app.get('/', (req, res) => res.send('barkin\' songs, makin\'n friends'));

// puppet
app.get('/puppet', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/puppet_001/puppet.html'));
});

// test fps
app.get('/performance', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/puppet_000/performance.html'));
});

// rest api
(async () => {
    // await _db.initialize_db(models);
    const db = await _db.dbPromise;

    _.each(models, (def) => {
        _.each(rest_api.obj_rest_api(def, db), (route_def) => {
            app[route_def.request_method](route_def.endpoint, route_def.handler);
        });
    });
})();

// signed urls for uploads
app.post('/upload_url', async (req, res) => {
    console.log(req.body);
    var url = await signed.to_signed_upload_url(req.body.filename);
    res.json({ url: url });
});

app.post('/playback_url', async (req, res) => {
    var url = await signed.to_signed_playback_url(req.body.filename);
    res.json({ url: url });
});

// model descriptions
app.get('/describe', (req, res) => {
    res.json(models);
});

// process raw audio into cropped pieces
app.post('/to_crops', async function (req, res) {
    // TODO check input against db, use db result for command string
    exec(`
        cd ../audio_processing &&
        source .env/bin/activate &&
        export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json" &&
        python to_crops.py -i ${req.body.uuid} -u ${req.body.user_id} -m ${req.body.image_id}
    `, {
        shell: '/bin/bash',
    }, async (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            res.json({
                error: 'there was an error',
            });
        } else {
            var output = stdout.split(/\r?\n/); // split by line and strip
            output.pop(); // ditch empty line
            var crop_uuids = _.map(output, (line) => {
                return line.split(' ')[0];
            });
            // TODO make this like rest api response
            // TODO brittle
            const db = await _db.dbPromise;
            var crop_qs = _.join(_.map(crop_uuids, (uuid) => { return '?'; }), ', ');
            var all_crops_sql = `select * from crops
                where uuid in (
                    ${crop_qs}
                );`;
            var crops = await db.all(all_crops_sql, crop_uuids);
            _.map(crops, (crop) => {
                crop.obj_type = 'crop';
            });
            res.json(crops);
        }
    });
});

// sequence audio into a song
app.post('/to_sequence', async function (req, res) {
    // TODO check input against db, use db result for command string
    var uuids_string = _.join(req.body.uuids, ' ');
    exec(`
        cd ../audio_processing &&
        source .env/bin/activate &&
        export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json" &&
        python to_sequence.py -c ${uuids_string} -u "${req.body.user_id}" -s "${req.body.song_id}"
    `, {
        shell: '/bin/bash',
    }, async (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            res.json({
                error: 'there was an error',
            });
        } else {
            var output = stdout.split(/\r?\n/);
            var line = output.shift();
            var sequence_uuid = line.split(' ')[0];
            var sequence_url = line.split(' ')[1];
            console.log(sequence_uuid, sequence_url);
            const db = await _db.dbPromise;
            var sequence = await db.get('select * from sequences where uuid = ?', sequence_uuid);
            sequence.obj_type = 'sequence';
            res.json(sequence);
        }
    });
});


module.exports = app.listen(port, () => console.log(`listening on port ${port}!`));
