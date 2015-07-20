import ThreeCannonObject = require('./ThreeCannonObject')

class ColladaObject extends ThreeCannonObject {
    zUp = false
    colladaIndex = 0

    static syncs = ThreeCannonObject.syncs.concat([
        ThreeCannonObject.createSimpleSyncFn('modelUrl'),
        ThreeCannonObject.createSimpleSyncFn('zUp'),
        ThreeCannonObject.createSimpleSyncFn('colladaIndex'),
        ThreeCannonObject.createTHREEArraySyncFn('size'),
    ])

    cloneModel(model: THREE.Object3D) {
        if (model.children[this.colladaIndex])
            model = model.children[this.colladaIndex]
        else
            console.log('[O] the model with index ' + this.colladaIndex + ' was not found')
        return ThreeCannonObject.wrapModelObject(model.clone(),
            this.zUp && [-Math.PI/2, 0, 0], 'bottom', this.size.y)
    }
}

export = ColladaObject