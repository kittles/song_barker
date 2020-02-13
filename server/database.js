const fs = require('fs');
var sqlite = require('sqlite-sync');
var _ = require('lodash');
const uuidv4 = require('uuid/v4');

const DB_FILENAME = 'barker_database.db'

var db = {
	cursor: sqlite.connect(DB_FILENAME),
}

exports.cursor = db.cursor;


// db initialization

// raw is the initial audio upload
// crops is the discrete sections that come from the raw audio file
// sequences are the rendered sequences that come from crops
// sqlite3 library cannot handle multiple creates... so do them sequentially :/
var create_table_sql = [
	//`DROP TABLE IF EXISTS raw`,
	`CREATE TABLE raw (
		client_id TEXT,
		uuid TEXT UNIQUE,
		name TEXT,
		pet_id TEXT,
		url TEXT,
		stream_url TEXT,
        hidden INTEGER DEFAULT 0
	)`,
	//`DROP TABLE IF EXISTS crops`,
	`CREATE TABLE crops (
		client_id TEXT,
		uuid TEXT UNIQUE,
		raw_fk INTEGER,
		name TEXT,
		url TEXT,
		stream_url TEXT,
        hidden INTEGER DEFAULT 0
	)`,
	//`DROP TABLE IF EXISTS sequences`,
	`CREATE TABLE sequences (
		client_id TEXT,
		uuid TEXT UNIQUE,
		crop_fk INTEGER,
		name TEXT,
		url TEXT,
		stream_url TEXT,
        hidden INTEGER DEFAULT 0
	)`,
];

function initialize_db () {
	//try {
	//	console.log(`attempting to back up db to ${DB_FILENAME}.bak`);
	//	fs.renameSync(DB_FILENAME, `${DB_FILENAME}.bak`);
	//} catch (error) {
	//	console.log('skipping backing up old db');
	//}
	//fs.unlinkSync(DB_FILENAME);
	//fs.touch
	db.cursor = sqlite.connect(DB_FILENAME);
	_.each(create_table_sql, (sql) => {
		db.cursor.run(sql);
	})
};
exports.initialize_db = initialize_db;


function close_db () {
	db.cursor.close();
};
exports.close_db = close_db;


function default_params (params, defaults) {
	for (var key in defaults) {
		if (defaults.hasOwnProperty(key)) {
			params[key] = (params[key] ? params : defaults)[key];
		}
	}
}


// raw table

// client_id: the string used to identify users
// uuid: the clientside generated uuid used to identify a new audio transaction directory
// name: the user specified name of the raw audio file (this is *NOT* the name of the raw audio file in the bucket)
// url: the actual link to the raw audio file on the bucket
// stream_url: the url where the raw audio can be streamed from


function add_raw (params) {
	default_params(params, {
		client_id: 'default-id',
		uuid: 'default-uuid',
		name: 'default-name',
        pet_id: null,
		url: null,
		stream_url: null,
	});
	return db.cursor.insert('raw', params);
};
exports.add_raw = add_raw;


function list_raw (client_id) {
	return db.cursor.run(`SELECT * FROM raw where client_id = ?`, [client_id]);
};
exports.list_raw = list_raw;


// crops table

// client_id: the string used to identify users
// raw_fk: foreign key to the row in the raw table
// name: the user specified name of the cropped audio file (this can be default to something based on
//     the initial audio file name, or can remain empty until the user names it)
// url: the actual link to the cropped file on the bucket
// stream_url: the url where the cropped file can be streamed from


function add_crop (params) {
	default_params({
		client_id: 'default-id',
        uuid: 'this-should-never-be-empty',
		raw_fk: 'this-shoul-never-be-empty',
		name: 'default-name',
		url: null,
		stream_url: null,
	});
	return db.cursor.insert('crops', params);
};
exports.add_crop = add_crop;


function list_crops (raw_fk) {
	return db.cursor.run(`SELECT * FROM crops where raw_fk = ?`, [raw_fk]);
};
exports.list_crops = list_crops;


// sequence table

// client_id: the string used to identify users
// uuid: the clientside generated uuid used to identify a new audio transaction directory
// name: the user specified name of the raw audio file (this is *NOT* the name of the raw audio file in the bucket)
// url: the actual link to the raw audio file on the bucket
// stream_url: the url where the raw audio can be streamed from


function add_sequence (params) {
	default_params({
		client_id: 'default-id',
		crop_fk: 'this-should-never-be-empty',
		name: 'default-name',
		url: null,
		stream_url: null,
	});
	
	return db.cursor.insert('sequences', params);
};
exports.add_sequence = add_sequence;


function list_sequences (raw_fk) {
	return db.cursor.run(`SELECT * FROM sequences where raw_fk = ?`, [raw_fk]);
};
exports.list_sequences = list_sequences;


//var initialize_db_sql = `
//CREATE TABLE IF NOT EXISTS raw (
//	client_id TEXT,
//    uuid TEXT,
//    name TEXT,
//	url TEXT,
//	stream_url TEXT,
//	UNIQUE (uuid) ON CONFLICT ABORT
//);
//CREATE TABLE IF NOT EXISTS crops (
//	client_id TEXT,
//    raw_fk INTEGER,
//	name TEXT,
//	url TEXT,
//	stream_url TEXT
//);
//CREATE TABLE IF NOT EXISTS sequences (
//	client_id TEXT,
//    raw_fk INTEGER,
//	name TEXT,
//	url TEXT,
//	stream_url TEXT
//);
//`;


fill_with_mock_data = function fill_with_mock_data () {
	//fs.unlinkSync(DB_FILENAME);
	initialize_db();
	//var rows = db.cursor.run("select name from sqlite_master where type='table'");

	var rowid = add_raw({
		client_id: 'jeff-epstein',
		uuid: 'some-audio-uuid',
		pet_id: 'Fred',
		name: 'fred getting mad',
	});

	var rowid = add_raw({
		client_id: 'jeff-epstein',
		uuid: 'some-other-uuid',
		pet_id: 'Fred',
		name: 'fred being scared',
	});

	//var rowid = add_raw({
	//	client_id: 'client-1',
	//	uuid: uuidv4(),
	//	name: 'Fred',
	//});
	//var fred_id = rowid;
	//add_crop({
	//	client_id: 'client-1',
	//	raw_fk: rowid,
	//	name: 'loud bark',
	//});
	//add_crop({
	//	client_id: 'client-1',
	//	raw_fk: rowid,
	//	name: 'growl',
	//});
	//add_sequence({
	//	client_id: 'client-1',
	//	raw_fk: rowid,
	//	name: 'fred barking happy birthday',
	//});
	//add_sequence({
	//	client_id: 'client-1',
	//	raw_fk: rowid,
	//	name: 'fred growling happy birthday',
	//});

	//var rowid = add_raw({
	//	client_id: 'client-1',
	//	uuid: uuidv4(),
	//	name: 'Ben',
	//});
	//var ben_id = rowid;
	//add_crop({
	//	client_id: 'client-1',
	//	raw_fk: rowid,
	//	name: 'bark',
	//});
	//add_crop({
	//	client_id: 'client-1',
	//	raw_fk: rowid,
	//	name: 'whimper',
	//});

	//var rowid = add_raw({
	//	client_id: 'client-1',
	//	uuid: uuidv4(),
	//	name: 'Joe',
	//});
	//add_crop({
	//	client_id: 'client-1',
	//	raw_fk: rowid,
	//	name: 'woof',
	//});
	//add_crop({
	//	client_id: 'client-1',
	//	raw_fk: rowid,
	//	name: 'mega woof',
	//});

	//var rowid = add_raw({
	//	client_id: 'client-2',
	//	uuid: uuidv4(),
	//	name: 'Weird Dog',
	//});
	//add_crop({
	//	client_id: 'client-1',
	//	raw_fk: rowid,
	//	name: 'loud bark',
	//});
	//add_crop({
	//	client_id: 'client-1',
	//	raw_fk: rowid,
	//	name: 'groan',
	//});

	//var rowid = add_raw({
	//	client_id: 'client-2',
	//	uuid: uuidv4(),
	//	name: 'Weird Dog 2',
	//});
	//add_crop({
	//	client_id: 'client-1',
	//	raw_fk: rowid,
	//	name: 'bark',
	//});
	//add_crop({
	//	client_id: 'client-1',
	//	raw_fk: rowid,
	//	name: 'loud bark',
	//});


	//console.log(list_raw('client-1'));
	//console.log(list_crops(ben_id));
	//console.log(list_sequences(fred_id));
};


if (require.main === module) {
	fill_with_mock_data();
}
