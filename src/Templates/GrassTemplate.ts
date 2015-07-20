import Utils = require('../Utils')

import BaseTemplate = require('./BaseTemplate')
import TreeTemplate = require('./TreeTemplate')

import GrassObject = require('../Objects/GrassObject')

const createParam = {
    TUNDRA:                 [0.3],
    TAIGA:                  [0.1],
    SHRUBLAND:              [0.4],
    TEMP_RAIN_FOREST:       [0.2],
    TEMP_DECIDUOUS_FOREST:  [0.4],
    GRASSLAND:              [0.8],
    TROP_RAIN_FOREST:       [0.2],
    TROP_SEASONAL_FOREST:   [0.3],
}

class GrassTemplate extends TreeTemplate {
    generateObjectsAtPos(pos: THREE.Vector2, objects: BaseTemplate.IObjects) {
        var fac = this.world.getParams(pos.x, pos.y, createParam)[0],
            height = this.world.getHeight(pos.x, pos.y)
        if (fac > Utils.nextrand(pos.x, pos.y) &&
                height > this.world.getWaterHeight()) {
            var object = <GrassObject> objects.create('GrassObject')
            object.size.y = Math.floor(Math.random() * 20) / 20 * 1 + 0.5
            object.modelUrl = Utils.randin(object.getUrls())
            object.childSize = Utils.randin([0, 1, 2, 2, 3, 4, 5, 6])
            object.setBottomPosition(pos.x, height, pos.y)
        }
    }
}

export = GrassTemplate