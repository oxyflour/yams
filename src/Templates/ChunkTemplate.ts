import BaseTemplate = require('./BaseTemplate')

interface ChunkTemplateParams {
	chunkIds: string[]
}

class ChunkTemplate extends BaseTemplate {
    static createLoader(data: ChunkTemplateParams) {
        var constructor: any = this
    	return (chunkId: string, world: BaseTemplate.IWorld,
                callback: (list: BaseTemplate[]) => void) => {
	        callback(data.chunkIds && data.chunkIds.indexOf(chunkId) >= 0 && [
                new constructor(chunkId, world, { })
            ])
    	}
    }
}

export = ChunkTemplate