
uniform vec2 leftEyePosition;//in worldSpace
uniform vec2 rightEyePosition;//in worldSpace
uniform vec2 mouthPosition;//in worldSpace
uniform vec2 mouthLeft;
uniform vec2 mouthRight;

uniform float mouthOpen;

uniform vec2 head_displacement;
uniform vec4 faceEllipse_ST;
uniform float swayTime;
uniform float swaySpeed;
uniform float swayAmplitude;
uniform sampler2D animationNoise;

varying float alpha;
varying vec4 debug;

float sqr(float x)
{
    return x * x;
}

float pow3(float x)
{
    return x * x * x;
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
#define MOUTH_INFLUENCE 1.3
#define MOUTH_OFFSET 0.3
#define MOUTH_ANIMATION_SCALE 0.4

#define OPEN_BLEND_LIMIT 0.8

vec3 GenerateInfluenceMasks(vec2 positionWS, vec2 blinkDir, vec2 mouthDir, float ipd, float mouthWidth)
{
    float leftEyeInfluence = 0.0;
    float rightEyeInfluence = 0.0;
    float mouthInfluence =
        1.0 - (clamp(distance(positionWS, mouthPosition + mouthDir * MOUTH_OFFSET) /
        (MOUTH_INFLUENCE * mouthWidth), 0.0, 1.0));

    return vec3(leftEyeInfluence, rightEyeInfluence, mouthInfluence);
}

void SortMouthCorners(inout vec2 mouthLeft, inout vec2 mouthRight)
{
    if(mouthLeft.x > mouthRight.x)//if left is right of right, flip em
    {
        vec2 copyLeft = mouthLeft;
        mouthLeft = mouthRight;
        mouthRight = copyLeft;
    }
}

vec2 RotateVector(vec2 inVector, float sinTheta, float cosTheta)
{
    float x2 = cosTheta * inVector.x - sinTheta * inVector.y;
    float y2 = sinTheta * inVector.x + cosTheta * inVector.y;
    return vec2(x2, y2);
}

vec2 DisplaceHead(vec2 positionOS, vec2 positionWS, float scale) {
    vec2 ellipse = (positionWS - faceEllipse_ST.zw) * faceEllipse_ST.xy;
    float ellipseDistanceSqr = clamp((sqr(ellipse.x) + sqr(ellipse.y)) * 2.0, 0.0, 1.0);
    float faceMask = 1.0 - ellipseDistanceSqr;

    vec2 animatedPositionOS = positionOS + head_displacement * faceMask * scale;
    return animatedPositionOS;
}

vec2 AnimateHeadSway(vec2 positionOS, vec2 positionWS, float scale)
{
    vec2 ellipse = (positionWS - faceEllipse_ST.zw) * faceEllipse_ST.xy;
    float ellipseDistanceSqr = clamp((sqr(ellipse.x) + sqr(ellipse.y)) * 2.0, 0.0, 1.0);
    float faceMask = 1.0 - ellipseDistanceSqr;

    float P_x = mod(swaySpeed * swayTime, 1.0);

    #if defined(GLES3)
        vec4 noiseTextureSample = textureLod(animationNoise, vec2(P_x, 0.5), 0.0);
    #else
        vec4 noiseTextureSample = texture2DLod(animationNoise, vec2(P_x, 0.5), 0.0);
    #endif

    vec2 noise = noiseTextureSample.xy * 2.0 - 1.0;
    noise *= swayAmplitude * scale;

    vec2 animatedPositionOS = positionOS + noise * faceMask;
    return animatedPositionOS;
}

vec2 AnimatePositionOS(vec2 positionOS)
{
	vec2 animatedPositionOS = positionOS;

	vec2 eyeLine = rightEyePosition - leftEyePosition;
	float ipd = length(eyeLine);
	vec2 blinkDir = vec2(eyeLine.y, -eyeLine.x);

	vec2 mouthCornerLeft = mouthLeft;
	vec2 mouthCornerRight = mouthRight;
	SortMouthCorners(mouthCornerLeft, mouthCornerRight);

	vec2 mouthLine = mouthCornerRight - mouthCornerLeft;
	float mouthWidth = length(mouthLine);
	vec2 mouthDir = vec2(mouthLine.y, -mouthLine.x);

	float sinTheta = -mouthLine.y / mouthWidth;
	float theta = asin(sinTheta);
	float cosTheta = cos(theta);

    vec2 mouthLineNormalized = mouthLine / mouthWidth;
    //gets the horizontal component of the vector from the mouth center to corner in mouth space
    float mouthWidthLeft = RotateVector((mouthCornerLeft - mouthPosition), sinTheta, cosTheta).x;
    float mouthWidthRight = RotateVector((mouthCornerRight - mouthPosition), sinTheta, cosTheta).x;

	vec2 leftPointFlat = mouthPosition + mouthLineNormalized * mouthWidthLeft;
	vec2 rightPointFlat = mouthPosition + mouthLineNormalized * mouthWidthRight;

    //assumes symmetrical mouth.  the approach used above should give closer values
	//vec2 leftPointFlat = mouthPosition - mouthLine * 0.5;
	//vec2 rightPointFlat = mouthPosition + mouthLine * 0.5;

	vec2 deltaLeftWS = mouthCornerLeft - leftPointFlat;
	vec2 deltaRightWS = mouthCornerRight - rightPointFlat;

	vec2 leftCornerOffset = RotateVector(deltaLeftWS, sinTheta, cosTheta) / mouthWidth;
	vec2 rightCornerOffset = RotateVector(deltaRightWS, sinTheta, cosTheta) / mouthWidth;

	float mouthMaskLeft = pow(clamp(-positionOS.x * 2.20, 0.0, 1.0), 1.5);//TODO
	float mouthMaskRight = pow(clamp(positionOS.x * 2.20, 0.0, 1.0), 1.5);//TODO
	animatedPositionOS +=
		leftCornerOffset * mouthMaskLeft +
		rightCornerOffset * mouthMaskRight;

	//blend to default shape around the bottom of the mouth.  Improves shape under extreme deformations
	animatedPositionOS = lerp(animatedPositionOS, position.xz, mouthOpen * color.z * 0.5);

	vec2 mouthDelta = vec2(0, mouthOpen * MOUTH_ANIMATION_SCALE);
	vec2 mouthOffset = mouthDelta;

	vec2 positionWS = (modelMatrix * vec4(animatedPositionOS.x, 0.0, animatedPositionOS.y, 1.0)).xy;
	vec3 influenceMask = GenerateInfluenceMasks(positionWS, blinkDir, mouthDir, ipd, mouthWidth);

	//animatedPositionOS.y *= 1.0 - (influenceMask.x * blinkL);
	//animatedPositionOS.y *= 1.0 - (influenceMask.y * blinkR);
	animatedPositionOS -= mouthOffset * influenceMask.z;

	float swayScale = ipd / mouthWidth;

	animatedPositionOS = AnimateHeadSway(animatedPositionOS, positionWS, swayScale);
	animatedPositionOS = DisplaceHead(animatedPositionOS, positionWS, swayScale);
	return animatedPositionOS;
}

void main()
{
    debug = vec4(0.0,0.0,0.0,0.0);
    alpha = (clamp(color.x * 1.0, 0.0, 1.0) * clamp(mouthOpen * 16.0, 0.0, 1.0));

    vec2 mouthClosedOS = vec2(uv.x - 0.5, (1.0 - uv.y) - 0.5);

    vec2 animatedPositionOS = lerp(mouthClosedOS.xy, position.xz, mouthOpen * OPEN_BLEND_LIMIT);
    //vec2 animatedPositionOS = position.xz;

    vec2 positionWS = (modelMatrix * vec4(animatedPositionOS.x, 0.0, animatedPositionOS.y, 1.0)).xy;

    animatedPositionOS = AnimatePositionOS(animatedPositionOS);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(animatedPositionOS.x, position.y, animatedPositionOS.y, 1.0);
}