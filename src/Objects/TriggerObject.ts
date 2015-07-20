import Utils = require('../Utils')
import ThreeCannonObject = require('./ThreeCannonObject')

class TriggerObject extends ThreeCannonObject {
    size = new THREE.Vector3(5, 5, 5)
    hasBody = true
    mass = 0

    triggerEvent = 'trigger'
    triggerDistance = 0.2
    triggerTracker = new TriggerObject.TriggerTracker(this, 500, 200)

    visibleGodModeOnly = true

    static syncs = ThreeCannonObject.syncs.concat([
        ThreeCannonObject.createSimpleSyncFn('triggerEvent'),
        ThreeCannonObject.createTHREEArraySyncFn('size'),
    ])

    static getCachedColorMaterial(c: number): THREE.Material {
        var material = ThreeCannonObject.getCachedColorMaterial(c).clone()
        material.opacity = 0.8
        material.transparent = true
        material.needsUpdate = true
        return material
    }

    trigger(type: string, data: any = null, callback: Function = null) {
        if (type === this.triggerEvent && this.model) {
            var model = <THREE.Mesh> this.model,
                trackedIds: string[] = data
            if (this.model instanceof THREE.Mesh && model.material)
                model.material.opacity = trackedIds.length ? 0.4 : 0.8
        }
        return super.trigger(type, data, callback)
    }

    getBody() {
        var body = super.getBody()
        body.collisionResponse = false
        body.addEventListener('collide', e => {
            this.triggerTracker.collide(e)
        })
        return body
    }

    run(dt: number) {
        super.run(dt)
        this.triggerTracker.run(dt)
    }
}

module TriggerObject {
    export interface ITriggerObject extends ThreeCannonObject {
        triggerEvent: string
        triggerDistance: number
    }
    export interface ITrackedObject {
        id: string
        body: CANNON.Body
        distance: number
    }
    export class TriggerTracker {
        private trackTimer: Function
        private eventTimer: Function
        private trackedObjects: ITrackedObject[] = [ ]
        private lastTrackedObjectIds: string[] = [ ]
        trackedObjectIds: string[] = [ ]
        constructor(private object: ITriggerObject,
            trackTimerInterval: number = 500,
            eventTriggerInterval: number = 200) {
            this.trackTimer = Utils.timer(() => { this.track() }, trackTimerInterval)
            this.eventTimer = Utils.timer(() => { this.check() }, eventTriggerInterval)
        }
        run(dt: number) {
            this.trackTimer.call(this, dt)
            this.eventTimer.call(this, dt)
        }
        track() {
            if (!this.object.body) return
            this.trackedObjects = this.trackedObjects.filter(object => {
                return object && object.body.position
                    .distanceTo(this.object.body.position) < object.distance
            })
            this.trackedObjectIds = this.trackedObjects.map(object => object.id)
        }
        check() {
            var oids = this.lastTrackedObjectIds,
                nids = this.trackedObjectIds
            if (oids.toString() !== nids.toString()) {
                var enter = nids.filter(id => oids.indexOf(id) < 0)
                enter.length && this.object
                    .trigger('enter-' + this.object.triggerEvent, enter)
                var leave = oids.filter(id => nids.indexOf(id) < 0)
                leave.length && this.object
                    .trigger('leave-' + this.object.triggerEvent, leave)
                this.object.trigger(this.object.triggerEvent,
                    this.lastTrackedObjectIds = nids.slice())
            }
        }
        collide(e: any) {
            var contact = e.contact,
                body = this.object.body,
                otherBody: CANNON.Body = contact.bi.id === body.id ? contact.bj : contact.bi,
                otherObjectId = otherBody && otherBody['objectId']
            if (otherObjectId && this.object.triggerEvent) {
                var i = this.trackedObjectIds.indexOf(otherObjectId)
                if (i < 0) i = this.trackedObjectIds.length
                this.trackedObjects[i] = {
                    id: otherObjectId,
                    body: otherBody,
                    distance: body.position.distanceTo(otherBody.position) +
                        this.object.triggerDistance
                }
                this.trackedObjectIds = this.trackedObjects.map(object => object.id)
            }
        }
    }
}

export = TriggerObject
