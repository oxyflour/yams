rm -r build/*
tsc --target es5 --outDir build --module commonjs src/*.ts src/**/*.ts && \
mkdir -p html/js/build && \
browserify client.js \
	-x socket.io-client \
	-x superagent \
	-x nedb \
	-x noisejs \
	-x three \
	-x cannon \
	-x jsdom \
	-x crc-32 \
	-x html/js/loaders/ColladaLoader.js \
	-o html/js/build/client.js && \
cp node_modules/superagent/superagent.js	html/js/build/ && \
cp node_modules/cannon/build/cannon.min.js	html/js/build/ && \
cp node_modules/cannon/tools/threejs/CannonDebugRenderer.js html/js/build && \
cp node_modules/noisejs/index.js			html/js/build/noise.js && \
cp node_modules/three/three.js				html/js/build/ && \
cp node_modules/crc-32/crc32.js				html/js/build/ && \
date > html/js/build/date.txt
