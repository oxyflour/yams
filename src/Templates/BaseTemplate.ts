import Utils = require('../Utils')
import BaseObject = require('../Objects/BaseObject')

class BaseTemplate {
    constructor(
        public chunkId: string,
        public world: BaseTemplate.IWorld,
        public data: any) {
    }

    updateHeight(x: number, y: number, h: number): number {
        return h
    }

    generateObjects(objects: BaseTemplate.IObjects) {

    }
}

module BaseTemplate {
    export interface IObjects {
        create(cls: string): BaseObject
        list(): BaseObject[]
    }
    export interface IWorld extends Utils.ChunkWorld {
        getSeed(): number
        getWaterHeight(): number
        getHeight(x: number, y: number): number
        getParams(x: number, y: number, p: any): number[]
    }
}

export = BaseTemplate