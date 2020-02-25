var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 25, window.innerWidth / window.innerHeight, 0.1, 1000 );

var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

var geometry = new THREE.Geometry();

// two triangles form a square
geometry.vertices.push(
	new THREE.Vector3( 0, 0, 0 ),
	new THREE.Vector3( 1, 0, 0 ),
	new THREE.Vector3( 1, 1, 0 ),
	new THREE.Vector3( 0, 1, 0 ),
);

// two faces
geometry.faces.push( new THREE.Face3( 0, 1, 2 ) );
geometry.faces.push( new THREE.Face3( 2, 3, 0 ) );

// triangle one - each vertex needs a U and V to know how to map texture
geometry.faceVertexUvs[ 0 ].push( [
        new THREE.Vector2( 0, 0 ),
        new THREE.Vector2( 1, 0 ),
        new THREE.Vector2( 1, 1 ),
    ] )
// triangle two
geometry.faceVertexUvs[ 0 ].push( [
        new THREE.Vector2( 1, 1 ),
        new THREE.Vector2( 0, 1 ),
        new THREE.Vector2( 0, 0 ),
    ] )
geometry.computeBoundingSphere();
geometry.computeFaceNormals();
geometry.computeVertexNormals();


var texture = new THREE.TextureLoader().load( 'puppy.png' );
var material = new THREE.MeshBasicMaterial( { map: texture } );
//var material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
var thing = new THREE.Mesh( geometry, material );
thing.doubleSided = true;
window.thing = thing;
scene.add( thing );

camera.position.z = 5;
setTimeout(() => {
	renderer.render( scene, camera );
}, 100);

function bark () {
	var frames = 30;
	function animate () {
		console.log(`frame ${frames}`);
		geometry.vertices[0].x = Math.sin(frames/10);
		geometry.verticesNeedUpdate = true;
		frames -= 1;
		if (frames > 0) {
			requestAnimationFrame(animate);	
		}
		renderer.render( scene, camera );
	}
	animate();
}
window.bark = bark;


//var c = 0;
//function animate () {
//	//c += 0.01;
//    //geometry.vertices[0].x = Math.sin(c);
//    //geometry.vertices[0].y = Math.cos(c);
//    //geometry.vertices[0].z = Math.sin(c * c);
//	requestAnimationFrame( animate );
//	renderer.render( scene, camera );
//}
//animate();

