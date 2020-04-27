uniform vec2 resolution;//set from game code, controls clip coordinates probably
varying float alpha;

void main()
{
    vec3 mouthColor = vec3(0.783, 0.543, 0.543);//TODO

    gl_FragColor = vec4(alpha, alpha, alpha, 1.0);
}
