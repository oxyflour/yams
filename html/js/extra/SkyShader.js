// http://threejs.org/examples/webgl_materials_lightmap.html
THREE.ShaderLib.Sky = {
	uniforms: THREE.UniformsUtils.merge([
		THREE.UniformsLib['fog'],
		{
			color:     { type:'c', value:new THREE.Color( 0x2299ff ) },
			fogTop:    { type:'f', value:2500 },
			fogBottom: { type:'f', value:0 },
		}
	]),

	vertexShader: [
		"varying float vHeight;",

		"void main() {",

			"vHeight = position.y;",

			"vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}",
	].join('\n'),

	fragmentShader: [
		"uniform vec3 color;",
		"uniform float fogTop;",
		"uniform float fogBottom;",

		"varying float vHeight;",

		THREE.ShaderChunk[ "fog_pars_fragment" ],

		"void main() {",

			"gl_FragColor = vec4( color, 1.0 );",

			"#ifdef USE_FOG",
				"#ifdef USE_LOGDEPTHBUF_EXT",
					"float depth = gl_FragDepthEXT / gl_FragCoord.w;",
				"#else",
					"float depth = gl_FragCoord.z / gl_FragCoord.w;",
				"#endif",
				"#ifdef FOG_EXP2",
					"const float LOG2 = 1.442695;",
					"float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );",
					"fogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );",
				"#else",
					"float fogFactor = smoothstep( fogNear, fogFar, depth );",
				"#endif",

				"fogFactor *= smoothstep( fogTop, fogBottom, vHeight );",

				"gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor);",
			"#endif",

		"}",
	].join('\n'),
}