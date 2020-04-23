/*
TODO
curry stuff
accept array of mouth positions
blink animations
eye brow animations
think about variable scoping
start and stop animation
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
var debugFaceMesh = false;
var features = {
	// NOTE coordinate system is [-0.5 to 0.5, -0.5 to 0.5]
    leftEyePosition:  new THREE.Vector2(-0.126, 0.308),
    rightEyePosition: new THREE.Vector2(0.007, 0.314),
    mouthPosition:    new THREE.Vector2(-0.058, 0.163),
    headTop:          new THREE.Vector2(-0.062, 0.438),
    headBottom:       new THREE.Vector2(-0.056, 0.117),
    headLeft:         new THREE.Vector2(-0.255, 0.301),
    headRight:        new THREE.Vector2(0.151, 0.334),
};
var mouthScale = 0.9;
var segments = 200; // Segments for the deformation mesh
var startTime = Date.now();
var iOS; // iOS webviews need 20 extra pixels
var window_width; // cant count on a single way of getting this
var window_height; // so use these for the result

// this is what the app will use
window.api = {
	create_puppet: null,
    set_eye:       set_eye,
    blinkLeft:     blinkLeft,
    blinkRight:    blinkRight,
    blink:         blink,
    headSway:      headSway,
    eyebrowLeft:   eyebrowLeft,
    eyebrowRight:  eyebrowRight,
} ;


$('document').ready(init);


function set_eye (eye, x, y) {
	log(`calling set_eye(${eye}, ${x}, ${y})`);
	face_animation_shader.uniforms[`${eye}EyePosition`].value = new THREE.Vector2(x, y);
}


function blinkLeft (val) {
	face_animation_shader.uniforms.blinkLeft.value = val;
}


function blinkRight (val) {
	face_animation_shader.uniforms.blinkRight.value = val;
}


function blink (val) {
	face_animation_shader.uniforms.blinkRight.value = val;
	face_animation_shader.uniforms.blinkLeft.value = val;
}


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


function eyebrowLeft (val) {
	face_animation_shader.uniforms.eyebrowLeftOffset.value = val;
}


function eyebrowRight (val) {
	face_animation_shader.uniforms.eyebrowRightOffset.value = val;
}


function mouthOpen (val) {
	var clamped = Math.min(Math.max(val, 0), 1);
	mouth_shader.uniforms.mouthOpen.value = clamped;
	face_animation_shader.uniforms.mouthOpen.value = clamped;
}


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
	if (typeof(Print) !== "undefined") {
		msg = '[puppet.js postMessage] ' + msg;
	    Print.postMessage(msg);
	} else {
	    console.log('[puppet.js console.log] ' + msg);
	}
}


function init () {
	log('puppet.js calling init');
	// iOS webview sizing shim
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
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('webgl2', {alpha: false});
    renderer = new THREE.WebGLRenderer({canvas: canvas, context: ctx});

	// this just holds the render element
	container = document.getElementById('container');
	scene = new THREE.Scene();


    // public methods


    window.set_eye = set_eye;
    window.blinkLeft = blinkLeft;
    window.blinkRight = blinkRight;
    window.blink = blink;

    window.headSway = headSway;
    window.eyebrowLeft = eyebrowLeft;
    window.eyebrowRight = eyebrowRight;

    async function create_puppet (img_url) {
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

        // TODO
        init_shaders(features);

        // Create the background plane
        // This is just the static pet image on the plane
        // Draw this if we aren't debugging the face mesh
        if (!debugFaceMesh) {
            CreateBackgroundPlane(scene);
        }
        // Deforming mesh
        CreateFaceMesh(scene, segments, segments, features);

        await load_mouth_mesh(scene, 'MouthStickerDog1_out/MouthStickerDog1.gltf');

        renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
        container.appendChild(renderer.domElement);
        renderer.setSize(window_width, window_height);
        render();

        if (enable_controls) {
            controls = new THREE.OrbitControls( camera, renderer.domElement );
        }

		function animate () {
			requestAnimationFrame(animate);

			// Allow camera orbiting with left click in viewport.
			if (enable_controls) {
				controls.update();
			}

			var elapsedMilliseconds = Date.now() - startTime;
			var elapsedSeconds = elapsedMilliseconds / 1000.;

			// Tell the shaders how many seconds have elapsed, this is for the headsway animation
			face_animation_shader.uniforms.swayTime.value = elapsedSeconds;
			mouth_shader.uniforms.swayTime.value = elapsedSeconds;

			render();
		}
		window.animate = animate;

        puppet_ready = 1;
		//$('document').trigger('puppet_ready');
        log('puppet is now ready');
        //return puppet_ready;
    }
    window.create_puppet = create_puppet;
	api.create_puppet = create_puppet;


    function render () {
        renderer.render(scene, camera);
    }
    window.render = render;

	// scene building

    
    //function screenToWorldPosition (screenPos) {
    //    var cameraSize = new THREE.Vector2(Math.abs(camera.left) + Math.abs(camera.right), -1.0);
    //    var offset = new THREE.Vector2(camera.left, 0.5);
    //    var worldPos = screenPos.multiply(cameraSize);
    //    return worldPos.add(offset);
    //}


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

        log('InitFaceShader finished');
    }


    function CreateBackgroundPlane (scene) {
        basicMaterial = new THREE.MeshBasicMaterial({
            map: pet_image_texture,
        });
        bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), basicMaterial);
        bgMesh.scale.x = pet_image_texture.image.width / pet_image_texture.image.height;
        bgMesh.renderOrder = 0;
        scene.add(bgMesh);
        log('CreateBackgroundPlane finished');
    }


    function CreateFaceMesh (scene, widthSegments, heightSegments, features) {
        // Create a material
        var material = new THREE.ShaderMaterial({
            uniforms:       face_animation_shader.uniforms,
            vertexShader:   face_animation_shader.vertexShader,
            fragmentShader: face_animation_shader.fragmentShader,
            depthFunc:      debugFaceMesh ? THREE.AlwaysDepth : THREE.GreaterDepth,
            side:           THREE.DoubleSide,
            wireframe:      debugFaceMesh,
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
        log('CreateFaceMesh finished');
    }

	init_ready = 1;
	log('finished init');
}


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

		scene.add( gltf.scene );
		gltf.animations; // Array<THREE.AnimationClip>
		gltf.scene; // THREE.Group
		gltf.scenes; // Array<THREE.Group>
		gltf.cameras; // Array<THREE.Camera>
		gltf.asset; // Object
		r(gltf);
	});
}
