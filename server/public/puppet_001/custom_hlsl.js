$('document').ready(init);

// In 'custom_hlsl.html' I added a script to include the custom shader code
// which lives in the /public/shaders/ directory.
// This javascript contains all of the GLSL shader code and uniforms for the face deformation
// The shader object is global in scope and should match the js filename; open to other options
// To separate out code into other files on the front-end.

// TODO //
// THREE.TextureLoader().load() is async, need to fix this up a bit with awaits so I don't
//      load the same texture 3 different times. 
//      I only have access to the texture.image.width/height once the function has completed, but I can't await it currently
//      If we can use async/await that would be great, I hate promises.

function init () {
    var controls;
    var container;
    var camera, scene, renderer;
    var uniforms, material, faceMesh;
    var mouseX = 0, mouseY = 0,
        lat = 0, lon = 0, phy = 0, theta = 0;

    var windowHalfX = window.innerWidth / 2;
    var windowHalfY = window.innerHeight / 2;
    
    // Debug vars
    var debugFaceMesh = false;
    var enableControls = true;

    // Mouth is 90% as wide as the distance between the eyes
    var mouthScale = 0.9;

    /*
        Uncomment this function to find the inputs for the features array below
        Testing only.
    */
    // window.addEventListener('mousemove', function(e) {
    //     var normalized_x = e.clientX / window.innerWidth;
    //     var normalized_y = e.clientY / window.innerHeight;
    //     var worldPos = screenToWorldPosition(new THREE.Vector2(normalized_x, normalized_y));
    //     console.log("worldPos: " + worldPos.x + ", " + worldPos.y);
    // });
    
    // dog1 features
    //var features = {
    //    leftEyePosition: new THREE.Vector2(-0.094, 0.261), 
    //    rightEyePosition: new THREE.Vector2(0.165, 0.267), 
    //    mouthPosition: new THREE.Vector2(0.040, -0.089),
    //    headTop: new THREE.Vector2(0.027, 0.475),
    //    headBottom: new THREE.Vector2(0.042, -0.147),
    //    headLeft: new THREE.Vector2(-0.304, 0.232),
    //    headRight: new THREE.Vector2(0.394, 0.260),
    //};

     //dog2 features
     //var features = {
     //    leftEyePosition: new THREE.Vector2(-0.048, 0.217), 
     //    rightEyePosition: new THREE.Vector2(0.091, 0.131), 
     //    mouthPosition: new THREE.Vector2(-0.109, -0.027),
     //    headTop: new THREE.Vector2(0.131, 0.359),
     //    headBottom: new THREE.Vector2(-0.122, -0.087),
     //    headLeft: new THREE.Vector2(-0.170, 0.287),
     //    headRight: new THREE.Vector2(0.252, 0.072),
     //};

    // dog3 features
    var features = {
        leftEyePosition: new THREE.Vector2(-0.126, 0.308), 
        rightEyePosition: new THREE.Vector2(0.007, 0.314), 
        mouthPosition: new THREE.Vector2(-0.058, 0.163),
        headTop: new THREE.Vector2(-0.062, 0.438),
        headBottom: new THREE.Vector2(-0.056, 0.117),
        headLeft: new THREE.Vector2(-0.255, 0.301),
        headRight: new THREE.Vector2(0.151, 0.334),        
    };

    // Pet image to use
    //var pet_image_path = "../img/dog1.jpg";
    //var pet_image_path = "../img/dog2.jpg";
    var pet_image_path = "dog3.jpg";
    
    var noise_texture_path = "noise_2D.png";

    // Segments for the deformation mesh
    var segments = 200;

    init();

    // Expose this function to global scope
    window.GetEllipseCenter = GetEllipseCenter;
    window.GetHeadTop = GetHeadTop;
    window.GetHeadLeft = GetHeadLeft;
    window.GetHeadRight = GetHeadRight;
    window.GetHeadBottom = GetHeadBottom;

    var startTime = Date.now();
    animate();
    
    function init() {

        container = document.getElementById('container');

        // Create a webgl scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color( 0x2E2E46 );

        // Calculate the aspect ratio of the browser viewport
        viewportAspect = window.innerWidth / window.innerHeight;

        // Camera left and right frustrum to make sure the camera size is the same as viewport size
        camera = new THREE.OrthographicCamera( -0.5 * viewportAspect, 0.5 * viewportAspect, 0.5, -0.5, 0.001, 1000 );
        camera.position.z = 1;

        InitShaders(pet_image_path, features);

        // Create the background plane
        // This is just the static pet image on the plane
        // Draw this if we aren't debugging the face mesh
        if (!debugFaceMesh)
            CreateBackgroundPlane(scene, pet_image_path);

        // Deforming mesh
        CreateFaceMesh(scene, pet_image_path, segments, segments, features);

        // No longer using a custom geometry mouth animation...
        LoadCustomMouthMesh(scene, 'MouthStickerDog1_out/MouthStickerDog1.gltf');

        // This is a webgl v1 renderer.
        //renderer = new THREE.WebGLRenderer();
        
        // This is a webgl v2 renderer, we're using some GLSL functions from version 300 es.
        var canvas = document.createElement( 'canvas' );
        var context = canvas.getContext( 'webgl2', { alpha: false } );
        renderer = new THREE.WebGLRenderer( { canvas: canvas, context: context } );

        renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
        container.appendChild(renderer.domElement);

        renderer.setSize(window.innerWidth, window.innerHeight);

        if (enableControls)
            controls = new THREE.OrbitControls( camera, renderer.domElement );
    }

    function animate() {
        requestAnimationFrame(animate);

        // Allow camera orbiting with left click in viewport.
        if (enableControls)
            controls.update();

        var elapsedMilliseconds = Date.now() - startTime;
        var elapsedSeconds = elapsedMilliseconds / 1000.;

        // Tell the shaders how many seconds have elapsed, this is for the headsway animation
        FaceAnimationShader.uniforms.swayTime.value = elapsedSeconds;
        MouthShader.uniforms.swayTime.value = elapsedSeconds;

        render();
    }

    function render() {
        var elapsedMilliseconds = Date.now() - startTime;
        var elapsedSeconds = elapsedMilliseconds / 1000.;
        //uniforms.time.value = 60. * elapsedSeconds;
        renderer.render(scene, camera);
    }
    
    function screenToWorldPosition(screenPos) {
        var cameraSize = new THREE.Vector2(Math.abs(camera.left) + Math.abs(camera.right), -1.0);

        var offset = new THREE.Vector2(camera.left, 0.5);
        var worldPos = screenPos.multiply(cameraSize);
        worldPos = worldPos.add(offset);

        return worldPos;
    }

    function GetHeadLeft() {
        return features.headLeft;
    }

    function GetHeadRight() {
        return features.headRight;
    }

    function GetHeadTop() {
        return features.headTop;
    }

    function GetHeadBottom() {
        return features.headBottom;
    }

    function GetMouthMaterial() {
        // Create a material
        const material = new THREE.ShaderMaterial({
            uniforms: MouthShader.uniforms,
            vertexShader: MouthShader.vertexShader,
            fragmentShader: MouthShader.fragmentShader,
            depthFunc: THREE.AlwaysDepth,
            side: THREE.DoubleSide,
            blending: THREE.MultiplyBlending,
            vertexColors: true
        });

        return material;
    }

    function GetEyeCenter() {
        var leftEye = new THREE.Vector2(features.leftEyePosition.x, features.leftEyePosition.y);
        var rightEye = new THREE.Vector2(features.rightEyePosition.x, features.rightEyePosition.y);

        // We need to center this geometry at the face
        var eyeCenter = leftEye.add(rightEye).multiplyScalar(0.5);

        return eyeCenter;
    }

    function GetEyeLine() {
        var leftEye = new THREE.Vector2(features.leftEyePosition.x, features.leftEyePosition.y);
        var rightEye = new THREE.Vector2(features.rightEyePosition.x, features.rightEyePosition.y);

        return rightEye.sub(leftEye);
    }

    // The head top/left/right/bottom points create an ellipse around the head which drives head sway motion
    function GetEllipseCenter() {
        var top = new THREE.Vector2(features.headTop.x, features.headTop.y);
        var bottom = new THREE.Vector2(features.headBottom.x, features.headBottom.y);
        var left = new THREE.Vector2(features.headLeft.x, features.headLeft.y);
        var right = new THREE.Vector2(features.headRight.x, features.headRight.y);

        var center = top.add(bottom).add(left).add(right).divideScalar(4);
        return center;
    }

    function LoadCustomMouthMesh(scene,model_path) {
        // Load the Mouth custom mesh
        var loader = new THREE.GLTFLoader();

        // Load a glTF resource
        loader.load(
            // resource URL
            model_path,
            // called when the resource is loaded
            function ( gltf ) {
                var mesh = gltf.scene.children[0].children[0];
                mesh.material = GetMouthMaterial();                
                mesh.renderOrder = 2;

                // Mesh position is same as mouthposition
                // Mesh rotation is the same as the head rotation

                var eyeCenter = GetEyeCenter();
                var eyeLine = GetEyeLine();
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
            },
            // called while loading is progressing
            undefined,
            // called when loading has errors
            function ( error ) {
                console.error( 'Error loading custom mouth mesh.' );
            }
        );
    }

    // Sets a shader's paramName uniform of type 't' with value THREE.Texture()
    // Returns true if the property exists essentially, needs to return false if TextureLoader().load fails as well.
    function LoadAndSetTexture(shader, paramName, img_path) {
        if (shader.uniforms.hasOwnProperty(paramName)) {
            var texture = new THREE.TextureLoader().load(img_path);
            texture.wrapS = THREE.MirroredRepeatWrapping;
            texture.wrapT = THREE.MirroredRepeatWrapping;

            shader.uniforms[paramName].value = texture;
            return true;
        }
        return false;
    }

    function InitShaders(img_path, features) {
        // Set the FaceAnimationShader's 'petImage' uniform to the pet image
        LoadAndSetTexture(FaceAnimationShader, "petImage", img_path);
        LoadAndSetTexture(FaceAnimationShader, "animationNoise", noise_texture_path);

        FaceAnimationShader.uniforms.resolution.value.x = window.innerWidth;
        FaceAnimationShader.uniforms.resolution.value.y = window.innerHeight;

        FaceAnimationShader.uniforms.leftEyePosition.value = features.leftEyePosition;
        FaceAnimationShader.uniforms.rightEyePosition.value = features.rightEyePosition;
        FaceAnimationShader.uniforms.mouthPosition.value = features.mouthPosition;

        // Mouth Shader
        LoadAndSetTexture(MouthShader, "animationNoise", noise_texture_path);

        MouthShader.uniforms.resolution.value.x = window.innerWidth;
        MouthShader.uniforms.resolution.value.y = window.innerHeight;

        MouthShader.uniforms.leftEyePosition.value = features.leftEyePosition;
        MouthShader.uniforms.rightEyePosition.value = features.rightEyePosition;
        MouthShader.uniforms.mouthPosition.value = features.mouthPosition;            
    }

    function CreateBackgroundPlane(scene, img_path) {
        // Note: Load is async, so we might have to await it before adding it to the scene
        // We need the width/height to do the correct scaling on the background image.
        var texture = new THREE.TextureLoader().load( img_path, function ( tex ) {
            aspect = tex.image.width / tex.image.height;

            basicMaterial = new THREE.MeshBasicMaterial( {
                map: tex
            });

            bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), basicMaterial);
            bgMesh.scale.x = aspect;

            bgMesh.renderOrder = 0;
            scene.add(bgMesh);
        } );
    }

    function CreateFaceMesh(scene, img_path, widthSegments, heightSegments, features) {
        // Create a material
        var material = new THREE.ShaderMaterial({
            uniforms: FaceAnimationShader.uniforms,
            vertexShader: FaceAnimationShader.vertexShader,
            fragmentShader: FaceAnimationShader.fragmentShader,
            depthFunc:debugFaceMesh ? THREE.AlwaysDepth : THREE.GreaterDepth,
            side: THREE.DoubleSide,
            wireframe:debugFaceMesh,
        });

        // This isn't great, we need to load the pet image again
        var loader = new THREE.TextureLoader();
        var texture = loader.load(img_path, 
            function(tex) {
                var aspect = tex.image.width / tex.image.height;
                FaceAnimationShader.uniforms.aspectRatio.value = aspect;
        });

        // Adds the material to the geometry
        var faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, widthSegments, heightSegments), material);
        
        // This object renders on top of the background
        faceMesh.renderOrder = 1;

        var eyeCenter = GetEyeCenter();
        var eyeLine = GetEyeLine();

        // Center the mesh's position on the eyes
        faceMesh.position.x = eyeCenter.x;
        faceMesh.position.y = eyeCenter.y;

        // Rotate the mesh the same direction as the eyes
        var rads = Math.atan(eyeLine.y / eyeLine.x);        
        faceMesh.rotateZ(rads);

        scene.add(faceMesh);
    }
}

function blinkLeft(val) {
    FaceAnimationShader.uniforms.blinkLeft.value = val;
}

function blinkRight(val) {
    FaceAnimationShader.uniforms.blinkRight.value = val;
}

function blink(val) {
    FaceAnimationShader.uniforms.blinkRight.value = val;
    FaceAnimationShader.uniforms.blinkLeft.value = val;
}

// Amplitude is how far to move the uvs for the animation, Default value of 1 looks good.
// Speed is a representation how often the animation loops in 1 minute.  Default value of 1 looks good
function headSway(amplitude, speed) {
    // Adjust the input values to make them a bit more intuitive, otherwise you'll need to put in a very small amplitude/speed value
    amplitude /= 10;
    speed /= 60;

    var ellipseCenter = window.GetEllipseCenter();

    var distanceLeft = ellipseCenter.distanceTo(window.GetHeadLeft());
    var distanceRight = ellipseCenter.distanceTo(window.GetHeadRight());

    var distanceTop = ellipseCenter.distanceTo(window.GetHeadTop());
    var distanceBottom = ellipseCenter.distanceTo(window.GetHeadBottom());

    var extentsX = (distanceLeft + distanceRight) * 0.5;
    var extentsY = (distanceTop + distanceBottom) * 0.5;

    // This value is how the big the ellipse is for the head
    var ST_numerator = 0.3;

    var ellipseExtents = new THREE.Vector2(extentsX, extentsY);

    var faceEllipse_ST = new THREE.Vector4(ST_numerator / ellipseExtents.x, ST_numerator / ellipseExtents.y, ellipseCenter.x, ellipseCenter.y);
    FaceAnimationShader.uniforms.swaySpeed.value = speed;
    FaceAnimationShader.uniforms.swayAmplitude.value = amplitude;
    FaceAnimationShader.uniforms.faceEllipse_ST.value = faceEllipse_ST;

    MouthShader.uniforms.swaySpeed.value = speed;
    MouthShader.uniforms.swayAmplitude.value = amplitude;
    MouthShader.uniforms.faceEllipse_ST.value = faceEllipse_ST;
}

function eyebrowLeft(val) {
    FaceAnimationShader.uniforms.eyebrowLeftOffset.value = val;
}

function eyebrowRight(val) {
    FaceAnimationShader.uniforms.eyebrowRightOffset.value = val;
}

function mouthOpen(val) {
    var clamped = Math.min(Math.max(val, 0), 1);
    MouthShader.uniforms.mouthOpen.value = clamped;
    FaceAnimationShader.uniforms.mouthOpen.value = clamped;
}
