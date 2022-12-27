const knex = require('knex')
const R = require('ramda')


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
                uri as song_id, 
                author_uri as author_id
            FROM 
                tracks
            WHERE 
                author_uri IN (${authorIds.join(',')})
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

module.exports = SongService