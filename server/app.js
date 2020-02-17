const express = require('express');
const _ = require('lodash');
var exec = require('child_process').exec;

const app = express();
const port = 3000;
var rest_api = require('./rest_api.js');
var models = require('./models.js').models;
var _db = require('./database.js');

app.use(express.json({
	type: 'application/json',
}));
app.set('json spaces', 2);


app.get('/', (req, res) => res.send('barkin\' songs, makin\'n friends'));


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


app.get('/describe', (req, res) => {
	res.json(models);
});



// audio processing apis

app.post('/split_audio', async function (req, res) {
	// call this when you have uploaded a new audio file and
	// want to crop it in to piece that can be candidates for
	// the individual sounds
	// the cropped files will be in audio-uuid/cropped
	//
	// post params:
    //     uuid: the uuid of the dir where the raw file resides

	// TODO: refactor to async await format
	exec(`
		cd ../audio_processing && 
		source .env/bin/activate &&
		export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json" &&
		python split_on_silence.py -i ${req.body.uuid} -u ${req.body.user_id}
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
			// TODO pet_id comes back

			const db = await _db.dbPromise;
			var raw = await db.get('select * from raws where uuid = ?', req.body.uuid);
			var pet = await db.get('select * from pets where pet_id = ?', raw.pet_id);
			var crop_qs = _.join(_.map(crop_uuids, (uuid) => { return '?' }), ', ');
			var all_crops_sql = `select * from crops 
				where uuid in ( 
					${ crop_qs }
				);`;
			var crops = await db.all(all_crops_sql, crop_uuids);
			_.map(crops, (crop) => {
				crop.obj_type = 'crop';
			});
			pet.obj_type = 'pet';
			res.json({
				crops: crops,
				pet: pet,
			});
		}
	});
});


app.post('/sequence_audio', function (req, res) {
	// for a give cropped audio, generate a musical sequence from it
	//
	// params:
	//     crop_uuid: this is the uuid of the crop. you can get it from list_all_crops
	exec(`
		cd ../audio_processing && 
		source .env/bin/activate &&
		export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json" &&
		python sequence_audio.py -c "${req.body.uuid}"
	`, {
		'shell': '/bin/bash',
	}, (error, stdout, stderr) => {
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
			// TODO make this like rest api response
			res.json({
				rows: [
					{
						obj_type: 'sequence',
						uuid: sequence_uuid,
						url: sequence_url,
					},
				],
			});
		}
	});
});


app.listen(port, () => console.log(`listening on port ${port}!`));
