const express = require('express');
const _ = require('lodash');
var exec = require('child_process').exec;
var ms = require('mediaserver');
var morgan = require('morgan');

const app = express();
var port = process.env.PORT || 3000;
var rest_api = require('./rest_api.js');
var models = require('./models.js').models;
var _db = require('./database.js');
var signed = require('./signed_url.js');


// server config

app.use(express.json({
	type: 'application/json',
}));
app.set('json spaces', 2);
app.use(morgan('combined')) // logging


// index

app.get('/', (req, res) => res.send('barkin\' songs, makin\'n friends'));


// send a dog puppet

app.get('/sample_animation', (req, res) => {
    res.send(`
    <head>
        <!--
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/5.2.1/pixi.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/4.0.3/pixi.js"></script>
        -->
        <script
          src="https://code.jquery.com/jquery-3.4.1.min.js"
          integrity="sha256-CSXorXvZcTkaix6Yvo6HppcZGetbYMGWSFlBw8HfCJo="
          crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/110/three.js"></script>
        <style>
        html { overflow: hidden; }
		body {
			margin: 0px auto;
			overflow: hidden;
		}
        canvas { display: block; }
		img { visibility: hidden; }
        </style>
    </head>
    <body>
        <script src="bark.js"></script>
    </body>
    `);
});
app.use(express.static('./public'));


// media server

app.get('/play/:sequence_uuid', async (req, res) => {
    // download and convert a sequence audio
    // put in a temp folder
	console.log('downloading file');
	exec(`
		cd ../audio_processing && 
		source .env/bin/activate &&
		export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json" &&
		python for_streaming_playback.py -i ${req.params.sequence_uuid}
	`, {
		'shell': '/bin/bash',
	}, async (error, stdout, stderr) => {
		console.log('finished downloading');
		if (error) {
			console.error(`exec error: ${error}`);
			res.json({
				error: 'there was an error',
			});
		} else {
		    ms.pipe(req, res, './public/sequence.wav');
		}
	});
});


// rest api

(async () => {
	//await _db.initialize_db(models);
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
    res.json({url: url});
});


app.post('/playback_url', async (req, res) => {
    var url = await signed.to_signed_playback_url(req.body.filename);
    res.json({url: url});
});


// model descriptions

app.get('/describe', (req, res) => {
	res.json(models);
});


// audio processing apis
// TODO dont interpolate user input
// directly into shell scripts...
// should use user id and uuid to check database for objects
// then use result from that to execute shell script.

app.post('/to_crops', async function (req, res) {
	// call this when you have uploaded a new audio file and
	// want to crop it in to piece that can be candidates for
	// the individual sounds
	// the cropped files will be in audio-uuid/cropped
	//
	// post params:
    //     uuid: the uuid of the dir where the raw file resides
    //     user_id: the user id

	// TODO: refactor to async await format
	exec(`
		cd ../audio_processing && 
		source .env/bin/activate &&
		export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json" &&
		python to_crops.py -i ${req.body.uuid} -u ${req.body.user_id} -m ${req.body.image_id}
	`, {
		'shell': '/bin/bash',
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
			var crop_fps = _.map(output, (line) => {
				return line.split(' ')[1];
			});
			// TODO make this like rest api response
			// TODO brittle
			const db = await _db.dbPromise;
			var raw = await db.get('select * from raws where uuid = ?', req.body.uuid);
			var crop_qs = _.join(_.map(crop_uuids, (uuid) => { return '?' }), ', ');
			var all_crops_sql = `select * from crops 
				where uuid in ( 
					${ crop_qs }
				);`;
			var crops = await db.all(all_crops_sql, crop_uuids);
			_.map(crops, (crop) => {
				crop.obj_type = 'crop';
			});
			res.json(crops);
		}
	});
});


app.post('/to_sequence', async function (req, res) {
	/*
	* args:
	*	- uuids: array or crop uuids, in order of the midi tracks
	*	- user_id
	*	- song_id
	*/
	var uuids_string = _.join(req.body.uuids, ' ');
	exec(`
		cd ../audio_processing && 
		source .env/bin/activate &&
		export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json" &&
		python to_sequence.py -c ${uuids_string} -u "${req.body.user_id}" -s "${req.body.song_id}"
	`, {
		'shell': '/bin/bash',
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


app.listen(port, () => console.log(`listening on port ${port}!`));
