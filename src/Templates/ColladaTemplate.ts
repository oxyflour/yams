import Utils = require('../Utils')
import ColladaObject = require('../Objects/ColladaObject')

import BaseTemplate = require('./BaseTemplate')

var Loader = THREE['ColladaLoader']

var queue = Utils.sequence(),
    loader = new Loader(),
    cache = { }

function loadCollada(url: string, callback: (any) => void) {
    queue(next => {
        if (cache[url]) {
            callback(cache[url])
            next()
        }
        else loader.load(url, collada => {
            callback(cache[url] = collada)
            next()
        })
    })
}

interface ColladaTemplateParams {
    url: string
    x: number
    y: number
    
    chunkId?: string
    padding?: number
    scale?: number
    zUp?: boolean

    box?: THREE.Box3
    scene?: THREE.Object3D
}

class ColladaTemplate extends BaseTemplate {
    data: ColladaTemplateParams

    static createLoader(data: ColladaTemplateParams) {
        return (chunkId: string, world: BaseTemplate.IWorld, callback: (list: BaseTemplate[]) => void) => {
            var pos = world.getChunkPos(chunkId),
                v1 = new THREE.Vector2(pos.x, pos.y),
                v2 = new THREE.Vector2(data.x, data.y)
            if (v1.distanceTo(v2) > 100) {
                callback(null)
            }
            else loadCollada(data.url, collada => {
                this.loadTemplatesFromCollada(chunkId, world,
                    collada, data, callback)
            })
        }
    }

    static loadTemplatesFromCollada(chunkId: string, world: BaseTemplate.IWorld,
            collada: any, data: ColladaTemplateParams,
            callback: (list: BaseTemplate[]) => void) {
        var scene = collada.scene.clone(),
            scale = data.scale || 1,
            padding = data.padding || 0,
            pos = world.getChunkPos(chunkId)

        if (data.zUp)
            scene.quaternion.setFromEuler(new THREE.Euler(-Math.PI/2, 0, 0))
        scene.position.set(data.x, world.getHeight(data.x, data.y), data.y)
        scene.scale.set(scale, scale, scale)

        var box = new THREE.Box3().setFromObject(scene)
        box.min.x -= padding
        box.max.x += padding
        box.min.z -= padding
        box.max.z += padding

        var hw = world.getChunkSize() / 2,
            chunkBox = new THREE.Box3(
                new THREE.Vector3(pos.x - hw, -1/0, pos.y - hw),
                new THREE.Vector3(pos.x + hw,  1/0, pos.y + hw)),
            constructor: any = this

        callback(box.isIntersectionBox(chunkBox) && [
            new constructor(chunkId, world, {
                chunkId: chunkId,
                url: data.url,
                zUp: data.zUp,
                padding: padding,
                box: box,
                scene: scene,
            })
        ])
    }

    updateHeight(x: number, y: number, h: number) {
        var data = this.data,
            min = data.box.min,
            max = data.box.max,
            padding = data.padding || 0,
            height = data.scene.position.y

        if (min.x < x && x < max.x && min.z < y && y < max.z) {
            var fx = Utils.smoothstep(min.x, min.x + padding, x) -
                     Utils.smoothstep(max.x - padding, max.x, x),
                fy = Utils.smoothstep(min.z, min.z + padding, y) -
                     Utils.smoothstep(max.z - padding, max.z, y)
            return Utils.lerp2(h, h, h, height, fx, fy)
        }

        return h
    }

    generateObjects(objects: BaseTemplate.IObjects) {
        var data = this.data,
            scene: THREE.Object3D = data.scene

        scene.updateMatrixWorld(true)
        scene.children.forEach((model, index) => {
            var pos = model.getWorldPosition()
            if (this.world.getChunkId(pos.x, pos.z) === data.chunkId) {
                var box = new THREE.Box3().setFromObject(model)
                if (box.max.y > box.min.y) {
                    var object = <ColladaObject> objects.create('ColladaObject')
                    object.size.copy(box.max).sub(box.min)
                    object.zUp = data.zUp
                    object.modelUrl = data.url
                    object.colladaIndex = index
                    object.position.set(pos.x, (box.min.y+box.max.y)/2, pos.z)
                }
                else {
                    console.warn('[H] ignoring dae model "' + model.name + '"')
                }
            }
        })
    }
}

export = ColladaTemplate