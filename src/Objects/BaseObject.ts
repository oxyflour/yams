import Utils = require('../Utils')

class BaseObject implements Utils.IAnimateObject {
    constructor(private _id: string,
        private _events: Utils.EventDispatcher,
        private _physics: any,
        private _scene: any) {
    }

    // Note: we really need readonly properties : (
    // see Typescript #12
    get id() {
        return this._id
    }
    get cls() {
        return Utils.fname(this.constructor)
    }
    get physics() {
        return this._physics
    }
    get scene() {
        return this._scene
    }

    //
    // for Utils.IAnimateObjects
    //
    finished: boolean

    // see TypeScript #338
    private _attached: Utils.AnimateList
    get attached(): Utils.AnimateList {
        return this._attached
    }
    set attached(value: Utils.AnimateList) {
        this._attached = value
        value ? this.trigger('attached') : this.trigger('dettached')
    }

    //
    // methods
    //
    run(dt: number, ...args) {
        throw new Error("BaseObject.run not impletemented")
    }
    render(camera: any, ...args) {
        throw new Error("BaseObject.render not impletemented")
    }
    trigger(type: string, data: any = null, callback: Function = null) {
        this._events && this._events.trigger(type, data, this, callback)
    }

    //
    // sync
    //
    static syncs: ((data?) => any)[] = [ ]
    sync(data: any = null, dt: number = 0) {
        var syncs: Function[] = (<typeof BaseObject> this.constructor).syncs
        if (data) {
            if (syncs && data.val && syncs.length === data.val.length)
            syncs.forEach((fn, i) => {
                fn.call(this, data.val[i], dt)
            })
        }
        else {
            data = { id:this.id, cls:this.cls }
            if (syncs) data.val = syncs.map(fn => {
                return fn.call(this)
            })
            return data
        }
    }
}

export = BaseObject
