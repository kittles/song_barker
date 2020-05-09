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
var gsutil_cmd = require('./gsutil_wrapper.js').gsutil_cmd;


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


app.post('/admin/create_new_song', async (req, res) => {
    // should receive a midi file and backing tracks

    var db_insert_info = {
        name: req.body.name,
        price: req.body.price,
        category: req.body.category,
        song_family: req.body.song_family,
        //bucket_url: comes from below,
        //bucket_fp: comes from below,
        //backing_track: comes from below,
    };


    // clear uploads
    // TODO probably want to handle multiple users uploading...
    // should put a lock on the dir or make a temp dir each time
    spawn.execSync('rm -rf ./uploads/*');

    var backing_dir_uuid = uuid.v4();

    db_insert_info.backing_track = backing_dir_uuid;

    var local_fp;
    var moves = _.map(req.files, (file, k) => {
        if (k === 'midi_file') {
            local_fp = `./uploads/${file.name}`;
            var remote_fp = `midi_files/${file.name}`;
            db_insert_info.bucket_fp = remote_fp;
            db_insert_info.bucket_url = 'gs://song_barker_sequences/' + remote_fp;
            file.mv(local_fp, () => {
                gsutil_cmd(`cp ${local_fp} ${db_insert_info.bucket_url}`);
                // get some info
            });
            return Promise.resolve();
        } else {
            // move all backing tracks to a dir and rename them
            var fname = _.split(file.name, '.')[0];
            var extension = _.split(file.name, '.')[1];
            var key_name = _.get(key_map, _.toLower(fname), 0);
            local_fp = `./uploads/${backing_dir_uuid}/${key_name}.${extension}`;
            return new Promise((resolve, reject) => {
                file.mv(local_fp, resolve);
            });
        }
    });

    Promise.all(moves).then(() => {
        console.log('uploading backing tracks');
        gsutil_cmd(`-m cp -r ./uploads/${backing_dir_uuid} gs://song_barker_sequences/backing_tracks`);
    });

    var db = await _db.dbPromise;
    console.log(db_insert_info);
    db.run(`
        INSERT into songs (
            name, price, category, song_family, bucket_url, bucket_fp, backing_track
        ) values (?, ?, ?, ?, ?, ?, ?)
    `, [
        db_insert_info.name,
        db_insert_info.price,
        db_insert_info.category,
        db_insert_info.song_family,
        db_insert_info.bucket_url,
        db_insert_info.bucket_fp,
        db_insert_info.backing_track,
    ]);

    res.send({
        status: true,
        message: 'ok',
    });
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
