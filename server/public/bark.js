$('document').ready(init);

var scene;
var camera;
var renderer;
var geometry;
var mouth_left;
var mouth_right;
var mouth_top;
var mouth_bottom;
var triangle_padding;
var vertex_array;
var scale;
var face_idx_array;
var texture;
var material;
var thing;
var dog;
var paused;
var texture_image;


function init () {
	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.01, 1000 );
	//camera = new THREE.OrthographicCamera();
	camera.position.x = 0.5
	camera.position.y = 0.5
	camera.position.z = 5;

	renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );
	document.body.appendChild( renderer.domElement );

	mouth_left = 0.452;
	mouth_right = 0.631;
	mouth_top = 0.415;
	mouth_bottom = 0.334;
	triangle_padding = 0.0001

	vertex_array = generate_vertex_array(
		mouth_left, mouth_right, mouth_top, mouth_bottom, triangle_padding,
	);
	scale = 1;
	vertex_array = vertex_array.map((vec) => {
		return [
			vec[0] * scale,
			vec[1] * scale,
			vec[2] * scale,
		];
	});
	face_idx_array = [
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
		[ 7, 8, 9], 
	];
	geometry = new THREE.Geometry();
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


	// use an img to store the texture (so it can be changed dynamicall)
	texture_image = document.createElement('img');
	document.body.appendChild(texture_image);
	create_dog();


	function create_dog (img_url) {
		var loader = new THREE.TextureLoader();
		texture_image.src = 'dog.jpg';
		return loader.load(texture_image.src, (texture) => {
			console.log('loaded');
			material = new THREE.MeshBasicMaterial({ 
				map: texture,
				side: THREE.DoubleSide,
			});
			dog =  new THREE.Mesh(geometry, material);
			window.dog = dog;
			scene.add(dog);
			window.bark = bark;
			paused = true;
			renderer.render(scene, camera);
            fit_to_camera();
			console.log('rendered');
		});
	}
	function update_texture (img64) {
		var loader = new THREE.TextureLoader();
		texture_image.src = img64;
		dog.material.map = loader.load(texture_image.src, () => {
			dog.material.needsUpdate = true; 
			renderer.render(scene, camera);
		});
	}
	window.update_texture = update_texture;
}


function generate_vertex_array (mouth_left, mouth_right, mouth_top, mouth_bottom, triangle_padding) {
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

function bark (duration, max_open) {
	var bark_type = parseInt(Math.random() * 3) // left, right, both
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
		console.info('frame', frame);
		if (frame < frame_count) {
			requestAnimationFrame(animate);	
		} else {
			console.info('finished');
		}
		renderer.render( scene, camera );
	}
	animate();
}

window.set_z = function (z) {
    camera.position.z = z
    renderer.render( scene, camera );
}
//function fit_to_camera () {
//
//	offset = 1.25;
//
//	const boundingBox = new THREE.Box3();
//
//	// get bounding box of dog - this will be used to setup controls and camera
//	boundingBox.setFromObject( dog );
//
//	const center = boundingBox.getCenter();
//
//	const size = boundingBox.getSize();
//
//	// get the max side of the bounding box (fits to width OR height as needed )
//	const maxDim = Math.max( size.x, size.y, size.z );
//	const fov = camera.fov * ( Math.PI / 180 );
//    console.log(camera.fov, fov);
//	let cameraZ = Math.abs( maxDim / 2 * Math.tan( fov * 2 ) ); //Applied fifonik correction
//
//	cameraZ *= offset; // zoom out a little so that dogs don't fill the screen
//
//	// <--- NEW CODE
//	//Method 1 to get dog's world position
//	scene.updateMatrixWorld(); //Update world positions
//	var dogWorldPosition = new THREE.Vector3();
//	dogWorldPosition.setFromMatrixPosition( dog.matrixWorld );
//
//	//Method 2 to get dog's world position
//	//dogWorldPosition = dog.getWorldPosition();
//
//	const directionVector = camera.position.sub(dogWorldPosition); 	//Get vector from camera to dog
//	const unitDirectionVector = directionVector.normalize(); // Convert to unit vector
//	camera.position = unitDirectionVector.multiplyScalar(cameraZ); //Multiply unit vector times cameraZ distance
//	camera.lookAt(dogWorldPosition); //Look at dog
//	// --->
//
//	const minZ = boundingBox.min.z;
//	const cameraToFarEdge = ( minZ < 0 ) ? -minZ + cameraZ : cameraZ - minZ;
//
//	camera.far = cameraToFarEdge * 3;
//	camera.updateProjectionMatrix();
//    camera.lookAt( center )
//    renderer.render( scene, camera );
//}
function fit_to_camera () {
    var dist = camera.position.z;
    var height = 1;
    var fov = 2 * Math.atan( height / ( 2 * dist ) ) * ( 180 / Math.PI );
    camera.fov = fov;
    camera.updateProjectionMatrix();

    //offset = 0;

    //const boundingBox = new THREE.Box3();

    //boundingBox.setFromObject( dog );

    //const center = boundingBox.getCenter( new THREE.Vector3() );
    //const size = boundingBox.getSize( new THREE.Vector3() );



    //const startDistance = center.distanceTo(camera.position);
    //console.log(startDistance);
    //// here we must check if the screen is horizontal or vertical, because camera.fov is
    //// based on the vertical direction.
    //const endDistance = camera.aspect > 1 ?
    //                    ((size.y/2)+offset) / Math.abs(Math.tan(camera.fov/2)) :
    //                    ((size.y/2)+offset) / Math.abs(Math.tan(camera.fov/2)) / camera.aspect ;

    //console.log(endDistance);


    //camera.position.set(
    //    camera.position.x * endDistance / startDistance,
    //    camera.position.y * endDistance / startDistance,
    //    camera.position.z * endDistance / startDistance,
    //    );
    //camera.lookAt(center);
    renderer.render( scene, camera );
}
window.fit_to_camera = fit_to_camera;

