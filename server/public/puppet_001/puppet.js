/*
TODO
headSway stops after a while
recreate mesh when features are moved


** hey TOVI! look here! ***

how to use: 

wait until init_ready = 1, or listen for log
call create_puppet with no arguments for default dog, or with a base64 image string
wait until create_puppet logs that its ready

if needed, set the position of features with set_position(key, x, y),
where key is one of these strings:
    'leftEyePosition'
    'rightEyePosition'
    'mouthPosition'
    'headTop'
    'headBottom'
    'headLeft'
    'headRight'
this is just setting things in the features object

when you are ready to start moving the puppet, call animate() to
initiate the requestAnimationFrame loop
note that nothing will move or change on the puppet until animate starts the loop.
after animate has been called- the following will manipulate the puppet:

to animate the features of the puppet directly, use the following:
    blink_left (val)
    blink_right (val)
    blink (val)
    eyebrow_left (val)
    eyebrow_right (val)
    mouth_open (val)
these just set the position of the various features to whatever you tell it to.
for instance, mouth_open(0.5) sets the mouth to 0.5 open

there are also "prepackaged" animations:
    left_brow_raise
    right_brow_raise
    left_brow_furrow
    right_brow_furrow
    left_blink_quick
    left_blink_slow
    right_blink_quick
    right_blink_slow
which take no arguments and do what animations. right_blink_slow() will make the right
eye blink slowly as soon as you call it
    
there are these functions, which smoothly move from one position to another over n frames.
start is the starting position, end is the ending position, so for instance,
mouth_to_pos(0,1,100) is open mouth from closed to open over 100 frames

    left_brow_to_pos (start, end, n)
    right_brow_to_pos (start, end, n)
    left_blink_to_pos (start, end, n)
    right_blink_to_pos (start, end, n)
    mouth_to_pos (start, end, n)

there are these two functions which are more specialized

    headSway (amplitude, speed)

    colin's head swaying function- it may stop working after a bit, i need to
    diagnose. while the animation is nice, i think it needs to be reimplemented
    into the tick based animation framework im using.

    mouth_track_sound (amplitudes)

    mouth_track_sound expects an array of floats [0-1] that represent the
    sound intensity over 1/60th of a second intervals. the mouth will animate
    as soon as you call this. we need to see if the overhead of passing the 
    argument to the webview is going to throw this out of sync with the music
    too much or not

to stop all current and future scheduled animations,
use 
	
	stop_all_animations ()

the raf loop will still keep going, but scheduled animations get erased

*/
var fp = _.noConflict(); // lodash fp and lodash at the same time
var init_ready = 0; // poll on this to know when you can start doing stuff
var puppet_ready = 0; // poll on this to know when you can start doing stuff
var image_canvas;
var image_ctx;
var canvas;
var ctx;
var container;
var scene;
var camera;
var renderer;
var animation_frame;
var uniforms, material, faceMesh, texture;
var mouseX = 0;
var mouseY = 0;
var lat = 0;
var lon = 0;
var phy = 0;
var theta = 0;
var enable_controls = false;
var debug_face_mesh = false;
var show_fps = true;
var stats = new Stats();
var features = {
	// NOTE coordinate system is [-0.5 to 0.5, -0.5 to 0.5]
    // defaults here work with dog3.jpg
    leftEyePosition:  new THREE.Vector2(-0.126, 0.308),
    rightEyePosition: new THREE.Vector2(0.007, 0.314),
    mouthPosition:    new THREE.Vector2(-0.058, 0.160),
    headTop:          new THREE.Vector2(-0.062, 0.438),
    headBottom:       new THREE.Vector2(-0.056, 0.117),
    headLeft:         new THREE.Vector2(-0.255, 0.301),
    headRight:        new THREE.Vector2(0.151, 0.334),
};
var mouthScale = 0.8;
var segments = 200; // Segments for the deformation mesh
var startTime = Date.now();
var iOS; // iOS webviews need 20 extra pixels
var window_width; // cant count on a single way of getting this
var window_height; // so use these for the result
var face_animation_shader = {
    uniforms: {
        resolution:         { type: 'v2', value: new THREE.Vector2() },
        leftEyePosition:    { type: 'v2', value: new THREE.Vector2() },
        rightEyePosition:   { type: 'v2', value: new THREE.Vector2() },
        mouthPosition:      { type: 'v2', value: new THREE.Vector2() },
        blinkLeft:          { type: 'f', value: 0.0 },
        blinkRight:         { type: 'f', value: 0.0 },
        mouthOpen:          { type: 'f', value: 0.0 },
        aspectRatio:        { type: 'f', value: 1.0 },
		petImage:           { type: 't', value: new THREE.Texture() },
		// Head Sway
		faceEllipse_ST:     { type: 'v4', value: new THREE.Vector4() },
		animationNoise:     { type: 't', value: new THREE.Texture() },
		swayTime:           { type: 'f', value: 0.0 },
		swaySpeed:          { type: 'f', value: 0.1 },
		swayAmplitude:      { type: 'f', value: 0.0 },
		// Eyebrows
		eyebrowLeftOffset:  { type: 'f', value: 0.0 },
		eyebrowRightOffset: { type: 'f', value: 0.0 },
		worldToFaceMatrix:  { type: 'm4', value: new THREE.Matrix4() }
    },
	// shaders get vertex and fragment shaders from server
	// so the files can have syntax highlighting
	vertexShader: null,
	fragmentShader: null,
};
var mouth_shader = {
    uniforms: {
        resolution:       { type: 'v2', value: new THREE.Vector2() },
        leftEyePosition:  { type: 'v2', value: new THREE.Vector2() },
        rightEyePosition: { type: 'v2', value: new THREE.Vector2() },
        mouthPosition:    { type: 'v2', value: new THREE.Vector2() },
        mouthOpen:        { type: 'f', value: 0.0 },
		// Head Sway
		faceEllipse_ST:   { type: 'v4', value: new THREE.Vector4() },
		animationNoise:   { type: 't', value: new THREE.Texture() },
		swayTime:         { type: 'f', value: 0.0 },
		swaySpeed:        { type: 'f', value: 0.0 },
		swayAmplitude:    { type: 'f', value: 0.0 }
    },
	// shaders get vertex and fragment shaders from server
	// so the files can have syntax highlighting
	vertexShader: null,
	fragmentShader: null,
};
var face_mesh;
var bgMesh;
var mouth_gltf;
var gltf_mesh;


$('document').ready(init);
function init () {
	log('puppet.js calling init');

	// iOS webview sizing shim
    // webviews dimensions come out undersized on ios for some reason
    // TODO figure out why
	iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
	log(`navigator.userAgent: ${navigator.userAgent}`);
	log(`iOS = ${iOS}`);
	if (iOS) {
		window_width = document.body.offsetWidth + 20;
		window_height = document.body.offsetHeight + 20;
	} else {
		window_width = document.body.offsetWidth;
		window_height = document.body.offsetHeight;
	}
	log(`WIDTH INFO: 
	window.innerWidth: ${window.innerWidth}
	document.body.offsetWidth: ${document.body.offsetWidth}
	document.body.clientWidth: ${document.body.clientWidth}
	USING:
	window_width: ${window_width}
	window_height: ${window_height}
	`);

    // for turning images into b64
	// this is just to help test in a browser
    image_canvas = document.getElementById('image-canvas');
    image_ctx = image_canvas.getContext('2d');

    // for rendering the actual puppet
    // TODO destroy old canvases
    canvas = document.createElement('canvas');
    //ctx = canvas.getContext('webgl2', {alpha: false});
	//if (!ctx) {
	//	log('webgl2 unavailable, the puppet will not work');
	//} else {
	//	log('webgl2 available');
	//}
    //renderer = new THREE.WebGLRenderer({canvas: canvas, context: ctx});
    renderer = new THREE.WebGLRenderer();

	// this just holds the three.js render element
	container = document.getElementById('container');
	scene = new THREE.Scene();

	// Create a webgl scene
	scene.background = new THREE.Color(0x2E2E46);

	// Calculate the aspect ratio of the browser viewport
	viewportAspect = window_width / window_height;
	log(`window width ${window_width} window height ${window_height}`);

	// Camera left and right frustrum to make sure the camera size is the same as viewport size
	camera = new THREE.OrthographicCamera(
		-0.5 * viewportAspect,
		0.5 * viewportAspect,
		0.5,
		-0.5,
		0.001,
		1000
	);
	camera.position.z = 1;

    // see fps
    if (show_fps) {
        stats.showPanel(2); // 0: fps, 1: ms, 2: mb, 3+: custom
        document.body.appendChild(stats.dom);
    }

    // tell client the webview is ready to create a puppet
	init_ready = 1;
	log('finished init');
}


async function create_puppet (img_url) {
	cancelAnimationFrame(animation_frame);
    return new Promise(async (r) => {
        img_url = (img_url === undefined ? await to_b64('dog3.jpg') : img_url);

        // if this is being called more than once, the scene needs to be cleared
        while (scene.children.length > 0) {
			var obj = scene.children[0];
            scene.remove(obj);
			console.log(obj.type);
			if (obj.type == 'Mesh') {
				console.log('disposing geometry');
				obj.geometry.dispose();
				obj.material.dispose();
			}
			if (obj.type == 'Group') {
				obj.children[0].children[0].geometry.dispose();
				obj.children[0].children[0].material.dispose();
			}
        }

        pet_image_texture = await load_texture(img_url);
        animation_noise_texture = await load_texture('noise_2D.png');

        // load shader text seperate so it can by syntax highlighted
        await get_shader_files();

        // tell the shaders about landmarks and screen sizing
        init_shaders(features);

        // Create the background plane
        // This is just the static pet image on the plane
        // Draw this if we aren't debugging the face mesh
        if (!debug_face_mesh) {
            create_background_plane(scene);
        }

        // Deforming mesh
        create_face_mesh(scene, segments, segments, features);

        // mouth sprite
        await load_mouth_mesh(scene, 'MouthStickerDog1_out/MouthStickerDog1.gltf');

        renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
        container.appendChild(renderer.domElement);
        renderer.setSize(window_width, window_height);
        renderer.render(scene, camera);

        if (enable_controls) {
            controls = new THREE.OrbitControls(camera, renderer.domElement);
        }

        puppet_ready = 1;
        log('puppet is now ready');
		animate();
        return r(puppet_ready);
    });
}



// use this set feature locations

function set_position (key, x, y) {
	log(`calling set_position(${key}, ${x}, ${y})`);
	features[key] = new THREE.Vector2(x, y);
    sync_features_to_shaders();
}


// control puppet features directly

function blink_left (val) {
	face_animation_shader.uniforms.blinkLeft.value = val;
}


function blink_right (val) {
	face_animation_shader.uniforms.blinkRight.value = val;
}


function blink (val) {
	face_animation_shader.uniforms.blinkRight.value = val;
	face_animation_shader.uniforms.blinkLeft.value = val;
}


function eyebrow_left (val) {
	face_animation_shader.uniforms.eyebrowLeftOffset.value = val;
}


function eyebrow_right (val) {
	face_animation_shader.uniforms.eyebrowRightOffset.value = val;
}


function mouth_open (val) {
	//var clamped = Math.min(Math.max(val, 0), 1);
	mouth_shader.uniforms.mouthOpen.value = val;
	face_animation_shader.uniforms.mouthOpen.value = val;
}


// animations

function ticker (handler) {
	var ticks = [];
	function next () {
		if (ticks.length > 0) {
			return ticks.shift();
		} else {
			return false;
		}
	}
	function add (xs) {
		ticks = ticks.concat(xs);
	}
	function cancel () {
		ticks = [];
	}
	function tick () {
		var val = next();
		if (val !== false) {
			handler(val);
		}
	}
	return {
		add: add,
		cancel: cancel,
		tick: tick,
	};
}


function motion_handler_tick () {
	_.invokeMap(ticks, 'tick');
}


function unit_linspace (n) {
    // includes 0 and 1
    return _.map(_.range(n), (x) => { return x / (n - 1); });
}


function to_range (start, end, xs) {
    xs = _.map(xs, fp.multiply(Math.abs(start - end)));
    xs = _.map(xs, fp.add(_.min([start, end])));
    if (end < start) {
        xs = _.reverse(xs);
    }
    return xs;
}


function to_positions (start, end, n, easing) {
    var xs = unit_linspace(n); 
    xs = _.map(xs, easing);
    xs = to_range(start, end, xs);
    return xs;
}


var easings = {
    linear: t => t,
    easeInQuad: t => t*t,
    easeOutQuad: t => t*(2-t),
    easeInOutQuad: t => t<.5 ? 2*t*t : -1+(4-2*t)*t,
    easeInCubic: t => t*t*t,
    easeOutCubic: t => (--t)*t*t+1,
    easeInOutCubic: t => t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1,
    easeInQuart: t => t*t*t*t,
    easeOutQuart: t => 1-(--t)*t*t*t,
    easeInOutQuart: t => t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t,
    easeInQuint: t => t*t*t*t*t,
    easeOutQuint: t => 1+(--t)*t*t*t*t,
    easeInOutQuint: t => t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t,
};


var ticks = {
    left_blink:  ticker(blink_left),
    right_blink: ticker(blink_right),
    left_brow:   ticker(eyebrow_left),
    right_brow:  ticker(eyebrow_right),
    mouth:       ticker(mouth_open),
};

function stop_all_animations () {
	_.each(ticks, (t, key) => {
		t.cancel();
	});
	// reset the dog to neutral position
	blink_left(0);
	blink_right(0);
	eyebrow_left(0);
	eyebrow_right(0);
	mouth_open(0);
}


// use like this for custom animations:
// ticks.<feature>.add(to_positions(<start>, <end>, 100, easings.easeInOutQuad))


// some prepackaged animations


function left_brow_raise () {
    left_brow_to_pos(0, 1, 15); 
    setTimeout(() => {
        left_brow_to_pos(1, 0, 15); 
    }, 500);
}


function right_brow_raise () {
    right_brow_to_pos(0, 1, 15); 
    setTimeout(() => {
        right_brow_to_pos(1, 0, 15); 
    }, 500);
}


function left_brow_furrow () {
    left_brow_to_pos(0, -1, 15); 
    setTimeout(() => {
        left_brow_to_pos(-1, 0, 15); 
    }, 500);
}


function right_brow_furrow () {
    right_brow_to_pos(0, -1, 15); 
    setTimeout(() => {
        right_brow_to_pos(-1, 0, 15); 
    }, 500);
}


function left_blink_quick () {
    left_blink_to_pos(0, 1, 4, easings.easeInOutQuad);
    setTimeout(() => {
        left_blink_to_pos(1, 0, 8, easings.easeInOutQuad);
    });
}


function left_blink_slow () {
    left_blink_to_pos(0, 1, 15, easings.easeInOutQuad);
    setTimeout(() => {
        left_blink_to_pos(1, 0, 25, easings.easeInOutQuad);
    });
}


function right_blink_quick () {
    right_blink_to_pos(0, 1, 4, easings.easeInOutQuad);
    setTimeout(() => {
        right_blink_to_pos(1, 0, 8, easings.easeInOutQuad);
    });
}


function right_blink_slow () {
    right_blink_to_pos(0, 1, 15, easings.easeInOutQuad);
    setTimeout(() => {
        right_blink_to_pos(1, 0, 25, easings.easeInOutQuad);
    });
}


// these move smoothly between two positions

function left_brow_to_pos (start, end, n) {
    ticks.left_brow.add(to_positions(start, end, n, easings.easeInOutQuad));
}


function right_brow_to_pos (start, end, n) {
    ticks.right_brow.add(to_positions(start, end, n, easings.easeInOutQuad));
}


function left_blink_to_pos (start, end, n) {
    ticks.left_blink.add(to_positions(start, end, n, easings.easeInOutQuad));
}


function right_blink_to_pos (start, end, n) {
    ticks.right_blink.add(to_positions(start, end, n, easings.easeInOutQuad));
}


function mouth_to_pos (start, end, n) {
    ticks.mouth.add(to_positions(start, end, n, easings.easeInOutQuad));
}


// this is the one for having the mouth move along to a sound
function mouth_track_sound (amplitudes) {
    ticks.mouth.add(amplitudes);
}


// TODO need a head_displacement method instead
// this should also probably be animated via the ticker framework
function headSway (amplitude, speed) {
	// Amplitude is how far to move the uvs for the animation, Default value of 1 looks good.
	// Speed is a representation how often the animation loops in 1 minute.  Default value of 1 looks good
	// Adjust the input values to make them a bit more intuitive, otherwise you'll need to put in a very small amplitude/speed value
	amplitude /= 10;
	speed /= 60;

	var ellipseCenter = get_ellipse_center();
	var distanceLeft = ellipseCenter.distanceTo(features.headLeft);
	var distanceRight = ellipseCenter.distanceTo(features.headRight);
	var distanceTop = ellipseCenter.distanceTo(features.headTop);
	var distanceBottom = ellipseCenter.distanceTo(features.headBottom);
	var extentsX = (distanceLeft + distanceRight) * 0.5;
	var extentsY = (distanceTop + distanceBottom) * 0.5;

	// This value is how the big the ellipse is for the head
	var ST_numerator = 0.3;
	var ellipseExtents = new THREE.Vector2(extentsX, extentsY);
	var faceEllipse_ST = new THREE.Vector4(ST_numerator / ellipseExtents.x, ST_numerator / ellipseExtents.y, ellipseCenter.x, ellipseCenter.y);
	face_animation_shader.uniforms.swaySpeed.value = speed;
	face_animation_shader.uniforms.swayAmplitude.value = amplitude;
	face_animation_shader.uniforms.faceEllipse_ST.value = faceEllipse_ST;

	mouth_shader.uniforms.swaySpeed.value = speed;
	mouth_shader.uniforms.swayAmplitude.value = amplitude;
	mouth_shader.uniforms.faceEllipse_ST.value = faceEllipse_ST;
}

//animate = _.noop;
function animate () {
    if (enable_controls && controls != undefined) {
        controls.update();
    }
	cancelAnimationFrame(animation_frame);

	function do_animate () {
		stats.begin();
		// Tell the shaders how many seconds have elapsed, this is for the headsway animation
		//var elapsedMilliseconds = Date.now() - startTime;
		//var elapsedSeconds = elapsedMilliseconds / 1000.;
		//face_animation_shader.uniforms.swayTime.value = elapsedSeconds;
		//mouth_shader.uniforms.swayTime.value = elapsedSeconds;

		//// step a tick in the motion handler
		//motion_handler_tick();

		//renderer.render(scene, camera);
		stats.end();
		animation_frame = requestAnimationFrame(do_animate);
	}
	do_animate();
}


function screen_to_world_position (screen_pos) {
    var cameraSize = new THREE.Vector2(Math.abs(camera.left) + Math.abs(camera.right), -1.0);
    var offset = new THREE.Vector2(camera.left, 0.5);
    var worldPos = screen_pos.multiply(cameraSize);
    return worldPos.add(offset);
}


function init_shaders (features) {
    face_animation_shader.uniforms['petImage'].value = pet_image_texture;
    face_animation_shader.uniforms['animationNoise'].value = animation_noise_texture;
    face_animation_shader.uniforms.resolution.value.x = window_width;
    face_animation_shader.uniforms.resolution.value.y = window_height;
    face_animation_shader.uniforms.leftEyePosition.value = features.leftEyePosition;
    face_animation_shader.uniforms.rightEyePosition.value = features.rightEyePosition;
    face_animation_shader.uniforms.mouthPosition.value = features.mouthPosition;

    mouth_shader.uniforms['animationNoise'].value = animation_noise_texture;
    mouth_shader.uniforms.resolution.value.x = window.innerWidth;
    mouth_shader.uniforms.resolution.value.y = window.innerHeight;
    mouth_shader.uniforms.leftEyePosition.value = features.leftEyePosition;
    mouth_shader.uniforms.rightEyePosition.value = features.rightEyePosition;
    mouth_shader.uniforms.mouthPosition.value = features.mouthPosition;            

    log('init shaders finished');
}


function sync_features_to_shaders () {
    // when feature locations get changed, the shaders need to be informed
    face_animation_shader.uniforms.leftEyePosition.value = features.leftEyePosition;
    face_animation_shader.uniforms.rightEyePosition.value = features.rightEyePosition;
    face_animation_shader.uniforms.mouthPosition.value = features.mouthPosition;
    mouth_shader.uniforms.leftEyePosition.value = features.leftEyePosition;
    mouth_shader.uniforms.rightEyePosition.value = features.rightEyePosition;
    mouth_shader.uniforms.mouthPosition.value = features.mouthPosition;            
}


function create_background_plane (scene) {
    basicMaterial = new THREE.MeshBasicMaterial({
        map: pet_image_texture,
    });
    bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), basicMaterial);
    bgMesh.scale.x = pet_image_texture.image.width / pet_image_texture.image.height;
    bgMesh.renderOrder = 0;
    scene.add(bgMesh);
    log('create background plane finished');
}


function create_face_mesh (scene, widthSegments, heightSegments, features) {
    // Create a material
    var material = new THREE.ShaderMaterial({
        uniforms:       face_animation_shader.uniforms,
        vertexShader:   face_animation_shader.vertexShader,
        fragmentShader: face_animation_shader.fragmentShader,
        depthFunc:      debug_face_mesh ? THREE.AlwaysDepth : THREE.GreaterDepth,
        //side:           THREE.DoubleSide,
        //wireframe:      debug_face_mesh,
    });

    face_animation_shader.uniforms.aspectRatio.value = pet_image_texture.image.width / pet_image_texture.image.height;

    // Adds the material to the geometry
    faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, widthSegments, heightSegments), material);
    
    // This object renders on top of the background
    faceMesh.renderOrder = 1;

    leftEye = new THREE.Vector2(features.leftEyePosition.x, features.leftEyePosition.y);
    rightEye = new THREE.Vector2(features.rightEyePosition.x, features.rightEyePosition.y);

    // We need to center this geometry at the face
    var eyeCenter = leftEye.add(rightEye).multiplyScalar(0.5);
    var eyeLine = rightEye.sub(leftEye);

    // Center the mesh's position on the eyes
    faceMesh.position.x = eyeCenter.x;
    faceMesh.position.y = eyeCenter.y;

    // Rotate the mesh the same direction as the eyes
    var rads = Math.atan(eyeLine.y / eyeLine.x);        
    faceMesh.rotateZ(rads);

    scene.add(faceMesh);
    log('create face mesh finished');
}


// util functions for features on the image

function get_eye_center () {
	var leftEye = new THREE.Vector2(features.leftEyePosition.x, features.leftEyePosition.y);
	var rightEye = new THREE.Vector2(features.rightEyePosition.x, features.rightEyePosition.y);
	// We need to center this geometry at the face
	var eyeCenter = leftEye.add(rightEye).multiplyScalar(0.5);
	return eyeCenter;
}


function get_eye_line () {
	var leftEye = new THREE.Vector2(features.leftEyePosition.x, features.leftEyePosition.y);
	var rightEye = new THREE.Vector2(features.rightEyePosition.x, features.rightEyePosition.y);
	return rightEye.sub(leftEye);
}


function get_ellipse_center () {
	// The head top/left/right/bottom points create an ellipse around the head which drives head sway motion
	var top = new THREE.Vector2(features.headTop.x, features.headTop.y);
	var bottom = new THREE.Vector2(features.headBottom.x, features.headBottom.y);
	var left = new THREE.Vector2(features.headLeft.x, features.headLeft.y);
	var right = new THREE.Vector2(features.headRight.x, features.headRight.y);
	var center = top.add(bottom).add(left).add(right).divideScalar(4);
	return center;
}


function log (msg) {
	// this gets picked up clientside through a "javascript channel"
	// if its in a webview in the app
	if (typeof(Print) !== 'undefined') {
		msg = '[puppet.js postMessage] ' + msg;
	    Print.postMessage(msg);
	} else {
	    console.log('[puppet.js console.log] ' + msg);
	}
}


async function test () {
    await create_puppet('dog3.jpg');
    animate();
	left_blink_slow();
	right_blink_slow();
}


// loaders

async function load_texture (img_src) {
    return new Promise(resolve => {
        new THREE.TextureLoader().load(img_src, resolve);
    });
}


// for console testing
async function to_b64 (img_src) {
    var img = await load_image(img_src);
    image_canvas.width = img.width;
    image_canvas.height = img.height;
    image_ctx.drawImage(img, 0, 0);
    return image_canvas.toDataURL();
}


// for console testing
async function load_image (img_src) {
    return new Promise((r) => { 
        let i = new Image(); 
        i.onload = () => r(i); 
        i.src = img_src; 
    });
}


// the mouth has custom geometry that gets loaded with this
var gltf_memo = {};
async function load_gltf (model_path) {
	return new Promise((r) => { 
		if (_.get(gltf_memo, model_path, false)) {
			log(`using cached gltf file: ${model_path}`);
			r(gltf_memo[model_path]);
		} else {
			var loader = new THREE.GLTFLoader();
			// Load a glTF resource
			loader.load(model_path, (gltf) => {
				log(`gltf loaded: ${model_path}`);
				gltf_memo[model_path] = gltf;
				r(gltf);
			}, () => {
				log(`gltf file loading: ${model_path}`);
			}, (error) => {
				log(`error loading gltf file: ${model_path}`);
				log(error);
			});
		}
	});
}


async function load_mouth_mesh (scene, model_path) {
	// Load the Mouth custom mesh
	return new Promise(async (r) => { 
		mouth_gltf = await load_gltf(model_path);
		gltf_mesh = mouth_gltf.scene.children[0].children[0];
		gltf_mesh.material = new THREE.ShaderMaterial({ 
			uniforms: mouth_shader.uniforms,
			vertexShader: mouth_shader.vertexShader,
			fragmentShader: mouth_shader.fragmentShader,
			depthFunc: THREE.AlwaysDepth,
			side: THREE.DoubleSide,
			blending: THREE.MultiplyBlending,
			vertexColors: true
		});
		gltf_mesh.renderOrder = 2;
		// Mesh position is same as mouthposition
		// Mesh rotation is the same as the head rotation
		var eyeCenter = get_eye_center();
		var eyeLine = get_eye_line();
		var eyeLineLength = eyeLine.length();
		var mouthPosition = new THREE.Vector2(features.mouthPosition.x, features.mouthPosition.y);
		gltf_mesh.scale.set(eyeLineLength * mouthScale, eyeLineLength * mouthScale, eyeLineLength * mouthScale);

		// Center the mesh's position on the eyes
		gltf_mesh.position.x = mouthPosition.x;
		gltf_mesh.position.y = mouthPosition.y;

		// Rotate the mesh the same direction as the eyes
		var rads = Math.atan(eyeLine.y / eyeLine.x);        
		gltf_mesh.rotateY(-rads);
		scene.add(mouth_gltf.scene);
		mouth_gltf.animations; // Array<THREE.AnimationClip>
		mouth_gltf.scene; // THREE.Group
		mouth_gltf.scenes; // Array<THREE.Group>
		mouth_gltf.cameras; // Array<THREE.Camera>
		mouth_gltf.asset; // Object
		r(mouth_gltf);
	});
}


async function get_hlsl_text (url) {
    var response = await fetch(url);
    var text = await response.text();
    return text;
}


async function get_shader_files () {
    return new Promise(async (r) => {
        if (face_animation_shader.fragmentShader == null) {
			log('loading shader file: /puppet_001/face_fragment_shader.hlsl');
            face_animation_shader.fragmentShader = await get_hlsl_text('/puppet_001/face_fragment_shader.hlsl');
        }
        if (face_animation_shader.vertexShader == null) {
			log('loading shader file: /puppet_001/face_vertex_shader.hlsl');
            face_animation_shader.vertexShader = await get_hlsl_text('/puppet_001/face_vertex_shader.hlsl');
        }
        if (mouth_shader.fragmentShader == null) {
			log('loading shader file: /puppet_001/mouth_fragment_shader.hlsl');
            mouth_shader.fragmentShader = await get_hlsl_text('/puppet_001/mouth_fragment_shader.hlsl'); 
        }
        if (mouth_shader.vertexShader == null) {
			log('loading shader file: /puppet_001/mouth_vertex_shader.hlsl');
            mouth_shader.vertexShader = await get_hlsl_text('/puppet_001/mouth_vertex_shader.hlsl');
        }
        log('finished loaded shader files');
        r();
    });
}
