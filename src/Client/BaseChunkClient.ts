/// <reference path="../../ref/socket.io-client/socket.io-client.d.ts" />

import Utils = require('../Utils')
import World = require('../World')
import Objects = require('../Objects')

import ThreeCannonObject = require('../Objects/ThreeCannonObject')
import TerrainObject = require('../Objects/TerrainObject')

class Clock {
    private ticks = 0
    sync(newTick) {
        if (this.ticks - newTick > 500 || newTick - this.ticks > 500)
            console.log('[C] adjusting local clock from ' + this.ticks + ' to ' + newTick)
        return this.ticks = newTick
    }
    run(dt) {
        return this.ticks += dt
    }
    now() {
        return this.ticks
    }
}

class Fps {
    private array = new Array(60)
    private index = 0
    update() {
        this.index = (this.index + 1) % this.array.length
        this.array[this.index] = Date.now()
    }
    get() {
        var next = (this.index + 1) % this.array.length
        return 1000 * (this.array.length - 1) / (this.array[this.index] - this.array[next])
    }
}

class ExtendedSocket {
    query(cmd: string, chunkId: string, data: any = null,
            callback: Function = undefined) {
        data = data || { }
        data.cmd = cmd
        data.chunkId = chunkId
        this.emit('query', data, callback)
    }
    broadcast(cmd: string, chunkId: string, data: any = null,
            callback: Function = undefined) {
        data = data || { }
        data.cmd = cmd
        data.chunkId = chunkId
        this.emit('broadcast', data, callback)
    }
    static fromSocket(s: SocketIOClient.Socket): ExtendedSocket {
        'query,broadcast'.split(',').forEach(key => {
            s[key] = ExtendedSocket.prototype[key]
        })
        return <ExtendedSocket> s
    }
    // these will never be used
    on(event: string, fn: Function): SocketIOClient.Socket { return null }
    once(event: string, fn: Function): SocketIOClient.Socket { return null }
    off(event?: string, fn?: Function): SocketIOClient.Socket { return null }
    emit(event: string, ...args: any[]): SocketIOClient.Socket { return null }
    listeners(event: string): Function[] { return null }
    hasListeners(event: string): boolean { return null }
    connected: boolean;
}

interface BaseChunkObject extends ThreeCannonObject {
    _chunkId: string
    _lastPosition: THREE.Vector3
}

class Client {
    protected objects: Objects

    protected world: World
    protected socket: ExtendedSocket

    protected hostingChunks  = { }
    protected activeChunks   = { }
    protected visibleChunks  = { }

    private scene: THREE.Scene
    private physics: CANNON.World

    private fps = new Fps()
    private clock = new Clock()

    private serverId = ''

    private useDebugRenderer = false
    private debugRenderer = null

    protected initPhysics(physics: CANNON.World) {
        physics.gravity.set(0, -10, 0)

        var groundMaterial = new CANNON.Material("groundMaterial"),
            groundContactMaterial = new CANNON.ContactMaterial(
                groundMaterial,
                groundMaterial,
                {
                    friction: 0,
                    restitution: 0.01
                })
        physics.addContactMaterial(groundContactMaterial)
        physics['groundMaterial'] = groundContactMaterial

        physics.doProfiling = true

        return physics
    }

    protected initSocketEvents(socket: SocketIOClient.Socket) {
        socket.on('hosting', data => {
            Object.keys(this.hostingChunks).forEach(chunkId => {
                if (!data[chunkId]) this.world.saveData(chunkId + '/objects',
                    this.getChunkObjectsData(chunkId))
            })
            Object.keys(data).forEach(chunkId => {
                if (!this.hostingChunks[chunkId])
                    this.loadChunkObjects(chunkId)
            })
            this.hostingChunks = data
            console.log('[H] hosting ' + Object.keys(data).length + ' chunks')
        })

        socket.on('sync', data => {
            if (data) this.syncObjectWithData(data)
        })

        socket.on('fetch', (data, callback) => {
            if (data && data.chunkId)
                callback(this.getChunkObjectsData(data.chunkId))
        })

        socket.on('reload', data => {
            global.location && location.reload()
        })
    }

    protected initObjectEvents(objects: Objects) {
        objects.on('attached dettached', (object: ThreeCannonObject) => {
            var chunkId = this.getChunkId(object)
            if (!this.hostingChunks[chunkId]) return
            this.socket && this.socket.broadcast('sync', chunkId,
                this.getObjectSyncData(object))
        })

        objects.on('sync', (object: ThreeCannonObject, method: string) => {
            // TODO: access control
            var chunkId = this.getChunkId(object)
            this.socket && this.socket.broadcast('sync', chunkId,
                this.getObjectSyncData(object, method))
        })
    }

    protected getChunkId(object: ThreeCannonObject): string {
        var obj = <BaseChunkObject> object
        if (!obj._lastPosition) {
            obj._lastPosition = new THREE.Vector3(Infinity)
        }
        if (!obj._lastPosition.equals(obj.position)) {
            obj._lastPosition.copy(obj.position)
            obj._chunkId = this.world.getChunkId(obj.position.x, obj.position.z)
        }
        return obj._chunkId
    }

    protected getChunkObjectsData(chunkId: string) {
        var list = [ ]
        this.objects.apply((object: ThreeCannonObject) => {
            if (this.getChunkId(object) === chunkId &&
                !(<Client.ChunkObject> object).dontSyncInChunk)
                list.push(object.sync())
        })
        return {
            objects: list,
            hostTime: this.clock.now(),
        }
    }

    protected syncChunkObjectData(data: any) {
        if (Array.isArray(data.objects)) data.objects.forEach(objectData => {
            if (!objectData) return
			var object = this.objects.get(objectData.id) ||
                this.objects.create(objectData.cls, objectData.id)
            if (object)
		         object.sync(objectData, this.clock.now() - data.hostTime)
		})
    }

    protected getObjectSyncData(object: ThreeCannonObject, method?: string) {
        method = object[method] ? method : 'sync'
        return object.finished ? {
            id: object.id,
            finished: true,
        } : {
            id: object.id,
            cls: object.cls,
            method: method,
            syncData: object[method](),
            hostTime: this.clock.now(),
        }
    }

    protected syncObjectWithData(data: any) {
        var object = this.objects.get(data.id)
        if (data.finished) {
            if (object)
                object.finished = true
        }
        else {
            if (!object)
                object = this.objects.create(data.cls, data.id)
            if (object && object[data.method])
                object[data.method](data.syncData, this.clock.now() - data.hostTime)
        }
    }

    private loadChunkObjects(chunkId: string) {
        if (this.hostingChunks[chunkId]) return
        this.socket.query('fetch', chunkId, { }, data => {
            if (data && data.objects && data.objects.length) {
                console.log(`[C] fetched ${data.objects.length} objects @${chunkId}`)
                this.syncChunkObjectData(data)
            }
            else this.world.loadData(chunkId + '/objects', data => {
                if (data && data.objects && data.objects.length) {
                    console.log(`[C] loaded ${data.objects.length} objects @${chunkId}`)
                    this.syncChunkObjectData(data)
                }
                else if (this.hostingChunks[chunkId]) {
                    console.log(`[C] creating objects @${chunkId}`)
                    this.world.createChunkObjects(chunkId, this.objects, () => {
                        var objectData = this.getChunkObjectsData(chunkId)
                        this.world.saveData(chunkId + '/objects', objectData)
                    })
                }
                else {
                    console.log(`[C] @${chunkId} seems not ready`)
                }
            })
        })
    }

    private renderObject(object: ThreeCannonObject, camera: THREE.Camera) {
        if ((<Client.ChunkObject> object).keepVisibleInChunk)
            return object.render(camera)

        var chunkId = this.getChunkId(object)
        // only render visible objects
        if (this.visibleChunks[chunkId])
            object.render(camera)
        else if (object.model)
            object.resetModel()
    }

    private runObject(object: ThreeCannonObject, dt: number) {
        var chunkId = this.getChunkId(object)
        // only render active objects
        if (this.activeChunks[chunkId] ||
            this.hostingChunks[chunkId])
            object.run(dt)
        else
            object.finished = true
    }

    constructor(scene: THREE.Scene) {
        this.scene = scene
        this.physics = new CANNON.World()
        this.initPhysics(this.physics)
        this.objects = new Objects(this.physics, this.scene)
        this.initObjectEvents(this.objects)
        if (this.useDebugRenderer)
            this.debugRenderer = new (THREE['CannonDebugRenderer'])(this.scene, this.physics)
    }

    connect(worldUrl: string = undefined, socketUrl: string = undefined) {
        this.trigger('client-connecting')
        Utils.batch([
            next => {
                World.connect(worldUrl, world => {
                    if (this.world) return next()
                    TerrainObject.chunkManager = this.world = world
                    console.log('[C] connected to world server')
                    next()
                })
            },
            next => {
                var s = io.connect(socketUrl)
                s.on('connect', () => {
                    if (this.socket) return next()
                    this.initSocketEvents(this.socket = ExtendedSocket.fromSocket(s))
                    console.log('[C] connected to socket server')
                    next()
                })
            }
        ], result => {
            this.trigger('client-connected')
        })
    }

    run(dt: number) {
        this.clock.run(dt)
        this.physics.step(10 / 1000, dt / 1000, 10)

        this.objects.apply(object => {
            this.runObject(object, dt)
        })

        this.objects.dispatch()
    }

    render(camera: THREE.Camera) {
        if (this.debugRenderer) {
            this.debugRenderer.update()
        }

        this.objects.apply((object: ThreeCannonObject) => {
            this.renderObject(object, camera)
        })

        this.fps.update()
    }

    activate(activeChunks: string[], visibleChunks: string[]) {
        this.activeChunks  = Utils.dict(activeChunks, true)
        this.visibleChunks = Utils.dict(visibleChunks, true)

        this.socket && this.socket.emit('register', {
            active: activeChunks
        }, data => {
            this.trigger('client-active', activeChunks)
            activeChunks.forEach(chunkId => this.loadChunkObjects(chunkId))
        })
    }

    trigger(evt: string, data = null) {
        // this function can be overriden
        global.$ && (global.$)(global.document).trigger(evt, data)
    }

    ping() {
        var now = Date.now(),
            hostTime = this.clock.now()
        this.socket && this.socket.emit('register', null, data => {
            if (!data || !data.serverTime) return

            var delta = this.clock.now() - hostTime,
                profile = this.physics.profile
            this.clock.sync(data.serverTime + Math.floor(delta / 2))
            this.trigger('client-statics', {
                serverId: data.serverId,
                ping: Date.now() - now,
                fps: this.fps.get(),
                physics: profile.narrowphase +
                    profile.broadphase +
                    profile.solve +
                    profile.integrate +
                    profile.makeContactConstraints,
                objects: this.objects.length,
                models: this.scene.children.length,
                bodies: this.physics.bodies.length,
            })

            if (!this.serverId)
                this.serverId = data.serverId
            else if (this.serverId !== data.serverId)
                global.location && location.reload()
        })
    }
}

module Client {
    export interface ChunkObject extends ThreeCannonObject {
        dontSyncInChunk: boolean
        keepVisibleInChunk: boolean
    }
}

export = Client