var _ = require('lodash');
var Promise = require('bluebird');
var sqlite = require('sqlite');

var DB_FILE = process.env.DB_FILE || 'barker_database.db';

// TODO probably want to use dev db on server
var dbPromise = sqlite.open(DB_FILE, { Promise });
exports.dbPromise = dbPromise;


async function initialize_db () {
    const models = require('./models.js').models;
    const db = await dbPromise;
    return Promise.all(_.map(models, (def) => {
        var sql = `CREATE TABLE IF NOT EXISTS ${def.table_name} (\n`;
        var col_sql = _.map(_.initial(def.schema.columns), (column) => {
            return `    ${column.name} ${_.toUpper(column.type)},`;
        });
        var last_column = _.last(def.schema.columns);
        col_sql.push(`    ${last_column.name} ${_.toUpper(last_column.type)}`);
        sql += _.join(col_sql, '\n');
        sql += '\n);';
        console.log(sql);
        return db.run(sql);
    }));
};
exports.initialize_db = initialize_db;
