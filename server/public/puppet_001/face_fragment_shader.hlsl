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

