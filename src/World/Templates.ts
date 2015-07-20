import Utils = require('../Utils')

import BaseTemplate = require('../Templates/BaseTemplate')
import TreeTemplate = require('../Templates/TreeTemplate')
import GrassTemplate = require('../Templates/GrassTemplate')
import ColladaTemplate = require('../Templates/ColladaTemplate')
import ChunkTemplate = require('../Templates/ChunkTemplate')

// TODO: move this to a seperate file
import TimerObject = require('../Objects/TimerObject')
class MonsterSpawnerTemplate extends ChunkTemplate {
    generateObjects(objects: BaseTemplate.IObjects) {
        var object = <TimerObject> objects.create('TimerObject'),
            pos = this.world.getChunkPos(this.chunkId)
        object.setBottomPosition(pos.x, this.world.getHeight(pos.x, pos.y), pos.y)
        object.timerEvent = 'monster-respawn'
        object.timerInterval = 10000
    }
}

// TODO: move this to a seperate file
import TriggerObject = require('../Objects/TriggerObject')
class SimpleTriggerTemplate extends ChunkTemplate {
    generateObjects(objects: BaseTemplate.IObjects) {
        var object = <TriggerObject> objects.create('TriggerObject'),
            seed = this.world.getSeed() + Math.random(),
            pos = TreeTemplate.getRandomPoints(seed, this.chunkId, this.world, 1)[0]
        object.setBottomPosition(pos.x, this.world.getHeight(pos.x, pos.y), pos.y)
        object.triggerEvent = 'simple-trigger'
    }
}

// TODO: load these templates from somewhere
var loaders = [
    TreeTemplate.createLoader({
        dencity: 0.005,
        seed: 1
    }),
    GrassTemplate.createLoader({
        dencity: 0.005,
        seed: 2
    }),
    /*
    ColladaTemplate.createLoader({
        url: 'models/monster.dae',
        scale: 0.01,
        zUp: true,
        x: 10,
        y: 10,
        padding: 10
    }),
    */
    MonsterSpawnerTemplate.createLoader({
        chunkIds: ['+1x+0']
    }),
    SimpleTriggerTemplate.createLoader({
        chunkIds: ['+0x+1']
    }),
]

class Templates {
    constructor(public world: BaseTemplate.IWorld) {
    }

    load(chunkId: string, callback: (list: BaseTemplate[]) => void) {
        var temps: BaseTemplate[] = [ ]
        Utils.batch(loaders.map(loader => {
            return next => {
                loader(chunkId, this.world, newTemps => {
                    if (newTemps && newTemps.length)
                        temps = temps.concat(newTemps)
                    next()
                })
            }
        }), () => {
            callback(temps)
        })
    }
}

export = Templates
