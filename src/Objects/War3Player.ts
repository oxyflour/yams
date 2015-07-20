import Utils = require('../Utils')

import War3Object = require('./War3Object')
import TriggerObject = require('./TriggerObject')

const MAX_SYNC_INTERVAL = 5000

const forwardDirection = new THREE.Vector3(0, 0, 1)
const upDirection = new CANNON.Vec3(0, 1, 0)

class IdleState implements Utils.StateInfo {
    static moveDirection = new THREE.Vector3()
    static moveQuaternion = new THREE.Quaternion()
    static targetQuaternion = new THREE.Quaternion()
    static targetEuler = new THREE.Euler()
    static targetVelocity = new THREE.Vector3()
    animName = 'stand'
    animSpeed = 1
    animTime = NaN
    movingFactor = 1
    constructor(public player: War3Player) {
    }
    init(from: Utils.StateInfo) {
        this.player.playAnimation(
            this.player.getStateAnimName(Utils.fname(this.constructor)) || this.animName,
            this.player.animSpeed * this.animSpeed, this.animTime)
    }
    quit(to: Utils.StateInfo) {
    }
    run(dt: number): any {
        var p = this.player,
            c = this.player.controls,
            d = IdleState.moveDirection

        d.set(0, 0, 0)
        if (c.moveForward)  d.z += 1
        if (c.moveBackword) d.z -= 1
        if (c.moveLeft)     d.x += 1
        if (c.moveRight)    d.x -= 1

        var q = IdleState.moveQuaternion,
            t = IdleState.targetQuaternion,
            v = IdleState.targetVelocity,
            u = IdleState.targetEuler

        v.set(0, 0, 0)
        if (d.x || d.z) {
            q.setFromUnitVectors(forwardDirection, d.normalize())
            t.copy(p.targetQuat)
            u.setFromQuaternion(t)
            u.reorder('YXZ')
            u.x = u.z = 0
            t.setFromEuler(u)
            t.multiply(q)

            // FIXME: due to small changes of rotation,
            //        slerp may goes in different directions on host/client
            p.quaternion.slerp(t, p.rotateVelocity * dt)

            //
            v.copy(forwardDirection)
                .multiplyScalar(p.maxMovingVelocity * this.movingFactor)
                .applyQuaternion(t)
        }

        if (p.body) {
            var e = p.body.velocity
            e.x = Utils.approach(e.x, -v.x, p.movingVelocity * this.movingFactor * dt)
            e.z = Utils.approach(e.z, -v.z, p.movingVelocity * this.movingFactor * dt)
            p.body.quaternion.copy(<any>p.quaternion)
        }

        if (c.jump)
            return 'JumpingState'
        else if (c.attack)
            return 'AttackingState'
        else if (c.use)
            return 'UsingState'
        return d.x || d.z ? 'WalkingState' : 'IdleState'
    }
}

class UsingState extends IdleState {
    init(from: Utils.StateInfo) {
        this.player.trigger('player-use', this.player.triggerTracker.trackedObjectIds)
        var c = this.player.controls
        c.moveBackword = c.moveForward = c.moveLeft = c.moveRight = false
        super.init(from)
    }
}

class WalkingState extends IdleState {
    animName = 'walk'
    animSpeed = 3
    enterRunningTick = 0
    allowRunningState = false
    init(from: Utils.StateInfo) {
        super.init(from)
        this.allowRunningState = this.player.age - this.enterRunningTick < 500
        this.enterRunningTick = this.player.age
    }
    run(dt: number) {
        var next = super.run(dt)
        if (next === 'WalkingState' && this.allowRunningState)
            return 'RunningState'
        else
            return next
    }
}

class RunningState extends WalkingState {
    animSpeed = 5
    movingFactor = 2.5
}

class JumpingState extends IdleState {
    allowJumpingState2 = false
    init(from: Utils.StateInfo) {
        super.init(from)
        this.player.body.velocity.y = this.player.jumpVelocity
        this.player.isStanding = false
        this.allowJumpingState2 = false
    }
    run(dt: number) {
        var next = super.run(dt)
        if (JumpingState.eventFilters[next])
            return next

        var vy = this.player.body && this.player.body.velocity.y,
            vy2 = this.player.jumpVelocity2
        if (vy <= -vy2) {
            return 'FallingState'
        }
        else if (vy < vy2) {
            var ctrl = this.player.controls
            // must release jump, then press again to goto JumpingState2
            if (!ctrl.jump)
                this.allowJumpingState2 = true
            if (ctrl.jump && this.allowJumpingState2)
                return 'JumpingState2'
            else if (this.player.isStanding)
                return next
        }
    }
    static eventFilters = {
        AttackingState: 1,
        UsingState: 1,
    }
}

class JumpingState2 extends JumpingState {
}

class FallingState extends IdleState {
    init(from: Utils.StateInfo) {
        super.init(from)
        this.player.canJump = false
    }
    run(dt: number) {
        var next = super.run(dt)
        if (JumpingState.eventFilters[next])
            return next
        else if (this.player.isStanding)
            return next
    }
    quit(to: Utils.StateInfo) {
        this.player.canJump = true
    }
}

class AttackingState extends IdleState {
    animName = 'attack'
    animTime = 0 // restart animation
    attackOver = 0
    attackDuration = 1000
    init(from: Utils.StateInfo) {
        super.init(from)
        this.attackOver = this.player.age + this.attackDuration
        this.player.trigger('player-attack')
    }
    run (dt: number) {
        var next = super.run(dt)
        if (this.player.age > this.attackOver)
            return next
    }
}

class War3Player extends War3Object implements TriggerObject.ITriggerObject {
    size = new THREE.Vector3(0.6, 1.5, 0.8)

    hasBody = true
    mass = 3
    material = this.physics['groundMaterial']

    hasShadow = true
    hasDropShadow = true
    modelUrl = 'models/mdl/hakurei reimu.w3m'

    controls = new War3Player.Control()
    targetQuat = new THREE.Quaternion()

    dontSyncInChunk = true
    keepVisibleInChunk = true

    //
    triggerEvent = 'player-trigger'
    triggerDistance = 0.2
    triggerTracker = new TriggerObject.TriggerTracker(this)

    // ...
    lastSyncTick = 0
    pingTimer = Utils.timer(() => {
        this.trigger('player-update')
        if (this.age - this.lastSyncTick > MAX_SYNC_INTERVAL) {
            console.log('[C] player ' + this.id + ' disconnected')
            this.finished = true
        }
    }, 1000)

    // ...
    animSpeed = 1
    maxMovingVelocity = 5
    movingVelocity = 0.010
    rotateVelocity = 0.005
    jumpVelocity = 9
    jumpVelocity2 = 2

    //...
    canJump = true
    canAttack = true
    isStanding = false
    state = Utils.StateMachine.fromClasses([
        IdleState,
        UsingState,
        WalkingState,
        RunningState,
        JumpingState,
        JumpingState2,
        FallingState,
        AttackingState,
    ], IdleState, this)

    static syncs = War3Object.syncs.concat([
        War3Object.createSimpleSyncFn('controls'),
        War3Object.createTHREEArraySyncFn('targetQuat'),
    ])

    addShapes(body) {
        var cls = <typeof War3Player> this.constructor,
            width = Math.min(this.size.x, this.size.z)
        if (width > 0) {
            body.addShape(cls.getCachedSphereShape(width / 2),
                new CANNON.Vec3(0, (width - this.size.y) / 2, 0))
        }
        if (this.size.y > this.size.x) {
            var shape = cls.getCachedBoxShape(new THREE.Vector3(width, this.size.y - width, width))
            body.addShape(shape,
                new CANNON.Vec3(0, width / 2, 0))
        }
    }

    getBody() {
        var body = super.getBody()

        // add damping
        body.linearDamping = 0.4

        // prevent body from rotating
        // REF: https://github.com/schteppe/cannon.js/issues/46
        body.inertia.set(0, 0, 0)
        body.invInertia.set(0, 0, 0)

        // update canJump attribute
        var contactNormal = new CANNON.Vec3()
        body.addEventListener('collide', e => {
            var contact = e.contact
            if (contact.bi.id === body.id)
                contact.ni.negate(contactNormal)
            else
                contactNormal.copy(contact.ni)

            if(contactNormal.dot(upDirection) > 0.5) {
                this.isStanding = true
            }

            this.triggerTracker.collide(e)
        })

        return body
    }

    getStateAnimName(stateName: string): string {
        return ''
    }

    update(keys: War3Player.IKeyState) {
        var c = this.controls,
            k = keys
        c.moveForward = k.W || k.UP
        c.moveBackword = k.S || k.DOWN
        c.moveLeft = k.A || k.LEFT
        c.moveRight = k.D || k.RIGHT
        c.crouch = k.SHIFT
        c.jump = this.canJump && k.SPACE
        c.attack = this.canAttack && k.X
        c.use = k.F
        c.spell = k.C

        this.trigger('player-update')
    }

    run(dt: number) {
        this.state.run(dt)
        this.pingTimer.call(this, dt)

        super.run(dt)
        this.triggerTracker.run(dt)
    }

    sync(data: any = null, dt: number = 0) {
        data = super.sync(data, dt)
        this.lastSyncTick = this.age

        return data
    }
}

module War3Player {
    export interface IKeyState {
        A
        B
        C
        D
        E
        F
        G
        H
        I
        J
        K
        L
        M
        N
        O
        P
        Q
        R
        S
        T
        U
        V
        W
        X
        Y
        Z
        UP
        DOWN
        LEFT
        RIGHT
        SHIFT
        CTRL
        ALT
        SPACE
    }

    export class Control {
        moveForward
        moveBackword
        moveLeft
        moveRight
        crouch
        jump
        attack
        spell
        use
    }
}

export = War3Player
