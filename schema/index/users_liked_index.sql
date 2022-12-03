CREATE INDEX users_recent_liked 
    ON users_liked_songs (user_id, event_time DESC)