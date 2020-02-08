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

app.get('/add_audio/:audio_uuid', function (req, res) {
	db.add_audio('some-client-id', req.params.audio_uuid);
	res.send(req.params);
});

app.get('/list_audio/:client_id', function (req, res) {
	var query = db.list_audio('from-server-some-client-id', req.params.client_id);
	query.then((rows) => {
		req.params.audio_uuids = rows;
		res.send(req.params);
	});
});

app.get('/crop_audio/:audio_uuid', function (req, res) {
	// send a response with the cropped file's uri
	req.params.crop_uri = `gs://${bucket_name}/${crop_dir}/${req.params.audio_uuid}.wav`;
	res.send(req.params);
	exec(`
		cd ../audio_processing && 
		source .env/bin/activate &&
		export GOOGLE_APPLICATION_CREDENTIALS="../credentials/songbarker-50dfd44f0393.json" &&
		python crop_audio.py --input ${input_audio_dir}/${req.params.audio_uuid}.wav --dest ${crop_dir}/${req.params.audio_uuid}.wav
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
	// send a response with the cropped file's uri
	req.params.sequence_uri = `gs://${bucket_name}/${crop_dir}/${req.params.audio_uuid}.wav`;
	res.send(req.params);
	exec(`
		cd ../audio_processing && 
		source .env/bin/activate &&
		export GOOGLE_APPLICATION_CREDENTIALS="../credentials/songbarker-50dfd44f0393.json" &&
		python sequence_audio.py --input ${crop_dir}/${req.params.audio_uuid}.wav --dest ${sequence_dir}/${req.params.audio_uuid}.wav
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

//app.get('/render_audio/:input_uuid', function (req, res) {
//	// clientside should upload a raw audio file to the input_audio dir in the bucket
//	// then hit this api with that file's name.
//	// this api will grab that raw audio from the bucket and generate
//	// an audio sequence. 
//	// this api will immediately return a response with the yet to be rendered
//	// audio's eventual filename on the bucket. you can poll that and show a loading
//	// spinner until it actually returns a file
//	// TODO discuss how client id comes in (header? param?)
//	req.params.render_fp = `gs://${bucket_name}/${render_dir}/${req.params.input_uuid}.wav`;
//	res.send(req.params);
//	console.log('rendering!');
//	db.add_render('some-client-id', req.params.input_uuid);
//	exec(`
//		cd ../audio_processing && 
//		source .env/bin/activate &&
//		export GOOGLE_APPLICATION_CREDENTIALS="../credentials/songbarker-50dfd44f0393.json" &&
//		python audio_to_sequence.py ${input_audio_dir}/${req.params.input_uuid}.wav ${render_dir}/${req.params.input_uuid}.wav ${req.params.input_uuid}
//	`, {
//		'shell': '/bin/bash',
//	}, (error, stdout, stderr) => {
//		if (error) {
//			console.error(`exec error: ${error}`);
//			return;
//		}
//		console.log(`stdout: ${stdout}`);
//		console.error(`stderr: ${stderr}`);
//	});
//});

app.listen(port, () => console.log(`listening on port ${port}!`));
