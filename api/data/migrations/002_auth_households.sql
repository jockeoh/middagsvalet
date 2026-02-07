CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  displayName TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ownerUserId TEXT NOT NULL,
  shareCode TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (ownerUserId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS household_memberships (
  id TEXT PRIMARY KEY,
  householdId TEXT NOT NULL,
  userId TEXT NOT NULL,
  role TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  UNIQUE(householdId, userId),
  FOREIGN KEY (householdId) REFERENCES households(id),
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS household_profiles (
  id TEXT PRIMARY KEY,
  householdId TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  pickyLevel INTEGER NOT NULL,
  weight REAL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (householdId) REFERENCES households(id)
);

CREATE TABLE IF NOT EXISTS household_preferences (
  householdId TEXT PRIMARY KEY,
  cuisines TEXT NOT NULL,
  proteins TEXT NOT NULL,
  avoidAllergens TEXT NOT NULL,
  avoidIngredients TEXT NOT NULL,
  maxTimeMinutes INTEGER NOT NULL,
  dinnersPerWeek INTEGER NOT NULL,
  moodTags TEXT NOT NULL,
  childWeightBoost REAL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (householdId) REFERENCES households(id)
);
