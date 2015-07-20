/// <reference path="../../ref/cannon.d.ts/cannon.d.ts" />

import BaseObject = require('./BaseObject')
import Utils = require('../Utils')

var directionDown = new THREE.Vector3(0, -1, 0),

    directionUp = new THREE.Vector3(0, 1, 0),

    directionForward = new THREE.Vector3(0, 0, 1),

    resourceLoaderSequence = Utils.sequence(),

    maxRollbackDeltaTime = 500,

    shadowUpdaterRaycaster = new THREE.Raycaster()

class ThreeCannonObject extends BaseObject {
    // hookup the 'dettached' event to release resource
    trigger(type: string, data: any = null, callback: Function = null) {
        if (type === 'dettached') {
            this.resetBody()
            this.resetModel()
        }
        super.trigger(type, data, callback)
    }

    //
    // common
    //
    age = 0
    size = new THREE.Vector3(0.5, 0.5, 0.5)
    position = new THREE.Vector3()
    quaternion = new THREE.Quaternion()

    static syncs = BaseObject.syncs.concat([
        ThreeCannonObject.createSimpleSyncFn('age'),
        ThreeCannonObject.createTHREEArraySyncFn('position'),
        ThreeCannonObject.createTHREEArraySyncFn('quaternion'),
        ThreeCannonObject.prototype.syncBody
    ])

    syncBody(data: any = null, dt: number = 0) {
        if (data) {
            if (!this.body || !data.length) return

            var b = this.body, d = data
            b.position.copy(d[0] || this.position)
            b.quaternion.copy(d[1] || this.quaternion)
            d[2] ? b.velocity.copy(d[2]) : b.velocity.set(0, 0, 0)
            d[3] ? b.angularVelocity.copy(d[3]) : b.angularVelocity.set(0, 0, 0)

            if (dt < maxRollbackDeltaTime && dt > -maxRollbackDeltaTime) {
				this.body.position.vadd(
					this.body.velocity.clone().scale(dt/1000))
				var av = this.body.angularVelocity
				this.body.quaternion.mult(
					new CANNON.Quaternion(av.x*dt/2000, av.y*dt/2000, av.z*dt/2000, 0))
				this.run(dt)
            }
        }
        else {
            if (!this.body) return [ ]

            var bv = this.body && this.body.position, pv = this.position,
                bq = this.body && this.body.quaternion, pq = this.quaternion
            return [
                bv.x === pv.x && bv.y === pv.y && bv.z === pv.z ? 0 : this.body.position,
                bq.x === pq.x && bq.y === pq.y && bq.z === pq.z ? 0 : this.body.quaternion,
                this.body.velocity.isZero()        ? 0 : this.body.velocity,
                this.body.angularVelocity.isZero() ? 0 : this.body.angularVelocity
            ]
        }
    }

    //
    // physics
    //
    hasBody: boolean = false
    body: CANNON.Body = null

    mass: number = 0
    material: CANNON.Material

    run(dt) {
        this.age += dt

        if (this.hasBody && !this.body && this.physics &&
            (this.body = this.getBody()))
            this.physics.add(this.body)

        if (this.body && this.mass) {
            this.position.copy(<any>this.body.position)
            this.quaternion.copy(<any>this.body.quaternion)
        }
    }

    addShapes(body: CANNON.Body) {
    	body.addShape((<typeof ThreeCannonObject> this.constructor)
            .getCachedBoxShape(this.size))
    }

    getBody(): CANNON.Body {
		var body = new CANNON.Body({
			mass: this.mass > 0 ? this.mass : 0,
			type: this.mass < 0 ? CANNON.Body.KINEMATIC : undefined,
			position: new CANNON.Vec3().copy(<any>this.position),
			quaternion: new CANNON.Quaternion().copy(<any>this.quaternion),
		})
		this.addShapes(body)

        body['objectId'] = this.id
		return body
    }

    resetBody() {
        if (this.body && this.physics)
            this.physics.remove(this.body)
        this.body = null
    }

    //
    // rendering
    //
    hasModel: boolean = true
    model: THREE.Object3D = null

    color: number

    hasDropShadow: boolean = false
    dropShadowModel: THREE.Object3D = null

    castShadow: boolean
    receiveShadow: boolean

    modelUrl: string

    static cameraPosition = new THREE.Vector3()
    static modelPosition = new THREE.Vector3()

    render(camera: THREE.Camera) {
        if (this.hasModel && !this.model && this.scene &&
            (this.model = this.getModel()))
            this.scene.add(this.model)

        if (this.model) {
            this.model.position.lerp(this.position, 0.4)
            this.model.quaternion.slerp(this.quaternion, 0.4)
        }

        if (this.dropShadowModel && this.model) {
            ThreeCannonObject.updateShadowModel(this.model, this.dropShadowModel, this.scene)
        }

        if (this.model instanceof THREE.LOD) {
            var v1 = ThreeCannonObject.cameraPosition,
                v2 = ThreeCannonObject.modelPosition
            v1.setFromMatrixPosition(camera.matrixWorld)
            v2.setFromMatrixPosition(this.model.matrixWorld)
            v1.y = v2.y = 0
            this.updateLOD(v1.distanceTo(v2))
        }
    }

    updateLOD(dist: number) {
        var lod = <THREE.LOD> this.model,
            visibleObject = lod.objects[lod.objects.length - 1]
        lod.objects.some(obj => {
            return obj.distance > dist && !!(visibleObject = obj)
        })
        lod.objects.forEach(obj => {
            obj.object.visible = obj === visibleObject
        })
    }

    requireModel(): THREE.Object3D {
        var cls = <typeof ThreeCannonObject> this.constructor
        if (this.modelUrl) {
        	var model = cls.getCachedResource(this.modelUrl)
        	if (model) return this.cloneModel(model)

    		cls.loadResourceToCache(this.modelUrl, () => {
    			this.resetModel()
        	})
        }
		return new THREE.Mesh(
			cls.getCachedBoxGeometry(this.size),
			cls.getCachedColorMaterial(this.color >= 0 ? this.color : 0x666666))
    }

    getModel(): THREE.Object3D {
        var model = this.requireModel()

        if (this.castShadow) {
            model.traverse(function(child) {
                child.castShadow = true
            })
        }

        if (this.hasDropShadow) {
            var shadow = (<typeof ThreeCannonObject> this.constructor)
                    .getCachedShadowModel().clone(),
                gyro = new THREE.Gyroscope()
            shadow.scale.set(0.2 / model.scale.x, 0.2 / model.scale.y, 0.2 / model.scale.z)
            gyro.add(shadow)
            model.add(gyro)
            this.dropShadowModel = shadow
        }

        model.position.copy(this.position)
        model.quaternion.copy(this.quaternion)

        model['objectId'] = this.id
        return model
    }

    resetModel() {
        if (this.model && this.scene)
            this.scene.remove(this.model)
        this.model = null
    }

    //
    // helpers
    //
    cloneModel(model: THREE.Object3D): THREE.Object3D {
        return model.clone()
    }
    updateBody(position: THREE.Vector3, quaternion: THREE.Quaternion) {
        if (position) {
            this.position.copy(position)
            this.body && this.body.position.copy(<any> this.position)
        }
        if (quaternion) {
            this.quaternion.copy(quaternion)
            this.body && this.body.quaternion.copy(<any> this.quaternion)
        }
    }
    setBottomPosition(x: number, y: number, z: number) {
        this.position.set(x, y + this.size.y / 2, z)
        this.updateBody(this.position, null)
    }
    setEuler(x: number, y: number, z: number, order = undefined) {
        this.quaternion.setFromEuler(new THREE.Euler(x, y, z, order))
        this.updateBody(null, this.quaternion)
    }
    lookAt(x: number, y: number, z: number) {
        this.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(x, y, z).sub(this.position).multiplyScalar(-1).normalize())
        this.updateBody(null, this.quaternion)
    }

    //
    // resource
    //
	static getCachedBoxShape(s: THREE.Vector3): CANNON.Shape {
		var cache = ThreeCannonObject,
			key = 'cachedBox:' + s.x + 'x' + s.y + 'x' + s.z
		return cache[key] || (cache[key] =
			new CANNON.Box(new CANNON.Vec3(s.x / 2, s.y / 2, s.z / 2)))
	}
    static getCachedSphereShape(r: number): CANNON.Shape {
        var cache = ThreeCannonObject,
            key = 'cachedBox:' + r
        return cache[key] || (cache[key] =
            new CANNON.Sphere(r))
    }
	static getCachedBoxGeometry(s: THREE.Vector3): THREE.Geometry {
		var cache = ThreeCannonObject,
			key = 'cachedGeometry:' + s.x + 'x' + s.y + 'x' + s.z
		return cache[key] || (cache[key] =
			new THREE.BoxGeometry(s.x, s.y, s.z))
	}
	static getCachedColorMaterial(c: number): THREE.Material {
		var cache = ThreeCannonObject,
			key = 'cachedMaterial:' + c
		return cache[key] || (cache[key] =
			new THREE.MeshBasicMaterial({ color:c }))
	}
	static getCachedShadowModel(): THREE.Object3D {
		var cache = ThreeCannonObject,
			key = 'cachedShadowModel'
		if (!cache[key]) {
			var geo = new THREE.CircleGeometry(1, 8),
				mat = new THREE.MeshBasicMaterial({
                    color:0x333333, transparent:true, opacity:0.6})
			geo.applyMatrix(new THREE.Matrix4().makeRotationX( -Math.PI / 2))
			cache[key] = new THREE.Mesh(geo, mat)
		}
		return cache[key]
	}
	static getCachedResource(url: string) {
    	var cache = ThreeCannonObject,
    		key = 'cahedResource:' + url
		return cache[key]
	}
    static loadResourceToCache(url: string, callback: (any) => void): any {
    	var cache = ThreeCannonObject,
    		key = 'cahedResource:' + url,

    		initKey = url.split('.').pop().toLowerCase() + 'ResLoader',
    		initiator = this[initKey]

    	if (initiator) resourceLoaderSequence((next) => {
        	if (cache[key] !== undefined) {
        		callback(cache[key])
                next()
            }
        	else initiator(url, (data) => {
                callback(cache[key] = data)
                next()
            })
        })

    	else {
    		console.warn('resource loader ' + initKey + ' is not found')
    		callback(null)
    	}
    }

    //
    // loaders
    //
    static objLoader = THREE['OBJLoader'] && new THREE['OBJLoader']
    static objResLoader(url: string, callback: (any) => void) {
        console.log('[O] loading ' + url)
        ThreeCannonObject.objLoader.load(url, callback)
    }
    static daeLoader = THREE['ColladaLoader'] && new THREE['ColladaLoader']
    static daeResLoader(url: string, callback: (any) => void) {
        console.log('[O] loading ' + url)
        ThreeCannonObject.daeLoader.load(url, function(collada) {
            console.log('[O] got collada scene (' +
                collada.scene.children.length + ' objects)')
            callback(collada.scene)
        })
    }
    static objmtlLoader = THREE['OBJMTLLoader'] && new THREE['OBJMTLLoader']
    static objmtlResLoader(url: string, callback: (any) => void) {
        var objUrl = url.replace(/\.objmtl$/i, '.obj'),
            mtlUrl = url.replace(/\.objmtl$/i, '.mtl')
        console.log('[O] loading ' + url)
        ThreeCannonObject.objmtlLoader.load(objUrl, mtlUrl, callback)
    }

    static updateShadowModel(model: THREE.Object3D, shadow: THREE.Object3D,
            scene: THREE.Scene) {
        shadowUpdaterRaycaster.set(model.position, directionDown)
        var intersects = shadowUpdaterRaycaster.intersectObjects(scene.children)
        if (intersects && intersects.length > 0) {
            var intersect = intersects[0],
                object = intersect.object,
                face = intersect.face
            shadow.position.set(0, -intersect.distance / model.scale.y + 1, 0)
            face && face.normal ?
                shadow.quaternion.setFromUnitVectors(directionUp,
                    face.normal.clone().applyQuaternion(object.getWorldQuaternion())) :
                shadow.rotation.set(0, 0, 0)
        }
    }

    static wrapModelObject(model: THREE.Object3D, rotation, offset, height = 0) {
        if (!model.children.length) {
            var parent = new THREE.Object3D()
            parent.add(model)
            model = parent
        }

        if (rotation && Array.isArray(rotation))
            rotation = new THREE.Euler().fromArray(rotation)
        if (rotation instanceof THREE.Euler)
            rotation = new THREE.Quaternion().setFromEuler(rotation)
        if (rotation instanceof THREE.Quaternion) model.children.forEach((child) => {
            child.quaternion.multiply(rotation)
        })

        var box = new THREE.Box3().setFromObject(model)
        if (height) {
            var newScale = box.min.y < box.max.y ?
                height / (box.max.y - box.min.y) : 1
            model.scale.set(newScale, newScale, newScale)
        }

        var center = box.max.clone().add(box.min).multiplyScalar(0.5),
            scale = model.scale
        if (offset == 'bottom')
            offset = [0, -center.y * scale.y, 0]
        else if (offset == 'center')
            offset = [-center.x*scale.x, -center.y*scale.y, -center.z*scale.z]

        if (offset && Array.isArray(offset))
            offset = new THREE.Vector3().fromArray(offset)
        if (offset instanceof THREE.Vector3) model.children.forEach((child) => {
            var d = offset.clone(),
                p = child.position,
                s = model.scale
            p.x += d.x / s.x
            p.y += d.y / s.y
            p.z += d.z / s.z
        })

        return model
    }

    static createSimpleSyncFn(key) {
        return function(data = null) {
            return data ? (this[key] = data) : this[key]
        }
    }

    static createTHREEArraySyncFn(key) {
        return function(data = null) {
            return data ? this[key].fromArray(data) : this[key].toArray()
        }
    }
}

export = ThreeCannonObject
