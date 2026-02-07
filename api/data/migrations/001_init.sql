CREATE TABLE IF NOT EXISTS dishes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cuisineTags TEXT NOT NULL,
  proteinTag TEXT NOT NULL,
  timeMinutes INTEGER NOT NULL,
  difficulty TEXT NOT NULL,
  kidFriendlyScore INTEGER NOT NULL,
  ingredients TEXT NOT NULL,
  instructionsShort TEXT NOT NULL,
  allergens TEXT NOT NULL,
  tags TEXT NOT NULL,
  imageUrl TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rating_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  householdId TEXT NOT NULL,
  profileId TEXT NOT NULL,
  dishId TEXT NOT NULL,
  reaction TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS household_state (
  householdId TEXT PRIMARY KEY,
  pantryState TEXT NOT NULL,
  favorites TEXT NOT NULL,
  avoidDishIds TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
