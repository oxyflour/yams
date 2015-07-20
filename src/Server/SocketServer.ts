/// <reference path="../../ref/socket.io/socket.io.d.ts" />

import Utils = require('../Utils')

class SocketClient {
    id
    constructor(
        public socket: SocketIO.Socket,
        public hosting = { },
        public active = { }) {
        this.id = socket.id
    }
}

class SocketServer {
    private bootTime = Date.now()
    private serverId = this.bootTime + Math.random()

    // clientId => socket
    private clients: { [s: string]: SocketClient } = { }

    // chunkId -> clientId
    private hosts: { [s: string]: string } = { }

    private getClientIds(chunkId: string) {
        var list = [ ]
        Object.keys(this.clients).forEach(clientId => {
            var socket = this.clients[clientId]
            if (socket.active[chunkId] || socket.hosting[chunkId])
                list.push(clientId)
        })
        return list
    }

    private registerChunkHost(chunks: string[], socket: SocketClient) {
        var hostsToUpdate: { [s: string]: SocketClient } = { }

        chunks.forEach(chunkId => {
            var hostSocket = this.clients[ this.hosts[chunkId] ]
            if (hostSocket) {
                // this chunk is still active
                if (hostSocket.active[chunkId]) {
                    return
                }
                // change host to socket
                else if (hostSocket.hosting[chunkId]) {
                    delete hostSocket.hosting[chunkId]
                    hostsToUpdate[hostSocket.id] = hostSocket
                }
            }

            console.log('[H] hosting (' + chunkId + ') -> ' + (socket ? socket.id : null))
            if (socket) {
                this.hosts[chunkId] = socket.id
                socket.hosting[chunkId] = true
                hostsToUpdate[socket.id] = socket
            }
            else {
                delete this.hosts[chunkId]
            }
        })

        Object.keys(hostsToUpdate).forEach(clientId => {
            var hostSocket = hostsToUpdate[clientId]
            hostSocket.socket.emit('hosting', hostSocket.hosting)
        })
    }

    private ungisterChunkHost(chunks: string[]) {
        var hostsToUpdate: { [s: string]: SocketClient } = { }

        chunks.forEach(chunkId => {
            this.getClientIds(chunkId).forEach(clientId => {
                hostsToUpdate[clientId] = this.clients[clientId]
            })
        })

        Object.keys(hostsToUpdate).forEach(clientId => {
            var hostSocket = hostsToUpdate[clientId]
            this.registerChunkHost(Object.keys(hostSocket.active), hostSocket)
        })
    }

    private acceptNewSocket(s: SocketIO.Socket) {
        var socket = new SocketClient(s)
        this.clients[socket.id] = socket
        console.log('[C] ' + socket.id + ' connected')

        s.on('register', (data, callback) => {
            if (data && data.active) {
                socket.active = Utils.dict(data.active, true)
                this.registerChunkHost(data.active, socket)
            }
            if (callback) callback({
                serverId: this.serverId,
                serverTime: Date.now() - this.bootTime
            })
        })

        s.on('broadcast', (data, callback) => {
            var targets = data && data.chunkId && this.getClientIds('' + data.chunkId)
            if (targets && data.cmd) targets.forEach(clientId => {
                if (clientId != socket.id)
                    this.clients[clientId].socket.emit(data.cmd, data)
            })
        })

        s.on('query', (data, callback) => {
            var hostSocket = data && this.clients[ this.hosts[data.chunkId] ]
            if (hostSocket && data.cmd) {
                hostSocket.socket.emit(data.cmd, data, callback)
            }
            else if (callback) callback({
                error: 'no avaiable host to query "' + (data && data.cmd) + '"'
            })
        })

        s.on('disconnect', data => {
            delete this.clients[socket.id]
            console.log('[C] ' + socket.id + ' disconnected')
            this.ungisterChunkHost(Object.keys(socket.hosting))
        })
    }

    serve(io: SocketIO.Server) {
        io.on('connection', s => {
            this.acceptNewSocket(s)
        })
        setInterval(() => {
            this.registerChunkHost(Object.keys(this.hosts), null)
        }, 30)
    }
}

export = SocketServer