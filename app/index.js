const config = require('../config')
const { users } = require('../schema/dummy')

const knex = require('knex')
const redis = require('redis')
const R = require('ramda')
const _ = require('lodash')

const UserService = require('./userService')
const SongService = require('./songService')
const SimilarityService = require('./similarityService')
const EnrichmentService = require('./enrichmentService')
const RecommendationService = require('./recommendationService')


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

    const similar = (flowName, config) => flow(
        recs.setVal('index', flowName),
        recs.similar(config),
    )

    const recsFlow = flow(
        recs.author,
        recs.set('id', 'recommender'),
        recs.enrichAuthor,
        recs.set('name', 'recommender_name'),
        merge(
            similar('negative', config.recs.author.collab.negative.small),
            similar('partial', config.recs.author.collab.partial),
            similar('full', config.recs.author.collab.big)
        ),
        recs.dedupe('id'),
        recs.diversify('recommender'),
        recs.take(20),
        recs.enrichAuthor
    )



    // /** @type {function(number|number[]): Promise<Object[]>} */
    // const songFlow = flow(
    //     recs.user,
    //     merge(recs.liked(config.signals), recs.saved(config.signals)),
    //     recs.dedupe('id'),
//     recs.set('id', 'recommender'),
    //     recs.setVal('flow', 'song'),
    //     recs.similar(config.songsRecommendations),
    //     recs.dedupe('id'),
    //     recs.diversify('recommender'),
    //     recs.take(5),
    // )

    // /** @type {function(number|number[]): Promise<Object[]>} */
    // const authorFlow = flow(
    //     recs.user,
    //     merge(recs.likedAuthors(config.signals), recs.savedAuthors(config.signals)),
    //     recs.dedupe('id'),
    //     recs.set('id', 'recommender'),
    //     recs.setVal('flow', 'author'),
    //     recs.similar(config.authorsRecommendations),
    //     recs.dedupe('id'),
    //     recs.recentSongs(config.authorSongs),
    //     recs.diversify('recommender'),
    //     recs.take(5),
    // )

    // /** @type {function(number|number[]): Promise<Object[]>} */
    // const recommendationsFlow = flow(
    //     merge(songFlow, authorFlow),
    //     recs.dedupe('id'),
    //     recs.enrichSong,
    //     recs.sort('length')
    // )

    // const recommendations = await recommendationsFlow(users.Joe.id)

    const recommendations = await recsFlow(['711MCceyCBcFnzjGY4Q7Un', '2ye2Wgw4gimLv2eAKyk1NB', '7dGJo4pcD2V6oG8kP0tJRR'])

    const names = recommendations.map(R.prop('name'))

    console.log('Recommendations', names)

    await db.destroy()
    await redisClient.disconnect()
}

main()
