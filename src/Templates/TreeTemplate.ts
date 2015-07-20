import Utils = require('../Utils')

import BaseTemplate = require('./BaseTemplate')

import TreeObject = require('../Objects/TreeObject')

const createParam = {
    TAIGA:                    [0.4],
    SHRUBLAND:                [0.1],
    TEMP_RAIN_FOREST:         [0.7],
    TEMP_DECIDUOUS_FOREST:    [0.5],
    TROP_RAIN_FOREST:         [0.9],
    TROP_SEASONAL_FOREST:     [0.5],
}

interface TreeTemplateParams {
    dencity: number
    seed: number
}

class TreeTemplate extends BaseTemplate {
    data: TreeTemplateParams

    static createLoader(data: TreeTemplateParams) {
        var constructor = this
        return (chunkId: string, world: BaseTemplate.IWorld, callback: (list: BaseTemplate[]) => void) => {
            callback([ new constructor(chunkId, world, data) ])
        }
    }

    static getRandomPoints(seed: number, chunkId: string,
            world: BaseTemplate.IWorld, count: number): THREE.Vector2[] {
        var list = [ ],
            size = world.getChunkSize(),
            p = world.getChunkPos(chunkId)
        for (var i = 0; i < count; i ++) {
            var x = p.x + (Utils.nextrand(p.y, seed, i + 1) - 0.5) * size,
                y = p.y + (Utils.nextrand(p.x, seed, i + 2) - 0.5) * size
            list.push(new THREE.Vector2(x, y))
        }
        return list
    }

    generateObjects(objects: BaseTemplate.IObjects) {
        var size = this.world.getChunkSize(),
            pts = TreeTemplate.getRandomPoints(this.world.getSeed() + this.data.seed,
                this.chunkId, this.world, this.data.dencity * size * size || 1)
        pts.forEach(pt => {
            this.generateObjectsAtPos(pt, objects)
        })
    }

    generateObjectsAtPos(pos: THREE.Vector2, objects: BaseTemplate.IObjects) {
        var fac = this.world.getParams(pos.x, pos.y, createParam)[0],
            height = this.world.getHeight(pos.x, pos.y)
        if (fac > Utils.nextrand(pos.x, pos.y) &&
                height > this.world.getWaterHeight()) {
            var object = <TreeObject> objects.create('TreeObject')
            object.size.y = Math.floor(Math.random() * 20) / 20 * 10 + 3
            object.modelUrl = Utils.randin(object.getUrls())
            object.setBottomPosition(pos.x, height, pos.y)
        }
    }
}

export = TreeTemplate