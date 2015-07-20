$.fn.rebind = function(type, callback) {
    var that = this,
        key = 'callback_' + type,
        fn = callback[key] || (callback[key] = function(e) {
            if (callback(e)) that.off(type, fn)
        })
    that.off(type, fn).on(type, fn)
}

var config = (function() {
    var it = {
        viewDepth: 128
    }
    location.search.substr(1).split('&').forEach(function(s) {
        var st = s.split('=')
        it[st[0]] = st[1] || ''
    })
    return it
})()

/*
 * init THREE
 */

var renderer = (function() {
    var it
    try {
        it = new THREE.WebGLRenderer({ antialias:true })
    }
    catch (e) {
        it = new THREE.CanvasRenderer()
    }
    it.gammaInput = true
    it.gammaOutput = true
    it.shadowMapEnabled = true
    it.shadowMapCascade = true
    //it.shadowMapType = THREE.PCFSoftShadowMap
    //it.shadowMapDebug = true
    it.domElement.tabIndex = 1
    $(it.domElement).appendTo('body')
    return it
})()

var camera = (function() {
    var it = new THREE.PerspectiveCamera(45,
        window.innerWidth/window.innerHeight, 1,
        config.viewDepth + 100)
    it.position.set(0, 2, 4)
    it.lookAt(new THREE.Vector3())

    var sky = new THREE.Mesh(
        new THREE.SphereGeometry(config.viewDepth, 16, 8),
        new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.Sky.uniforms),
            vertexShader: THREE.ShaderLib.Sky.vertexShader,
            fragmentShader: THREE.ShaderLib.Sky.fragmentShader,
            side: THREE.BackSide,
            fog: true,
        })
    )
    sky.geometry.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI/2))
    it.add(new THREE.Gyroscope().add(sky))

    var control = new THREE.OrbitControls(it, renderer.domElement)
    control.noKeys = true
    //control.minPolarAngle = 0
    //control.maxPolarAngle = 1.5
    control.maxDistance = config.viewDepth / 2
    control.minDistance = 2

    var holder = new THREE.Gyroscope(),
        raycaster = new THREE.Raycaster()

    it.update = function(dt) {
        raycaster.far = control.maxDistance
        raycaster.set(holder.position, this.position)
        var intersects = raycaster.intersectObjects(scene.children),
            intersection = intersects && intersects[0],
            cameraDistance = this.position.length()
        if (intersection) {
            if (!this.restoreDistance)
                this.restoreDistance = cameraDistance
            var maxDistance = intersection.distance
            if (cameraDistance > maxDistance)
                this.position.multiplyScalar(0.9 + 0.1 * maxDistance / cameraDistance)
        }
        else if (this.restoreDistance) {
            var restoreDistance = this.restoreDistance
            if (cameraDistance < restoreDistance)
                this.position.multiplyScalar(1 + 0.02 * restoreDistance / cameraDistance)
            else
                this.restoreDistance = 0
        }

        control.update(dt)
    }

    it.control = control

    holder.add(it)
    return it
})()

var scene = (function() {
    var it = new THREE.Scene()

    it.fog = new THREE.Fog(0xffffff, config.viewDepth / 2, config.viewDepth)

    it.add(new THREE.AmbientLight(0x555555))

    var light = new THREE.DirectionalLight(0x777777, 2.25)
    light.position.set(0, 20, 10)
    light.castShadow = config.enableShadow
    light.shadowCameraNear = 0
    light.shadowCameraFar = 100
    light.shadowCameraLeft = -50
    light.shadowCameraRight = 50
    light.shadowCameraTop = 50
    light.shadowCameraBottom = -50
    light.shadowMapWidth = 2048
    light.shadowMapHeight = 2048
    light.shadowMapDarkness = 0.95
    //light.shadowCameraVisible = true
    light.shadowCascade = config.enableShadow
    light.shadowCascadeOffset = new THREE.Vector3(0, 0, -10)
    light.shadowCascadeCount = 3
    light.shadowCascadeNearZ  = [-1.000, 0.900, 0.950]
    light.shadowCascadeFarZ   = [ 0.900, 0.950, 0.980]
    light.shadowCascadeWidth  = [2048, 2048, 2048]
    light.shadowCascadeHeight = [2048, 2048, 2048]
    it.add(light)

    it.add(camera.parent)

    $(window).bind('resize', function(e) {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
    }).trigger('resize')

    THREE.Loader.Handlers.add(/\.tga$/i, new THREE.TGALoader());

    return it
})()

/*
 * init game client
 */

var Client = require('./build/Client'),
    Utils = require('./build/Utils')
    client = new Client(scene)

var keys = new function() {
    this.keyName = function(which) {
        return {
            13: 'RETURN',
            27: 'ESCAPE',
            32: 'SPACE',
            37: 'LEFT',
            38: 'UP',
            39: 'RIGHT',
            40: 'DOWN',
        }[which] || String.fromCharCode(which)
    }
    this.update = function(evt) {
        this.shiftKey = evt.shiftKey
        this.ctrlKey = evt.ctrlKey
        // translate key code to char
        var c = this.keyName(evt.which)
        // update key state
        if (evt.type == 'keydown')
            this[c] = 1
        else if (evt.type == 'keyup')
            this[c] = 0
    }
    this.inputs = [ ]

    $(window).bind('keydown keyup', function(e) {
        keys.last = {
            type: e.type,
            which: e.which,
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey
        }
        keys.inputs.push(keys.last)
    })
}

var mouse = new function() {

    var pos = { }
    $(renderer.domElement).on('mousedown', function(e) {
        // Note: must attach events before TransformControls
        pos = { x:e.clientX, y:e.clientY }
    })
    $(renderer.domElement).on('click', function(e) {
        if (pos.x == e.clientX && pos.y == e.clientY && config.godMode)
            mouse.select(ray.pick(e.clientX, e.clientY))
    })

    var box = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color:0xff0000, wireframe:true }))
    box.visible = false
    scene.add(box)

    var ctrl = new THREE.TransformControls(camera, renderer.domElement)
    ctrl.addEventListener('change', function(e) {
        box.objectToUpdate = selectedObject
    })
    ctrl.addEventListener('mouseDown', function(e) {
        camera.control.enabled = false
        if (selectedObject && selectedObject.onMouseControlDown)
            selectedObject.onMouseControlDown()
    })
    ctrl.addEventListener('mouseUp', function(e) {
        camera.control.enabled = true
        if (selectedObject && selectedObject.onMouseControlUp)
            selectedObject.onMouseControlUp()
    })
    ctrl.visible = false
    ctrl.attach(box)
    scene.add(ctrl)

    this.update = function() {
        ctrl.update()
        if (box.objectToUpdate) {
            if (box.objectToUpdate === selectedObject) {
                selectedObject.updateBody(box.position, box.quaternion)
                client.commitObject(selectedObject.id)
                if (selectedObject.onMouseControlUpdate)
                    selectedObject.onMouseControlUpdate()
            }
            box.objectToUpdate = false
        }
        if (selectedObject) {
            box.position.copy(selectedObject.position)
            box.quaternion.copy(selectedObject.quaternion)
        }
    }

    var selectedObject
    this.select = function(object) {
        selectedObject = object
        box.visible = !!object

        // you can not move dynamic objects
        ctrl.visible = !!object && !(object.mass > 0) && !object.uiUneditable
        ctrl[ctrl.visible ? 'attach' : 'detach'](box)
        ctrl.setMode('translate')

        $('body')[object ? 'addClass' : 'removeClass']('info-open')
        var objectUI = $('#info .object-ui').empty()
        if (object) {
            box.scale.copy(object.size)
            box.position.copy(object.position)
            box.quaternion.copy(object.quaternion)
            $('#info .cls').text(object.cls)
            $('#info .id').text('i: ' + object.id.substr(0, 8))
            $('#info .btn-scale')[object.canRescale ? 'show' : 'hide']()
            object.getEditorUI && object.getEditorUI(objectUI)
        }
    }

    var ray = new THREE.Raycaster()
    // see three.js #6559
    ray.fromCamera = function(px, py, camera) {
        var origin = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld),
            x = px / window.innerWidth * 2 - 1,
            y = 1 - py / window.innerHeight * 2,
            direction = new THREE.Vector3(x, y, 0.5).unproject(camera).sub(origin).normalize()
        ray.set(origin, direction)
        return ray
    }
    ray.pick = function(px, py) {
        var intersects = ray.fromCamera(px, py, camera)
                .intersectObjects(scene.children, true),
            selected = null
        if (intersects.length) intersects.forEach(function(intersection) {
            var child = intersection.object
            while (child && !child.objectId)
                child = child.parent
            if (child && child.objectId) {
                var object = client.objects.get(child.objectId)
                if (!object.uiUneditable) {
                    selected = object
                    selected.intersection = intersection
                    return true
                }
            }
        })
        return selected
    }

    $('#info .btn-close').click(function(e) {
        mouse.select(null)
    })

    $('#info .btn-scale').click(function(e) {
        ctrl.setMode('scale')
    })

    $('#info .btn-rotate').click(function(e) {
        ctrl.setMode('rotate')
    })

    $('#info .btn-translate').click(function(e) {
        ctrl.setMode('translate')
    })

    $('#info .btn-remove').click(function(e) {
        if (selectedObject) {
            selectedObject.finished = true
            client.commitObject(selectedObject.id)
        }
        mouse.select(null)
    })

    setInterval(function() {
        if (selectedObject) {
            var p = selectedObject.position,
                c = selectedObject.chunkId,
                t = ~~p.x + ',' + ~~p.y + ',' + ~~p.z + '/' + c,
                b = client.world.getBiome(p.x, p.z)
            $('#info .position').text('p: ' + t)
            $('#info .biome').text('b: ' + b)
        }
    }, 1000)
}

var ui = new function() {
    var isOpen,
        className
    Object.defineProperty(this, 'isOpen', {
        get: function() {
            return isOpen
        },
        set: function(v) {
            isOpen = v
            $('body')[isOpen ? 'addClass' : 'removeClass']('ui-open')
        },
    })
    Object.defineProperty(this, 'className', {
        get: function() {
            return className
        },
        set: function(v) {
            return $('#ui').attr('class', className = v)
        },
    })

    $(window).on('keyup', function(e) {
        if (keys.keyName(e.which) === 'E') {
            if (!ui.isOpen)
                ui.className = 'e'
            if (ui.className === 'e')
                ui.isOpen = !ui.isOpen
        }
        else if (keys.keyName(e.which) === 'ESCAPE') {
            if (ui.className === 'e')
                ui.isOpen = false
        }
    })
}

$(document).on('poll-join', function() {
    if (client.playerObject) return

    var savedPosition = localStorage.getItem('player-last-position'),
        lastPosition = savedPosition && savedPosition.split(',').map(parseFloat)
    if (lastPosition) camera.parent.position.fromArray(lastPosition)

    client.joinGame({
        cls: 'War3PlayerCirno',
        id: location.hash.replace(/^#/, '') || (location.hash = Utils.guid()),
        position: lastPosition
    })

    setTimeout(function() {
        $(document).trigger('poll-join')
    }, 1000)
}).trigger('poll-join')

$(document).on('client-statics', function(evt, data) {
    $('#statics .ping-fps').text(data.ping + '/' +
        data.fps.toFixed(1) + '/' +
        data.physics.toFixed(1))
    $('#statics .objects').text(data.objects + '/' + data.models + '/' + data.bodies)
})

$(document).on('player-use', function(evt, callback) {
    ui.isOpen = true
    ui.className = 'u'

    ui.pendingKeyup = true
    $(window).rebind('keyup', ui.finishUsing = ui.finishUsing || function(e) {
        if (ui.pendingKeyup) return ui.pendingKeyup = false
        if ({ ESCAPE:1, F:1 }[keys.keyName(e.which)]) {
            ui.isOpen = false
            return callback() || true
        }
    })
})

$(document).on('player-talk', function(evt, callback) {
    ui.isOpen = true
    ui.className = 't'

    // TODO
    var parent = $('#ui .talk .content').text('loading...')
    $.get('/story/dialog/hello.json', function(data) {
        var messages = data && data.messages || { },
            defaultDiv = null

        parent.empty()
        Object.keys(messages).forEach(function(key) {
            var diagData = messages[key] || { },
                text = $('<div></div>').text(diagData.text),
                options = $('<div></div>')

            if (Array.isArray(diagData.options)) diagData.options.forEach(function(option) {
                var input = $('<input type="radio" name="option" />').val(option.next),
                    text = $('<span></span>').text(option.text)
                $('<label></label>')
                    .append(input)
                    .append(text)
                    .appendTo(options)
            })

            var div = $('<div></div>')
                .attr('class', 'diag hidden')
                .attr('key', key)
                .attr('next', diagData.next)
                .append(text)
                .append(options)
                .appendTo(parent)

            if (!defaultDiv || diagData.isDefault)
                defaultDiv = div
        })

        if (defaultDiv) defaultDiv.removeClass('hidden')
            .find('input:first').focus().prop('checked', true)
    })

    ui.pendingKeyup = true
    $(window).rebind('keyup', ui.finishTalking = ui.finishTalking || function(e) {
        if (ui.pendingKeyup) return ui.pendingKeyup = false

        var key = keys.keyName(e.which)
        if (key === 'ESCAPE') {
            ui.isOpen = false
            return callback() || true
        }
        else if (key === 'F') {
            var active = parent.children(':visible'),
                options = active.find('input'),
                selected = options.filter(':checked'),
                next = selected.length ? selected.val() : active.attr('next'),
                div = parent.children('[key="' + next + '"]')
            if (div.length) {
                parent.children().addClass('hidden')
                div.removeClass('hidden')
                    .find('input:first').focus().prop('checked', true)
            }
            else {
                ui.isOpen = false
                return callback(next) || true
            }
        }
        else if (key === 'W' || key === 'S') {
            parent.children(':visible')
                .find('input:checked').parent()[ { W:'prev', S:'next' }[key] ]()
                .find('input').focus().prop('checked', true)
        }
    })
})

$(document).ready(function(e) {

    $('select[select-target]').on('change', function(e) {
        $($(this).attr('select-target')).children().addClass('hidden')
            .eq($(this).children(':selected').index()).removeClass('hidden')
    }).trigger('change')

    $('.equip .checkbox-config-god-mode').on('change', function(e) {
        config.godMode = $(this).prop('checked')

        client.objects.apply(function(object) {
            if (object.visibleGodModeOnly)
                object.hasModel = config.godMode
            if (!object.hasModel && object.model)
                object.resetModel()
        })

        if (!config.godMode)
            mouse.select(null)

        $('.equip .select-equip-tab')
            .children('.god-mode-only')[config.godMode ? 'show' : 'hide']()
            .parent().trigger('change')
    }).trigger('change')

    $('.equip .checkbox-config-enable-shadow')
        .prop('checked', config.enableShadow)

    $('.equip .btn-save-settings').click(function(e) {
        var $this = $(this);
        client.saveChunks(function() {
            $this.parents('form').first().submit()
        })
    })

    $('.equip .btn-close').click(function(e) {
        ui.isOpen = false
    })

    $('.equip .btn-save').click(function(e) {
        var $this = $(this)
        if ($this.css('opacity') != 0.5) {
            $this.css('opacity', 0.5)
            client.saveChunks(function() {
                $this.css('opacity', 1)
            })
        }
        if (client.playerObject) localStorage.setItem('player-last-position',
            client.playerObject.position.toArray().join(','))
    })

    $('.equip .btn-create').click(function(e) {
        var player = client.playerObject
        if (!player) return

        var selected = $(this).parent().find('select').children(':selected'),
            cls = selected.attr('create-class') || $(this).attr('create-class'),
            object = client.objects.create(cls),
            size = selected.attr('size') &&
                object.size.fromArray(selected.attr('size').split(' ').map(parseFloat))

        if (cls == 'War3StaticAny' || cls == 'War3AnimalAny') {
            object.modelUrl = 'models/w3/' + selected.val() + '.w3m'
        }
        else if (cls == 'ThdStaticAny' || cls == 'ThdCharacterAny') {
            object.modelUrl = 'models/mdl/' + selected.val() + '.w3m'
        }
        else if (cls == 'TreeObject') {
            object.modelUrl = Utils.randin(object.getUrls())
            object.size.y = Math.floor(Math.random() * 10 * 20) / 20 + 5
        }

        var distance = object.size.clone().add(player.size),
            direction = (distance.z = 0) || new THREE.Vector3(0, 0, distance.length() / 2)
                .applyQuaternion(player.quaternion),
            position = player.position.clone().sub(direction),
            height = client.world.getHeight(position.x, position.z),
            rotation = camera.getWorldRotation(),
            rotationY = (rotation.reorder('YXZ'), new THREE.Euler(0, rotation.y + Math.PI, 0))

        object.setBottomPosition(position.x, height, position.z)
        object.quaternion.setFromEuler(rotationY)
        client.commitObject(object.id)

        ui.isOpen = false
    })
})

var run = Utils.timer(function() {
    keys.hasInput = keys.inputs.length

    while (keys.lastInput = keys.inputs.shift())
        keys.update(keys.lastInput)

    if (!ui.isOpen && keys.hasInput)
        client.update(keys)

    client.run(50)
}, 50, null, 200)

var ping = Utils.timer(function() {
    client.ping()
}, 2000);

var clock = new THREE.Clock()
function render(time) {
    requestAnimationFrame(render)

    var dt = clock.getDelta()
    THREE.AnimationHandler.update(dt)

    camera.update(dt)
    camera.lastRenderDelta = dt * 1000
    camera.lastRenderTick = time

    mouse.update()

    client.render(camera)
    renderer.render(scene, camera)

    run(dt * 1000)
    ping(dt * 1000)
}
render()

client.connect()
