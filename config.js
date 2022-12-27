const { DateTime } = require('luxon')

module.exports = {
    db: {
        client: 'mysql2',
        connection: {
            host : '127.0.0.1',
            port : 3306,
            user : 'user',
            
            database : 'music'
        }
    },
    redis: {
        socket: {
            host: 'localhost',
        },
    },
    recs: {
        author: {
            collab: {
                partial: {
                    indexName: 'artist:collab:nn:partial:small',
                    fan_out: 20,
                },
                small: {
                    indexName: 'artist:collab:nn:full:small',
                    fan_out: 20,
                },
                big: {
                    indexName: 'artist:collab:nn:full:big',
                    fan_out: 20,
                },
                negative: {
                    small: {
                        indexName: 'artist:collab:nn:less_negatives:small',
                        fan_out: 20,
                    },
                    big: {
                        indexName: 'artist:collab:nn:less_negatives:big',
                        fan_out: 20,
                    },
                }
            }
        }
    },
    songsRecommendations: {
        indexName: 'songs_collab_v1',
        fan_out: 5,
    },
    authorsRecommendations: {
        indexName: 'authors_collab_v1',
        fan_out: 3
    },
    authorSongs: {
        fan_out: 2
    },
    signals: () => ({
        last_ts: DateTime.now().minus({ days: 2 }).toUnixInteger(),
        limit: 50,
    }),
}
