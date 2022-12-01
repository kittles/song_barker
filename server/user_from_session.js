var _db = require('./database.js');
var uuidv4 = require('uuid').v4;


async function get_user (user_id) {
    var db = await _db.dbPromise;
    user_obj = await db.get('select * from users where user_id = ?', user_id);
    if(user_obj) {
        user_obj.obj_type = 'user';
    }
    return user_obj;
}
exports.get_user = get_user;


async function get_user_no_password (user_id) {
    var user_obj = await get_user(user_id);
    if(user_obj) {
        delete user_obj.password;
    }
    return user_obj;
}
exports.get_user_no_password = get_user_no_password;


async function add_user (user_id, name, email) {
    var db = await _db.dbPromise;
    return db.run('insert into users (user_id, name, email, account_uuid) values (?, ?, ?, ?)', [
        user_id,
        name,
        email,
        uuidv4(),
    ]);
}
exports.add_user = add_user;
/**
 *         var result = await db.run('update users set password = ? where user_id = ?',
            password,
            user_obj.user_id
        );
 */ 
async function update_email(user_id, email) {
    var db = await _db.dbPromise;
    return db.run('update users set email = ? where user_id = ?', email, user_id);
}
exports.update_email = update_email;
