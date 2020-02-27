var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 15, window.innerWidth / window.innerHeight, 0.1, 1000 );

var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

var geometry = new THREE.Geometry();

var mouth_left = 0.55;
var mouth_right = 0.63;
var mouth_top = 0.41;
var mouth_bottom = 0.37;

var triangle_padding = 0.0001

function generate_vertex_array () {
	// perimeter
	var perimeter = [
		[ 0   , 0   , 0 ],
		[ 1   , 0   , 0 ],
		[ 1   , 1   , 0 ],
		[ 0   , 1   , 0 ],
	];

	var outer_triangle = [
		[ (mouth_left + mouth_right) / 2 , mouth_bottom - triangle_padding, 0 ], // bottom vertex
		[ mouth_right + triangle_padding , mouth_top + triangle_padding, 0 ], // right
		[ mouth_left - triangle_padding , mouth_top + triangle_padding, 0 ], // left
	];

	var inner_triangle = [
		[ (mouth_left + mouth_right) / 2 , mouth_bottom , 0 ], // bottom vertex
		[ mouth_right , mouth_top , 0 ], // right
		[ mouth_left , mouth_top , 0 ], // left
	];
	
	return perimeter.concat(outer_triangle, inner_triangle);
}
var vertex_array = generate_vertex_array();

//var vertex_array = [
//	// perimeter
//	[ 0   , 0   , 0 ],
//	[ 1   , 0   , 0 ],
//	[ 1   , 1   , 0 ],
//	[ 0   , 1   , 0 ],
//
//	// outer triangle (bottom, right, left)
//	[ 0.5 , 0.1 , 0 ],
//	[ 0.8 , 0.9 , 0 ],
//	[ 0.2 , 0.9 , 0 ],
//
//	// inner triangle (bottom, right, left)
//	[ 0.5 , 0.2 , 0 ],
//	[ 0.7 , 0.8 , 0 ],
//	[ 0.3 , 0.8 , 0 ],
//];

var face_idx_array = [
	[ 0, 6, 3], 
	[ 0, 4, 6], 
	[ 0, 1, 4], 
	[ 1, 5, 4], 
	[ 1, 2, 5], 
	[ 2, 6, 5], 
	[ 2, 3, 6], 
	[ 6, 7, 9], 
	[ 6, 4, 7], 
	[ 4, 8, 7], 
	[ 4, 5, 8], 
	//[ 5, 9, 8], 
	//[ 5, 6, 9], 
	[ 7, 8, 9], 
];

//var face_idx_array = [
//	[ 0, 4, 3], 
//	[ 3, 4, 5], 
//	[ 2, 3, 5], 
//	[ 2, 5, 7], 
//	[ 1, 2, 7], 
//	[ 7, 6, 1], 
//	[ 0, 1, 6], 
//	[ 0, 6, 4], 
//	[ 4, 6, 5], 
//	[ 5, 6, 7], 
//];
vertex_array.forEach((vertex) => {
	geometry.vertices.push(new THREE.Vector3( vertex[0], vertex[1], vertex[2] ));
});
face_idx_array.forEach((vec) => {
	geometry.faces.push( new THREE.Face3( vec[0], vec[1], vec[2] ) );
	geometry.faceVertexUvs[ 0 ].push( [
			new THREE.Vector2( vertex_array[vec[0]][0], vertex_array[vec[0]][1] ),
			new THREE.Vector2( vertex_array[vec[1]][0], vertex_array[vec[1]][1] ),
			new THREE.Vector2( vertex_array[vec[2]][0], vertex_array[vec[2]][1] ),
		] )
});


geometry.computeBoundingSphere();
geometry.computeFaceNormals();
geometry.computeVertexNormals();


var texture = new THREE.TextureLoader().load( 'puppy.png' );
var material = new THREE.MeshBasicMaterial( { map: texture } );
//var material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
var thing = new THREE.Mesh( geometry, material );

thing.material.side = THREE.DoubleSide;
window.thing = thing;
scene.add( thing );

function show_vertices (input_geometry) {
	var vertex_geometry = new THREE.Geometry();
	sprite = THREE.ImageUtils.loadTexture( 'disc.png' );
	for ( i = 0; i < input_geometry.vertices.length; i ++ ) {
		vertex_geometry.vertices.push(input_geometry.vertices[i]);
	}
	material = new THREE.PointCloudMaterial( { size: 10, sizeAttenuation: false, map: sprite, transparent: true } );
	material.color.setHSL( 1.0, 0.3, 0.7 );
	particles = new THREE.PointCloud( vertex_geometry, material );
	particles.sortParticles = true;
	scene.add( particles );
}
function show_edges (input_geometry) {
	var edges = new THREE.EdgesGeometry( input_geometry );
	var line = new THREE.LineSegments( edges, new THREE.LineBasicMaterial( { color: 0xffffff } ) );
	scene.add( line );
}

camera.position.x = 1.7;
camera.position.y = 0.35;
camera.position.z = 5;

function bark (duration, max_open) {
	var bark_type = parseInt(Math.random() * 3) // left, right, both
	console.log(bark_type);
	var vertex_original_ys = [
		geometry.vertices[7].y,
		geometry.vertices[8].y,
		geometry.vertices[9].y,
	];
	var vertex_original_ys = [
		geometry.vertices[7].z,
		geometry.vertices[8].z,
		geometry.vertices[9].z,
	];
	var frame_count = duration * 60;
	var frame = 0;
	var step =  max_open / (frame_count / 2);
	function animate () {
		if (frame < (frame_count / 2)) {
			// opening
			switch (bark_type) {
				case 0:
					geometry.vertices[9].y -= step;
					break;
				case 1:
					geometry.vertices[8].y -= step;
					break;
				case 2:
					geometry.vertices[7].y -= step;
					geometry.vertices[8].y -= step;
					geometry.vertices[9].y -= step;
					break;
			}
		} else {
			// opening
			switch (bark_type) {
				case 0:
					geometry.vertices[9].y += step;
					break;
				case 1:
					geometry.vertices[8].y += step;
					break;
				case 2:
					geometry.vertices[7].y += step;
					geometry.vertices[8].y += step;
					geometry.vertices[9].y += step;
					break;
			}
		}
		geometry.verticesNeedUpdate = true;
		frame += 1;
		if (frame < frame_count) {
			requestAnimationFrame(animate);	
		}
		renderer.render( scene, camera );
	}
	animate();
}
window.bark = bark;
//setInterval(() => {
//	bark(0.5, 0.04);
//}, 800);


//var c = 0;
function animate () {
	//c += 0.01;
    //geometry.vertices[0].x = Math.sin(c);
    //geometry.vertices[0].y = Math.cos(c);
    //geometry.vertices[0].z = Math.sin(c * c);
	//thing.rotation.x += 0.01;
	//thing.rotation.y += 0.01;
	requestAnimationFrame( animate );
	renderer.render( scene, camera );
}
animate();
