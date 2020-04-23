/*
TODO
headSway stops after a while
*/
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
var uniforms, material, faceMesh, texture;
var mouseX = 0;
var mouseY = 0;
var lat = 0;
var lon = 0;
var phy = 0;
var theta = 0;
var enable_controls = true;
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
    ctx = canvas.getContext('webgl2', {alpha: false});
    renderer = new THREE.WebGLRenderer({canvas: canvas, context: ctx});

	// this just holds the render element
	container = document.getElementById('container');
	scene = new THREE.Scene();

    // see fps
    if (show_fps) {
        stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        document.body.appendChild(stats.dom);
    }

    // tell client the puppet is ready
	init_ready = 1;
	log('finished init');
}


async function create_puppet (img_url) {
    return new Promise(async (r) => {
        img_url = (img_url === undefined ? await to_b64('dog3.jpg') : img_url);

        // if this is being called more than once, the scene needs to be cleared
        while (scene.children.length > 0) {
            scene.remove(scene.children[0]);
        }

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

        pet_image_texture = await load_texture(img_url);
        animation_noise_texture = await load_texture('noise_2D.png');

        await get_shader_files();

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
        return r(puppet_ready);
    });
}



// set landmarks

//function set_eye (eye, x, y) {
//	log(`calling set_eye(${eye}, ${x}, ${y})`);
//	face_animation_shader.uniforms[`${eye}EyePosition`].value = new THREE.Vector2(x, y);
//}
function set_position (key, x, y) {
	log(`calling set_position(${key}, ${x}, ${y})`);
	features[key] = new THREE.Vector2(x, y);
}


// control puppet directly

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


function mouthOpen (val) {
	var clamped = Math.min(Math.max(val, 0), 1);
	mouth_shader.uniforms.mouthOpen.value = clamped;
	face_animation_shader.uniforms.mouthOpen.value = clamped;
}

// TODO need a head_displacement method instead
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
	function tick () {
		var val = next();
		if (val !== false) {
			handler(val);
		}
	}
	return {
		add: add,
		tick: tick,
	};
}


var ticks = {
    left_blink: ticker(blink_left),
    right_blink: ticker(blink_right),
    left_brow: ticker(eyebrow_left),
    right_brow: ticker(eyebrow_right),
    //mouth:       _([]),
};


function motion_handler_tick () {
	_.invokeMap(ticks, 'tick');
}


function ease_out_quad (x) {
	return 1 - (1 - x) * (1 - x);
}	


function left_brow_to_pos (x, frames) {
	var vals = _.map(_.range(0, x + (1 / frames), 1 / frames), ease_out_quad);
	ticks.left_brow.add(vals);
}


function add_left_blink () {
	var close_frames = 3;
	var vals = _.map(_.range(0, 1 + (1 / close_frames), 1 / close_frames), ease_out_quad);
	var open_frames = 7;
	vals = vals.concat(_.map(_.reverse(_.range(0, 1 + (1 / open_frames), 1 / open_frames)), ease_out_quad));
	ticks.left_blink.add(vals);
}


function add_right_blink () {
	var close_frames = 3;
	var vals = _.map(_.range(0, 1 + (1 / close_frames), 1 / close_frames), ease_out_quad);
	var open_frames = 7;
	vals = vals.concat(_.map(_.reverse(_.range(0, 1 + (1 / open_frames), 1 / open_frames)), ease_out_quad));
	ticks.right_blink.add(vals);
}


function animate () {
    stats.begin();
    if (enable_controls) {
        controls.update();
    }

    // Tell the shaders how many seconds have elapsed, this is for the headsway animation
    var elapsedMilliseconds = Date.now() - startTime;
    var elapsedSeconds = elapsedMilliseconds / 1000.;
    face_animation_shader.uniforms.swayTime.value = elapsedSeconds;
    mouth_shader.uniforms.swayTime.value = elapsedSeconds;

    // step a tick in the motion handler
    motion_handler_tick();

    renderer.render(scene, camera);
    stats.end();
    requestAnimationFrame(animate);
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
        side:           THREE.DoubleSide,
        wireframe:      debug_face_mesh,
    });

    face_animation_shader.uniforms.aspectRatio.value = pet_image_texture.image.width / pet_image_texture.image.height;

    // Adds the material to the geometry
    var faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, widthSegments, heightSegments), material);
    
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
    await create_puppet();
    animate();
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


async function load_gltf (model_path) {
	return new Promise((r) => { 
		var loader = new THREE.GLTFLoader();
		// Load a glTF resource
		loader.load(model_path, (gltf) => {
			log('gltf loaded');
			r(gltf);
		}, () => {
			log('gltf file loading');
		}, (error) => {
			log('error loading gltf');
			log(error);
		});
	});
}


async function load_mouth_mesh (scene, model_path) {
	// Load the Mouth custom mesh
	return new Promise(async (r) => { 
		var gltf = await load_gltf(model_path);
		var mesh = gltf.scene.children[0].children[0];
		mesh.material = new THREE.ShaderMaterial({ 
			uniforms: mouth_shader.uniforms,
			vertexShader: mouth_shader.vertexShader,
			fragmentShader: mouth_shader.fragmentShader,
			depthFunc: THREE.AlwaysDepth,
			side: THREE.DoubleSide,
			blending: THREE.MultiplyBlending,
			vertexColors: true
		});
		mesh.renderOrder = 2;

		// Mesh position is same as mouthposition
		// Mesh rotation is the same as the head rotation
		var eyeCenter = get_eye_center();
		var eyeLine = get_eye_line();
		var eyeLineLength = eyeLine.length();
		var mouthPosition = new THREE.Vector2(features.mouthPosition.x, features.mouthPosition.y);
		mesh.scale.set(eyeLineLength * mouthScale, eyeLineLength * mouthScale, eyeLineLength * mouthScale);

		// Center the mesh's position on the eyes
		mesh.position.x = mouthPosition.x;
		mesh.position.y = mouthPosition.y;

		// Rotate the mesh the same direction as the eyes
		var rads = Math.atan(eyeLine.y / eyeLine.x);        
		mesh.rotateY(-rads);
		scene.add(gltf.scene);
		gltf.animations; // Array<THREE.AnimationClip>
		gltf.scene; // THREE.Group
		gltf.scenes; // Array<THREE.Group>
		gltf.cameras; // Array<THREE.Camera>
		gltf.asset; // Object
		r(gltf);
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
            face_animation_shader.fragmentShader = await get_hlsl_text('/puppet_001/face_fragment_shader.hlsl');
        }
        if (face_animation_shader.vertextShader == null) {
            face_animation_shader.vertexShader = await get_hlsl_text('/puppet_001/face_vertex_shader.hlsl');
        }
        if (mouth_shader.fragmentShader == null) {
            mouth_shader.fragmentShader = await get_hlsl_text('/puppet_001/mouth_fragment_shader.hlsl'); 
        }
        if (mouth_shader.vertexShader == null) {
            mouth_shader.vertexShader = await get_hlsl_text('/puppet_001/mouth_vertex_shader.hlsl');
        }
        log('loaded shader files');
        r();
    });
}
