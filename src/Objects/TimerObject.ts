import Utils = require('../Utils')
import ThreeCannonObject = require('./ThreeCannonObject')

class TimerObject extends ThreeCannonObject {
    size = new THREE.Vector3(2, 2, 2)
    timerEvent = 'timer'
    timerInterval = 5000
    timerNextTick = 0

    visibleGodModeOnly = true

    run(dt: number) {
        super.run(dt)
        if (this.age > this.timerNextTick) {
            this.timerNextTick += this.timerInterval
            this.trigger(this.timerEvent)
        }
    }

    static syncs = ThreeCannonObject.syncs.concat([
        ThreeCannonObject.createSimpleSyncFn('timerEvent'),
        ThreeCannonObject.createSimpleSyncFn('timerInterval'),
        ThreeCannonObject.createSimpleSyncFn('timerNextTick'),
    ])
}

export = TimerObject
