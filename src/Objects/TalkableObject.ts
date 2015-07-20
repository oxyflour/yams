import ThreeCannonObject = require('./ThreeCannonObject')

class TalkableObject extends ThreeCannonObject implements TalkableObject.ITalkableObject {
    canTalk = true
    isTalking = false
    static syncs = ThreeCannonObject.syncs.concat([
        TalkableObject.prototype.syncTalkatble
    ])
    syncTalkatble(data = null) {
        return data !== null ? (this.isTalking = data) : this.isTalking
    }
}

module TalkableObject {
    export interface ITalkableObject {
        canTalk: boolean
        isTalking: boolean
    }
}

export = TalkableObject
