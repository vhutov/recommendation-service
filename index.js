const config = require('./config')
const { users } = require('./schema/dummy')

const knex = require('knex')
const { DateTime } = require('luxon')
const redis = require('redis')

class UserService {
    /**
     * @type {knex.Knex}
     */
    #db

    /**
     * @param {knex.Knex} db
     */
    constructor(db) {
        this.#db = db
    }

    /**
     * Gets list of recently liked song ids
     * @param {number} userId
     * @param {{last_ts: ?number, limit: ?number}} options
     * @returns {Promise<number[]>} list of song ids
     */
    getRecentLikedIds = async (userId, { last_ts = null, limit = null } = {}) => {
        const ts_filter = last_ts ? `AND event_time >= datetime(${last_ts}, 'unixepoch')` : ''
        const limit_clause = limit ? `LIMIT ${limit}` : ''

        const rows = await this.#db.raw(`
            SELECT 
                song_id as id
            FROM 
                users_liked_songs
            WHERE 
                user_id = ${userId}
                ${ts_filter}
            ORDER BY 
                event_time DESC
            ${limit_clause}
        `)

        return rows.map(({ id }) => id)
    }

    /**
     * Gets list of recently saved song ids
     * @param {number} userId
     * @param {{last_ts: ?number, limit: ?number}} options
     * @returns {Promise<number[]>} list of song ids
     */
    getRecentSavedIds = async (userId, { last_ts = null, limit = null } = {}) => {
        const ts_filter = last_ts ? `AND event_time >= datetime(${last_ts}, 'unixepoch')` : ''
        const limit_clause = limit ? `LIMIT ${limit}` : ''

        const rows = await this.#db.raw(`
            SELECT 
                song_id as id
            FROM 
                users_saved_songs
            WHERE 
                user_id = ${userId}
                ${ts_filter}
            ORDER BY 
                event_time DESC
            ${limit_clause}
        `)

        return rows.map(({ id }) => id)
    }
}

class SimilarityService {
    /**
     * @type {redis.RedisClientType}
     */
    #redis

    /**
     *
     * @param {redis.RedisClientType} redis
     */
    constructor(redis) {
        this.#redis = redis
    }

    /**
     * For provided entity ids fetches similar entities
     * @param {number[]} ids
     * @param {{indexName: string, fan_out: ?number}} options
     * @returns {Promise<Object.<number, number[]>>} dict of similar entities
     */
    getSimilar = async (ids, { indexName, fan_out = 10 }) => {
        const key = SimilarityService.#redisKey(indexName)

        const pendingSimilarities = ids.map(async (id) => {
            const similarIds = await this.#redis.lRange(key(id), 0, fan_out)

            if (similarIds.length == 0) return null
            return [id, similarIds.map(Number)]
        })

        const similarities = (await Promise.allSettled(pendingSimilarities)).filter((r) => r.value).map((r) => r.value)

        return Object.fromEntries(similarities)
    }

    static #redisKey = (indexName) => (id) => `${indexName}:${id}`
}

class EnrichmentService {
    /**
     * @type {knex.Knex}
     */
    #db

    /**
     * @type {knex.Knex}
     */
    constructor (db) {
        this.#db = db
    }

    /**
     * Gets song data from db
     * @param {number[]} songIds
     * @returns {Promise<Object.<string, any>>} enriched songs data
     */
    enrichSongData = async (songIds) => {
        const rows = await this.#db.raw(`
            SELECT 
                *
            FROM 
                songs
            WHERE 
                id IN (${songIds.join(',')})`   
        )

        return rows
    }
}

async function main() {
    /**
     * @type {knex.Knex}
     */
    const db = knex(config.db)
    const redisClient = redis.createClient(config.redis)
    await redisClient.connect()

    const userService = new UserService(db)
    const similarityService = new SimilarityService(redisClient)
    const enrichmentService = new EnrichmentService(db)

    const date = DateTime.now().minus({ days: 2 })
    const options = { last_ts: date.toUnixInteger() }

    const [liked, saved] = await Promise.all([
        userService
            .getRecentLikedIds(users.Joe.id, options)
            .then((liked) => similarityService.getSimilar(liked, config.songsRecommendations))
            .then((values) => Object.values(values).flat())
            .then((ids) => enrichmentService.enrichSongData(ids)),
        userService
            .getRecentSavedIds(users.Joe.id, options)
            .then((saved) => similarityService.getSimilar(saved, config.songsRecommendations))
            .then((values) => Object.values(values).flat())
            .then((ids) => enrichmentService.enrichSongData(ids)),
    ])

    console.log('Liked', liked)
    console.log('Saved', saved)


    await db.destroy()
    await redisClient.disconnect()
}

main()
