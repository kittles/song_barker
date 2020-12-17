var _db = require('./database.js');
var _ = require('lodash');


async function insert_into_db (table, obj) {
    var db = await _db.dbPromise;
    var column_order = _.keys(obj);
    column_order.sort();
    var sql = `INSERT INTO ${table} (\n    `;
    sql += column_order.join(', ');
    sql += '\n) VALUES (\n    ';
    sql += _.map(column_order, (col) => { return '?' }).join(', ');
    sql += '\n);'
    //console.log(sql);
    var vals = _.map(column_order, (col) => { return obj[col]; });
    return db.run(sql, vals).catch((err) => { console.log(err) });
}
exports.insert_into_db = insert_into_db;


//insert_into_db('my_table', {
//    'key1': 1,
//    'key2': 'sex',
//});


//    var insert_sql = `
//        insert into sequences (
//            uuid, song_id, crop_id, bucket_url, bucket_fp, backing_track_fp, backing_track_url, stream_url, hidden, name, user_id
//        ) values (
//            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
//        )`;
//    var insert_result = await db.run(insert_sql, [
//        sequence_data['uuid'],
//        sequence_data['song_id'],
//        sequence_data['crop_id'],
//        sequence_data['bucket_url'],
//        sequence_data['bucket_fp'],
//        sequence_data['backing_track_fp'],
//        sequence_data['backing_track_url'],
//        sequence_data['stream_url'],
//        sequence_data['hidden'],
//        sequence_data['name'],
//        sequence_data['user_id'],
//    ]);
