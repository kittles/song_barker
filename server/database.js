var fs = require('fs');
var _ = require('lodash');
var Promise = require('bluebird');
var sqlite = require('sqlite');
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
	var users = [
		{
			user_id: "999",
			name: "tovi",
			email: "deartovi@gmail.com",
			hidden: 0,
		},
	];
    // go through midi_files dir
    // for each song, get title and such...
    var songs = [];
	var midi_dir = '../audio_processing/midi_files';
    var dir = fs.opendirSync(midi_dir);
    var dirent;
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
			bucket_fp: `/midi_files/${filename}`,
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
        _.map(songs, (song) => {
			return db.run(`INSERT INTO songs (name, bucket_url, bucket_fp, track_count, price)
				VALUES ("${song.name}", "${song.bucket_url}", "${song.bucket_fp}", "${song.tracks}", "${song.price}")`);
        }),
		_.map(images, (image) => {
			return db.run(`INSERT INTO images (uuid, user_id, name, mouth_coordinates)
				VALUES ("${image.uuid}", "${image.user_id}", "${image.name}", "${image.mouth_coordinates}")`);
		}),
	);
	return await Promise.all(ins);
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
