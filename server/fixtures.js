var fs = require('fs');
var _ = require('lodash');
var Promise = require('bluebird');
var sqlite = require('sqlite');
var exec = require('child_process').exec;
var midi_parser = require('midi-parser-js');
// TODO probably want to use dev db on server
const dbPromise = sqlite.open('barker_database.db', { Promise });


async function fixtures () {
	var bucket = 'song_barker_sequences';
	const db = await dbPromise;
	var dev_user_id = 'dev';
	var users = [
		{
			user_id: dev_user_id,
			name: 'tovi',
			email: 'deartovi@gmail.com',
			hidden: 0,
		},
		{
			user_id: 999,
			name: 'tovi',
			email: 'deartovi@gmail.com',
			hidden: 0,
		},
		{
			user_id: 'Graig',
			name: 'Graig',
			email: 'graig@songbarker.com',
			hidden: 0,
		},
		{
			user_id: 'Jeremy',
			name: 'Jeremy',
			email: 'jeremy@songbarker.com',
			hidden: 0,
		},
	];
    var raws = [];
	var raw_dir = '../audio_processing/raw_fixtures';
    var dir = fs.opendirSync(raw_dir);
    var dirent;
	var c = 0;
    while ((dirent = dir.readSync()) !== null) {
        var filename = dirent.name;
		var fp = `${raw_dir}/${filename}`
        var uuid = filename.replace('.aac', '');
		c++;
		raws.push({
			uuid: uuid,
			user_id: user_id,
			name: `raw fixture ${c}`,
			bucket_url: `gs://${bucket}/${uuid}/${filename}`,
			bucket_fp: `${uuid}/${filename}`,
		});
    }
    dir.closeSync();
    var songs = [];
	var midi_dir = '../audio_processing/midi_files';
    var dir = fs.opendirSync(midi_dir);
    var dirent;
    var category_map = {
        'baby_shark.mid':         'Kids',
        'cmin_fugue.mid':         'Classical',
        'crazy.mid':              'Test',
        'for_unit_testing.mid':   'Test',
        'happy_birthday.mid':     'Holiday',
        'sample_midi.mid':        'Test',
        'sweet_child_o_mine.mid': 'Rock',
        'two_track_test.mid':     'Test',
    }:
    while ((dirent = dir.readSync()) !== null) {
        var filename = dirent.name;
		var fp = `${midi_dir}/${filename}`
        var name = filename.replace('.mid', '');
        name = name.replace(/\_/gi, ' ');
        name = title_case(name);
		songs.push({
			filename: filename,
			fp: fp,
			name: name,
			bucket_url: `gs://${bucket}/midi_files/${filename}`,
			bucket_fp: `midi_files/${filename}`,
            // TODO should this include non melody or rhythm tracks?
			tracks: midi_parser.parse(fs.readFileSync(fp, 'base64')).tracks,
			price: 0.99,
			category: category_map[filename],
		});
    }
    dir.closeSync();
    // TODO backing tracks
	var images = [
		{
			uuid: 'default_dog',
            user_id: dev_user_id,
			name: 'Default Dog',
            mouth_coordinates: '[(0.452, 0.415), (0.631, 0.334)]',
		},
	];
	var ins = _.concat(
		_.map(users, (user) => {
			return db.run(`INSERT INTO users (user_id, name, email, hidden)
				VALUES ("${user.user_id}", "${user.name}", "${user.email}", "${user.hidden}")`);
		}),
        _.map(raws, (raw) => {
			return db.run(`INSERT INTO raws (uuid, user_id, name, bucket_url, bucket_fp)
				VALUES ("${raw.uuid}", "${raw.user_id}", "${raw.name}", "${raw.bucket_url}", "${raw.bucket_fp}")`);
        }),
        _.map(songs, (song) => {
			return db.run(`INSERT INTO songs (name, bucket_url, bucket_fp, track_count, price, category)
				VALUES ("${song.name}", "${song.bucket_url}", "${song.bucket_fp}", "${song.tracks}", "${song.price}", "${song.category}")`);
        }),
		_.map(images, (image) => {
			return db.run(`INSERT INTO images (uuid, user_id, name, mouth_coordinates)
				VALUES ("${image.uuid}", "${image.user_id}", "${image.name}", "${image.mouth_coordinates}")`);
		}),
	);
	await Promise.all(ins);

    var ps = _.map(raws, async (raw) => {
        exec(`
                cd ../audio_processing && 
                source .env/bin/activate &&
                export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json" &&
                python generate_crop_fixtures.py -i ${raw.uuid} -u ${raw.user_id} -m 1
            `, {
                'shell': '/bin/bash',
            }, async (error, stdout, stderr) => {
                console.log(`cropped ${raw.uuid}`);
            }
        );
    });
}
exports.fixtures = fixtures;


function title_case (str) {
   var splitStr = str.toLowerCase().split(' ');
   for (var i = 0; i < splitStr.length; i++) {
	   // You do not need to check if i is larger than splitStr length, as your for does that for you
	   // Assign it back to the array
	   splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
   }
   // Directly return the joined string
   return splitStr.join(' ');
}

