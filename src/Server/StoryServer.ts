/// <reference path="../../ref/express/express.d.ts" />

import express = require('express')

class StoryServer {
    constructor(private path: string) {
    }
    serve(app: express.Application) {
        // TODO
        app.use('/story', express.static(this.path))
    }
}

export = StoryServer
