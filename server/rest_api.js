var _ = require('lodash');
var Promise = require('bluebird');
var sqlite = require('sqlite');
const dbPromise = require('./database.js').dbPromise;


//async function initialize_db (models) {
//	const db = await dbPromise;
//	var queries = [];
//    _.each(models, (def) => {
//        var sql = `CREATE TABLE ${def.table_name} (\n`;
//        var col_sql = _.map(_.initial(def.schema.columns), (column) => {
//            return `    ${column.name} ${_.upperCase(column.type)},`;   
//        });
//        var last_column = _.last(def.schema.columns);
//        col_sql.push(`    ${last_column.name} ${_.upperCase(last_column.type)}`);
//        sql += _.join(col_sql, '\n')
//        sql += '\n);';
//		queries.push(db.run(sql));
//    })
//	await Promise.all(queries);
//};
//exports.initialize_db = initialize_db;


function obj_rest_api (def, db) {
    // generate rest endpoints for an object
	// TODO make sure primary keys are immutable
	// TODO error response
    return {
        get_all: {
			request_method: 'get',
            endpoint: `/all/${def.obj_type}/:user_id`,
            handler: async (req, res) => {
                var sql = `SELECT * from ${def.table_name}\n`;
                sql += `    where user_id = "${req.params.user_id}";`;
				var rows = await db.all(sql);
				return res.json(rows);
            },
        },
        get: {
			request_method: 'get',
            endpoint: `/${def.obj_type}/:primary_key`,
            handler: async (req, res) => {
                var sql = `SELECT * from ${def.table_name}\n`;
                sql += `    where ${def.primary_key} = "${req.params.primary_key}";`;
                //console.log(sql);
				return res.json(await db.get(sql));
				//return res.json(rows);
            },
        },
        post: {
			request_method: 'post',
            endpoint: `/${def.obj_type}`,
            handler: async (req, res) => {
                var sql_obj = obj_to_sql(req.body);
                var sql = `INSERT INTO ${def.table_name} ${sql_obj.columns} VALUES ${sql_obj.placeholders};`
                //console.log(sql);
				//console.log(prefix_obj(req.body));
				return res.json({
					last_id: await db.run(sql, prefix_obj(req.body)).lastID,
				});
            },
        },
        put: {
			request_method: 'put',
            endpoint: `/${def.obj_type}`,
            handler:  async (req, res) => {
                var columns = _.keys(req.body);
                var sql = `UPDATE ${def.table_name} SET\n`
                sql += _.join(_.map(_.initial(columns), (column) => {
                    return `    ${column} = $${column},\n`;
                }), '');
                sql += `    ${_.last(columns)} = $${_.last(columns)}\n`;
                //${sql_obj.columns} VALUES ${sql_obj.placeholders};`
                sql += `WHERE ${def.primary_key} = "${req.body[def.primary_key]}";`
				return res.json({
					last_id: await db.run(sql, prefix_obj(req.body)).lastID,
				});
            },
        },
        delete: {
			request_method: 'delete',
            endpoint: `/${def.obj_type}/:primary_key`,
            handler:  async (req, res) => {
                var sql = `UPDATE ${def.table_name}\n`;
                sql += `    set hidden = 1 where ${def.primary_key} = "${req.params.primary_key}";`;
                //console.log(sql);
				return res.json({
					last_id: await db.run(sql).lastID,
				});
            },
        },
    };
}
exports.obj_rest_api = obj_rest_api;


function obj_to_sql (obj) {
    var keys = _.keys(obj);

    var cols = '(\n';
    cols += _.join(_.map(_.initial(keys), (key) => {
        return `    ${key}, \n`;
    }), '');
    cols += `    ${_.last(keys)}\n)`;

    var placeholders = '(\n';
    placeholders += _.join(_.map(_.initial(keys), (key) => {
        return `    $${key}, \n`;
    }), '');
    placeholders += `    $${_.last(keys)}\n)`;

    return {
        columns: cols,
        placeholders: placeholders,
    };
}


function prefix_obj (obj) {
	return _.fromPairs(_.map(_.toPairs(obj), (pair) => {
		return ['$' + pair[0], pair[1]];
	}));
}


