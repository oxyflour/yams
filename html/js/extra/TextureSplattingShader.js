// modified from http://stemkoski.github.io/Three.js/Shader-Heightmap-Textures.html
// and THREE.ShaderLib.lambert

THREE.ShaderLib.TextureSplattingDepth = {
	uniforms: THREE.ShaderLib.depthRGBA.uniforms,
	vertexShader: THREE.ShaderLib.depthRGBA.vertexShader,
	fragmentShader: THREE.ShaderLib.depthRGBA.fragmentShader
}

THREE.ShaderLib.TextureSplattingShader = {

	uniforms: THREE.UniformsUtils.merge([
		THREE.UniformsLib['common'],
		THREE.UniformsLib['fog'],
		THREE.UniformsLib['lights'],
		THREE.UniformsLib['shadowmap'],
		{
			"emissive" : { type: "c", value: new THREE.Color( 0x000000 ) },
			"wrapRGB"  : { type: "v3", value: new THREE.Vector3( 1, 1, 1 ) }
		},
		{
			texture1: { type:'t', value:null },
			texture2: { type:'t', value:null },
			texture3: { type:'t', value:null },
			texture4: { type:'t', value:null },
		}
	]),

	vertexShader: [

		"#define LAMBERT",
		"varying vec3 vLightFront;",
		"#ifdef DOUBLE_SIDED",
		"	varying vec3 vLightBack;",
		"#endif",

		"attribute vec4 splattingAlpha;",
		"varying vec4 vSplattingAlpha;",
		"varying vec2 vSplattingUv;",

		THREE.ShaderChunk[ "common" ],
		THREE.ShaderChunk[ "map_pars_vertex" ],
//		THREE.ShaderChunk[ "lightmap_pars_vertex" ],
//		THREE.ShaderChunk[ "envmap_pars_vertex" ],
		THREE.ShaderChunk[ "lights_lambert_pars_vertex" ],
		THREE.ShaderChunk[ "color_pars_vertex" ],
		THREE.ShaderChunk[ "morphtarget_pars_vertex" ],
//		THREE.ShaderChunk[ "skinning_pars_vertex" ],
		THREE.ShaderChunk[ "shadowmap_pars_vertex" ],
//		THREE.ShaderChunk[ "logdepthbuf_pars_vertex" ],

		"void main() {",

			THREE.ShaderChunk[ "map_vertex" ],
//			THREE.ShaderChunk[ "lightmap_vertex" ],
			THREE.ShaderChunk[ "color_vertex" ],

//			THREE.ShaderChunk[ "morphnormal_vertex" ],
//			THREE.ShaderChunk[ "skinbase_vertex" ],
//			THREE.ShaderChunk[ "skinnormal_vertex" ],
			THREE.ShaderChunk[ "defaultnormal_vertex" ],

//			THREE.ShaderChunk[ "morphtarget_vertex" ],
//			THREE.ShaderChunk[ "skinning_vertex" ],
			THREE.ShaderChunk[ "default_vertex" ],
//			THREE.ShaderChunk[ "logdepthbuf_vertex" ],

			THREE.ShaderChunk[ "worldpos_vertex" ],
//			THREE.ShaderChunk[ "envmap_vertex" ],
			THREE.ShaderChunk[ "lights_lambert_vertex" ],
			THREE.ShaderChunk[ "shadowmap_vertex" ],

			"vSplattingAlpha = splattingAlpha;",
			"vSplattingUv = uv * 2.0;",

		"}",
	].join('\n'),

	fragmentShader: [
		"uniform vec3 diffuse;",
		"uniform vec3 emissive;",
		"uniform float opacity;",

		"varying vec3 vLightFront;",

		"#ifdef DOUBLE_SIDED",
		"	varying vec3 vLightBack;",
		"#endif",

		"uniform sampler2D texture1;",
		"uniform sampler2D texture2;",
		"uniform sampler2D texture3;",
		"uniform sampler2D texture4;",
		"varying vec4 vSplattingAlpha;",
		"varying vec2 vSplattingUv;",

		THREE.ShaderChunk[ "common" ],
		THREE.ShaderChunk[ "color_pars_fragment" ],
		THREE.ShaderChunk[ "map_pars_fragment" ],
//		THREE.ShaderChunk[ "alphamap_pars_fragment" ],
//		THREE.ShaderChunk[ "lightmap_pars_fragment" ],
//		THREE.ShaderChunk[ "envmap_pars_fragment" ],
		THREE.ShaderChunk[ "fog_pars_fragment" ],
		THREE.ShaderChunk[ "shadowmap_pars_fragment" ],
//		THREE.ShaderChunk[ "specularmap_pars_fragment" ],
//		THREE.ShaderChunk[ "logdepthbuf_pars_fragment" ],

		"void main() {",

			"	vec3 outgoingLight = vec3( 0.0 );",	// outgoing light does not have an alpha, the surface does
			"	vec4 diffuseColor = vec4( diffuse, opacity );",

				THREE.ShaderChunk[ "logdepthbuf_fragment" ],
				THREE.ShaderChunk[ "map_fragment" ],
				THREE.ShaderChunk[ "color_fragment" ],
//				THREE.ShaderChunk[ "alphamap_fragment" ],
				THREE.ShaderChunk[ "alphatest_fragment" ],
//				THREE.ShaderChunk[ "specularmap_fragment" ],

			"	vec4 splattingColor = ",
			"		texture2D(texture1, vSplattingUv) * vSplattingAlpha.r +",
			"		texture2D(texture2, vSplattingUv) * vSplattingAlpha.g +",
			"		texture2D(texture3, vSplattingUv) * vSplattingAlpha.b +",
			"		texture2D(texture4, vSplattingUv) * vSplattingAlpha.a;",
			"	diffuseColor = mix(diffuseColor, splattingColor, splattingColor.a * 0.5);",

			"	#ifdef DOUBLE_SIDED",
					//"float isFront = float( gl_FrontFacing );",
					//"gl_FragColor.xyz *= isFront * vLightFront + ( 1.0 - isFront ) * vLightBack;",
			"		if ( gl_FrontFacing )",
			"			outgoingLight += diffuseColor.rgb * vLightFront + emissive;",
			"		else",
			"			outgoingLight += diffuseColor.rgb * vLightBack + emissive;",
			"	#else",
			"		outgoingLight += diffuseColor.rgb * vLightFront + emissive;",
			"	#endif",

//				THREE.ShaderChunk[ "lightmap_fragment" ],
//				THREE.ShaderChunk[ "envmap_fragment" ],
				THREE.ShaderChunk[ "shadowmap_fragment" ],

//				THREE.ShaderChunk[ "linear_to_gamma_fragment" ],
				THREE.ShaderChunk[ "fog_fragment" ],

			"	gl_FragColor = vec4( outgoingLight, diffuseColor.a );",	// TODO, this should be pre-multiplied to allow for bright highlights on very transparent objects
		"}",
	].join('\n'),
}
