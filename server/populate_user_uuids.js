var _db = require('./database.js');
var uuidv4 = require('uuid').v4;


function populate_user_uuids () {
    _db.dbPromise.then((db) => {
        var users_to_update = db.all('select user_id from users where account_uuid is null')
        .then((results) => {
            var inserts = [];
            for (i = 0; i < results.length; i++) {
                // run update
                console.log(results[i]);
                inserts.push(db.run('update users set account_uuid = ? where user_id = ?',
                    uuidv4(),
                    results[i]['user_id'],
                ));
            }
            return Promise.all(inserts);
        })
        .then((r) => {
            console.log('done');
        });

    });
}
exports.populate_user_uuids = populate_user_uuids;
