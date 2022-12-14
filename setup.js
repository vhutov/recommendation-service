const config = require('./config')
const dummy = require('./schema/dummy')
const fs = require('fs')
const knex = require('knex')
const redis = require('redis')

/**
 * @param {knex.Knex} db
 */
async function prepareTables(db) {

    for (const [dir, type] of [['sql', 'table'], ['index', 'index']]) {
        const parent = `./schema/${dir}`
        const files = await fs.promises.readdir(parent)

        for (const file of files) {
            if (!file.endsWith('.sql')) continue

            const sql = (await fs.promises.readFile(`${parent}/${file}`)).toString()
            await db.raw(sql)
            console.log(`Created ${type} `, file.trim('.sql'))
        }
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

/**
 * 
 * @param {redis.RedisClientType} redis 
 */
async function insertSimilar(redis) {
    for (let [key, vals] of Object.entries(dummy.similar_songs)) {
        const redis_key = `${config.songsRecommendations.indexName}:${key}`
        await redis.del(redis_key)
        await redis.lPush(redis_key, vals.map(String))
    }

    for (let [key, vals] of Object.entries(dummy.similar_authors)) {
        const redis_key = `${config.authorsRecommendations.indexName}:${key}`
        await redis.del(redis_key)
        await redis.lPush(redis_key, vals.map(String))
    }
}

async function main() {
    /**
     * @type {knex.Knex}
     */
    const db = knex(config.db)

    const redisClient = redis.createClient(config.redis)
    await redisClient.connect()

    await dropTable()
    console.log('Dropped database')
    await prepareTables(db)
    console.log('Created table schema')
    await insertDb(db)
    console.log('Dummy data insertion complete')

    await insertSimilar(redisClient)
    console.log('Similarity insertion complete.')

    await db.destroy()
    await redisClient.disconnect()
}

main()
