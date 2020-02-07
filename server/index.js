const express = require('express');
const uuidv4 = require('uuid/v4');
var exec = require('child_process').exec;

const app = express();
const port = 3000;
const bucket_name = 'song_barker_sequences';
const render_dir = 'sequences';
const input_audio_dir = 'input_audio';

app.get('/', (req, res) => res.send('barkin\' songs, makin\'n friends'));

app.get('/render_audio/:raw_input_filename', function (req, res) {
	// clientside should upload a raw audio file to the input_audio dir in the bucket
	// then hit this api with that file's name.
	// this api will grab that raw audio from the bucket and generate
	// an audio sequence. 
	// this api will immediately return a response with the yet to be rendered
	// audio's eventual filename on the bucket. you can poll that and show a loading
	// spinner until it actually returns a file
	var render_uuid = uuidv4();
	var render_fp = `gs://${bucket_name}/${render_dir}/${render_uuid}.wav`;
	req.params.render_fp = render_fp;
	res.send(req.params);
	// kick off rendering process here...
	console.log('rendering!');
	//exec(`echo "${Date.now()} ${render_uuid}" >> render_log.txt`);
	//python audio_to_sequence.py gs://${bucket_name}/${input_audio_dir}/${req.params.raw_input_filename} ${render_fp} ${render_uuid} &&
	exec(`
		cd ../audio_processing && 
		source .env/bin/activate &&
		export GOOGLE_APPLICATION_CREDENTIALS="../credentials/songbarker-50dfd44f0393.json" &&
		python audio_to_sequence.py ${input_audio_dir}/${req.params.raw_input_filename} ${render_dir}/${render_uuid}.wav ${render_uuid}
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

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
