const knex = require('knex')

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

module.exports = UserService