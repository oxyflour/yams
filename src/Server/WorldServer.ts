/// <reference path="../../ref/nedb/nedb.d.ts" />
/// <reference path="../../ref/express/express.d.ts" />

import nedb = require('nedb')
import express = require('express')

function rand64() {
    var s = Math.floor(Math.random() * 0xffffffff).toString(16)
    while (s.length < 8) s = '0' + s
    return s
}

function getSeed(seedFile: string) {
    var fs = require('fs'),
        seed = ''
    if (fs.existsSync(seedFile))
        seed = fs.readFileSync(seedFile, 'utf8')
    else fs.writeFile(seedFile,
        seed = rand64() + rand64() + rand64() + rand64())
    return seed
}

class WorldServer {
    seed: string
    db: nedb

    constructor(path: string) {
        var NeDB = require('nedb')
        this.db = new NeDB({ filename:path + '/world.db', autoload:true })
        this.seed = getSeed(path + '/seed')
    }

    serve(app: express.Application) {
        app.get('/seed', (req, res) => {
            res.json(this.seed)
        })

        app.all('/chunk/:chunkId/:key', (req, res) => {
            var q = { _id:'c_' + req.params.chunkId },
                k = req.params.key

            if (req.method == 'GET') {
                this.db.findOne(q, function(err, data) {
                    res.json(data && data[k] || 0)
                })
            }

            else if (req.method == 'POST') {
                var s = { }; s[k] = req.body
                this.db.update(q, { $set:s }, { upsert:true }, function(err) {
                    res.json(err || '')
                })
            }

            else {
                res.set(403)
            }
        })
    }
}

export = WorldServer