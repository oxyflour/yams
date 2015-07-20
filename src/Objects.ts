import Utils = require('./Utils')

import BaseObject = require('./Objects/BaseObject')

import War3Object = require('./Objects/War3Object')
import War3Monster = require('./Objects/War3Monster')
import War3Player = require('./Objects/War3Player')

class War3PlayerAlice extends War3Player {
	modelUrl = 'models/mdl/alice.w3m'
}

class War3PlayerCirno extends War3Player {
	modelUrl = 'models/mdl/cirno.w3m'
	animSpeed = 0.6
	getStateAnimName(stateName: string): string {
		return {
			WalkingState: 'Walk',
			RunningState: 'Walk',
			JumpingState: 'fast walk',
			JumpingState2: 'fast walk',
		}[stateName] || super.getStateAnimName(stateName)
	}
}

class War3StaticAny extends War3Object {
	hasBody = true
	static syncs = War3Object.syncs.concat([
		War3Monster.createTHREEArraySyncFn('size'),
		War3Monster.createSimpleSyncFn('modelUrl'),
	])
}

class War3AnimalAny extends War3Monster {
	static syncs = War3Monster.syncs.concat([
		War3Monster.createTHREEArraySyncFn('size'),
		War3Monster.createSimpleSyncFn('modelUrl'),
	])
}

class ThdStaticAny extends War3StaticAny {
}

class ThdCharacterAny extends War3AnimalAny {
}

var Classes = { }
;[
	require('./Objects/TerrainObject'),

	require('./Objects/ColladaObject'),

	require('./Objects/TreeObject'),
	require('./Objects/GrassObject'),

	require('./Objects/TimerObject'),
	require('./Objects/TriggerObject'),

	require('./Objects/UiObject'),
	require('./Objects/TerrainBrush'),

	War3Monster,
	War3AnimalAny,
	War3StaticAny,
	ThdStaticAny,
	ThdCharacterAny,

	War3Player,
	War3PlayerAlice,
	War3PlayerCirno,
].forEach(fn => {
	Classes[Utils.fname(fn)] = fn
})

class Cache {
	private len = 0
	private objects: { [s: string]: BaseObject } = { }
	private classes: { [s: string]: BaseObject[] } = { }
	get length() {
		return this.len
	}
	add(object: BaseObject) {
		this.objects[object.id] = object
		;(this.classes[object.cls] || (this.classes[object.cls] = [ ]))
			.push(object)
		this.len ++
	}
	reset() {
		this.objects = { }
		this.classes = { }
		this.len = 0
	}
	get(id: string): BaseObject {
		return this.objects[id]
	}
	cls(cls: string): BaseObject[] {
		return this.classes[cls] || [ ]
	}
}

class Objects extends Utils.AnimateList {
	private events = new Utils.EventDispatcher()
	private cache = new Cache()
	constructor(private physics: any,
				private scene: any) {
		super()
	}

	get(id: string) {
		var object = this.cache.get(id)
		return object && this.has(object) && object
	}

	cls(cls: string) {
		return this.cache.cls(cls).filter(object => this.has(object))
	}

	create(cls: string, id: string = '') {
		if (!cls || !Classes[cls]) {
			console.warn('[C] class ' + cls + ' is not found')
			return
		}

		var obj = id && this.get(id)
		if (obj && obj.cls === cls) {
			console.warn('[C] object ' + cls + '#' + obj.id + ' exists')
			return obj
		}
		else if (obj) {
			obj.finished = true
		}

		var object = new Classes[cls](id || Utils.guid(),
			this.events, this.physics, this.scene)
		this.add(object)
		this.cache.add(object)

		if (this.cache.length > this.length * 1.2) {
			this.cache.reset()
			this.apply(object => this.cache.add(object))
		}

		return object
	}

	on(type: string, callback: (source?: any, data?: any, fn?: Function) => void) {
		this.events.on(type, callback)
	}

	dispatch() {
		this.events.dispatch()
	}
}

export = Objects
