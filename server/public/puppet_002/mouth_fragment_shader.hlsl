	uniform vec2 resolution;
	uniform vec3 mouthColor;

    uniform vec2 mouthPosition;//in worldSpace
	uniform vec2 mouthLeft;
	uniform vec2 mouthRight;
	
	varying float alpha;
	varying vec4 debug;
	
	void main()
	{		
		//float distance = distance(debug.xy, mouthLeft) * 16.0;

		gl_FragColor = vec4(mouthColor, alpha);
		//gl_FragColor = vec4(alpha, alpha, alpha, 1.0);
		//gl_FragColor = vec4(distance, distance, distance, 1.0);
		//gl_FragColor = vec4(debug.x, debug.y, debug.z, alpha);
	}