import Utils = require('../Utils')

import BaseObject = require('./BaseObject')

class BaseChunkObject extends BaseObject {
    static chunkManager: Utils.ChunkWorld

    private _chunkId: string
    private lastPosition = new THREE.Vector3(Infinity)

    position = new THREE.Vector3()

    get chunkId(): string {
        if (!this.lastPosition.equals(this.position)) {
            this.lastPosition.copy(this.position)
            this._chunkId = BaseChunkObject.chunkManager
                .getChunkId(this.position.x, this.position.z)
        }
        return this._chunkId
    }

    // useful attributes
    dontSyncInChunk: boolean
    uiUneditable: boolean
    keepOnTerrain: boolean
    keepVisibleInChunk: boolean
    visibleGodModeOnly: boolean
}

export = BaseChunkObject
