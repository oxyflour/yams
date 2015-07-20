import Utils = require('../Utils')
import War3Object = require('./War3Object')
import TalkableObject = require('./TalkableObject')

const forwardDirection = new THREE.Vector3(0, 0, 1)

class IdleState implements Utils.StateInfo {
    timer = Utils.timer(() => {
        if (!this.object.isTalking)
            this.object.trigger('monster-think')
    }, 2000)
    constructor(public object: War3Monster) {
    }
    init(from: Utils.StateInfo) {
        this.object.playAnimation('stand', 1)
    }
    quit(to: Utils.StateInfo) {
    }
    run(dt: number): any {
        this.timer.call(this, dt)
    }
}

class WalkingState extends IdleState {
    maxWalkingSpeed = 6
    walkingAccel = 5 / 50
    velocity = new THREE.Vector3()
    init(from: Utils.StateInfo) {
        this.object.playAnimation('walk', 1)
    }
    run(dt: number): any {
        var v = this.object.body && this.object.body.velocity
        if (v) {
            this.velocity.copy(forwardDirection)
                .applyQuaternion(<any>this.object.body.quaternion)
                .multiplyScalar(this.maxWalkingSpeed)
            v.x = Utils.approach(v.x, -this.velocity.x, dt * this.walkingAccel)
            v.z = Utils.approach(v.z, -this.velocity.z, dt * this.walkingAccel)
        }
        if (this.object.isTalking) {
            if (v) v.set(0, 0, 0)
            return 'IdleState'
        }
        else {
            return super.run(dt)
        }
    }
}

class War3Monster extends War3Object implements TalkableObject.ITalkableObject {
    size = new THREE.Vector3(2, 2, 2)

    modelUrl = 'models/w3/Sheep.w3m'
    castShadow = true

    mass = 10
    hasBody = true

    state = Utils.StateMachine.fromClasses([
        IdleState,
        WalkingState,
    ], IdleState, this)

    //
    canTalk = true
    isTalking

    static syncs = War3Object.syncs.concat([
        War3Monster.prototype.syncState,
        TalkableObject.prototype.syncTalkatble,
    ])

    syncState(state = null) {
        return state ? this.state.set(state) :
            Utils.fname(this.state.get() && this.state.get().constructor)
    }

    addShapes(body: CANNON.Body) {
        body.addShape((<typeof War3Monster> this.constructor)
            .getCachedSphereShape(this.size.y / 2))
        body.inertia.set(0, 0, 0)
        body.invInertia.set(0, 0, 0)
        body.angularDamping = 1
    }

    run(dt: number) {
        this.state.run(dt)
        super.run(dt)
    }
}

export = War3Monster
