const config = require('./config')
const { users } = require('./schema/dummy')

const knex = require('knex')
const { DateTime } = require('luxon')
const redis = require('redis')

class UserService {
    /** @type {knex.Knex} */
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
    /** @type {redis.RedisClientType} */
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
    /** @type {knex.Knex} */
    #db

    /**
     * @param {knex.Knex} db
     */
    constructor(db) {
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
                id IN (${songIds.join(',')})`)

        return rows
    }
}

class RecommendationService {
    /** @type {UserService} */
    #userService
    /** @type {SimilarityService} */
    #similarityService
    /** @type {EnrichmentService} */
    #enrichmentService

    /**
     * @param {UserService} userService
     * @param {SimilarityService} similarityService
     * @param {EnrichmentService} enrichmentService
     */
    constructor(userService, similarityService, enrichmentService) {
        this.#userService = userService
        this.#similarityService = similarityService
        this.#enrichmentService = enrichmentService
    }

    /**
     * Convert number (id) into User Entity
     * @typedef {Object.<string, any>} Entity
     * @param {number|number[]} input
     * @returns {Promise<Entity[]>} input as user id
     */
    user = async (input) => {}

    /**
     * Copies property value to another property
     * @typedef {Object.<string, any>} Entity
     * @param {string} from param name
     * @param {string} to param name
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} entities with new property set
     */
    set = (from, to) => async (input) => {}

    /**
     * Finds similar entities. Copies properties from parent to children.
     * @typedef {Object.<string, any>} Entity
     * @param {*} options see SimilarityService#getSimilar options
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} similar entities for every entity from input
     */
    similar = (options) => async (input) => {}

    /**
     * Enriches Song Entities with song data
     * @typedef {Object.<string, any>} Entity
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} input entities, enriched with songs data
     */
    enrichSong = async (input) => {}

    /**
     * For User Entities fetches Song Entities. Copies over properties from parent to children.
     * @typedef {Object.<string, any>} Entity
     * @param {*} options see UserService#getRecentLikedIds
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} liked entities from input entities
     */
    liked =
        (options = {}) =>
        async (input) => {}

    /**
     * For User Entities fetches Song Entities. Copies over properties from parent to children.
     * @typedef {Object.<string, any>} Entity
     * @param {*} options see UserService#getRecentLikedIds
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} saved values from input entities
     */
    saved =
        (options = {}) =>
        async (input) => {}

    /**
     * Takes specified amount from input.
     * @typedef {Object.<string, any>} Entity
     * @param {number} limit
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} same as input but only [limit] elements
     */
    take = (limit) => async (input) => {}

    /**
     * Merges few flows into single flow
     * @typedef {Object.<string, any>} Entity
     * @param  {...Promise<Entity[]>} flows
     * @returns {Promise<Entity[]>} multiple flows merged together
     */
    merge = async (...flows) => {}

    /**
     * Deduplicates entities by specified property
     * @typedef {Object.<string, any>} Entity
     * @param {string} by property name
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} same as input but deduplicated
     */
    dedupe = (by) => async (input) => {}

    /**
     * Tries to sort values in a way that puts similar items further away from
     * each other
     * @typedef {Object.<string, any>} Entity
     * @param {string} by param name
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} same as input
     */
    diversify = (by) => async (input) => {}
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

    const recs = new RecommendationService(userService, similarityService, enrichmentService)

    const date = DateTime.now().minus({ days: 2 })
    const options = { last_ts: date.toUnixInteger() }

    const user = recs.user(users.Joe.id)

    const recommendations = await recs
        .merge(recs.liked(options)(user), recs.saved(options)(user))
        .then(recs.similar(config.songsRecommendations))
        .then(recs.enrichSongData)

    console.log('Recommendations', recommendations)

    await db.destroy()
    await redisClient.disconnect()
}

main()
