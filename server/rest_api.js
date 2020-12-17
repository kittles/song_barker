var _ = require('lodash');
var uuid_validate = require('uuid-validate')


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
        res.status(401).send('[rest api error] you must have a valid user_id to access this resource');
    }
}


function check_uuid (req, res, test_str) {
    if (uuid_validate(test_str)) {
        return true;
    } else {
        res.status(400).send('[rest api error] malformed uuid');
    }
}



function obj_rest_api (def, db) {
    var rest_api = {
        get_all: {
            request_method: 'get',
            endpoint: `/all/${def.obj_type}`,
            handler: async (req, res) => {
                if (def.disable_all) {
                    res.status(401).send('[rest api error] cannot get all for this type');
                    return;
                }
                // auth
                if (def.user_owned) {
                    if (!check_authentication(req, res)) {
                        return;
                    }
                }

                // query
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
                // auth
                if (def.primary_key_is_uuid) {
                    if (!check_uuid(req, res, req.params.primary_key)) {
                        return;
                    }
                }
                if (def.user_owned) {
                    if (!check_authentication(req, res)) {
                        return;
                    }
                    if (!user_owns_resource(req.params.primary_key)) {
                        res.status(401).send('[rest api error] user doesnt own this resource');
                        return;
                    }
                }

                // query
                var sql = `SELECT * from ${def.table_name}\n`;
                sql += `    where ${def.primary_key} = "${req.params.primary_key}";`;
                var row = await db.get(sql);
                if (row) {
                    row.obj_type = def.obj_type;
                }
                return res.json(row);
            },
        },
        post: {
            request_method: 'post',
            endpoint: `/${def.obj_type}`,
            handler: async (req, res) => {
                if (def.immutable) {
                    res.status(401).send('[rest api error] cannot modify immutable type');
                    return;
                }
                // auth
                if (def.user_owned) {
                    if (!check_authentication(req, res)) {
                        return;
                    }
                    req.body.user_id = req.session.user_id; // overwrite body param (should be unset but just in case)
                }

                // query
                var sql_obj = obj_to_sql(req.body);
                var sql = `INSERT INTO ${def.table_name} ${sql_obj.columns} VALUES ${sql_obj.placeholders};`;
                var db_response = await db.run(sql, prefix_obj(req.body));
                var row = await db.get(`SELECT * from ${def.table_name} where rowid = "${db_response.lastID}";`);
                if (row) {
                    row.obj_type = def.obj_type;
                }
                return res.json(row);
            },
        },
        patch: {
            request_method: 'patch',
            endpoint: `/${def.obj_type}/:primary_key`,
            handler: async (req, res) => {
                if (def.immutable) {
                    res.status(401).send('[rest api error] cannot modify immutable type');
                    return;
                }
                // auth
                if (def.primary_key_is_uuid) {
                    if (!check_uuid(req, res, req.params.primary_key)) {
                        return;
                    }
                }
                if (def.user_owned) {
                    if (!check_authentication(req, res)) {
                        return;
                    }
                    if (!user_owns_resource(req.params.primary_key)) {
                        res.status(401).send('[rest api error] user doesnt own this resource');
                        return;
                    }
                }

                // query
                var columns = _.keys(req.body);
                var sql = `UPDATE ${def.table_name} SET\n`;
                sql += _.join(_.map(_.initial(columns), (column) => {
                    return `    ${column} = $${column},\n`;
                }), '');
                sql += `    ${_.last(columns)} = $${_.last(columns)}\n`;
                sql += `WHERE ${def.primary_key} = "${req.params.primary_key}";`;
                await db.run(sql, prefix_obj(req.body));
                var row = await db.get(`SELECT * from ${def.table_name} where ${def.primary_key} = "${req.params.primary_key}";`);
                if (row) {
                    row.obj_type = def.obj_type;
                }
                return res.json(row);
            },
        },
        delete: {
            request_method: 'delete',
            endpoint: `/${def.obj_type}/:primary_key`,
            handler: async (req, res) => {
                if (def.immutable) {
                    res.status(401).send('[rest api error] cannot modify immutable type');
                    return;
                }
                // auth
                if (def.primary_key_is_uuid) {
                    if (!check_uuid(req, res, req.params.primary_key)) {
                        return;
                    }
                }
                if (def.user_owned) {
                    if (!check_authentication(req, res)) {
                        return;
                    }
                    if (!user_owns_resource(req.params.primary_key)) {
                        res.status(401).send('[rest api error] user doesnt own this resource');
                        return;
                    }
                }

                // query
                var sql = `UPDATE ${def.table_name}\n`;
                sql += `    set hidden = 1 where ${def.primary_key} = "${req.params.primary_key}";`;
                await db.run(sql);
                var row = await db.get(`SELECT * from ${def.table_name} where ${def.primary_key} = "${req.params.primary_key}";`);
                if (row) {
                    row.obj_type = def.obj_type;
                }
                return res.json(row);
            },
        },
    };
    _.each(rest_api, (api) => {
        api.handler = error_wrapper(api.handler, 500);
    });
    // TODO restrict http methods based on models.js
    return rest_api;


    async function user_owns_resource (pk) {
        var sql = `SELECT 1 from ${def.table_name}\n`;
        sql += `    where ${def.primary_key} = "${pk}";`;
        var row = await db.get(sql);
        console.log(sql, row);
        return row['1'];
    }
}
exports.obj_rest_api = obj_rest_api;


function obj_to_sql (obj) {
    // TODO sql escaping columns
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


