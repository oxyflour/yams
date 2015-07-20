export function guid() {
	// REF: http://stackoverflow.com/questions/105034/...
	// how-to-create-a-guid-uuid-in-javascript
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random()*16|0, v = c == 'x' ? r: (r&0x3|0x8)
		return v.toString(16)
	});
}

var CRC = global.CRC32 || require('crc-32')
export function crc32(str) {
	return CRC.str(str)
}

export function extend(data, ...args) {
	for (var i = 1; i < arguments.length; i ++) {
		var arg = arguments[i]
		if (arg) for (var k in arg)
			data[k] = arg[k]
	}
	return data
}

export function val(object: any, path: string = '') {
	var keys = path.split('.')
    for (var i = 0; object && i < keys.length; i ++)
    	object = object[ keys[i] ]
	return object
}

export function dict(keys: string[], vals) {
    var d = { }
    keys.forEach((k, i) => {
        d[k] = (vals && vals.call) ? vals(k, i) :
        	(Array.isArray(vals) ? vals[i] : vals)
    })
    return d
}

export function randin(list: any[]) {
	return list[Math.floor(list.length * Math.random())]
}

export function smoothstep(start: number, stop: number, x: number) {
	// REF: http://en.wikipedia.org/wiki/Smoothstep
	x = (x - start) / (stop - start)
	if (x < 0) x = 0
	if (x > 1) x = 1
	return x * x * x * (x * (x * 6 - 15) + 10)
}

export function interp(x1: number, x2: number, y1: number, y2: number, x: number) {
	return lerp(y1, y2, (x - x1) / (x2 - x1))
}

export function hypot(a: number, b: number) {
	return Math.sqrt(a * a + b * b)
}

export function lerp(from: number, to: number, factor: number) {
	return from * (1 - factor) + to * factor
}

export function lerp2(lt, rt, lb, rb, fx, fy) {
	return lerp(lerp(lt, rt, fx), lerp(lb, rb, fx), fy)
}

export function approach(from: number, to: number, delta: number) {
    return from < to ? Math.min(from + delta, to): Math.max(from - delta, to)
}

export function sinrand(x) {
	x = Math.sin(x * 0xff) * 0xff
	x = x - Math.floor(x)
	return (~~(x * 0xffff)) / 0xffff
}

export function nextrand(...args) {
	var x = 0, n = arguments.length
	for (var i = 0; i < n; i ++)
		x = sinrand(arguments[i] + x)
	return x
}

export function debounce(callback: Function, interval: number, data=null) {
	var timeout = null,
		that = this
	return () => {
		if (timeout)
			clearTimeout(timeout)
		timeout = setTimeout(function() {
			callback.call(that, data)
			timeout = 0
		}, interval)
	}
}

export function timer(callback: Function, interval: number, data=null, maxdt=undefined) {
	var time = 0,
		that = this
	return (dt: number) => {
		if (dt > maxdt) // skip some ticks
			dt = maxdt
		for (time += dt; time >= interval; time -= interval)
			callback.call(that, data)
	}
}

export function sequence() {
	var list = [ ],
		running = null,
		next = function() {
			if (running = list.shift())
				running(next)
		}
	return (initiator: Function) => {
		list.push(initiator)
		if (!running) next()
	}
}

export function batch(initiators: Function[], finish: Function) {
	var total = initiators.length,
		results = [ ]
	if (total) initiators.forEach((initiator, index) => {
		initiator(result => {
			results[index] = result
			if (!--total) finish(results)
		})
	})
	else {
		finish(results)
	}
}

var functionNameRegex = /function\s+([^\s(]+)\s*\(/
export function fname(fn: Function) {
    if (!fn['name']) {
        var mat = functionNameRegex.exec(fn.toString())
        if (mat && mat.length > 1) fn['name'] = mat[1]
    }
    return fn['name']
}

export interface IAnimateObject {
	attached: AnimateList
	finished: boolean
}

export class AnimateList {
	private objectList: IAnimateObject[] = [ ]
	private unusedIndices: number[] = [ ]
	get length() {
		return this.objectList.length
	}
	has(object: IAnimateObject) {
		return object && object.attached === this
	}
	clean() {
		this.objectList = this.objectList.filter(x => !!x)
		this.unusedIndices.length = 0
	}
	check() {
		var total = this.objectList.length,
			unused = this.unusedIndices.length
		if (unused > 30 || (total && unused / total > 0.8))
			this.clean()
	}
	add(object: IAnimateObject) {
		if (this.has(object)) {
			console.warn('object is already in the list!')
			return
		}

		object.attached = this
		object.finished = false

		var index = this.unusedIndices.length ?
			this.unusedIndices.pop(): this.objectList.length
		this.objectList[index] = object
	}
	apply(fn: (IAnimateObject, data?) => void, data=null) {
		var needsCheck = false
		this.objectList.forEach((object, index) => {
			if (!object) {
				// ...
			}
			else if (object.finished) {
				object.attached = null
				this.objectList[index] = null
				this.unusedIndices.push(index)
				needsCheck = true
			}
			else {
				fn(object, data)
			}
		})
		if (needsCheck)
			this.check()
	}
}

export interface IEvent {
	type: string
	data: any
	source: any
	callback: Function
}

export class EventDispatcher {
	private events: IEvent[] = [ ]
	private backup: IEvent[] = null
	private handles = { }
	trigger(type: string, data: any, source: any, callback: Function) {
		(this.backup || this.events).push({
			type: type,
			data: data,
			source: source,
			callback: callback
		})
	}
	dispatch() {
		this.backup = [ ]
		this.events.forEach(evt => {
			var callbacks = this.handles[evt.type];
			if (callbacks) callbacks.forEach(callback => {
				callback(evt.source, evt.data, evt.callback)
			})
		})
		this.events = this.backup
		this.backup = null
	}
	on(type: string, callback: (source?: any, data?: any, fn?: Function) => void) {
		type.split(' ').forEach(type => {
			var callbacks = this.handles[type] || (this.handles[type] = [ ])
			callbacks.push(callback)
		})
	}
}

export interface StateInfo {
	init(from: StateInfo)
	quit(to: StateInfo)
	run(data: any)
}

export class StateMachine {
	private current: StateInfo
	constructor(private states: { [s: string]: StateInfo }, init: string) {
		this.set(init)
	}
	get(name: string = null) {
		return name ? this.states[name] : this.current
	}
	set(name: string) {
		var newState = this.states[name],
			oldState = this.current
		if (newState === oldState)
			return this.current

		this.current && this.current.quit(newState)
		this.current = newState
		this.current && this.current.init(oldState)
		return this.current
	}
	run(data: any) {
		var next = this.current && this.current.run(data)
		if (next) this.set(next)
	}

	static fromClasses(classes: Function[], initClass: Function, data: any) {
        var states: { [s: string]: StateInfo } = { }
        classes.forEach((fn: any) => {
            states[fname(fn)] = new fn(data)
        })
        return new StateMachine(states, fname(initClass))
	}
}

export class Point {
    constructor(public x: number, public y: number) {
    }
}

export class ChunkManager {
	private chunkPositionCache = { }
	private getChunkIndex(x: number) {
	    return Math.floor(x / this.chunkSize + 0.5)
	}
	private getChunkIdFromIndex(i: number, j: number): string {
	    return (i >= 0 ? '+' + i : i) + 'x' + (j >= 0 ? '+' + j : j)
	}
	constructor(private chunkSize: number) {
	}
	getChunkSize() {
		return this.chunkSize
	}
	getChunkId(x: number, y: number): string {
	    return this.getChunkIdFromIndex(
	    	this.getChunkIndex(x),
	    	this.getChunkIndex(y))
	}
	getChunkPos(id: string): Point {
	    if (this.chunkPositionCache[id])
	        return this.chunkPositionCache[id]

	    var sp = id.split('x')
	    return this.chunkPositionCache[id] = new Point(
	        parseInt(sp[0]) * this.chunkSize,
	        parseInt(sp[1]) * this.chunkSize
	    )
	}
	getChunkInRect(x: number, y: number, w: number, h: number): string[] {
	    var iMin = this.getChunkIndex(x - w / 2),
	        iMax = this.getChunkIndex(x + w / 2),
	        jMin = this.getChunkIndex(y - h / 2),
	        jMax = this.getChunkIndex(y + h / 2),
	        list = [ ]
	    for (var i = iMin; i <= iMax; i ++)
	        for (var j = jMin; j <= jMax; j ++)
	            list.push(this.getChunkIdFromIndex(i, j))
	    return list
	}
	getChunkInCircle(x: number, y: number, r: number): string[] {
	    var iMin = this.getChunkIndex(x - r),
	        iMax = this.getChunkIndex(x + r),
	        jMin = this.getChunkIndex(y - r),
	        jMax = this.getChunkIndex(y + r),
	        list = [ ]
	    for (var i = iMin; i <= iMax; i ++)
	        for (var j = jMin; j <= jMax; j ++) {
	            var dx = i * this.chunkSize - x,
	                dy = j * this.chunkSize - y,
	                dr = r + this.chunkSize * 0.707
	            if (dx * dx + dy * dy < dr * dr)
	                list.push(this.getChunkIdFromIndex(i, j))
	        }
	    return list
	}
	getNeighborChunks(chunkId: string) {
	    var pos = this.getChunkPos(chunkId)
	    return [
	        this.getChunkId(pos.x + this.chunkSize, pos.y),
	        this.getChunkId(pos.x - this.chunkSize, pos.y),
	        this.getChunkId(pos.x, pos.y + this.chunkSize),
	        this.getChunkId(pos.x, pos.y - this.chunkSize)
	    ]
	}
}
