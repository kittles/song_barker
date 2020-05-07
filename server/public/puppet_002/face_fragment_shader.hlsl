uniform vec2 resolution;
uniform sampler2D petImage;
varying vec2 uvCoords;
varying vec4 debug;

void main()
{
    vec4 color = texture2D(petImage, uvCoords);
    //color = debug;

    gl_FragColor = vec4(color.xyz, 1.0);
}