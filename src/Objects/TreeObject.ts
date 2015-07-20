/// <reference path="../../ref/threejs/three.d.ts" />

import ThreeCannonObject = require('./ThreeCannonObject')

class TreeObject extends ThreeCannonObject {
    size = new THREE.Vector3(0.1, 2.5, 0.1)
    hasBody = true
    castShadow = true

    keepOnTerrain = true

    static syncs = ThreeCannonObject.syncs.concat([
        ThreeCannonObject.createSimpleSyncFn('modelUrl'),
        ThreeCannonObject.createTHREEArraySyncFn('size')
    ])

    getUrls(): string[] {
        return [
            'models/k4_treepack1/tree 1a - 1b/tree1a_lod0.obj',
            'models/k4_treepack1/tree 1a - 1b/tree1b_lod0.obj',
            'models/k4_treepack1/tree 2a - 2b/tree2a_lod0.obj',
            'models/k4_treepack1/tree 2a - 2b/tree2b_lod0.obj',
            'models/k4_treepack1/tree 3a - 3b/tree3a_lod0.obj',
            'models/k4_treepack1/tree 3a - 3b/tree3b_lod0.obj',
            'models/k4_treepack1/tree 4a - 4b/tree4a_lod0.obj',
            'models/k4_treepack1/tree 4a - 4b/tree4b_lod0.obj',
        ]
    }

    cloneModel(model: THREE.Object3D): THREE.Object3D {
        return ThreeCannonObject.wrapModelObject(model.clone(), null, 'bottom', this.size.y)
    }
}

export = TreeObject
