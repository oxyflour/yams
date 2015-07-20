import ThreeCannonObject = require('./ThreeCannonObject')
import UiObject = require('./UiObject')

class SparsePath {
    private points = [ ]
    constructor(private minDistance: number) {
    }
    add(p: THREE.Vector3) {
        var d = this.points[this.points.length - 1]
        if (!d || p.distanceTo(d) > this.minDistance)
            this.points.push(p.clone())
    }
    get() {
        return this.points
    }
}

class TerrainBrush extends ThreeCannonObject implements UiObject.IEditableObject {
    static getCacheCylinderGeometry(radius: number, height: number) {
        var key = 'cachedCylinderGeometry_' + radius + '_' + height
        return TerrainBrush[key] || (TerrainBrush[key] =
            new THREE.CylinderGeometry(radius, radius, height, 16))
    }

    static getCachedBrushMaterial(color, opacity) {
        var key = 'cachedBrushMaterial_' + color
        if (TerrainBrush[key]) return TerrainBrush[key]
        var material = ThreeCannonObject.getCachedColorMaterial(color).clone()
        if (opacity < 1) {
            material.transparent = true
            material.opacity = opacity
        }
        return TerrainBrush[key] = material
    }

    size = new THREE.Vector3(3, 1, 3)
    evt = 'update-terrain'

    requireModel(): THREE.Object3D {
        var model = new THREE.Mesh(
            TerrainBrush.getCacheCylinderGeometry(this.size.x / 2, this.size.y),
            TerrainBrush.getCachedBrushMaterial(0xaaaaaa, 1))
        model.scale.set(1, 0.9, 1)
        var center = new THREE.Mesh(
            TerrainBrush.getCacheCylinderGeometry(this.size.x / 2, this.size.y),
            TerrainBrush.getCachedBrushMaterial(0xeeeeee, 0.6))
        center.scale.set(3, 0.5, 3)
        model.add(center)
        return model
    }

    enabled = true
    alpha = 0.5

    getEditorUI(elem: JQuery) {
        var object = this,
            model = object.model,
            modelScale = model.scale,
            centerScale = model.children[0].scale

        var content = $('<table>'+
                '<tr><td>radius</td><td class="input-radius"></td></tr>' +
                '<tr><td>hardness</td><td class="input-hardness"></td></tr>' +
                '<tr><td>alpha</td><td class="input-alpha"></td></tr>' +
                '<tr><td colspan="2"><label class="input-enable">'+
                    '<span>enabled</span></label></td></tr>' +
                '<tr><td colspan="2" class="btn-undo"></td><td></td></tr>' +
            '</table>').appendTo(elem)

        $('<input type="range" min="0.1" max="5" step="0.1" />')
            .appendTo(content.find('.input-radius'))
            .attr('value', modelScale.x)
            .change(function(e) {
                modelScale.x = modelScale.z = parseFloat($(this).val())
            })

        $('<input type="range" min="0.1" max="5" step="0.1" />')
            .appendTo(content.find('.input-hardness'))
            .attr('value', centerScale.x - 1)
            .change(function(e) {
                centerScale.x = centerScale.z = 1 + parseFloat($(this).val())
            })

        $('<input type="range" min="0.1" max="1" step="0.01" />')
            .appendTo(content.find('.input-alpha'))
            .attr('value', object.alpha)
            .change(function(e) {
                object.alpha = parseFloat($(this).val())
            })

        $('<input type="checkbox" />')
            .prependTo(content.find('.input-enable'))
            .prop('checked', this.enabled)
            .change(function(e) {
                object.enabled = $(this).prop('checked')
            })

        $('<button>Undo</button>')
            .appendTo(content.find('.btn-undo'))
            .click(function(e) {
                object.trigger('undo-redo-' + object.evt, true)
            })

        $('<button>Redo</button>')
            .appendTo(content.find('.btn-undo'))
            .click(function(e) {
                object.trigger('undo-redo-' + object.evt, false)
            })
    }

    pathPoints: THREE.Vector3[] = [ ]
    keepVisibleInChunk = false

    onMouseControlDown() {
        this.keepVisibleInChunk = true
        this.pathPoints = [ this.position.clone() ]
    }

    onMouseControlUpdate() {
        this.pathPoints.push(this.position.clone())
    }

    onMouseControlUp() {
        this.keepVisibleInChunk = false
        this.pathPoints.push(this.position.clone())
        if (!this.enabled) return

        var box = new THREE.Box3().setFromPoints(this.pathPoints),
            dist = box.min.distanceTo(box.max) / 10,
            path = new SparsePath(Math.max(dist, 1)),
            begin = this.pathPoints[0]
        this.pathPoints.reverse().forEach(p => path.add(p))

        var data: TerrainBrush.BrushParameters = {
            radius: this.model.scale.x * this.size.x,
            padding: this.model.children[0].scale.x - 1,
            alpha: this.alpha,
            box: box,
            path: path.get().reverse(),
            begin: begin,
        }
        this.trigger(this.evt, data)
    }
}

module TerrainBrush {
    export interface BrushParameters {
        radius: number
        padding: number
        alpha: number
        box: THREE.Box3
        path: THREE.Vector3[]
        begin: THREE.Vector3
    }
}

export = TerrainBrush
