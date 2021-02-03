uniform vec2 resolution;

uniform vec3 mouthColor;
uniform vec3 lipsColor;
uniform vec2 mouthPosition;//in worldSpace
uniform vec2 mouthLeft;
uniform vec2 mouthRight;
uniform float lipsThickness;
varying float alpha;
varying vec4 debug;
varying vec4 localPos;
varying vec2 st;
void main()
{
    //float distance = distance(debug.xy, mouthLeft) * 1.0;
    gl_FragColor = vec4(mouthColor, alpha);
    vec2 uv = localPos.xz;
    uv.y += 1.;
    float c = smoothstep(0.3 + lipsThickness, 0.31 + lipsThickness, uv.y);
    gl_FragColor.rgb = mix(mouthColor, vec3(0.5), 1.0 - c);
    c = smoothstep(0.56 + lipsThickness, 0.6 + lipsThickness, (st.y - pow(st.x * 1.4, 2.0)) + 1.0);
    gl_FragColor.rgb = mix(mouthColor, lipsColor, 1.0 - c);
    //gl_FragColor.rgb = vec3(1. - c);
    //gl_FragColor.rgb = vec3(st.x+0.5);
    //gl_FragColor.rgb = vec3(c);
    //gl_FragColor = vec4(c,c,c,1.);
    //gl_FragColor = vec4(alpha, alpha, alpha, 1.0);
    //gl_FragColor = vec4(distance, distance, distance, 1.0);
    //gl_FragColor = vec4(debug.x, debug.y, debug.z, alpha);
}
