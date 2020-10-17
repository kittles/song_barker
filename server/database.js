var _ = require('lodash');
var Promise = require('bluebird');
var sqlite = require('sqlite');

var DB_FILE = process.env.k9_database || 'barker_database.db';

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


async function update_db () {
    // for adding new columns to the db
    const models = require('./models.js').models;
    const db = await dbPromise;
    return Promise.all(_.map(models, async (def) => {
        var table_info = await db.all(`PRAGMA table_info(${def.table_name})`);
        //{
        //  cid: 6,
        //  name: 'name',
        //  type: 'TEXT',
        //  notnull: 0,
        //  dflt_value: null,
        //  pk: 0
        //},

        // add columns if they arent in the table info
        _.map(def.schema.columns, async (column) => {
            if (!table_has_column(table_info, column.name)) {
                var alter_sql = `ALTER TABLE ${def.table_name} ADD COLUMN ${column.name} ${_.toUpper(column.type)};`;
                console.log(`running: "${alter_sql}"`);
                await db.run(alter_sql);
            }
        });


        //var sql = `CREATE TABLE IF NOT EXISTS ${def.table_name} (\n`;
        //var col_sql = _.map(_.initial(def.schema.columns), (column) => {
        //    return `    ${column.name} ${_.toUpper(column.type)},`;
        //});
        //var last_column = _.last(def.schema.columns);
        //col_sql.push(`    ${last_column.name} ${_.toUpper(last_column.type)}`);
        //sql += _.join(col_sql, '\n');
        //sql += '\n);';
        //console.log(sql);
        //return db.run(sql);
    }));


    function table_has_column (table_info, column_name) {
        return _.filter(table_info, (col) => {
            return col.name === column_name;
        }).length > 0;
    }
};
exports.update_db = update_db;
