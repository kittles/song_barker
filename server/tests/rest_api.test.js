var request = require('supertest');
var models = require('../models').models;
var _ = require('lodash');


describe('test test', () => {
	it('should test that true === true', () => {
		expect(true).toBe(true)
	})
})


describe('loading express', function () {
    var server;
    beforeEach(function () {
        server = require('../app');
    });
    afterEach(function () {
        server.close();
    });
    it('responds to /', function testSlash(done) {
        request(server)
            .get('/')
            .expect(200, done);
    });
    it('404 everything else', function testPath(done) {
        request(server)
            .get('/foo/bar')
            .expect(404, done);
    });
});


describe('rest api', function () {
    var server;
	var dev_id = 'dev';
    beforeEach(() => {
        server = require('../app');
    });
    afterEach(() => {
        server.close();
    });
	_.each(models, (model) => {
		it(`get /all/${model.obj_type}/-1`, (done) => {
			request(server)
			.get(`/all/${model.obj_type}/-1`)
			.expect(200, done);
		});
	});
	_.each(models, (model) => {
		if (model.obj_type == 'song') {
			it(`get /all/${model.obj_type}/${dev_id} (should 500)`, (done) => {
				request(server)
				.get(`/all/${model.obj_type}/${dev_id}`)
				.expect(500, done);
			});
		} else {
			it(`get /all/${model.obj_type}/${dev_id}`, (done) => {
				request(server)
				.get(`/all/${model.obj_type}/${dev_id}`)
				.expect(200, done);
			});
		}
	});

	// raw
	it(`get /raw/raw-fixture-fake-raw`, (done) => {
		request(server)
		.get(`/raw/raw-fixture-fake-raw`)
		.expect(200, done);
	});
	it(`post /raw`, (done) => {
		request(server)
		.post(`/raw`)
		.send({
			uuid: 'delete-me-soon',
			user_id: dev_id,
			name: 'i am sadness incarnate',
			bucket_url: 'somebucketurl.com',
			bucket_fp: 'bucketfp/cool.aac'
		})
		.expect(200, done);
	});
	//it(`patch /raw`, (done) => {
	//	request(server)
	//	.patch(`/raw`)
	//	.send({
	//		name: 'i am so happy incarnate',
	//	})
	//	.expect(200, done);
	//});

	it(`get /crop/one`, (done) => {
		request(server)
		.get(`/crop/one`)
		.expect(200, done);
	});
	it(`get /song/1`, (done) => {
		request(server)
		.get(`/song/1`)
		.expect(200, done);
	});
	it(`get /image/puppy`, (done) => {
		request(server)
		.get(`/image/puppy`)
		.expect(200, done);
	});
});
