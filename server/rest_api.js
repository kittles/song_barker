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


// Needs device_id mods
async function fetch_user_ids (device_id, register_id, db) {
    // query
    var sql = `SELECT "${device_id}" as user_id;`
    if(register_id.length > 0) {
        sql = `SELECT "${device_id}" as user_id UNION SELECT "${register_id}" as user_id\n`;
        sql += `UNION SELECT device_id as user_id FROM devices_users WHERE user_id = "${register_id}";`; 
    }
    var rows = await db.all(sql);
    return rows;
}

async function fetch_user_ids_associated_with_device(device_id) {
    
    var sql = "Select user_id from devices_users where device_id = '${device_id};'\n";
    var rows = await db.all(sql);
    return rows;
}

/*
def fetch_assets(table, user_ids):
    sql = "select * from " + table + " where user_id in ("
    for i in range(len(user_ids)):
        if i > 0:
            sql += ','
        el = user_ids[i]
        sql += "'" + el["user_id"] + "'"
    sql += ");"
    print(sql)

    cur.execute(sql)
    try:
        rows = cur.fetchall()
    except Exception:
        print(Exception)
    return rows
*/

function build_sql_user_assets(table, device_id, user_id, has_stock=0) {
    var sql = "select * from " + table + " where user_id='" + device_id + "'\n ";
    console.log("build_sql_user_assets:", device_id, user_id);
    var is_registered = device_id != user_id;
    if(is_registered) {
        sql += "union\n"
            + "select * from " + table + " where user_id='" + user_id + "'\n ";
        // if((table == "images" || table == 'crops')) {
        //     sql += "and is_stock=0";
        // }
    }
    return sql;
}

function get_all_images(device_id, user_id) {
    var sql = "select * from images where user_id='" + device_id + "'\n ";
    var is_registered = device_id != user_id;
    if(is_registered) {
        sql += "union\n"
            + "select * from images where user_id='" + user_id + "'\n ";
    }
    return sql;
}

function get_all_crops(device_id, user_id) {
    var sql = "select * from crops where user_id='" + device_id + "'\n ";
    var is_registered = device_id != user_id;
    if(is_registered) {
        sql += "and is_stock=0\n"
        sql += "union\n"
            + "select * from crops where user_id='" + user_id + "'\n ";
    }
    return sql;
}

function get_all_user_assets(table, device_id, user_id) {
    var sql = "select * from " + table + " where user_id='" + device_id + "'\n ";
    console.log("build_sql_user_assets:", device_id, user_id);
    var is_registered = device_id != user_id;
    if(is_registered) {
        sql += "union\n"
            + "select * from " + table + " where user_id='" + user_id + "'\n ";
    }
    return sql;
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
                console.log("Retrieve_all for :", def.table_name);
                if(def.table_name == "images" || def.table_name == "crops" )
                     console.log(def.table_name, "has stock?", req.query['stock']);
                // auth
                if (def.user_owned) {
                    console.log("User id:", req.session.user_id);
                    if (!check_authentication(req, res)) {
                        return;
                    }
                }

                // query
                var sql = `SELECT * from ${def.table_name}\n`;
                if (def.user_owned) {
                    // var has_stock = def.table_name == "images" || def.table_name == "crops"
                    //                 ? req.query['stock'] : 0;
                    // sql = build_sql_user_assets(def.table_name, req.session.device_id, 
                    //                 req.session.user_id, has_stock);
                    if(def.table_name == "images") {
                        sql = get_all_images(req.session.device_id, req.session.user_id);
                    }
                    else if(def.table_name == "crops") {
                        sql = get_all_crops(req.session.device_id, req.session.user_id);
                    }
                    else {
                        sql = get_all_user_assets(def.table_name, req.session.device_id, req.session.user_id);
                    }
                    console.log("current:", sql);
                }
                if (def.order_by) {
                    sql += `    order by ${def.order_by} ASC\n`;
                }
                sql += ';';
                var rows = await db.all(sql);
                _.each(rows, (row) => {
                    row.obj_type = def.obj_type;
                });
                console.log(rows.length, "rows returned for", def.table_name);
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


