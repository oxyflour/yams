import Utils = require('./Utils')

import BaseClient = require('./Client/BaseChunkClient');

import Objects = require('./Objects')
import ThreeCannonObject = require('./Objects/ThreeCannonObject');
import TerrainObject = require('./Objects/TerrainObject');
import PlayerObject = require('./Objects/War3Player')

import TriggerObject = require('./Objects/TriggerObject')
import TalkableObject = require('./Objects/TalkableObject')
import TerrainBrush = require('./Objects/TerrainBrush')

interface TerrainHistory {
    history: TerrainHistoryData[],
    dones: TerrainHistoryData[],
}

interface TerrainHistoryData {
    center: THREE.Vector2
    size: THREE.Vector2
    pos: THREE.Vector3
    data: { }
}

interface TerrainEffect extends TerrainObject {
    finishing: boolean
}

const SURROUND_DISTANCE = 3.1
const ACTIVE_DISTANCE = 2.1
const VISIBLE_DISTANCE = 1.1

class Client extends BaseClient {
    protected effects: Objects

    private playerObject: PlayerObject = null

    private lastActiveChunkId: string
    private switchActiveChunkDebounce = Utils.debounce(() => {
        if (!this.lastActiveChunkId) return

        var size = this.world.getChunkSize(),
            pos = this.world.getChunkPos(this.lastActiveChunkId),
            activeChunks = this.world.getChunkInCircle(pos.x, pos.y, size * ACTIVE_DISTANCE),
            visibleChunks = this.world.getChunkInCircle(pos.x, pos.y, size * VISIBLE_DISTANCE),
            surroundChunks = this.world.getChunkInCircle(pos.x, pos.y, size * SURROUND_DISTANCE)

        this.activate(activeChunks, visibleChunks)

        this.effects.cls('TerrainObject').forEach((object: TerrainEffect) => {
            if (!object.finishing) object.finishing = !!setTimeout(() => {
                object.finishing && (object.finished = true)
            }, 1000)
        })
        surroundChunks.forEach(chunkId => {
            if (this.activeChunks[chunkId]) return
            var effect: TerrainEffect
            if (effect = <TerrainEffect> this.effects.get(chunkId))
                effect.finishing = false
            else if (effect = this.effects.create('TerrainObject', chunkId))
                this.world.loadChunk(chunkId, data => effect.updateChunkData(this.world))
        })
    }, 500)

    constructor(scene: THREE.Scene) {
        super(scene)
        this.effects = new Objects(null, scene)
    }

    update(keys: PlayerObject.IKeyState) {
        if (this.playerObject)
            this.playerObject.update(keys)
    }

    render(camera: THREE.Camera) {
        var holder = camera.parent,
            chunkId = this.world &&
                this.world.getChunkId(holder.position.x, holder.position.z)

        if (this.playerObject) {
            this.playerObject.targetQuat.copy(camera.quaternion)
            holder.position.lerp(this.playerObject.position, 0.6)
        }

        if (this.lastActiveChunkId != chunkId) {
            this.lastActiveChunkId = chunkId
            this.switchActiveChunkDebounce.call(this)
        }

        this.effects.apply((effect: ThreeCannonObject) => {
            effect.render(camera)
        })
        this.effects.dispatch()

        super.render(camera)
    }

    protected initSocketEvents(socket: SocketIOClient.Socket) {
        super.initSocketEvents(socket)

        socket.on('join', (data, callback) => {
            if (!data || !data.id || !data.cls) {
                callback({ error: 'invalid argument' })
                return
            }
            var object = this.objects.get(data.id) || this.objects.create(data.cls, data.id),
                player = <PlayerObject> object,
                position = player && player.position
            if (player) {
                if (Array.isArray(data.position)) position.fromArray(data.position)
                var height = this.world.getHeight(position.x, position.z)
                player.setBottomPosition(position.x, height + player.size.y * 3, position.z)
                callback(player.sync())
            }
            else {
                callback({ error: 'join failed.' })
            }
        })

        socket.on('count-class', (data, callback) => {
            var checkChunkId = (object: ThreeCannonObject) => this.getChunkId(object) === data.chunkId
            if (data && data.cls && callback)
                callback(this.objects.cls(data.cls).filter(checkChunkId).length)
        })

        socket.on('reload-chunk', data => {
            var object = data && data.chunkId && <TerrainObject> this.objects.get(data.chunkId)
            object && object.trigger('chunk-load')
        })
    }

    protected initObjectEvents(objects: Objects) {
        super.initObjectEvents(objects)

        objects.on('get-height', (object: ThreeCannonObject,
                position: THREE.Vector3, callback: Function) => {
            position.y = this.world.getHeight(position.x, position.z)
            callback && callback(position)
        })

        this.initChunkEvents(objects)
        this.initMonsterEvents(objects)
        this.initPlayerEvents(objects)
    }

    private initChunkEvents(objects: Objects) {
        objects.on('chunk-load', (object: TerrainObject) => {
            this.world && this.world.loadChunk(object.id, data => {
                data && object.updateChunkData(this.world)
            })
        })

        objects.on('chunk-loaded', (object: TerrainObject) => {
            // set objects above the terrain
            objects.apply((obj: ThreeCannonObject) => {
                if (this.getChunkId(obj) !== object.id || obj.id === object.id) return
                var pos = obj.position,
                    height = this.world.getHeight(pos.x, pos.z)
                if ((obj.mass > 0 && pos.y - obj.size.y / 2 < height) ||
                    (obj.mass == 0 && (<Client.ChunkObject> obj).keepOnTerrain)) {
                    obj.setBottomPosition(pos.x, height, pos.z)
                    obj.body && obj.body.velocity.set(0, 0, 0)
                }
            })
            // create high detailed models when neibor chunks are ready
            this.world.getNeighborChunks(object.id).concat([object.id]).forEach(chunkId => {
                if (this.world.getNeighborChunks(chunkId).every(chunkId => {
                    var chunk = <TerrainObject> this.objects.get(chunkId)
                    return !!(chunk && chunk.chunkData)
                })) {
                    var chunk = <TerrainObject> this.objects.get(chunkId)
                    chunk && chunk.updateChunkModel()
                }
            })
        })

        objects.on('update-terrain', (object: TerrainObject,
                data: TerrainBrush.BrushParameters) => {
            var min = data.box.min,
                max = data.box.max,
                innerRadius = data.radius,
                outerRadius = innerRadius * (1 + data.padding),

                last = { },
                now = { },
                center = new THREE.Vector2(
                    (min.x + max.x) / 2,
                    (min.z + max.z) / 2),
                size = new THREE.Vector2(
                    max.x - min.x + outerRadius * 2,
                    max.z - min.z + outerRadius * 2)

            if (!Object
                .keys(this.world.updateHeight(center.x, center.y, size.x, size.y))
                .every(chunkId => !!this.objects.get(chunkId)))
                return console.warn('[C] the terrain brush is too large!')

            var chunks = this.world.updateHeight(
                    center.x, center.y, size.x, size.y,
                    (x, y, h): number => {
                        var k = x + '_' + y
                        last[k] = h
                        data.path.forEach(p => {
                            var r = Utils.hypot(p.x - x, p.z - y),
                                f = Utils.smoothstep(innerRadius, outerRadius, r),
                                k = Utils.lerp(p.y, h, f)
                            h = Utils.lerp(h, k, data.alpha)
                        })
                        now[k] = h
                        return h
                    })

            var hist: TerrainHistory = object['terrainEditHistory'] ||
                    (object['terrainEditHistory'] = {
                        history: [],
                        dones: [],
                    })
            hist.history.push({
                center: center,
                size: size,
                pos: data.begin.clone(),
                data: last,
            })
            hist.dones = [{
                center: center,
                size: size,
                pos: object.position.clone(),
                data: now,
            }]

            Object.keys(chunks).forEach(chunkId => {
                var chunkObject = <TerrainObject> this.objects.get(chunkId)
                chunkObject.updateChunkData(this.world)
                this.world.saveChunk(chunkId, chunks[chunkId], (err, res) => {
                    this.socket.broadcast('reload-chunk', chunkId)
                })
            })
        })

        objects.on('undo-redo-update-terrain', (object: TerrainObject,
                undo: boolean) => {
            var hist: TerrainHistory = object['terrainEditHistory']
            if (!hist) return

            var last: TerrainHistoryData
            if (undo && hist.history.length &&
                    (last = hist.history.pop()))
                hist.dones.unshift(last)
            else if (!undo && hist.dones.length > 1 &&
                    (last = hist.dones[1]))
                hist.history.push(hist.dones.shift())
            if (!last) return

            var center = last.center,
                size = last.size
            if (!Object
                .keys(this.world.updateHeight(center.x, center.y, size.x, size.y))
                .every(chunkId => !!this.objects.get(chunkId)))
                return console.warn('[C] the terrain brush is too large!')

            object.updateBody(last.pos, null)

            var chunks = this.world.updateHeight(
                    last.center.x, last.center.y,
                    last.size.x, last.size.y,
                    (x, y, h): number => {
                        var n = last.data[x + '_' + y]
                        return +n === n ? n : h
                    })

            Object.keys(chunks).forEach(chunkId => {
                var chunkObject = <TerrainObject> this.objects.get(chunkId)
                chunkObject.updateChunkData(this.world)
                this.world.saveChunk(chunkId, chunks[chunkId], (err, res) => {
                    this.socket.broadcast('reload-chunk', chunkId)
                })
            })
        })
    }

    private initPlayerEvents(objects: Objects) {
        objects.on('player-update', (object: ThreeCannonObject) => {
            var chunkId = this.getChunkId(object)
            if (!this.playerObject || this.playerObject.id !== object.id) return
            this.socket && this.socket.broadcast('sync', chunkId,
                this.getObjectSyncData(object))
        })

        objects.on('player-trigger', (object: ThreeCannonObject) => {
            if (!this.playerObject || this.playerObject.id !== object.id) return
            // TODO:
        })

        objects.on('player-attack', (object: ThreeCannonObject) => {
            if (!this.playerObject || this.playerObject.id !== object.id) return
            // TODO:
        })

        objects.on('player-use', (object: ThreeCannonObject, objectIds: string[]) => {
            if (!this.playerObject || this.playerObject.id !== object.id) return
            objectIds.some(id => {
                var obj = this.objects.get(id),
                    objc = <ThreeCannonObject> obj
                if (!obj) {
                    return
                }
                var trigger = <TriggerObject> obj
                if (trigger.triggerEvent) {
                    this.trigger('player-use', result => {
                        console.log(result)
                    })
                    return true
                }
                var talkable = <TalkableObject> obj
                if (talkable.canTalk) {
                    talkable.isTalking = true
                    talkable.lookAt(object.position.x,
                        talkable.position.y, object.position.z)
                    this.trigger('player-talk', result => {
                        talkable.isTalking = false
                    })
                    this.socket.broadcast('sync', this.getChunkId(objc),
                        this.getObjectSyncData(objc))
                    return true
                }
            })
        })
    }

    private initMonsterEvents(objects: Objects) {
        objects.on('monster-think', (object: ThreeCannonObject) => {
            var chunkId = this.getChunkId(object)
            if (!this.hostingChunks[chunkId]) return
            var r = Math.random(),
                s: Utils.StateMachine = object['state']
            if (r > 0.5) {
                if (object.body && s.get() !== s.get('WalkingState')) {
                    var q = object.body.quaternion,
                        a = (Math.random() - 0.5) * 2
                    q.mult(new CANNON.Quaternion().setFromEuler(0, a, 0), q)
                }
                s.set('WalkingState')
            }
            else {
                s.set('IdleState')
            }
            this.socket.broadcast('sync', chunkId,
                this.getObjectSyncData(object))
        })

        objects.on('monster-respawn', (object: ThreeCannonObject) => {
            var chunkId = this.getChunkId(object)
            if (!this.hostingChunks[chunkId]) return
            var pos = object.position,
                size = this.world.getChunkSize(),
                chunkIds = this.world.getChunkInCircle(pos.x, pos.z, size * 2.1),
                count = 0
            Utils.batch(chunkIds.map(chunkId => {
                return next => {
                    this.socket.query('count-class', chunkId, {
                        cls: 'War3AnimalAny'
                    }, data => {
                        if (data > 0)
                            count += data
                        next()
                    })
                }
            }), result => {
                if (count > 3) return
                var monster: ThreeCannonObject = this.objects.create('War3AnimalAny'),
                    type = Utils.randin(['Sheep', 'Pig']),
                    size = 1
                monster.modelUrl = 'models/w3/' + type + '.w3m'
                monster.size.set(size, size, size)
                monster.position.copy(object.position)
                monster.position.y += monster.size.y * 2
                monster.setEuler(0, Math.random()*Math.PI*2, 0)
            })
        })
    }

    joinGame(data: any) {
        if (!data.id || this.objects.get(data.id)) return
        this.socket && this.socket.query('join', this.lastActiveChunkId, data, res => {
            if (res.error) {
                console.warn('[C] join game failed: ' + res.error)
            }
            else {
                this.playerObject = this.objects.get(res.id) ||
                    this.objects.create(res.cls, res.id)
                this.playerObject.sync(res, 0)
                console.log('[C] join game ok!')
            }
        })
    }

    commitObject(id: string) {
        var object = <ThreeCannonObject> this.objects.get(id),
            chunkId = this.getChunkId(object)
        if (object) {
            this.socket.broadcast('sync', chunkId,
                this.getObjectSyncData(object))
        }
    }

    saveChunks(callback: Function) {
        Utils.batch(Object.keys(this.hostingChunks).map(chunkId => {
            return next => {
                this.world.saveData(chunkId + '/objects',
                    this.getChunkObjectsData(chunkId), <any> next)
            }
        }), callback)
    }
}

module Client {
    export interface ChunkObject extends BaseClient.ChunkObject {
        uiUneditable: boolean
        keepOnTerrain: boolean
        visibleGodModeOnly: boolean
    }
}

export = Client
