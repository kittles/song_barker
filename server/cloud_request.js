var axios = require('axios');
var cloud_access_token = require('../credentials/cloud-access-token.json').token;

// TODO come from env or something
var cloud_ip = '34.83.134.37';


async function cloud_request (endpoint, data) {
    try {
        data.access_token = cloud_access_token;
        console.log("url: http://" 
            + cloud_ip + "/" + endpoint);
        console.log("data: " + JSON.stringify(data));
        var cloud_response = await axios({
            method: 'post',
            url: `http://${cloud_ip}/${endpoint}`,
            data: data,
        });
        console.log(cloud_response.data);
        return cloud_response.data.data.data;
    } catch (err) {
        return {
            stderr: err,
        }
    }
}
exports.cloud_request = cloud_request;


//var request_data = {
//    uuid: '100288f3-dbc2-45fd-b051-c90b5c53d851',
//};
//cloud_request('to_crops', request_data)
//    .then((r) => { console.log(r) });
