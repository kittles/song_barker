var sqlite3 = require('sqlite3').verbose()
var db = new sqlite3.Database('render_database.db')

var initialize_db_sql = `
CREATE TABLE IF NOT EXISTS client_audio (
	client_id TEXT,
    audio_uuid TEXT
)`;

function initialize_db () {
	db.run(initialize_db_sql);
}

var add_audio_sql = `
INSERT INTO clien_audio (
	client_id, 
	audio_uuid
)
VALUES (
	?,
	?
)`;

function add_audio (client_id, audio_uuid) {
	db.run(add_audio_sql, client_id, audio_uuid);
}


var list_audio_sql = `SELECT * FROM client_audio where client_id = ?`;

function list_audio (client_id, resp_fn) {
    return new Promise(function(resolve, reject) {
        db.all(list_audio_sql, client_id, function (err, rows)  {
            if (err) {
                reject("Read error: " + err.message);
            } else {
                resolve(rows);
            }
        })
    })
}


function close_db () {
	db.close();
}


exports.add_audio = add_audio;
exports.list_audio = list_audio;
exports.close_db = close_db;
