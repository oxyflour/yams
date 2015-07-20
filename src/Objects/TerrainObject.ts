import Utils = require('../Utils')

import BaseChunkObject = require('./BaseChunkObject');
import ThreeCannonObject = require('./ThreeCannonObject')

var noisejs = global.Noise ? global : require('noisejs')

const colorParams = {
    // r, g, b, dirt, sand, grass, rock
    SNOW:                   [0xff, 0xff, 0xff, 1.0, 0.0, 0.0, 0.0],
    TUNDRA:                 [0xdd, 0xdd, 0xbb, 0.5, 0.0, 0.5, 0.0],
    BARE:                   [0xbb, 0xbb, 0xbb, 0.0, 0.2, 0.0, 0.8],
    SCORCHED:               [0x99, 0x99, 0x99, 0.1, 0.0, 0.0, 0.9],
    TAIGA:                  [0xcc, 0xd4, 0xbb, 0.4, 0.0, 0.6, 0.0],
    SHRUBLAND:              [0xc4, 0xcc, 0xbb, 0.4, 0.4, 0.2, 0.0],
    TEMP_DESERT:            [0xe4, 0xe8, 0xca, 0.0, 1.0, 0.0, 0.0],
    TEMP_RAIN_FOREST:       [0xa4, 0xc4, 0xa8, 0.0, 0.0, 1.0, 0.0],
    TEMP_DECIDUOUS_FOREST:  [0xb4, 0xc9, 0xa9, 0.0, 0.0, 1.0, 0.0],
    GRASSLAND:              [0xc4, 0xd4, 0xaa, 0.0, 0.0, 1.0, 0.0],
    TROP_RAIN_FOREST:       [0x9c, 0xbb, 0xa9, 0.2, 0.0, 0.8, 0.0],
    TROP_SEASONAL_FOREST:   [0xa9, 0xcc, 0xa4, 0.3, 0.3, 0.4, 0.0],
    SUBSTROP_DESERT:        [0xe9, 0xdd, 0xc7, 1.0, 0.0, 0.0, 0.0],
}

const waterColor = new THREE.Color('rgb(253, 244, 227)')

//
// larger 'lod' value makes sparser plane, must be divided by segs
//
class SparsePlaneGeometry extends THREE.BufferGeometry {
    constructor(size: number, segs: number, lod: number) {
        super()
        var grid = size / segs,

            innerSegs = segs / lod - 1,
            innerSize = size - grid * lod / 2,
            innerGrid = innerSize / innerSegs,

            outerVerLen = segs * 4,

            verLen = outerVerLen + (innerSegs + 1) * (innerSegs + 1),
            vertices = new Float32Array(verLen * 3),
            normals = new Float32Array(verLen * 3),
            uvs = new Float32Array(verLen * 2),
            indices = new Uint32Array((segs + innerSegs) * 4 * 3 + innerSegs * innerSegs * 2 * 3)

        var i = 0
        ;[
            // x0, dx, y0, dy
            // bottom -> right -> top -> left
            [-size/2,  grid, -size/2,     0],
            [ size/2,     0, -size/2,  grid],
            [ size/2, -grid,  size/2,     0],
            [-size/2,     0,  size/2, -grid],
        ].forEach(p => {
            for (var m = 0, x = p[0], y = p[2];
                    m < segs;
                    m ++, x += p[1], y += p[3]) {
                vertices[i] = x
                vertices[i + 1] = y
                normals[i + 2] = 1
                i += 3
            }
        })
        for (var y = -innerSize/2; y <= innerSize/2; y += innerGrid) {
            for (var x = -innerSize/2; x <= innerSize/2; x += innerGrid) {
                vertices[i] = x
                vertices[i + 1] = y
                normals[i + 2] = 1
                i += 3
            }
        }

        var i = 0,
            c = innerSegs + 1
        ;[
            // s0, t0, dt
            [     0,       0,  1],
            [  segs,     c-1,  c],
            [segs*2,   c*c-1, -1],
            [segs*3, c*(c-1), -c],
        ].forEach(p => {
            for (var m = 0, s = p[0], t = outerVerLen + p[1];
                    m < innerSegs;
                    m ++, s += lod, t += p[2]) {
                for (var n = 0; n < lod; n ++) {
                    indices[i] = t
                    indices[i + 1] = n + s
                    indices[i + 2] = n + s + 1
                    i += 3
                }
                indices[i] = t
                indices[i + 1] = n + s
                indices[i + 2] = t + p[2]
                i += 3
            }
            for (var n = 0; n < lod; n ++) {
                indices[i] = t
                indices[i + 1] = n + s
                indices[i + 2] = (n + s + 1) % outerVerLen
                i += 3
            }
        })
        for (var n = 0; n < innerSegs; n ++) {
            for (var m = 0; m < innerSegs; m ++) {
                indices[i] = outerVerLen + m + n * c
                indices[i + 1] = indices[i] + 1
                indices[i + 2] = indices[i] + 1 + c
                i += 3
                indices[i] = outerVerLen + (m + 1) + (n + 1) * c
                indices[i + 1] = indices[i] - 1
                indices[i + 2] = indices[i] - 1 - c
                i += 3
            }
        }

        for (var i = 0; i < vertices.length / 3; i ++) {
            uvs[i * 2] = Utils.interp(-size/2, size/2, 0, 1, vertices[i * 3])
            uvs[i * 2 + 1] = Utils.interp(-size/2, size/2, 0, 1, vertices[i * 3 + 1])
        }

        this.addAttribute('index', new THREE.BufferAttribute(indices, 1))
        this.addAttribute('position', new THREE.BufferAttribute(vertices, 3))
        this.addAttribute('normal', new THREE.BufferAttribute(normals, 3))
        this.addAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    }
}

class TerrainObject extends ThreeCannonObject {
    hasBody = true
    chunkData: TerrainObject.IChunkData

    uiUneditable = true
    keepVisibleInChunk = true

    private lodNeedsUpdate

    constructor(id, events, physics, scene) {
        super(id, events, physics, scene)
        var size = BaseChunkObject.chunkManager.getChunkSize()
        this.size.set(size, size, 20)
        var pos = BaseChunkObject.chunkManager.getChunkPos(this.id)
        this.position.set(pos.x, 0, pos.y)
        var dirX = new THREE.Vector3(1, 0, 0)
        this.quaternion.setFromAxisAngle(dirX, -Math.PI / 2)
    }

    updateChunkData(data: TerrainObject.IChunkData) {
        this.chunkData = data
        this.resetBody()
        this.lodNeedsUpdate = false
        this.resetModel()
    }

    updateChunkModel() {
        this.lodNeedsUpdate = true
    }

    updateLOD(distance: number) {
        var cls = <typeof TerrainObject> this.constructor,
            lod = <THREE.LOD> this.model
        if (this.lodNeedsUpdate && this.model instanceof THREE.LOD) {
            this.lodNeedsUpdate = false
            ;[
                this.chunkData.getChunkSize() * 1.5,
                this.chunkData.getChunkSize() * 3.0,
            ].forEach((dist, index) => {
                var ready = 'lod_ready_' + index
                // lod models are created only when necessary
                if (!lod[ready] && distance < dist) {
                    var mesh = new THREE.Mesh(
                        cls.getCachedHeightGeometry(
                            this.chunkData, this.position.x, this.position.z, index * 2),
                        cls.getCachedSplattingMaterial())
                    mesh.receiveShadow = true
                    lod.addLevel(mesh, dist)
                    lod[ready] = true
                }
                if (!lod[ready]) {
                    this.lodNeedsUpdate = true
                }
            })
        }
        super.updateLOD(distance)
    }

    addShapes(body: CANNON.Body) {
        var cls = <typeof TerrainObject> this.constructor
        if (this.chunkData) {
            body.addShape(cls.getHeightField(this.chunkData, this.position.x, this.position.z),
                new CANNON.Vec3(-this.size.x / 2, -this.size.y / 2, 0))
            this.trigger('chunk-loaded')
        }
        else {
            body.addShape((<typeof TerrainObject> this.constructor).getCachedBoxShape(this.size),
                new CANNON.Vec3(0, 0, -this.size.z / 2))
            this.trigger('chunk-load')
        }
    }

    requireModel() {
        if (this.chunkData) {
            var cls = <typeof TerrainObject> this.constructor,
                model = new THREE.LOD(),
                mesh = new THREE.Mesh(
                    cls.getCachedHeightGeometry(
                        this.chunkData, this.position.x, this.position.z, 4),
                    cls.getCachedSplattingMaterial())
            model.addLevel(mesh, this.chunkData.getChunkSize() * 100)
            if (mesh.geometry['hasWater']) {
                var water = new THREE.Mesh(
                    cls.getCachedChunkGeometry(this.size.x, this.size.y),
                    cls.getCachedWaterMaterial())
                water.position.z = this.chunkData.getWaterHeight()
                model.add(water)
            }
            mesh.receiveShadow = true
            return <THREE.Object3D> model
        }
        else {
            return new THREE.Object3D()
        }
    }

    /*
     * TODO: remove this
     *
    requireMaterial() {
      var textureData = this.chunkData.getTexture(this.id)
      if (textureData) {
        var img = document.createElement('img')
        img.src = textureData
        return new THREE.MeshLambertMaterial({
            vertexColors: THREE.VertexColors,
            map: new THREE.Texture(img),
        })
      }
      return (<typeof TerrainObject> this.constructor).getCachedTerrainMaterial()
    }
    */

    static getHeightField(data: TerrainObject.IChunkData,
            px: number, py: number): CANNON.Heightfield {
        var s = data.getChunkSize(),
            g = data.getGridSize(),
            matrix = [ ]

        for (var x = -s/2; x <= s/2; x += g) {
            var a = [ ]
            for (var y = -s/2; y <= s/2; y += g)
                a.push(data.getHeight(px + x, py - y))
            matrix.push(a)
        }

        return new CANNON.Heightfield(matrix, {
            elementSize: g
        })
    }

    static getCachedHeightGeometry(data: TerrainObject.IChunkData,
            px: number, py: number, lod: number) {
        var key = 'CachedGeometry' + px + 'x' + py + '#' + lod,
            geo = TerrainObject[key],
            hash = data.getChunkHash(data.getChunkId(px, py))
        if (!geo || geo['hash'] !== hash) {
            geo = this.getHeightBufferGeometry(data, px, py, lod)
            geo.hash = hash
            TerrainObject[key] = geo
        }
        return geo
    }

    static getHeightBufferGeometry(data: TerrainObject.IChunkData,
            px: number, py: number, lod: number) {
        var s = data.getChunkSize(),
            g = data.getGridSize() / 2,
            w = data.getWaterHeight(),

            geometry = lod > 0 ?
                new SparsePlaneGeometry(s, s/g, lod) :
                new THREE.PlaneBufferGeometry(s, s, s/g, s/g),

            vertices: Float32Array = geometry.getAttribute('position').array,
            normals: Float32Array = geometry.getAttribute('normal').array,
            colors: Float32Array = new Float32Array(vertices.length),
            alpha: Float32Array = new Float32Array(vertices.length / 3 * 4),
            edgeNormals: THREE.Vector3[] = new Array(normals.length / 3),

            vecX = new THREE.Vector3(g, 0, 0),
            vecY = new THREE.Vector3(0, g, 0),
            color = new THREE.Color(),

            hasWater = false

        for (var i = 0, j = 0; i < vertices.length; i += 3, j += 4) {
            var x = vertices[i],
                y = vertices[i + 1],
                z = data.getHeight(px + x, py - y),
                p = data.getParams(px + x, py - y, colorParams)

            // setup height
            vertices[i + 2] = z

            // setup color
            colors[i    ] = p[0] / 255
            colors[i + 1] = p[1] / 255
            colors[i + 2] = p[2] / 255

            // setup texture splatting
            alpha[j    ] = p[3]
            alpha[j + 1] = p[4]
            alpha[j + 2] = p[5]
            alpha[j + 3] = p[6]

            // blend with water color
            if (z / w < 1.1) {
                var f = Utils.smoothstep(0.9, 1.1, z / w)
                color.setRGB(colors[i], colors[i + 1], colors[i + 2])
                color.lerp(waterColor, 1 - f)
                colors[i    ] = color.r
                colors[i + 1] = color.g
                colors[i + 2] = color.b
                alpha[j    ] *= f
                alpha[j + 1] *= f
                alpha[j + 2] *= f
                alpha[j + 3] *= f
            }

            // lower than the water?
            if (z < w) {
                hasWater = true
            }

            // add some noise to grass
            if (alpha[j + 2] > 0.3) {
                vecX.z = data.getHeight(px + x + vecX.x, py - y) - z
                vecY.z = data.getHeight(px + x, py - y - vecY.y) - z
                var n = vecX.clone().cross(vecY).normalize()
                // add dirt to grass
                if (n.z < 0.98) {
                    var f = Utils.smoothstep(0.85, 0.98, n.z),
                        d = alpha[j + 2] * (1 - f)
                    alpha[j + 2] -= d
                    alpha[j + 1] += d
                }
            }

            // udpate normals to create smooth edge
            if (Math.abs(x * x - s * s / 4) < 1e-3 ||
                Math.abs(y * y - s * s / 4) < 1e-3) {
                vecX.z = data.getHeight(px + x + vecX.x, py - y) - z
                vecY.z = data.getHeight(px + x, py - y - vecY.y) - z
                edgeNormals[i / 3] = vecX.clone().cross(vecY).normalize()
            }
        }

        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3))
        geometry.addAttribute('splattingAlpha', new THREE.BufferAttribute(alpha, 4))
        geometry.computeVertexNormals()

        for (var i = 0; i < normals.length; i += 3) {
            var n = edgeNormals[i / 3]
            if (n) {
                normals[i] = n.x
                normals[i + 1] = n.y
                normals[i + 2] = n.z
            }
        }

        geometry['hasWater'] = hasWater
        return geometry
    }

    /*
     * TODO: remove this
     *
    static getCachedTerrainMaterial() {
        var cache = TerrainObject,
            key = 'terrainMaterial'
        return cache[key] || (cache[key] = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            vertexColors: THREE.VertexColors,
        }))
    }
     */

    static getCachedSplattingMaterial() {
        var cache = TerrainObject,
            key = 'terrainSplattingMaterial'
        if (cache[key]) return cache[key]

        var shader = THREE.ShaderLib['TextureSplattingShader'],
            uniforms = THREE.UniformsUtils.clone(shader.uniforms),
            attributes = { splattingAlpha: { type:'f' } }

        ;[
            'images/terrain/dirt-512.jpg',
            'images/terrain/sand-512.jpg',
            'images/terrain/grass-512.jpg',
            'images/terrain/rock-512.jpg',
        ].forEach((url, i) => {
            var texture = THREE.ImageUtils.loadTexture(url)
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping
            uniforms['texture' + (i + 1)].value = texture
        })

        return cache[key] =  new THREE.ShaderMaterial({
            uniforms: uniforms,
            attributes: attributes,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader,
            vertexColors: THREE.VertexColors,
            lights: true,
            fog: true,
        })
    }

    static getCachedWaterMaterial() {
        var cache = TerrainObject,
            key = 'waterMaterial'
        return cache[key] || (cache[key] = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            map: THREE.ImageUtils.loadTexture('images/terrain/water-512.jpg'),
        }))
    }

    static getCachedChunkGeometry(x: number, y: number) {
        var cache = TerrainObject,
            key = 'chunkGeometry'
        return cache[key] || (cache[key] =
            new THREE.PlaneBufferGeometry(x, y))
    }
}

module TerrainObject {
    export interface IChunkData extends Utils.ChunkWorld {
        getWaterHeight(): number
        getGridSize(): number
        getTexture(chunkId: string): string
        getChunkHash(chunkId: string): string
        getHeight(x: number, y: number): number
        getParams(x: number, y: number, p: any): number[]
    }
}

export = TerrainObject
