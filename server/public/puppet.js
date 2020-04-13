var puppet_ready = false; // poll on this to know when you can start doing stuff
var canvas = document.getElementById('image-canvas');
var ctx = canvas.getContext('2d');
var container = document.getElementById('container');
var scene = new THREE.Scene();
var camera;
var renderer = new THREE.WebGLRenderer();
var uniforms, material, faceMesh, texture;
var mouseX = 0, mouseY = 0,
    lat = 0, lon = 0, phy = 0, theta = 0;

var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

var debugFaceMesh = false;
// NOTE coordinate system is [-0.5 to 0.5, -0.5 to 0.5]
// TODO remove
var features = {
    leftEyePosition:  new THREE.Vector2(-0.094, 0.261),
    rightEyePosition: new THREE.Vector2(0.165, 0.267),
    mouthPosition:    new THREE.Vector2(0.040, -0.089),
};
// Segments for the deformation mesh
var segments = 200;
var startTime = Date.now();


$('document').ready(init);


function init () {

    // public methods


    function set_eye (eye, pos) {
        FaceAnimationShader.uniforms[`${eye}EyePosition`].value = new THREE.Vector2(pos);
    }
    window.set_eye = set_eye;


    function blinkLeft (val) {
        FaceAnimationShader.uniforms.blinkLeft.value = val;
        render();
    }
    window.blinkLeft = blinkLeft;


    function blinkRight (val) {
        FaceAnimationShader.uniforms.blinkRight.value = val;
        render();
    }
    window.blinkRight = blinkRight;


    function blink (val) {
        FaceAnimationShader.uniforms.blinkRight.value = val;
        FaceAnimationShader.uniforms.blinkLeft.value = val;
        render();
    }
    window.blink = blink;


    async function create_puppet (img_url) {
		img_url = (img_url === undefined ? await to_b64('dog.jpg') : img_url);

        // if this is being called more than once, the scene needs to be cleared
        while (scene.children.length > 0) {
            scene.remove(scene.children[0]);
        }

        // Create a webgl scene
        scene.background = new THREE.Color(0x2E2E46);

        // Calculate the aspect ratio of the browser viewport
        viewportAspect = window.innerWidth / window.innerHeight;

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

		texture = await load_texture(img_url);
        console.log(texture);

        InitFaceShader(features);

        // Create the background plane
        // This is just the static pet image on the plane
        // Draw this if we aren't debugging the face mesh
        if (!debugFaceMesh) {
            CreateBackgroundPlane(scene);
        }
        // Deforming mesh
        CreateFaceMesh(scene, segments, segments, features);

        renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
        container.appendChild(renderer.domElement);
        renderer.setSize(window.innerWidth, window.innerHeight);
        render();

        puppet_ready = true;
		$('document').trigger('puppet_ready');
        console.log('puppet is now ready');
        return puppet_ready;
    }
    window.create_puppet = create_puppet;


    function render () {
        // TODO what is the time for
        var elapsedMilliseconds = Date.now() - startTime;
        var elapsedSeconds = elapsedMilliseconds / 1000.;
        //uniforms.time.value = 60. * elapsedSeconds;
        renderer.render(scene, camera);
    }
    window.render = render;

	// scene building

    
    function screenToWorldPosition (screenPos) {
        var cameraSize = new THREE.Vector2(Math.abs(camera.left) + Math.abs(camera.right), -1.0);
        var offset = new THREE.Vector2(camera.left, 0.5);
        var worldPos = screenPos.multiply(cameraSize);
        return worldPos.add(offset);
    }


    function InitFaceShader (features) {
        FaceAnimationShader.uniforms['petImage'].value = texture;
        FaceAnimationShader.uniforms.resolution.value.x = window.innerWidth;
        FaceAnimationShader.uniforms.resolution.value.y = window.innerHeight;
        FaceAnimationShader.uniforms.leftEyePosition.value = features.leftEyePosition;
        FaceAnimationShader.uniforms.rightEyePosition.value = features.rightEyePosition;
        FaceAnimationShader.uniforms.mouthPosition.value = features.mouthPosition;
        console.log('InitFaceShader finished');
    }


    function CreateBackgroundPlane (scene) {
        basicMaterial = new THREE.MeshBasicMaterial({
            map: texture,
        });
        bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), basicMaterial);
        bgMesh.scale.x = texture.image.width / texture.image.height;
        bgMesh.renderOrder = 0;
        scene.add(bgMesh);
        console.log('CreateBackgroundPlane finished');
    }


    function CreateFaceMesh (scene, widthSegments, heightSegments, features) {
        // Create a material
        var material = new THREE.ShaderMaterial({
            uniforms:       FaceAnimationShader.uniforms,
            vertexShader:   FaceAnimationShader.vertexShader,
            fragmentShader: FaceAnimationShader.fragmentShader,
            depthFunc:      debugFaceMesh ? THREE.AlwaysDepth : THREE.GreaterDepth,
            side:           THREE.DoubleSide,
            wireframe:      debugFaceMesh,
        });

        FaceAnimationShader.uniforms.aspectRatio.value = texture.image.width / texture.image.height;

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
        console.log('CreateFaceMesh finished');
    }


	// testing 
	//function blink_forever () {
	//	var blink_amount = 0;
	//	function animate () {
	//		requestAnimationFrame(animate);
	//		blink_amount = (blink_amount + (1 / 60)) % 1;
	//		blink(blink_amount);
	//		console.log(blink_amount);
	//	}
	//	animate();
	//}
	//window.blink_forever = blink_forever;


	// Uncomment this function to find the inputs for the features array below
	// Testing only.
    //window.addEventListener('mousemove', function(e) {
    //    var normalized_x = e.clientX / window.innerWidth;
    //    var normalized_y = e.clientY / window.innerHeight;
    //    var worldPos = screenToWorldPosition(new THREE.Vector2(normalized_x, normalized_y));
    //    console.log("worldPos: " + worldPos.x + ", " + worldPos.y);
    //});
}


async function load_texture (img_src) {
    return new Promise(resolve => {
        new THREE.TextureLoader().load(img_src, resolve);
    });
}


// for console testing
async function to_b64 (img_src) {
    var img = await load_image(img_src);
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL();
}


// for console testing
async function load_image (img_src) {
    return new Promise((r) => { 
        let i = new Image(); 
        i.onload = () => r(i); 
        i.src = img_src; 
    });
}


var vertex_shader_literal = `
uniform vec2 leftEyePosition;//in worldSpace
uniform vec2 rightEyePosition;//in worldSpace
uniform vec2 mouthPosition;//in worldSpace

uniform float blinkLeft;
uniform float blinkRight;
uniform float mouthOpen;
uniform float aspectRatio;

varying vec2 uvCoords;

float sqr(float x)
{
    return x * x;
}

vec2 Rescale(vec2 coordinates, float scale, float offset)
{
    return coordinates * scale + offset;
}

#define EYE_INFLUENCE 0.35//TODO
#define MOUTH_INFLUENCE 0.6//TODO

vec3 GenerateInfluenceMasks(vec2 positionWS, vec2 blinkDir, float ipd)
{
    float leftEyeInfluence =
        1.0 - sqr(clamp(distance(positionWS, leftEyePosition) / (EYE_INFLUENCE * ipd), 0.0, 1.0));
    float rightEyeInfluence =
        1.0 - sqr(clamp(distance(positionWS, rightEyePosition) / (EYE_INFLUENCE * ipd), 0.0, 1.0));
    float mouthInfluence =
        1.0 - clamp(distance(positionWS, mouthPosition + blinkDir * 0.3) / (MOUTH_INFLUENCE * ipd), 0.0, 1.0);
    mouthInfluence *= 1.0 - max(leftEyeInfluence, rightEyeInfluence) * 0.65;

    return vec3(leftEyeInfluence, rightEyeInfluence, mouthInfluence);
}
    
vec2 AnimatePositionOS(vec2 positionOS, vec2 positionWS, float blinkL, float blinkR, float talk)
{
    vec2 animatedPosition = positionOS;

    //animatedPosition.x += sin(positionOS.y * 16.0) * 0.1;

    vec2 eyeLine = rightEyePosition - leftEyePosition;
    float ipd = length(eyeLine);
    vec2 blinkDir = vec2(eyeLine.y, -eyeLine.x);

    vec3 influenceMask = GenerateInfluenceMasks(positionWS, blinkDir, ipd);

    animatedPosition.y *= 1.0 - (influenceMask.x * blinkL);
    animatedPosition.y *= 1.0 - (influenceMask.y * blinkR);
    animatedPosition.y -= (influenceMask.z * talk * ipd * 0.3);

    return animatedPosition;
}

void main()
{
    vec2 worldPos = (modelMatrix * vec4(position, 1.0)).xy;
    uvCoords = worldPos;
    uvCoords.x /= aspectRatio;
    uvCoords = Rescale(uvCoords, 1.0, 0.5);

    vec2 animatedLocalPos = AnimatePositionOS(position.xy, worldPos, blinkLeft, blinkRight, mouthOpen);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(animatedLocalPos, -1.0, 1.0);

}`;


var fragment_shader_literal = `
uniform vec2 resolution;//set from game code, controls clip coordinates probably
uniform sampler2D petImage;

varying vec2 uvCoords;

void main()
{
    gl_FragColor = vec4(texture2D(petImage, uvCoords).xyz, 1.0);
}`;


var FaceAnimationShader = {
    uniforms: {
        resolution: { type: 'v2', value: new THREE.Vector2() },
        leftEyePosition: { type: 'v2', value: new THREE.Vector2() },
        rightEyePosition: { type: 'v2', value: new THREE.Vector2() },
        mouthPosition: { type: 'v2', value: new THREE.Vector2() },
        blinkLeft: { type: 'f', value: 0.0 },
        blinkRight: { type: 'f', value: 0.0 },
        mouthOpen: { type: 'f', value: 0.0 },
        aspectRatio: { type: 'f', value: 1.0 },
        petImage: { type: 't', value: new THREE.Texture() }
    },
	vertexShader: vertex_shader_literal,
	fragmentShader: fragment_shader_literal,
};
