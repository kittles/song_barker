var fs = require('fs');
var _ = require('lodash');
var Promise = require('bluebird');
var sqlite = require('sqlite');
var exec = require('child_process').exec;
var midi_parser = require('midi-parser-js');
// TODO probably want to use dev db on server
const dbPromise = sqlite.open('barker_database.db', { Promise });

exports.dbPromise = dbPromise;


async function initialize_db () {
    const models = require('./models.js').models;
	const db = await dbPromise;
    return Promise.all(_.map(models, (def) => {
        var sql = `CREATE TABLE ${def.table_name} (\n`;
        var col_sql = _.map(_.initial(def.schema.columns), (column) => {
            return `    ${column.name} ${_.upperCase(column.type)},`;   
        });
        var last_column = _.last(def.schema.columns);
        col_sql.push(`    ${last_column.name} ${_.upperCase(last_column.type)}`);
        sql += _.join(col_sql, '\n')
        sql += '\n);';
		return db.run(sql);
    }));
};
exports.initialize_db = initialize_db;


async function fixtures () {
	var bucket = 'song_barker_sequences';
	const db = await dbPromise;
	var user_id = '999';
	var users = [
		{
			user_id: user_id,
			name: 'tovi',
			email: 'deartovi@gmail.com',
			hidden: 0,
		},
	];
    var raws = [];
	var raw_dir = '../audio_processing/raw_fixtures';
    var dir = fs.openSync(raw_dir);
    var dirent;
	var c = 0;
    while ((dirent = dir.readdirSync()) !== null) {
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
    var dir = fs.openSync(midi_dir);
    var dirent;
    while ((dirent = dir.readdirSync()) !== null) {
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
			tracks: midi_parser.parse(fs.readFileSync(fp, 'base64')).tracks,
			price: 0.99,
		});
    }
    dir.closeSync();
	var images = [
		{
			uuid: "default_dog",
            user_id: "999",
			name: "Default Dog",
            mouth_coordinates: "[(0.452, 0.415), (0.631, 0.334)]",
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
			return db.run(`INSERT INTO songs (name, bucket_url, bucket_fp, track_count, price)
				VALUES ("${song.name}", "${song.bucket_url}", "${song.bucket_fp}", "${song.tracks}", "${song.price}")`);
        }),
		_.map(images, (image) => {
			return db.run(`INSERT INTO images (uuid, user_id, name, mouth_coordinates)
				VALUES ("${image.uuid}", "${image.user_id}", "${image.name}", "${image.mouth_coordinates}")`);
		}),
	);
	await Promise.all(ins);

    // call cropping script for all raw files
    var ps = _.map(raws, async (raw) => {
        exec(`
                cd ../audio_processing && 
                source .env/bin/activate &&
                export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json" &&
                python split_sox.py -i ${raw.uuid} -u ${raw.user_id} -m 1
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
