const { DateTime } = require("luxon");

const id = (id) => () => {
    return id++;
}

const [user_id, song_id, author_id] = [id(10000), id(20000), id(30000)]


const users = {
    'Joe': { id: user_id(), name: 'Joe' },
    'Mike': { id: user_id(), name: 'Mike' },
}

const authors = {
    'Disturbed': { id: author_id(), name: 'Disturbed' },
    'Metallica': { id: author_id(), name: 'Metallica' },
    'Godsmack': { id: author_id(), name: 'Godsmack' },
    'ACDC': { id: author_id(), name: 'AC/DC' },
    'Eminem': { id: author_id(), name: 'Eminem' },
    'Yelawolf': { id: author_id(), name: 'Yelawolf' }
}

const songs = {
    'Immortalized': { id: song_id(), name: 'Immortalized', length: 258, genre: 'Heavy Metal', author_id: authors.Disturbed.id },
    'TheSoundOfSilence': { id: song_id(), name: "The Sound Of Silence", length: 246, genre: 'Heavy Metal', author_id: authors.Disturbed.id },
    'EnterSandman': { id: song_id(), name: 'Enter Sandman', length: 328, genre: 'Heavy Metal', author_id: authors.Metallica.id },
    'Bulletproof': { id: song_id(), name: 'Bulletproof', length: 147, genre: 'Hard Rock', author_id: authors.Godsmack.id },
    'Thunderstruck': { id: song_id(), name: 'Thunderstruck', length: 256, genre: 'Hard Rock', author_id: authors.ACDC.id },
    'RapGod': { id: song_id(), name: 'Rap God', length: 360, genre: 'Hip-Hop', author_id: authors.Eminem.id },
    'BestFrield': { id: song_id(), name: 'Best Friend', length: 270, genre: 'Hip-Hop', author_id: authors.Yelawolf.id },
}

/**
 * 
 * @param {DateTime} date 
 * @returns {string}
 */
const toSql = (date) => date.toSQL({includeOffset: false, includeOffsetSpace: false, includeZone: false})

const user_liked_songs = [
    { user_id: users.Joe.id, song_id: songs.Immortalized.id, event_time: toSql(DateTime.now().minus({ days: 1 }))},
    { user_id: users.Mike.id, song_id: songs.RapGod.id, event_time: toSql(DateTime.now())}
]

const user_saved_songs = [
    { user_id: users.Joe.id, song_id: songs.EnterSandman.id, event_time: toSql(DateTime.now()) }
]

module.exports = { users, authors, songs, user_liked_songs, user_saved_songs }