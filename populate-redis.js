const redis = require('redis')
const config = require('./config')
const fs = require('fs')

const readFile = async (filename) => {
    const fileContent = (await fs.promises.readFile(filename)).toString()

    const similarityMap = {}
    for (const line of fileContent.split('\n')) {
        const entries = line.split(' ')
        const key = entries.shift()

        if (!key) continue
        similarityMap[key] = entries
    }

    return similarityMap
}

/**
 * 
 * @param {redis.RedisClientType} redis 
 * @param {Object.<string, string[]>} similarityMap
 * @param {string} indexName
 * @returns 
 */
const populateRedis = async (redis, similarityMap, indexName) => {
    const key = (id) => `${indexName}:${id}`

    const promises = Object.entries(similarityMap).map(async ([id, values]) => redis.lPush(key(id), values))

    await Promise.all(promises)

}

const flow = async (redis, filename, indexName) => {
    const similarityMap = await readFile(filename)

    await populateRedis(redis, similarityMap, indexName)
}

const main = async () => {

    const redisClient = redis.createClient(config.redis)
    await redisClient.connect()

    // const files = {
    //     'artist:collab:nn:partial:small': 'similar_artist.txt',
    //     'artist:collab:nn:full:small' : 'similarity-smaller.txt',
    //     'artist:collab:nn:full:big' : 'similarity-bigger.txt',
    // }

    const files = {
        'artist:collab:nn:less_negatives:small': 'similarity-smaller-05.txt',
        'artist:collab:nn:less_negatives:big': 'similarity-bigger-05.txt'
    }

    for (const [indexName, filename] of Object.entries(files)) {
        console.log('Populating ', indexName)
        await flow(redisClient, filename, indexName)
    }

    await redisClient.disconnect()
}

main()