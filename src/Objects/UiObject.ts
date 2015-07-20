/// <reference path="../../ref/jquery/jquery.d.ts" />

import ThreeCannonObject = require('./ThreeCannonObject')

module UiObject {
    export interface IEditableObject {
        getEditorUI(elem: JQuery)
        onMouseControlDown()
        onMouseControlUpdate(box: THREE.Object3D)
        onMouseControlUp()
    }
    export interface IUsableObject {
        getUsageUI(elem: JQuery)
    }
    export interface ITalkableObject extends IUsableObject {
        isTalking: boolean
    }
}

export = UiObject
