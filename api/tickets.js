import crypto from 'node:crypto';
import { getPool } from '../lib/db.js';

const STATUSES = ['todo', 'progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];
const COLUMNS = 'id, title, description, priority, status, requested_by, deadline, created_at, updated_at, done_at';

function isAuthorized(req) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return true;
  const given = String(req.headers['x-app-key'] || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return req.body;
}

function validate(input, { partial }) {
  const data = {};
  const errors = [];

  if (!partial || 'title' in input) {
    const title = String(input.title ?? '').trim();
    if (!title) errors.push('Title is required.');
    else if (title.length > 150) errors.push('Title must be at most 150 characters.');
    else data.title = title;
  }
  if ('description' in input) {
    const desc = String(input.description ?? '').trim();
    if (desc.length > 5000) errors.push('Details must be at most 5000 characters.');
    else data.description = desc || null;
  }
  if ('priority' in input) {
    if (!PRIORITIES.includes(input.priority)) errors.push('Invalid priority.');
    else data.priority = input.priority;
  }
  if ('status' in input) {
    if (!STATUSES.includes(input.status)) errors.push('Invalid status.');
    else data.status = input.status;
  }
  if ('requested_by' in input) {
    data.requested_by = String(input.requested_by ?? '').trim().slice(0, 60) || 'Boss';
  }
  if ('deadline' in input) {
    const dl = input.deadline;
    if (dl === null || dl === '') data.deadline = null;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(dl) && !Number.isNaN(Date.parse(dl))) data.deadline = dl;
    else errors.push('Deadline format must be YYYY-MM-DD.');
  }
  return { data, errors };
}

async function findTicket(db, id) {
  const [rows] = await db.execute(`SELECT ${COLUMNS} FROM tickets WHERE id = ?`, [id]);
  return rows[0] || null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Wrong or missing access code.' });
  }

  let id = null;
  if (req.query.id !== undefined) {
    id = Number(req.query.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ticket ID.' });
  }

  try {
    const db = getPool();

    switch (req.method) {
      case 'GET': {
        const [rows] = await db.query(`SELECT ${COLUMNS} FROM tickets ORDER BY id ASC`);
        return res.status(200).json({ tickets: rows });
      }

      case 'POST': {
        const body = readBody(req);
        if (!body) return res.status(400).json({ error: 'Body must be JSON.' });
        const { data, errors } = validate(body, { partial: false });
        if (errors.length) return res.status(400).json({ error: errors.join(' ') });

        const [result] = await db.execute(
          'INSERT INTO tickets (title, description, priority, requested_by, deadline) VALUES (?, ?, ?, ?, ?)',
          [data.title, data.description ?? null, data.priority ?? 'medium', data.requested_by ?? 'Bos', data.deadline ?? null]
        );
        return res.status(201).json({ ticket: await findTicket(db, result.insertId) });
      }

      case 'PATCH': {
        if (!id) return res.status(400).json({ error: 'The id parameter is required.' });
        const body = readBody(req);
        if (!body) return res.status(400).json({ error: 'Body must be JSON.' });
        const { data, errors } = validate(body, { partial: true });
        if (errors.length) return res.status(400).json({ error: errors.join(' ') });

        const fields = Object.keys(data); // safe: column names come only from the whitelist in validate()
        if (!fields.length) return res.status(400).json({ error: 'No data to update.' });

        const sets = fields.map((f) => `${f} = ?`);
        const values = fields.map((f) => data[f]);
       if ('status' in data) {
          sets.push(
            data.status === 'done'
              ? 'done_at = COALESCE(done_at, CURRENT_TIMESTAMP)'
              : 'done_at = NULL'
          );
        }

        await db.execute(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
        const ticket = await findTicket(db, id);
        if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
        return res.status(200).json({ ticket });
      }

      case 'DELETE': {
        if (!id) return res.status(400).json({ error: 'The id parameter is required.' });
        const [result] = await db.execute('DELETE FROM tickets WHERE id = ?', [id]);
        if (!result.affectedRows) return res.status(404).json({ error: 'Ticket not found.' });
        return res.status(200).json({ deleted: id });
      }

      default:
        res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
        return res.status(405).json({ error: 'Method not supported.' });
    }
    } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to access the database.' });
  }
}