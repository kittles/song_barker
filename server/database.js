var _ = require('lodash');
var Promise = require('bluebird');
var sqlite = require('sqlite');
const dbPromise = sqlite.open('barker_database.db', { Promise });

exports.dbPromise = dbPromise;


async function initialize_db (models) {
	const db = await dbPromise;
	var queries = [];
    _.each(models, (def) => {
        var sql = `CREATE TABLE ${def.table_name} (\n`;
        var col_sql = _.map(_.initial(def.schema.columns), (column) => {
            return `    ${column.name} ${_.upperCase(column.type)},`;   
        });
        var last_column = _.last(def.schema.columns);
        col_sql.push(`    ${last_column.name} ${_.upperCase(last_column.type)}`);
        sql += _.join(col_sql, '\n')
        sql += '\n);';
		queries.push(db.run(sql));
    })
	return await Promise.all(queries);
};
exports.initialize_db = initialize_db;
