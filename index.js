const config = require('./config')
const { users } = require('./schema/dummy')

const knex = require('knex')
const { DateTime } = require('luxon')

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

async function main() {
    /**
     * @type {knex.Knex}
     */
    const db = knex(config.db)

    const userService = new UserService(db)

    const date = DateTime.now().minus({ days: 1 })
    const options = { last_ts: date.toUnixInteger() }

    const [liked, saved] = await Promise.all([
        userService.getRecentLikedIds(users.Joe.id, options),
        userService.getRecentSavedIds(users.Joe.id, options),
    ])

    console.log('Liked', liked)
    console.log('Saved', saved)

    console.log()

    await db.destroy()
}

main()
