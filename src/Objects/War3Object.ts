/// <reference path="../../ref/threejs/three.d.ts" />

import ThreeCannonObject = require('./ThreeCannonObject')

interface IW3Character {
    root: THREE.Object3D
    constructor(geos: THREE.Geometry)
    beforeRender(dt: number)
    playAnimation(name: string | string[], speed: number, time: number)
}

interface ILoadWar3Mdl {
    (url: string, callback: (geos: THREE.Geometry[]) => void)
}

class War3Object extends ThreeCannonObject {
    castShadow = true

    private character: IW3Character = null
    private animNames: { [s: string]: string[] } = { }
    private initAnimArgs

    static parseAnimationGroup(animations) {
        var animGroup: { [s: string]: string[] } = {
            walk: [ ],
            attack: [ ],
            spell: [ ],
            stand: [ ],
        }

        for (var i = 0, a; a = animations[i]; i ++) {
            var name = a.name.toLowerCase(),
                list: string[] = null

            if (name.indexOf('walk') >= 0)
                list = animGroup['walk']

            else if (name.indexOf('attack') >= 0)
                list = animGroup['attack']

            else if (name.indexOf('spell') >= 0)
                list = animGroup['spell']

            // don't want 'Stand Ready'
            else if (name.indexOf('stand') >= 0 && name.indexOf('ready') < 0)
                list = animGroup['stand']

            if (list) {
                list.push(a.name)
                list[a.name] = ''+i
            }
        }

        return animGroup
    }

    static w3mResLoader(url: string, callback: (any) => void) {
        console.log('[O] loading war3 model ' + url)
        var loader: ILoadWar3Mdl = THREE['LoadWar3Mdl'],
            path = url.replace(/[^/]+\.w3m$/i, '')
        loader(url.replace(/\.w3m$/i, '.txt'), function(geometries) {
            // update texture path
            geometries.forEach(function(geo) {
                var texture = geo['extra'].TexturePath || '',
                    fname = texture.split('\\').pop().replace(/\.\w+$/g, '.png')
                geo['extra'].TexturePath = path + fname.toLowerCase()
            })
            callback(geometries)
        })
    }

    cloneModel(geometries) {
        this.character = new (THREE['W3Character'])(geometries)
        this.animNames = War3Object.parseAnimationGroup(geometries[0]['animations'])

        if (this.initAnimArgs) {
            this.playAnimation.apply(this, this.initAnimArgs)
            this.initAnimArgs = null
        }

        return ThreeCannonObject.wrapModelObject(this.character.root,
            [-Math.PI/2, 0, Math.PI/2], 'bottom', this.size.y)
    }

    playAnimation(name: string, speed: number = 1, time: number = NaN) {
        if (this.character)
            this.character.playAnimation(this.animNames[name] || name, speed, time)
        else
            this.initAnimArgs = [].slice.call(arguments)
    }

    render(camera: any) {
        this.character && camera.lastRenderDelta > 0 &&
            this.character.beforeRender(camera.lastRenderDelta / 1000)
        super.render(camera)
    }
}

export = War3Object
