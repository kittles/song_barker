$(document).ready(init);
async function init () {
    renderer = new THREE.WebGLRenderer();
    container = document.getElementById('container');
    scene = new THREE.Scene();
    iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (iOS) {
        window_width = document.body.offsetWidth + 20;
        window_height = document.body.offsetHeight + 20;
    } else {
        window_width = document.body.offsetWidth;
        window_height = document.body.offsetHeight;
    }
    viewportAspect = window_width / window_height;
    camera = new THREE.OrthographicCamera(
        -0.5 * viewportAspect,
        0.5 * viewportAspect,
        0.5,
        -0.5,
        0.001,
        1000
    );
    camera.position.z = 1;
    stats = new Stats();
    stats.showPanel(2); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);


    container.appendChild(renderer.domElement);
    renderer.setSize(window_width, window_height);
    scene.background = new THREE.Color(0x2E2E46);

    face_animation_shader = {
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
    mouth_shader = {
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

    await get_shader_files();

    // mesh
    pet_image_texture = await load_texture('dog3.jpg');
    var material = new THREE.ShaderMaterial({
        uniforms:       face_animation_shader.uniforms,
        vertexShader:   face_animation_shader.vertexShader,
        fragmentShader: face_animation_shader.fragmentShader,
        depthFunc:      THREE.GreaterDepth,
        side:           THREE.DoubleSide,
    });
    var faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 100, 100), material);
    faceMesh.renderOrder = 1;
    scene.add(faceMesh);

    await load_mouth_mesh(scene, 'MouthStickerDog1_out/MouthStickerDog1.gltf');


    function do_animate () {
        stats.begin();
        renderer.render(scene, camera);
        stats.end();
        animation_frame = requestAnimationFrame(do_animate);
    }
    do_animate();
}

// loaders

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

		scene.add(gltf.scene);
		gltf.animations; // Array<THREE.AnimationClip>
		gltf.scene; // THREE.Group
		gltf.scenes; // Array<THREE.Group>
		gltf.cameras; // Array<THREE.Camera>
		gltf.asset; // Object
		r(gltf);
	});
}

// the mouth has custom geometry that gets loaded with this
async function load_gltf (model_path) {
	return new Promise((r) => { 
		var loader = new THREE.GLTFLoader();
		// Load a glTF resource
		loader.load(model_path, (gltf) => {
			log(`gltf loaded: ${model_path}`);
			r(gltf);
		}, () => {
			log(`gltf file loading: ${model_path}`);
		}, (error) => {
			log(`error loading gltf file: ${model_path}`);
			log(error);
		});
	});
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


async function get_hlsl_text (url) {
    var response = await fetch(url);
    var text = await response.text();
    return text;
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

