// This variable name will match 1:1 with the code in custom_hlsl.js
var face_animation_shader = {
    uniforms: {
        resolution: { type: "v2", value: new THREE.Vector2() },

        leftEyePosition: { type: "v2", value: new THREE.Vector2() },
        rightEyePosition: { type: "v2", value: new THREE.Vector2() },
        mouthPosition: { type: "v2", value: new THREE.Vector2() },

        blinkLeft: { type: "f", value: 0.0 },
        blinkRight: { type: "f", value: 0.0 },
        mouthOpen: { type: "f", value: 0.0 },
        aspectRatio: { type: "f", value: 1.0 },

		petImage: { type: "t", value: new THREE.Texture() },

		// Head Sway
		faceEllipse_ST: { type: "v4", value: new THREE.Vector4() },
		animationNoise: { type: "t", value: new THREE.Texture() },
		swayTime: { type: "f", value: 0.0 },
		swaySpeed: { type: "f", value: 0.1 },
		swayAmplitude: { type: "f", value: 0.0 },

		// Eyebrows
		eyebrowLeftOffset: { type: "f", value: 0.0 },
		eyebrowRightOffset: { type: "f", value: 0.0 },

		worldToFaceMatrix: {type: "m4", value: new THREE.Matrix4() }
    },

	vertexShader: [`
    
	uniform mat4 worldToFaceMatrix;

    uniform vec2 leftEyePosition;//in worldSpace
    uniform vec2 rightEyePosition;//in worldSpace
    uniform vec2 mouthPosition;//in worldSpace

    uniform float blinkLeft;
    uniform float blinkRight;
    uniform float mouthOpen;
    uniform float aspectRatio;

	uniform float eyebrowLeftOffset;
	uniform float eyebrowRightOffset;

	uniform vec4 faceEllipse_ST;
	uniform float swayTime;
	uniform float swaySpeed;
	uniform float swayAmplitude;
	uniform sampler2D animationNoise;
	
	varying vec2 uvCoords;
	varying vec4 debug;
    
    float sqr(float x)
    {
	    return x * x;
    }

	vec2 Rescale(vec2 coordinates, float scale, float offset)
	{
		return coordinates * scale + offset;
	}

	vec2 lerp(vec2 b, vec2 t, float s)
	{
		return b + s * (t-b);
	}
    

    #define EYE_INFLUENCE 0.35
    #define MOUTH_INFLUENCE 0.6
	#define EYEBROW_DISTANCE 0.67

    vec3 GenerateInfluenceMasks(vec2 positionWS, vec2 blinkDir, float ipd)
    {
	    float leftEyeInfluence =
		    1.0 - sqr(clamp(distance(positionWS, leftEyePosition) / 
			(EYE_INFLUENCE * ipd), 0.0, 1.0));
	    float rightEyeInfluence =
		    1.0 - sqr(clamp(distance(positionWS, rightEyePosition) / 
			(EYE_INFLUENCE * ipd), 0.0, 1.0));
	    float mouthInfluence =
		    1.0 - (clamp(distance(positionWS, mouthPosition + blinkDir * 0.3) / 
			(MOUTH_INFLUENCE * ipd), 0.0, 1.0));
	    mouthInfluence *= 1.0 - max(leftEyeInfluence, rightEyeInfluence) * 0.65;

	    return vec3(leftEyeInfluence, rightEyeInfluence, mouthInfluence);
    }

	vec2 GenerateEyebrowMasks(vec2 positionWS, vec2 eyeLine, vec2 blinkDir, float ipd)
	{
		vec2 leftEyebrowPosition = leftEyePosition - ((blinkDir - eyeLine * 0.85) * EYEBROW_DISTANCE * 0.5);
		vec2 rightEyebrowPosition = rightEyePosition - ((blinkDir + eyeLine * 0.85) * EYEBROW_DISTANCE * 0.5);

		float leftEyebrowInfluence = 1.0 - 
			(clamp(distance(positionWS, leftEyebrowPosition) / 
			(EYEBROW_DISTANCE * ipd), 0.0, 1.0));
		float rightEyebrowInfluence = 1.0 - 
			(clamp(distance(positionWS, rightEyebrowPosition) / 
			(EYEBROW_DISTANCE * ipd), 0.0, 1.0));
		return vec2(leftEyebrowInfluence * 0.5, rightEyebrowInfluence * 0.5);
	}

	vec2 DebugNoiseTexture(vec2 uvCoords)
	{
		vec4 noiseTextureSample = textureLod(animationNoise, uvCoords, 0.0);
		
		vec2 noise = noiseTextureSample.xy;
		return noise;
	}

	vec2 AnimateHeadSway(vec2 positionOS, float scale)
	{
		vec2 ellipse = positionOS * 2.0 * faceEllipse_ST.xy + faceEllipse_ST.zw;
		float faceMask = 1.0 - clamp(sqr(ellipse.x) + sqr(ellipse.y), 0.0, 1.0);
		
		vec4 noiseTextureSample = textureLod(animationNoise, vec2(swaySpeed * swayTime, 0.5), 0.0);
		
		vec2 noise = noiseTextureSample.xy * 2.0 - 1.0;
		noise *= swayAmplitude * scale;
		
		//debug.x = faceMask;

		vec2 animatedPositionOS = positionOS + noise * faceMask;
		return animatedPositionOS;
	}
        
    vec2 AnimatePositionOS(vec2 positionOS, vec2 positionWS, float blinkL, float blinkR, float talk, float mask)
    {
	    vec2 animatedPositionOS = positionOS;
	
	    vec2 eyeLine = rightEyePosition - leftEyePosition;
	    float ipd = length(eyeLine);
	    vec2 blinkDir = vec2(eyeLine.y, -eyeLine.x);

		mat4 modelMatrixInverse = inverse(modelMatrix);
		vec2 leftEyePositionOS = (modelMatrixInverse * vec4(leftEyePosition, 0.0, 1.0)).xy;
		vec2 rightEyePositionOS = (modelMatrixInverse * vec4(rightEyePosition, 0.0, 1.0)).xy;
		vec2 mouthPositionOS = (modelMatrixInverse * vec4(mouthPosition, 0.0, 1.0)).xy;

		float mouthInfluence =
		    1.0 - clamp(distance(positionOS, mouthPositionOS) / (MOUTH_INFLUENCE * ipd), 0.0, 1.0);

	    vec3 influenceMask = GenerateInfluenceMasks(positionWS, blinkDir, ipd);
		vec2 eyebrowMasks = GenerateEyebrowMasks(positionWS, eyeLine, blinkDir, ipd);

		eyebrowMasks.x = clamp(eyebrowMasks.x * 0.8 - influenceMask.x * 0.35, 0.0, 1.0);
		eyebrowMasks.y = clamp(eyebrowMasks.y * 0.8 - influenceMask.y * 0.35, 0.0, 1.0);

		animatedPositionOS.y += eyebrowMasks.x * ipd *
			((eyebrowLeftOffset > 0.0) ? eyebrowLeftOffset * 0.5 : (eyebrowLeftOffset * 0.25));
		animatedPositionOS.x += eyebrowMasks.x * ipd * (eyebrowLeftOffset) * 0.18;
		animatedPositionOS.y += eyebrowMasks.y * ipd * 
			((eyebrowRightOffset > 0.0) ? eyebrowRightOffset * 0.5 : (eyebrowRightOffset * 0.25));
		animatedPositionOS.x -= eyebrowMasks.y * ipd * (eyebrowRightOffset) * 0.18;

	    animatedPositionOS.y *= 1.0 - (influenceMask.x * blinkL);
	    animatedPositionOS.y *= 1.0 - (influenceMask.y * blinkR);
	    animatedPositionOS.y -= (influenceMask.z * talk * ipd * 0.3);

		animatedPositionOS = AnimateHeadSway(animatedPositionOS, ipd);

	    return lerp(positionOS, animatedPositionOS, mask);
    }

	void main()
	{
		debug = vec4(0.0, 0.0, 0.0, 0.0);

        vec2 worldPos = (modelMatrix * vec4(position, 1.0)).xy;
		uvCoords = worldPos;
		uvCoords.x /= aspectRatio;
		uvCoords = Rescale(uvCoords, 1.0, 0.5);

		float mask = clamp((1.0 - abs(position.x * 2.0)) * 8.0, 0.0, 1.0) * 
			clamp((1.0 - abs(position.y * 2.0)) * 8.0, 0.0, 1.0);

		vec2 animatedPositionOS = AnimatePositionOS(position.xy, worldPos, blinkLeft, blinkRight, mouthOpen, 1.0);
		
		//gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy,  -1.0, 1.0);
		gl_Position = projectionMatrix * modelViewMatrix * vec4(animatedPositionOS, -1.0, 1.0);

	}
`].join( "\n" ),

	fragmentShader: [`
	uniform vec2 resolution;//set from game code, controls clip coordinates probably
	uniform sampler2D petImage;

	varying vec2 uvCoords;
	varying vec4 debug;

	void main()
	{
		vec4 color = texture2D(petImage, uvCoords);
		//color += debug;
		//color = debug;
		//color.xyz = vec3(debug.x, debug.x, debug.x);

		gl_FragColor = vec4(color.xyz, 1.0);
	}
`].join( "\n" )
};
