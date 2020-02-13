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
	type: 'application/x-www-form-urlencoded',
}));


app.get('/', (req, res) => res.send('barkin\' songs, makin\'n friends'));


app.get('/list_raw/:client_id', function (req, res) {
	// shows all the audio uuids associated with a client id
    res.json({
		rows: db.cursor.run('select * from raw where client_id = ?', [req.params.client_id]),
	});
});


app.post('/add_raw', function (req, res) {
    // do this when you just uploaded a new raw audio file
    //
    // post params:
    //    client_id: this is the string that identifies the user from other users
    //    uuid: the uuid that was used to create the dir in the bucket where the raw audio was uploaded
    //    name: the user specified name of the file (this is NOT what the file is called in the bucket,
    //        its what the user sees when they need to interact / select the file in the clientside app
	db.add_raw({
        client_id: req.body.client_id,
        uuid: req.body.uuid,
        name: req.body.name,
    });

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
			console.log(`stdout: ${stdout}`);
			console.error(`stderr: ${stderr}`);
			res.json({
				rows: db.cursor.run('select * from crops where raw_fk = ?', [req.body.uuid]),
				//rows: db.cursor.run('select * from crops'),
			});
		}
	});
});


app.get('/list_all_crops/:client_id', function (req, res) {
	// shows all crops for a client
	var fks = _.map(
		db.cursor.run('select uuid from raw where client_id = ?', [req.params.client_id]),
		'uuid'
	);
	console.log('uuids are', fks);
	var rows = db.cursor.run(
		'select * from crops where raw_fk in ( ' + fks.map(() => { return '?' }).join(',') + ' )',
		fks
	);
    res.json({
		rows: rows,
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
		python sequence_audio.py -c ${req.body.crop_uuid}
	`, {
		'shell': '/bin/bash',
	}, (error, stdout, stderr) => {
		if (error) {
			console.error(`exec error: ${error}`);
			res.json({
				error: 'there was an error',
			});
		} else {
			console.log(`stdout: ${stdout}`);
			console.error(`stderr: ${stderr}`);
			res.json({
				rows: db.cursor.run('select * from sequences where raw_fk = ?', [req.body.crop_uuid]),
				//rows: db.cursor.run('select * from crops'),
			});
		}
	});
});


app.listen(port, () => console.log(`listening on port ${port}!`));
