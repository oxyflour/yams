/// <reference path="../../ref/threejs/three.d.ts" />

import Utils = require('../Utils')
import ThreeCannonObject = require('./ThreeCannonObject')
import UIObject = require('./UiObject')

class GrassObject extends ThreeCannonObject implements UIObject.IEditableObject {
    keepOnTerrain = true

    static objmtlResLoader(url, callback) {
        ThreeCannonObject.objmtlResLoader(url, (model: THREE.Object3D) => {
            model.traverse((mesh: THREE.Mesh) => {
                var mat = mesh.material
                if (mat) {
                    mat.side = THREE.DoubleSide
                    mat.transparent = true
                    mat.opacity = 0.5
                    mat.needsUpdate = true
                }
            })

            callback(model)
        })
    }

    static syncs = ThreeCannonObject.syncs.concat([
        ThreeCannonObject.createSimpleSyncFn('modelUrl'),
        ThreeCannonObject.createSimpleSyncFn('childSize'),
        ThreeCannonObject.createSimpleSyncFn('childArea'),
        ThreeCannonObject.createSimpleSyncFn('childSeed'),
    ])

    getUrls(): string[] {
        return [
            'models/grass/grass01.objmtl',
            'models/grass/grass02.objmtl',
            'models/grass/grass03.objmtl',
        ]
    }

    getEditorUI(elem: JQuery) { }
    onMouseControlDown() { }
    onMouseControlUpdate() { }
    onMouseControlUp() {
        this.trigger('sync', 'updateChildren')
    }

    childSize = 0
    childArea = 5
    childSeed = Math.random()

    updateChildren() {
        if (this.model) this.model.children.forEach(child => {
            this.trigger('get-height',
                child.position.clone().multiply(this.model.scale).add(this.position),
                (position: THREE.Vector3) => {
                    child.position.y = (position.y - this.position.y) / this.model.scale.y
                })
        })
    }

    cloneModel(model: THREE.Object3D): THREE.Object3D {
        var newModel = ThreeCannonObject.wrapModelObject(model.clone(),
                null, 'bottom', this.size.y),
            random = Utils.nextrand(this.childSeed)
        Array.apply(null, Array(this.childSize)).forEach(v => {
            var x = ((random = Utils.nextrand(random)) - 0.5) * this.childArea,
                y = ((random = Utils.nextrand(random)) - 0.5) * this.childArea,
                r = (random = Utils.nextrand(random)) * Math.PI * 2,
                s = (random = Utils.nextrand(random)) * 0.4 + 0.6
            this.trigger('get-height',
                new THREE.Vector3(x + this.position.x, 0, y + this.position.z),
                (position: THREE.Vector3) => {
                    var child = model.clone()
                    child.position.copy(position).sub(this.position)
                    child.setRotationFromEuler(new THREE.Euler(0, r, 0))
                    child.scale.set(s, s, s)
                    newModel.add(child)
                })
        })
        return newModel
    }
}

export = GrassObject
