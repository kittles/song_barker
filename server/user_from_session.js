var _db = require('./database.js');
var uuidv4 = require('uuid').v4;


async function get_user (user_id) {
    var db = await _db.dbPromise;
    return db.get('select * from users where user_id = ?', user_id);
}
exports.get_user = get_user;


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


//// persisting the song data
//async function insert_new_user (db_insert_info) {
//    var db = await _db.dbPromise;
//    console.log(db_insert_info);
//    db.run(`
//        INSERT into songs (
//            name, price, category, song_family, bucket_url, bucket_fp, backing_track, track_count, key
//        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
//    `, [
//        db_insert_info.name,
//        db_insert_info.price,
//        db_insert_info.category,
//        db_insert_info.song_family,
//        db_insert_info.bucket_url,
//        db_insert_info.bucket_fp,
//        db_insert_info.backing_track,
//        db_insert_info.track_count,
//        db_insert_info.key,
//    ]);
//}
