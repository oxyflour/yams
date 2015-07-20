import Utils = require('../Utils')

const ELEVATION_SCALE = 512
const MOISTURE_SCALE = 512

const VORONOI_CHUNK = 128
const VORONOI_NOISE = 8

var noisejs = global.Noise ? global : require('noisejs')

// ref: http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/
const biomeTable = [
	'SNO|SNO|SNO|TUN|BAR|SCO',
	'SNO|SNO|SNO|TUN|BAR|SCO',
	'SNO|SNO|SNO|TUN|BAR|SCO',
	'TAI|TAI|SHR|SHR|TED|TED',
	'TAI|TAI|SHR|SHR|TED|TED',
	'TRF|TDF|TDF|GRA|GRA|TED',
	'TRF|TDF|TDF|GRA|GRA|TED',
	'RRF|RRF|TSF|TSF|GRA|SUD',
	'RRF|RRF|TSF|TSF|GRA|SUD',
].map(s => s.split('|').map(s => {
	return {
		SNO: 'SNOW',
		TUN: 'TUNDRA',
		BAR: 'BARE',
		SCO: 'SCORCHED',
		TAI: 'TAIGA',
		SHR: 'SHRUBLAND',
		TED: 'TEMP_DESERT',
		TRF: 'TROP_RAIN_FOREST',
		TDF: 'TEMP_DECIDUOUS_FOREST',
		GRA: 'GRASSLAND',
		RRF: 'TROP_RAIN_FOREST',
		TSF: 'TROP_SEASONAL_FOREST',
		SUD: 'SUBSTROP_DESERT',
	}[s]
}))

// height is updated from these params
const heightParams: { [s: string]: number[] } = {
	// biome name:		[mix, pers, amp, scale]
	SNOW: 				[ 0.0, 	-0.2, 	0.2,	 0.3],
	BARE: 				[ 0.1, 	 0.2, 	0.0, 	 0.0],
	TAIGA: 				[-0.2, 	 0.0, 	0.0, 	 0.0],
	TEMP_DESERT: 		[-0.2, 	-0.3, 	0.2, 	 0.0],
	GRASSLAND: 			[-0.25,	-0.4,  -0.5, 	-0.2],
	SUBSTROP_DESERT: 	[-0.2, 	-0.4, 	0.0, 	 0.0],
	SHRUBLAND: 			[-0.2, 	 0.2, 	0.2,	 0.6],
}

function pow2(x, n) {
	while (n --)
		x = x * x
	return x
}

class Terrain {
	constructor(private seed: string,
			private maxHeight: number,
			private waterHeight: number) {
		this.moistureNoise = [
			new noisejs.Noise(parseInt(seed.substr(0, 4), 16)),
			new noisejs.Noise(parseInt(seed.substr(4, 4), 16))
		]
		this.elevationNoise = [
			new noisejs.Noise(parseInt(seed.substr(2, 4), 16)),
			new noisejs.Noise(parseInt(seed.substr(6, 4), 16))
		]
		this.voronoiSeed = parseInt(seed.substr(8, 4), 16)
		this.biomeEdgeNoise = [
			new noisejs.Noise(parseInt(seed.substr(12, 4), 16)),
			new noisejs.Noise(parseInt(seed.substr(16, 4), 16))
		]
		this.heightNoise = this.elevationNoise.concat([
			new noisejs.Noise(parseInt(seed.substr(10, 4), 16)),
			new noisejs.Noise(parseInt(seed.substr(14, 4), 16)),
			new noisejs.Noise(parseInt(seed.substr(18, 4), 16))
		])
	}

	private moistureNoise: any[]
	private getMoisture(x: number, y: number): number /* [0, 1) */ {
		var val = 0,
			freq = 1
		this.moistureNoise.forEach((noise) => {
			var n = noise.simplex2(x * freq / MOISTURE_SCALE, y * freq / MOISTURE_SCALE)
			val += (n + 1) / 2
			freq *= 2
		})
		return val / this.moistureNoise.length
	}

	private elevationNoise: any[]
	private getElevation(x: number, y: number): number /* [0, 1) */ {
		var	freq = 1,
			pers = 0.5,
			amp = 1,

			val = 0,
			max = val

		this.elevationNoise.forEach((noise) => {
			var n = noise.simplex2(x * freq / ELEVATION_SCALE, y * freq / ELEVATION_SCALE)
			val += (n + 1) / 2 * amp
			max += amp
			freq *= 2
			amp *= pers
		})
		return val / max
	}

	private voronoiSeed: number
	private voronoiIndexCache = { }
	private getVoronoiPointsByIndex(i: number, j: number): any[] {
		var size = VORONOI_CHUNK,
			key = i + 'x' + j

		if (this.voronoiIndexCache[key])
			return this.voronoiIndexCache[key]

		var seed = Utils.nextrand(this.voronoiSeed, i, j),
			ptc = 1 + Math.floor(seed * 3),
			pts = [ ]
		for (var k = 0; k < ptc; k ++) {
			var pt: any = { }
			pt.x = (i + Utils.nextrand(1, k, seed)) * size
			pt.y = (j + Utils.nextrand(2, k, seed)) * size
			pt.moisture = this.getMoisture(pt.x, pt.y)
			pt.elevation = this.getElevation(pt.x, pt.y)

			var w = this.waterHeight / this.maxHeight
			if (pt.elevation < w) {
				pt.biome = 'SUBSTROP_DESERT'
			}
			else {
				var e = (pt.elevation - w) / (1 - w),
					rows = biomeTable.length,
					row = rows - 1 - Math.floor(rows * e),
					cols = biomeTable[0].length,
					col = cols - 1 - Math.floor(cols * pt.moisture)
				pt.biome = biomeTable[row][col]
			}

			pts.push(pt)
		}

		return this.voronoiIndexCache[key] = pts
	}
	private voronoiPointsCache = { }
	private getNearbyVoronoiPoints(x: number, y: number): any[] {
		var size = VORONOI_CHUNK,
			ii = Math.floor(x / size),
			jj = Math.floor(y / size),
			key = ii + 'x' + jj

		if (this.voronoiPointsCache[key])
			return this.voronoiPointsCache[key]

		var pts = [ ]
		// Note: we only need to check the nearby 3x3 chunks
		// because there is at least one point in each chunk
		for (var i = ii - 1; i <= ii + 1; i ++)
			for (var j = jj - 1; j <= jj + 1; j ++)
				pts.push.apply(pts, this.getVoronoiPointsByIndex(i, j))

		return this.voronoiPointsCache[key] = pts
	}

	private biomeEdgeNoise: any[]
	private getBiomePoints(x: number, y: number): any[] {
		// create noisy edges
		var size = VORONOI_CHUNK / 4,
			noise = VORONOI_NOISE
		x += this.biomeEdgeNoise[0].simplex2(x / size, y / size) * noise
		y += this.biomeEdgeNoise[1].simplex2(x / size, y / size) * noise

		var pts = this.getNearbyVoronoiPoints(x, y).map((pt) => {
			return { p:pt, r:Utils.hypot(pt.x - x, pt.y - y) }
		})

		pts.sort((p1, p2) => {
			return p1.r - p2.r
		})

		return pts
	}

	// Note: p is sth like
	// {
	//   SNOW:  [p1, p2, ...]
	//   TAIGA: [p1, p2, ...]
	// }
	// and the result is the blended number array by biome
	// [p1, p2, ...]
	getParams(x: number, y: number, p: { [s: string]: number[] }): number[] {
		var pts = this.getBiomePoints(x, y),
			params = [ ],
			weightSum = 0

		// use IDW to blend params (r^6)
		pts.forEach((pt) => {
			var w = 1 / (pow2(pt.r, 2) * pow2(pt.r, 1) + 1e-6),
				d = p[pt.p.biome]
			if (d) d.forEach((v, i) => {
				params[i] = (params[i] || 0) + v * w
			})
			weightSum += w
		})

		return params.map(v => (v || 0) / (weightSum || 1))
	}

	getBiome(x: number, y: number): string {
		var pts = this.getBiomePoints(x, y)
		return pts[0] && pts[0].p.biome
	}

	private heightNoise: any[]
	getHeight(x: number, y: number): number {
		var params = this.getParams(x, y, heightParams),

			mix = 0.3 + params[0],
			pers = 0.5 + params[1],
			amp  = 1 + params[2],
			scale = 1 + params[3],

			freq = 1,
			val = 0,
			max = val

		this.heightNoise.forEach((noise) => {
			var f = freq / ELEVATION_SCALE,
				n = noise.simplex2(x * f, y * f)
			val += (n + 1) / 2 * amp
			max += amp
			freq *= 2
			amp *= pers
		})

		return Utils.lerp(val / max * scale, this.getElevation(x, y), mix) * this.maxHeight
	}
}

export = Terrain
