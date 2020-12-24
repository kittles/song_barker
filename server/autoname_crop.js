var _ = require('lodash');
var _db = require('./database.js');

async function data_for_name (image_id, user_id) {
    const db = await _db.dbPromise;
    var res = await db.get('select name from images where uuid = ?',
        image_id
    );
    var base_name = _.isUndefined(res.name) ? 'sound' : res.name;
    var count_res = await db.get(`select count(*) from crops where user_id = ? and name like '${base_name}%'`,
        user_id,
    );
    var crop_count = count_res['count(*)'] | 0;
    return {
        base_name: base_name,
        count: crop_count,
    };
}
exports.data_for_name = data_for_name;

//data_for_name('c0c1d023-fd69-448a-9f2d-8752d8c4345d', 'pat.w.brooks@gmail.com')
//    .then((r) => { console.log(r) });
