const express = require('express');
var exec = require('child_process').exec;

const app = express();
const port = 3000;
const bucket_name = 'song_barker_sequences';
const crop_dir = 'cropped_audio';
const sequence_dir = 'sequenced_audio';
const input_audio_dir = 'input_audio';
var db = require('./database.js');


app.get('/', (req, res) => res.send('barkin\' songs, makin\'n friends'));


app.get('/list_audio/:client_id', function (req, res) {
	// shows all the audio uuids associated with a client id
	var query = db.list_audio(req.params.client_id);
	query.then((rows) => {
		req.params.audio_uuids = rows;
		res.send(req.params);
	});
});


app.get('/add_audio/:audio_uuid', function (req, res) {
	// this will make an entry in the database that associates an audio uuid with a client id
	// you should call this whenever you upload a raw audio file to the bucket
	db.add_audio('some-client-id', req.params.audio_uuid);
	res.send(req.params);
});


app.get('/split_audio/:audio_uuid', function (req, res) {
	// call this when you have uploaded a new audio file and
	// want to crop it in to piece that can be candidates for
	// the individual sounds
	// the cropped files will be in audio-uuid/cropped
	res.send(req.params);
	exec(`
		cd ../audio_processing && 
		source .env/bin/activate &&
		export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json" &&
		python split_on_silence.py -i ${req.params.audio_uuid}
	`, {
		'shell': '/bin/bash',
	}, (error, stdout, stderr) => {
		if (error) {
			console.error(`exec error: ${error}`);
			return;
		}
		console.log(`stdout: ${stdout}`);
		console.error(`stderr: ${stderr}`);
	});
});


app.get('/sequence_audio/:audio_uuid', function (req, res) {
	// for a give cropped audio, generate a musical sequence from it
	// this sequence will be in audio-uuid/sequences/filename.wav
	// it will have to look for already existing sequences and generate a filename sequentially (like 008.wav if there
	// were already 7 rendered sequences in there i guess)
	// TODO not implemented
	req.params.not_implemented = 'NOT IMPLEMENTED'
	res.send(req.params);
});


app.listen(port, () => console.log(`listening on port ${port}!`));
