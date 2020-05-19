var _ = require('lodash');


function error_wrapper (fn, status) {
    return async (req, res) => {
        try {
            return await fn(req, res);
        } catch (err) {
            return res.status(status).send(`[rest api error] ${err}`);
        }
    };
}


function check_authentication (req, res) {
    if (req.session.user_id) {
        return true;
    } else {
        res.status(401).send('[rest api error] your must have a valid user_id to access this resource');
    }
}


function obj_rest_api (def, db) {
    // generate rest endpoints for an object
    // TODO user_id comes from session object
    var rest_api = {
        get_all: {
            request_method: 'get',
            endpoint: `/all/${def.obj_type}`,
            handler: async (req, res) => {
                // ensure there is a user_id on the session
                if (def.user_owned) {
                    check_authentication(req, res);
                }
                var sql = `SELECT * from ${def.table_name}\n`;
                if (def.user_owned) {
                    sql += `    where user_id = "${req.session.user_id}"\n`;
                }
                if (def.order_by) {
                    sql += `    order by ${def.order_by} ASC\n`;
                }
                sql += ';';
                var rows = await db.all(sql);
                _.each(rows, (row) => {
                    row.obj_type = def.obj_type;
                });
                return res.json(rows);
            },
        },
        get: {
            request_method: 'get',
            endpoint: `/${def.obj_type}/:primary_key`,
            handler: async (req, res) => {
                // TODO check user_id against resource
                var sql = `SELECT * from ${def.table_name}\n`;
                sql += `    where ${def.primary_key} = "${req.params.primary_key}";`;
                var row = await db.get(sql);
                row.obj_type = def.obj_type;
                return res.json(row);
            },
        },
        post: {
            request_method: 'post',
            endpoint: `/${def.obj_type}`,
            handler: async (req, res) => {
                // TODO add user_id for user_owned resources
                var sql_obj = obj_to_sql(req.body);
                var sql = `INSERT INTO ${def.table_name} ${sql_obj.columns} VALUES ${sql_obj.placeholders};`;
                var db_response = await db.run(sql, prefix_obj(req.body));
                var row = await db.get(`SELECT * from ${def.table_name} where rowid = "${db_response.lastID}";`);
                row.obj_type = def.obj_type;
                return res.json(row);
            },
        },
        patch: {
            request_method: 'patch',
            endpoint: `/${def.obj_type}/:primary_key`,
            handler: async (req, res) => {
                // TODO check user_id against resource
                var columns = _.keys(req.body);
                var sql = `UPDATE ${def.table_name} SET\n`;
                sql += _.join(_.map(_.initial(columns), (column) => {
                    return `    ${column} = $${column},\n`;
                }), '');
                sql += `    ${_.last(columns)} = $${_.last(columns)}\n`;
                sql += `WHERE ${def.primary_key} = "${req.params.primary_key}";`;
                await db.run(sql, prefix_obj(req.body));
                var row = await db.get(`SELECT * from ${def.table_name} where ${def.primary_key} = "${req.params.primary_key}";`);
                row.obj_type = def.obj_type;
                return res.json(row);
            },
        },
        delete: {
            request_method: 'delete',
            endpoint: `/${def.obj_type}/:primary_key`,
            handler: async (req, res) => {
                // TODO check user_id against resource
                var sql = `UPDATE ${def.table_name}\n`;
                sql += `    set hidden = 1 where ${def.primary_key} = "${req.params.primary_key}";`;
                await db.run(sql);
                var row = await db.get(`SELECT * from ${def.table_name} where ${def.primary_key} = "${req.params.primary_key}";`);
                row.obj_type = def.obj_type;
                return res.json(row);
            },
        },
    };
    _.each(rest_api, (api) => {
        api.handler = error_wrapper(api.handler, 500);
    });
    return rest_api;
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


