var _ = require('lodash');
var Promise = require('bluebird');
var sqlite = require('sqlite');
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
	const db = await dbPromise;
	var users = [
		{
			user_id: "999",
			name: "tovi",
			email: "deartovi@gmail.com",
			hidden: 0,
		},
	];
	var songs = [
		{
			id: "1",
			name: "Happy Birthday",
			data: "[(-5, 1),(-5, 1),(-3, 2),(-5, 2),(0, 2),(-1, 4),]",
		},
		{
			id: "2",
			name: "Darth Vader",
			data: "[(0, 2),(0, 2),(0, 2),(-4, 1.33),(3, 0.66),(0, 2),]",
		},
	];
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
			db.run(`INSERT INTO users (user_id, name, email, hidden)
				VALUES ("${user.user_id}", "${user.name}", "${user.email}", "${user.hidden}")`);
		}),
		_.each(songs, (song) => {
			db.run(`INSERT INTO songs (id, name, data)
				VALUES ("${song.id}", "${song.name}", "${song.data}")`);
		}),
		_.each(images, (image) => {
			db.run(`INSERT INTO images (uuid, user_id, name, mouth_coordinates)
				VALUES ("${image.uuid}", "${image.user_id}", "${image.name}", "${image.mouth_coordinates}")`);
		}),
	);
	return await Promise.all(ins);
}
exports.fixtures = fixtures;
