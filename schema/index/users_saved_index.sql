CREATE INDEX users_recent_saved
    ON users_saved_songs (user_id, event_time DESC)