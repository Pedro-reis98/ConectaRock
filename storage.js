const fs = require('node:fs');
const path = require('node:path');

const { Pool } = require('pg');

function createMessageStorage({ rooms, historyLimit, dataDir }) {
  const historyFile = path.join(dataDir, 'messages.json');
  const emptyHistory = () => Object.fromEntries(rooms.map((room) => [room, []]));

  if (!process.env.DATABASE_URL) {
    return createJsonStorage({ rooms, historyLimit, dataDir, historyFile, emptyHistory });
  }

  return createPostgresStorage({ rooms, historyLimit, historyFile, emptyHistory });
}

function createJsonStorage({ rooms, historyLimit, dataDir, historyFile, emptyHistory }) {
  return {
    kind: 'json',
    async init() {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      if (!fs.existsSync(historyFile)) {
        fs.writeFileSync(historyFile, JSON.stringify(emptyHistory(), null, 2));
      }
    },
    async loadHistory() {
      return readJsonHistory({ rooms, historyLimit, historyFile, emptyHistory });
    },
    async saveMessage(_room, _message, histories) {
      await fs.promises.writeFile(historyFile, JSON.stringify(histories, null, 2));
    },
    async close() {},
  };
}

function createPostgresStorage({ rooms, historyLimit, historyFile, emptyHistory }) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX || 5),
    ssl: getSslConfig(),
  });

  return {
    kind: 'postgres',
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          room TEXT NOT NULL,
          user_id TEXT,
          username TEXT,
          avatar TEXT,
          color TEXT,
          text TEXT NOT NULL DEFAULT '',
          image JSONB,
          is_private BOOLEAN NOT NULL DEFAULT false,
          to_user_id TEXT,
          to_username TEXT,
          type TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_room_created_at
        ON messages (room, created_at DESC);
      `);

      await seedPostgresFromJson({ pool, rooms, historyLimit, historyFile, emptyHistory });
    },
    async loadHistory() {
      const entries = await Promise.all(
        rooms.map(async (room) => {
          const result = await pool.query(
            `
              SELECT *
              FROM (
                SELECT
                  id,
                  room,
                  user_id,
                  username,
                  avatar,
                  color,
                  text,
                  image,
                  is_private,
                  to_user_id,
                  to_username,
                  type,
                  created_at
                FROM messages
                WHERE room = $1 AND is_private = false
                ORDER BY created_at DESC
                LIMIT $2
              ) recent
              ORDER BY created_at ASC;
            `,
            [room, historyLimit],
          );

          return [room, result.rows.map(rowToMessage)];
        }),
      );

      return Object.fromEntries(entries);
    },
    async saveMessage(_room, message) {
      await insertMessage(pool, message);
    },
    async close() {
      await pool.end();
    },
  };
}

async function seedPostgresFromJson({ pool, rooms, historyLimit, historyFile, emptyHistory }) {
  const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM messages;');
  if (countResult.rows[0].count > 0) return;

  const seedHistory = readJsonHistory({ rooms, historyLimit, historyFile, emptyHistory });
  const seedMessages = rooms.flatMap((room) => seedHistory[room] || []);

  for (const message of seedMessages) {
    await insertMessage(pool, message);
  }
}

async function insertMessage(pool, message) {
  await pool.query(
    `
      INSERT INTO messages (
        id,
        room,
        user_id,
        username,
        avatar,
        color,
        text,
        image,
        is_private,
        to_user_id,
        to_username,
        type,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO NOTHING;
    `,
    [
      message.id,
      message.room,
      message.userId || null,
      message.username || null,
      message.avatar || null,
      message.color || null,
      message.text || '',
      message.image ? JSON.stringify(message.image) : null,
      Boolean(message.private),
      message.toUserId || null,
      message.toUsername || null,
      message.type || null,
      message.createdAt || new Date().toISOString(),
    ],
  );
}

function readJsonHistory({ rooms, historyLimit, historyFile, emptyHistory }) {
  try {
    if (!fs.existsSync(historyFile)) return emptyHistory();

    const parsed = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    return Object.fromEntries(
      rooms.map((room) => {
        const messages = Array.isArray(parsed[room]) ? parsed[room] : [];
        return [room, messages.slice(-historyLimit)];
      }),
    );
  } catch (error) {
    console.warn('Nao foi possivel carregar o historico:', error.message);
    return emptyHistory();
  }
}

function rowToMessage(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    avatar: row.avatar,
    color: row.color,
    room: row.room,
    text: row.text || '',
    image: row.image || null,
    private: row.is_private,
    toUserId: row.to_user_id,
    toUsername: row.to_username,
    type: row.type || undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

function getSslConfig() {
  const mode = String(process.env.PGSSLMODE || '').toLowerCase();
  if (mode === 'disable') return false;
  if (mode === 'require' || mode === 'no-verify') return { rejectUnauthorized: false };
  return undefined;
}

module.exports = { createMessageStorage };
