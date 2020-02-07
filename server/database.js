var sqlite3 = require('sqlite3').verbose()
var db = new sqlite3.Database('render_database.db')

var initialize_db_sql = `
CREATE TABLE IF NOT EXISTS renders (
	client_id TEXT,
    uuid TEXT
)`;

function initialize_db () {
	db.run(initialize_db_sql);
}


var add_render_sql = `
INSERT INTO renders (
	client_id, 
	uuid
)
VALUES (
	?,
	?
)`;

function add_render (client_id, uuid) {
	db.run(add_render_sql, client_id, uuid);
}


var list_renders_sql = `SELECT * FROM renders where client_id = ?`;

function list_renders (client_id, resp_fn) {
    return new Promise(function(resolve, reject) {
        db.all(list_renders_sql, client_id, function (err, rows)  {
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


exports.add_render = add_render;
exports.list_renders = list_renders;
exports.close_db = close_db;
