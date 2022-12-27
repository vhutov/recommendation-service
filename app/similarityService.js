const redis = require('redis')


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
     * @param {string[]} ids
     * @param {{indexName: string, fan_out: ?number}} options
     * @returns {Promise<Object.<string, string[]>>} dict of similar entities
     */
    getSimilar = async (ids, { indexName, fan_out = 10 }) => {
        const key = (id) => `${indexName}:${id}`

        const pendingSimilarities = ids.map(async (id) => {
            const similarIds = await this.#redis.lRange(key(id), 0, fan_out)

            if (similarIds.length == 0) return null
            return [id, similarIds]
        })

        const similarities = (await Promise.allSettled(pendingSimilarities)).filter((r) => r.value).map((r) => r.value)

        return Object.fromEntries(similarities)
    }

}

module.exports = SimilarityService