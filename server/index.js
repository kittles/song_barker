const express = require('express');
const _ = require('lodash');
var exec = require('child_process').exec;

const app = express();
const port = 3000;
const bucket_name = 'song_barker_sequences';
const crop_dir = 'cropped_audio';
const sequence_dir = 'sequenced_audio';
const input_audio_dir = 'input_audio';
var db = require('./database.js');

app.use(express.json({
	// NOTE: make sure your post requests header Content-Type matches this, otherwise
	// the json will not be parsed
	type: 'application/json',
}));


app.get('/', (req, res) => res.send('barkin\' songs, makin\'n friends'));


// util


function where_in_sql (sql_in, xs) {
	return	sql_in + ' ( ' + xs.map(() => { return '?' }).join(',') + ' )';
}


// non indempotent fns


app.post('/add_raw', function (req, res) {
    // do this when you just uploaded a new raw audio file
    //
    // post params:
    //    client_id: this is the string that identifies the user from other users
    //    uuid: the uuid that was used to create the dir in the bucket where the raw audio was uploaded
    //    name: the user specified name of the file (this is NOT what the file is called in the bucket,
    //        its what the user sees when they need to interact / select the file in the clientside app
	//    pet_id: just use the name of the pet for now
	var result = db.add_raw({
        client_id: req.body.client_id,
        uuid: req.body.uuid,
        name: req.body.name,
        pet_id: req.body.pet_id,
    });
	// TODO handle uuid already exists
	res.json({
        rows: db.cursor.run('select * from raw where uuid = ?', [req.body.uuid]),
    });
});


app.post('/split_audio', function (req, res) {
	// call this when you have uploaded a new audio file and
	// want to crop it in to piece that can be candidates for
	// the individual sounds
	// the cropped files will be in audio-uuid/cropped
	//
	// post params:
    //     uuid: the uuid of the dir where the raw file resides

	// TODO: this shouldnt block but it does for simplifying dev process so far
	exec(`
		cd ../audio_processing && 
		source .env/bin/activate &&
		export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json" &&
		python split_on_silence.py -i ${req.body.uuid}
	`, {
		'shell': '/bin/bash',
	}, (error, stdout, stderr) => {
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
			res.json({
				rows: _.map(_.zip(crop_uuids, crop_fps), (pair) => {
					return {
						obj_type: 'crop',
						uuid: pair[0],
						url: pair[1],
					};
				})
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
		python sequence_audio.py -c "${req.body.crop_uuid}"
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



app.get('/list_raw/:client_id', function (req, res) {
	// shows all the audio uuids associated with a client id
    res.json({
		rows: _.map(db.cursor.run('select * from raw where client_id = ?', [req.params.client_id]), (obj) => {
			obj.obj_type = 'raw';
			return obj;
		}),
	});
});


app.get('/list_crop/:client_id', function (req, res) {
	// shows all crops for a client
	var fks = _.map(
		db.cursor.run('select uuid from raw where client_id = ?', [req.params.client_id]),
		'uuid'
	);
	var rows = db.cursor.run(
		'select * from crops where raw_fk in ( ' + fks.map(() => { return '?' }).join(',') + ' )',
		fks
	);
    res.json({
		rows: _.map(rows, (row) => {
			row.obj_type = 'crop';
			row.raw_obj = db.cursor.run('select * from raw where uuid = ?', [row.raw_fk])[0];
			return row;
		}),
	});
});


app.get('/list_sequence/:client_id', function (req, res) {
	// shows all crops for a client
	var raw_fks = _.map(
		db.cursor.run('select uuid from raw where client_id = ?', [req.params.client_id]),
		'uuid'
	);
	console.log(raw_fks);
	var crop_fks = _.map(raw_fks, (raw_fk) => {
		return db.cursor.run(where_in_sql('select uuid from crops where raw_fk in ', raw_fks), raw_fks);
	})
	crop_fks = _.map(_.flatten(crop_fks), 'uuid');
	console.log(crop_fks);
	var rows = db.cursor.run(
		where_in_sql('select * from sequences where crop_fk in ', crop_fks),
		crop_fks
	);
    res.json({
		rows: _.map(rows, (row) => {
			row.obj_type = 'sequence';
			row.crop_obj = db.cursor.run('select * from crops where uuid = ?', [row.crop_fk])[0];
			row.raw_obj = db.cursor.run('select * from raw where uuid = ?', [row.crop_obj.raw_fk])[0];
			// TODO make a nice where in fn...
			// include the parent objects for each sequence...
			return row;
		}),
	});
});


app.listen(port, () => console.log(`listening on port ${port}!`));
