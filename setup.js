const config = require('./config')
const dummy = require('./schema/dummy')
const fs = require('fs')
const knex = require('knex')

/**
 * @param {knex.Knex} db
 */
async function prepareTables(db) {
    const files = await fs.promises.readdir('./schema/sql')

    for (const file of files) {
        if (!file.endsWith('.sql')) continue

        const sql = (await fs.promises.readFile(`./schema/sql/${file}`)).toString()
        await db.raw(sql)
        console.log('Created table ', file.trim('.sql'))
    }
}

/**
 * @param {knex.Knex} db
 */
async function insertDb(db) {
    await Promise.all([
        db('users').insert(Object.values(dummy.users)),
        db('songs').insert(Object.values(dummy.songs)),
        db('authors').insert(Object.values(dummy.authors)),
    ])
    console.log('Inserted dummy nodes.')

    await Promise.all([
        db('users_liked_songs').insert(dummy.user_liked_songs),
        db('users_saved_songs').insert(dummy.user_saved_songs),
    ])
    console.log('Inserted dummy edges.')
}

async function dropTable() {
    const { filename: f } = config.db.connection
    try {
        await fs.promises.access(f, fs.constants.F_OK)
        await fs.promises.rm(f)
    } catch (error) {}
}

async function main() {
    /**
     * @type {knex.Knex}
     */
    const db = knex(config.db)

    await dropTable()
    console.log('Dropped database')
    await prepareTables(db)
    console.log('Created table schema')
    await insertDb(db)
    console.log('Dummy data insertion complete')

    await db.destroy()
}

main()
