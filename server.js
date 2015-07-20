var express = require('express'),
    app = express(),
    srv = require('http').Server(app),
    io = require('socket.io')(srv)

var config = {
    port: 18080,
    html: 'html', 	// html assets path
    world: 'world', // world database path
    story: 'story', // story assets path
}

app.use(require('body-parser').json())
    .use(express.static(__dirname + '/' + config.html))

srv.listen(config.port)

var socket = require('./build/Server/SocketServer'),
	world = require('./build/Server/WorldServer'),
	story = require('./build/Server/StoryServer')

new socket().serve(io)

new world(config.world).serve(app)

new story(config.story).serve(app)

console.log('[S] listening at port ' + config.port)

// for livereloading
require('fs').watch('html/js/build/date.txt', function(event, file) {
    io.emit('reload')
})
