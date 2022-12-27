const knex = require('knex')

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

    enrichAuthorData = async (authorIds) => {
        const response = await this.#db.raw(`
            SELECT
                uri as id,
                name
            FROM artists
            WHERE
                uri IN (${authorIds.map(s => `'${s}'`).join(',')})
        `)

        return response[0]
    }
}

module.exports = EnrichmentService