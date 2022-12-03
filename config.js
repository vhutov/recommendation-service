const { DateTime } = require('luxon')

module.exports = {
    db: {
        client: 'sqlite3',
        connection: {
            filename: './db.dat',
        },
        useNullAsDefault: true,
    },
    redis: {
        socket: {
            host: 'localhost',
        },
    },
    songsRecommendations: {
        indexName: 'songs_collab_v1',
        fan_out: 5,
    },
    signals: () => ({
        last_ts: DateTime.now().minus({ days: 2 }).toUnixInteger(),
        limit: 50,
    }),
}
