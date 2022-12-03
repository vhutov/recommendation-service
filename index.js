const config = require('./config')
const { users } = require('./schema/dummy')

const knex = require('knex')
const { DateTime } = require('luxon')
const redis = require('redis')
const R = require('ramda')
const _ = require('lodash')

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

    /**
     * Get list of recently liked author ids
     * @param {number} userId
     * @param {{last_ts: ?number, limit: ?number}} options
     * @returns {Promise<number[]>} list of author ids
     */
    getRecentLikedAuthorIds = async (userId, { last_ts = null, limit = null } = {}) => {
        const ts_filter = last_ts ? `AND event_time >= datetime(${last_ts}, 'unixepoch')` : ''
        const limit_clause = limit ? `LIMIT ${limit}` : ''

        const rows = await this.#db.raw(`
            SELECT 
                s.author_id as id
            FROM 
                users_liked_songs AS uls
            JOIN
                songs AS s
                ON uls.song_id = s.id
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
     * Get list of recentlysaved author ids
     * @param {number} userId
     * @param {{last_ts: ?number, limit: ?number}} options
     * @returns {Promise<number[]>} list of author ids
     */
    getRecentSavedAuthorIds = async (userId, { last_ts = null, limit = null } = {}) => {
        const ts_filter = last_ts ? `AND event_time >= datetime(${last_ts}, 'unixepoch')` : ''
        const limit_clause = limit ? `LIMIT ${limit}` : ''

        const rows = await this.#db.raw(`
            SELECT 
                s.author_id as id
            FROM 
                users_saved_songs AS uss
            JOIN
                songs AS s
                ON uss.song_id = s.id
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

class SongService {
    /** @type {knex.Knex} */
    #db

    /**
     * @param {knex.Knex} db
     */
    constructor(db) {
        this.#db = db
    }

    /**
     * Get list of recently added songs by author.
     *
     * @param {number[]} authorIds list of author ids
     * @param {{fan_out: ?number}} options fan_out specifies how many songs per author
     * @returns {Promise<Object.<number, number[]>>} list of songs per author
     */
    getRecentByAuthor = async (authorIds, { fan_out = null } = {}) => {
        const rows = await this.#db.raw(`
            SELECT 
                id as song_id, 
                author_id
            FROM 
                songs
            WHERE 
                author_id IN (${authorIds.join(',')})
        `)

        const maybeLimitWithinAuthor = R.ifElse(
            R.always(fan_out != null),
            R.pipe(
                R.toPairs,
                R.map(([k, v]) => [k, v.slice(0, fan_out)]),
                R.fromPairs
            ),
            R.identity
        )

        return R.pipe(R.groupBy(R.prop('author_id')), maybeLimitWithinAuthor, R.mapObjIndexed(R.pluck('song_id')))(rows)
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

/**
 * @template A
 * @param {A|A[]} input
 * @returns {A[]}
 */
const toArray = (input) => (Array.isArray(input) ? input : [input])

class RecommendationService {
    /** @type {UserService} */
    #userService
    /** @type {SimilarityService} */
    #similarityService
    /** @type {EnrichmentService} */
    #enrichmentService
    /** @type {SongService} */
    #songService

    /**
     * @param {UserService} userService
     * @param {SimilarityService} similarityService
     * @param {EnrichmentService} enrichmentService
     * @param {SongService} songService
     */
    constructor(userService, similarityService, enrichmentService, songService) {
        this.#userService = userService
        this.#similarityService = similarityService
        this.#enrichmentService = enrichmentService
        this.#songService = songService
    }

    /**
     * Convert number (id) into User Entity
     * @typedef {Object.<string, any>} Entity
     * @param {number|number[]} input
     * @returns {Promise<Entity[]>} input as user id
     */
    user = async (input) => {
        input = toArray(input)

        return input.map(R.objOf('id'))
    }

    /**
     * Copies property value to another property
     * @typedef {Object.<string, any>} Entity
     * @param {string} from param name
     * @param {string} to param name
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} entities with new property set
     */
    set = (from, to) => async (input) => {
        input = toArray(input)

        return input.map((entity) => ({ ...entity, [to]: entity[from] }))
    }

    /**
     * Finds similar entities. Copies properties from parent to children.
     * @typedef {Object.<string, any>} Entity
     * @param {Object|Function} options see SimilarityService#getSimilar options
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} similar entities for every entity from input
     */
    similar = (options) => async (input) => {
        input = toArray(input)

        options = _.isFunction(options) ? options() : options

        const ids = input.map(R.prop('id'))

        const similarMap = await this.#similarityService.getSimilar(ids, options)

        return input.flatMap((entity) => {
            const similar = similarMap[entity.id] || []

            return similar.map((id) => ({
                ...entity,
                id,
            }))
        })
    }

    /**
     * Enriches Song Entities with song data
     * @typedef {Object.<string, any>} Entity
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} input entities, enriched with songs data
     */
    enrichSong = async (input) => {
        input = toArray(input)

        const ids = input.map(R.prop('id'))

        const songData = await this.#enrichmentService.enrichSongData(ids)

        const dataMap = R.indexBy(R.prop('id'))(songData)

        return input.map((entity) => ({ ...entity, ...dataMap[entity.id] }))
    }

    /**
     * @typedef {Object.<string, any>} Entity
     * @param {Entity|Entity[]} input
     * @param {function(number): Promise<number[]>} f
     * @returns
     */
    #signals = async (input, f) => {
        input = toArray(input)

        const pendingSignals = input.map(async (entity) => {
            const ids = await f(entity.id)
            if (!ids) return null
            return [entity, ids]
        })

        const signals = (await Promise.allSettled(pendingSignals)).filter((v) => v.value).map((v) => v.value)

        return signals.flatMap(([{ id, ...rest }, signals]) => {
            return signals.map((s) => ({ id: s, user: id, ...rest }))
        })
    }

    /**
     * For User Entities fetches Song Entities. Copies over properties from parent to children.
     * @typedef {Object.<string, any>} Entity
     * @param {*} options see UserService#getRecentLikedIds
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} liked entities from input entities
     */
    liked =
        (options = {}) =>
        async (input) =>
            this.#signals(input, (id) =>
                this.#userService.getRecentLikedIds(id, _.isFunction(options) ? options() : options)
            )

    /**
     * For User Entities fetches Song Entities. Copies over properties from parent to children.
     * @typedef {Object.<string, any>} Entity
     * @param {*} options see UserService#getRecentLikedIds
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} saved values from input entities
     */
    saved =
        (options = {}) =>
        async (input) =>
            this.#signals(input, (id) =>
                this.#userService.getRecentSavedIds(id, _.isFunction(options) ? options() : options)
            )

    /**
     * For User Entities fetches Author Entities. Copies over properties from parent to children.
     * @typedef {Object.<string, any>} Entity
     * @param {*} options see UserService#getRecentLikedAuthorIds
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} author ids of liked songs from input entities
     */
    likedAuthors =
        (options = {}) =>
        async (input) =>
            this.#signals(input, (id) =>
                this.#userService.getRecentLikedAuthorIds(id, _.isFunction(options) ? options() : options)
            )

    /**
     * For User Entities fetches Author Entities. Copies over properties from parent to children.
     * @typedef {Object.<string, any>} Entity
     * @param {*} options see UserService#getRecentSavedAuthorIds
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} author ids of saved songs from input entities
     */
    savedAuthors =
        (options = {}) =>
        async (input) =>
            this.#signals(input, (id) =>
                this.#userService.getRecentSavedAuthorIds(id, _.isFunction(options) ? options() : options)
            )

    recentSongs =
        (options = {}) =>
        async (input) => {
            input = toArray(input)
            options = _.isFunction(options) ? options() : options

            const authorIds = input.map(({ id }) => id)

            const authorSongs = await this.#songService.getRecentByAuthor(authorIds, options)

            return input.flatMap((entity) => {
                return (
                    authorSongs[entity.id]?.map((s) => {
                        return { ...entity, author_id: entity.id, id: s }
                    }) || []
                )
            })
        }

    /**
     * Takes specified amount from input.
     * @typedef {Object.<string, any>} Entity
     * @param {number} limit
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} same as input but only [limit] elements
     */
    take = (limit) => async (input) => {
        input = toArray(input)

        return input.slice(0, limit)
    }

    /**
     * Merges few flows into single flow
     * @typedef {Object.<string, any>} Entity
     * @param  {...Promise<Entity[]>} flows
     * @returns {Promise<Entity[]>} multiple flows merged together
     */
    merge = async (...flows) => {
        const inputs = (await Promise.allSettled(flows)).filter((v) => v.value).map((v) => v.value)

        return inputs.flat()
    }

    /**
     * Deduplicates entities by specified property
     * @typedef {Object.<string, any>} Entity
     * @param {string} by property name
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} same as input but deduplicated
     */
    dedupe = (by) => async (input) => {
        input = toArray(input)

        return R.uniqBy(R.prop(by))(input)
    }

    /**
     * Tries to sort values in a way that puts similar items further away from
     * each other
     * @typedef {Object.<string, any>} Entity
     * @param {string} by param name
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} same as input
     */
    diversify = (by) => async (input) => _.shuffle(toArray(input))
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
    const songService = new SongService(db)

    const recs = new RecommendationService(userService, similarityService, enrichmentService, songService)

    const flow = (...f) => R.pipeWith(R.andThen)(f)
    const merge = (...f) => R.converge(recs.merge, f)

    const recommendationsFlow = flow(
        recs.user,
        merge(recs.likedAuthors(config.signals), recs.savedAuthors(config.signals)),
        recs.dedupe('id'),
        recs.set('id', 'recommender'),
        recs.similar(config.authorsRecommendations),
        recs.dedupe('id'),
        recs.recentSongs(config.authorSongs),
        recs.diversify('recommender'),
        recs.take(5),
        recs.enrichSong
    )

    const recommendations = await recommendationsFlow(users.Joe.id)

    console.log('Recommendations', recommendations)

    await db.destroy()
    await redisClient.disconnect()
}

main()
