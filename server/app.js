var express = require('express');
var _ = require('lodash');
var exec = require('child_process').exec;
var morgan = require('morgan');
var path = require('path');
var app = express();
var rest_api = require('./rest_api.js');
var models = require('./models.js').models;
var _db = require('./database.js');
var signed = require('./signed_url.js');

var port = process.env.PORT || 3000;

// server config
app.use(express.json({
    type: 'application/json',
}));
app.set('json spaces', 2);
app.use(morgan('combined')); // logging
app.use(express.static('./public'));


//
// routes
//


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
