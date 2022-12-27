const R = require('ramda')
const _ = require('lodash')

const UserService = require('./userService')
const SongService = require('./songService')
const SimilarityService = require('./similarityService')
const EnrichmentService = require('./enrichmentService')

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

    #toObject = async (input) => {
        input = toArray(input)

        return input.map(R.objOf('id'))
    }

    /**
     * Convert number (id) into User Entity
     * @typedef {Object.<string, any>} Entity
     * @param {number|number[]} input
     * @returns {Promise<Entity[]>} input as user id
     */
    user = async (input) => this.#toObject(input)

    song = async (input) => this.#toObject(input)

    author = async (input) => this.#toObject(input)

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
     * Sets property with specified key-value
     * @typedef {Object.<string, any>} Entity
     * @param {string} key 
     * @param {any} value 
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>} entities with new property set
     */
    setVal = (key, value) => async (input) => {
        input = toArray(input)

        return R.map(R.assoc(key, value))(input)
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

    enrichAuthor = async (input) => {
        input = toArray(input)

        const ids = input.map(R.prop('id'))

        const authorData = await this.#enrichmentService.enrichAuthorData(ids)

        const dataMap = R.indexBy(R.prop('id'))(authorData)

        return input.map((entity) => ({ ...entity, ...dataMap[entity.id]}))
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

    /**
     * Sorts input by specified field
     * @typedef {Object.<string, any>} Entity
     * @param {string} by sorting column
     * @param {Entity|Entity[]} input
     * @returns {Promise<Entity[]>}
     */
    sort = (by) => async (input) => R.sortBy(R.prop(by))(toArray(input))
}

module.exports = RecommendationService
