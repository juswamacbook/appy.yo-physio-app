/**
 * models/goalsModel.js
 * Uses existing User_Goals table. Per-muscle goal text stored in notes as JSON.
 */

const db = require('../db');

/** Ensure User_Goals table exists (idempotent). Run once on first use. */
async function ensureUserGoalsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS \`User_Goals\` (
      user_id INT PRIMARY KEY,
      muscle_ids VARCHAR(255) NULL COMMENT 'Comma-separated Muscle_Group ids',
      intensity ENUM('slight', 'moderate', 'significant', 'maximum') DEFAULT 'moderate',
      notes TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_User_Goals_user FOREIGN KEY (user_id) REFERENCES \`User\`(id) ON DELETE CASCADE
    )
  `);
}

function parseNotes(notes) {
  if (!notes || typeof notes !== 'string') return { general: '', muscleGoals: {} };
  try {
    const parsed = JSON.parse(notes);
    return {
      general: parsed.general || '',
      muscleGoals: parsed.muscleGoals || {}
    };
  } catch (_) {
    return { general: notes, muscleGoals: {} };
  }
}

function stringifyNotes(obj) {
  return JSON.stringify(obj);
}

/**
 * Get goals for a user
 */
const getGoalsByUserId = async (userId) => {
  await ensureUserGoalsTable();
  const [rows] = await db.query(
    'SELECT muscle_ids, intensity, notes FROM User_Goals WHERE user_id = ?',
    [userId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  const muscleIds = row.muscle_ids
    ? row.muscle_ids.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id))
    : [];
  const { general, muscleGoals } = parseNotes(row.notes);
  return {
    muscleIds,
    intensity: row.intensity || 'moderate',
    notes: general,
    muscleGoals
  };
};

/**
 * Save or update user goals (muscle list, intensity, general notes).
 * Preserves existing muscleGoals in notes.
 */
const saveGoals = async (userId, muscleIds, intensity, notes) => {
  await ensureUserGoalsTable();
  const [existing] = await db.query(
    'SELECT notes FROM User_Goals WHERE user_id = ?',
    [userId]
  );
  let muscleGoals = {};
  if (existing.length > 0 && existing[0].notes) {
    const parsed = parseNotes(existing[0].notes);
    muscleGoals = parsed.muscleGoals || {};
  }
  const notesStr = stringifyNotes({ general: notes || '', muscleGoals });
  const muscleIdsStr = Array.isArray(muscleIds) && muscleIds.length > 0
    ? muscleIds.join(',')
    : null;
  const validIntensity = ['slight', 'moderate', 'significant', 'maximum'].includes(intensity)
    ? intensity
    : 'moderate';

  await db.query(
    `INSERT INTO User_Goals (user_id, muscle_ids, intensity, notes)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       muscle_ids = VALUES(muscle_ids),
       intensity = VALUES(intensity),
       notes = VALUES(notes)`,
    [userId, muscleIdsStr, validIntensity, notesStr]
  );
};

/**
 * Set or update goal text for one muscle. Creates User_Goals row if needed.
 */
const setMuscleGoalText = async (userId, muscleId, goalText) => {
  await ensureUserGoalsTable();
  const [rows] = await db.query(
    'SELECT muscle_ids, intensity, notes FROM User_Goals WHERE user_id = ?',
    [userId]
  );
  let muscleIds = [];
  let intensity = 'moderate';
  let parsed = { general: '', muscleGoals: {} };
  if (rows.length > 0) {
    const r = rows[0];
    muscleIds = r.muscle_ids
      ? r.muscle_ids.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id))
      : [];
    intensity = r.intensity || 'moderate';
    parsed = parseNotes(r.notes);
  }
  const key = String(muscleId);
  if (!parsed.muscleGoals[key]) parsed.muscleGoals[key] = { text: '', completed: false };
  parsed.muscleGoals[key].text = goalText || '';
  if (!muscleIds.includes(muscleId)) muscleIds.push(muscleId);
  const notesStr = stringifyNotes(parsed);
  const muscleIdsStr = muscleIds.join(',');

  await db.query(
    `INSERT INTO User_Goals (user_id, muscle_ids, intensity, notes)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE muscle_ids = VALUES(muscle_ids), notes = VALUES(notes)`,
    [userId, muscleIdsStr, intensity, notesStr]
  );
};

/**
 * Toggle completed for one muscle goal.
 */
const toggleMuscleGoalCompleted = async (userId, muscleId) => {
  await ensureUserGoalsTable();
  const [rows] = await db.query(
    'SELECT notes FROM User_Goals WHERE user_id = ?',
    [userId]
  );
  if (rows.length === 0) return false;
  const parsed = parseNotes(rows[0].notes);
  const key = String(muscleId);
  if (!parsed.muscleGoals[key]) parsed.muscleGoals[key] = { text: '', completed: false };
  const next = !parsed.muscleGoals[key].completed;
  parsed.muscleGoals[key].completed = next;
  await db.query(
    'UPDATE User_Goals SET notes = ? WHERE user_id = ?',
    [stringifyNotes(parsed), userId]
  );
  return next;
};

/**
 * Remove one muscle from goals (from muscle_ids and from muscleGoals in notes).
 */
const removeMuscleGoal = async (userId, muscleId) => {
  await ensureUserGoalsTable();
  const [rows] = await db.query(
    'SELECT muscle_ids, notes FROM User_Goals WHERE user_id = ?',
    [userId]
  );
  if (rows.length === 0) return;
  const r = rows[0];
  let muscleIds = r.muscle_ids
    ? r.muscle_ids.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id))
    : [];
  muscleIds = muscleIds.filter((id) => id !== muscleId);
  const parsed = parseNotes(r.notes);
  delete parsed.muscleGoals[String(muscleId)];
  const notesStr = stringifyNotes(parsed);
  const muscleIdsStr = muscleIds.length > 0 ? muscleIds.join(',') : null;
  await db.query(
    'UPDATE User_Goals SET muscle_ids = ?, notes = ? WHERE user_id = ?',
    [muscleIdsStr, notesStr, userId]
  );
};

module.exports = {
  getGoalsByUserId,
  saveGoals,
  setMuscleGoalText,
  toggleMuscleGoalCompleted,
  removeMuscleGoal
};
