-- Game Chat Tables
-- Same structure as team chat but for games instead of teams

CREATE TABLE game_chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES bookings(id) NOT NULL,
  created_by UUID REFERENCES user_profiles(id) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE game_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES game_chat_rooms(id) NOT NULL,
  game_id UUID REFERENCES bookings(id) NOT NULL,
  sender_id UUID REFERENCES user_profiles(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX idx_game_chat_rooms_game_id ON game_chat_rooms(game_id);
CREATE INDEX idx_game_chat_messages_game_id ON game_chat_messages(game_id);
CREATE INDEX idx_game_chat_messages_room_id ON game_chat_messages(room_id);
CREATE INDEX idx_game_chat_messages_created_at ON game_chat_messages(created_at);

-- Add unique constraint to ensure one room per game
CREATE UNIQUE INDEX idx_game_chat_rooms_unique_game ON game_chat_rooms(game_id);
