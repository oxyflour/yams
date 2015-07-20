/// <reference path="../ref/superagent/superagent.d.ts" />

import Utils = require('./Utils')
import Objects = require('./Objects')

import Templates = require('./World/Templates')
import Terrain = require('./World/Terrain')

import TerrainObject = require('./Objects/TerrainObject')
import BaseObject = require('./Objects/BaseObject')

import BaseTemplate = require('./Templates/BaseTemplate')

var superagent = global.superagent || require('superagent')

class TempObjects implements BaseTemplate.IObjects {
    constructor(private objects: Objects,
        private _list: BaseObject[] = [ ]) {
    }
    create(cls: string): BaseObject {
        var object = this.objects.create(cls)
        this._list.push(object)
        return object
    }
    list(): BaseObject[] {
        return this._list
    }
}

class World extends Utils.ChunkManager implements BaseTemplate.IWorld, TerrainObject.IChunkData {
    private seed: number
    private terrain: Terrain
    private templates: Templates
    private cachedChunks = { }

    constructor(
        chunkSize: number,
        private gridSize: number,
        private maxHeight: number,
        private waterHeight: number,
        private url: string,
        seed: string) {
        super(chunkSize)
        this.seed = parseInt(seed.substr(0, 4), 16)
        this.terrain = new Terrain(seed, maxHeight, waterHeight)
        this.templates = new Templates(this)
    }

    static connect(url: string, callback: (world: World) => void) {
        url = url || ''
        superagent.get(url + 'seed').end(res => {
            callback(new World(32, 2, 128, 32, url, res.body))
        })
    }

    getSeed() {
        return this.seed
    }

    getGridSize() {
        return this.gridSize
    }

    getWaterHeight() {
        return this.waterHeight
    }

    getBiome(x: number, y: number) {
        return this.terrain.getBiome(x, y)
    }

    getParams(x: number, y: number, p: any): number[] {
        return this.terrain.getParams(x, y, p)
    }

    getChunkHash(chunkId: string): string {
        var chunkData = this.cachedChunks[chunkId]
        return Utils.crc32(JSON.stringify(chunkData))
    }

    getHeight(x: number, y: number): number {
        var chunkId = this.getChunkId(x, y),
            chunkData = this.cachedChunks[chunkId]

        if (!chunkData) {
            var width = this.getChunkSize() * 0.001,
                chunkIds = this.getChunkInRect(x, y, width, width)
            chunkIds.some(cid => {
                if (chunkData = this.cachedChunks[cid]) {
                    return !!(chunkId = cid)
                }
            })
        }

        if (chunkData && chunkData.heightData) {
            var d = chunkData.heightData,
                p = this.getChunkPos(chunkId),
                s = this.getChunkSize(),
                g = this.gridSize,
                dx = x - (p.x - s / 2),
                dy = y - (p.y - s / 2),
                n = s / g + 1,
                ix = dx / g,
                iy = dy / g,
                nx = Math.floor(ix),
                ny = Math.floor(iy),
                fx = ix - nx,
                fy = iy - ny,
                lt = d[nx   + ny*n  ],
                rt = d[nx+1 + ny*n  ],
                lb = d[nx   + ny*n+n],
                rb = d[nx+1 + ny*n+n]
            if (+lt === lt && +rt === rt &&
                +lb === lb && +rb === rb)
                return Utils.lerp2(lt, rt, lb, rb, fx, fy)
        }
        return this.terrain.getHeight(x, y)
    }

    updateHeight(x: number, y: number, w: number, h: number,
            callback?: (x: number, y: number, h: number) => number) {
        var chunkIds = this.getChunkInRect(x, y, w, h),
            data = { }
        chunkIds.forEach(chunkId => {
            var chunkData = this.cachedChunks[chunkId]
            if (!chunkData || !chunkData.heightData)
                return

            var d = chunkData.heightData,
                p = this.getChunkPos(chunkId),
                s = this.getChunkSize(),
                g = this.gridSize,
                m = s / g + 1,
                bx = p.x - s/2,
                by = p.y - s/2,
                iMin = Math.floor(Math.max(0, (x-w/2) - bx) / g),
                iMax = Math.floor(Math.min(s, (x+w/2) - bx) / g),
                jMin = Math.floor(Math.max(0, (y-h/2) - by) / g),
                jMax = Math.floor(Math.min(s, (y+h/2) - by) / g)
            if (callback) for (var i = iMin; i <= iMax; i ++)
                for (var j = jMin; j <= jMax; j ++) {
                    var n = i + j * m
                    d[n] = callback(i * g + bx, j * g + by, d[n])
                }
            data[chunkId] = chunkData
        })
        return data
    }

    getTexture(chunkId: string) {
        var chunkData = this.cachedChunks[chunkId]
        return chunkData && chunkData.textureData
    }

    updateTexture(x: number, y: number, w: number, h: number,
            callback?: (dc: CanvasRenderingContext2D,
              canvas: HTMLCanvasElement,
              box: THREE.Box2) => void) {
        var data = { }
        if (typeof document === typeof undefined)
          return console.warn('[C] needs canvas to update texture!') || data

        var chunkIds = this.getChunkInRect(x, y, w, h),
          size = this.getChunkSize(),
          chunkPos = chunkIds.map(chunkId => this.getChunkPos(chunkId))
            .map(pt => new THREE.Vector2(pt.x, pt.y)),
          box = new THREE.Box2().setFromPoints(chunkPos)
            .expandByScalar(size / 2),
          canvas = document.createElement('canvas'),
          imsize = 256
        canvas.width = Math.floor((box.max.x - box.min.x) * imsize / size)
        canvas.height = Math.floor((box.max.y - box.min.y) * imsize / size)

        var img = document.createElement('img'),
          dc = <CanvasRenderingContext2D> canvas.getContext('2d')
        img.width = imsize
        img.height = imsize
        img.onload = e => img['loaded'] = true
        img.onerror = e => img['loaded'] = true
        chunkIds.map(chunkId => {
            var chunkData = this.cachedChunks[chunkId]
            if (!chunkData || !chunkData.textureData) return
            var pos = this.getChunkPos(chunkId)
            img['loaded'] = false
            img.src = chunkData.textureData
            // this is NAIVE!
            while (!img['loaded']);
            dc.drawImage(img,
                (pos.x - size / 2 - box.min.x) / size * imsize,
                (pos.y - size / 2 - box.min.y) / size * imsize,
                imsize, imsize)
        })

        callback(dc, canvas, box)

        img.src = canvas.toDataURL()
        img.width = canvas.width
        img.height = canvas.height
        canvas.width = imsize
        canvas.height = imsize
        chunkIds.forEach(chunkId => {
            var chunkData = this.cachedChunks[chunkId]
            if (!chunkData) return
            var pos = this.getChunkPos(chunkId)
            dc.drawImage(img,
                (pos.x - size / 2 - box.min.x) / size * imsize,
                (pos.y - size / 2 - box.min.y) / size * imsize,
                imsize, imsize,
                0, 0,
                imsize, imsize)
            chunkData.textureData = canvas.toDataURL()
            data[chunkId] = chunkData
        })
        return data
    }

    createChunkObjects(chunkId: string, objects: Objects,
            callback: () => void) {
        this.templates.load(chunkId, temps => {
            var p = this.getChunkPos(chunkId),
                s = this.getChunkSize(),
                g = this.gridSize

            // make the terrain
            var heightData = [ ]
            for (var y = p.y - s/2; y <= p.y + s/2; y += g)
                for (var x = p.x - s/2; x <= p.x + s/2; x += g) {
                    var h = this.terrain.getHeight(x, y)
                    temps.forEach(temp => {
                        h = temp.updateHeight(x, y, h)
                    })
                    heightData.push(h)
                }

            var chunkData = {
                heightData: heightData,
            }

            this.saveChunk(chunkId, chunkData, (err, res) => {
                // create terrain object
                objects.create('TerrainObject', chunkId)

                // create other objects
                var objectList = new TempObjects(objects)
                temps.forEach(temp => {
                    temp.generateObjects(objectList)
                })

                // finish
                callback()
            })
        })
    }

    loadData(key: string, callback: (data: any) => void) {
        superagent.get(this.url + 'chunk/' + key + '?' + Math.random()).end(res => {
            callback(res.ok ? res.body : null)
        })
    }

    saveData(key: string, data: any, callback?: (err, res) => void) {
        superagent.post(this.url + 'chunk/' + key).send(data).end(callback)
    }

    loadChunk(chunkId: string, callback: (data: any) => void) {
        this.loadData(chunkId + '/data?' + Math.random(), (data) => {
            callback(this.cachedChunks[chunkId] = data)
        })
    }

    saveChunk(chunkId: string, data: any, callback: (err, res) => void) {
        this.saveData(chunkId + '/data', this.cachedChunks[chunkId] = data, callback)
    }
}

export = World
