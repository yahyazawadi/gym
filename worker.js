/**
 * Cloudflare Worker Backend for Minimal Gym PWA
 * Endpoints:
 *   POST /api/auth/login    - Verify or auto-register user, issue 30-day session token
 *   GET  /api/auth/session  - Verify active session token
 *   POST /api/auth/logout   - Invalidate session token
 *   GET  /api/logs          - Fetch user workout logs
 *   POST /api/logs          - Record a set
 */

// Helper: SHA-256 Passphrase Hash
async function hashPassphrase(passphrase) {
  const enc = new TextEncoder().encode(passphrase + '_salt_iron_vault');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: JSON Response
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// Authenticate session from Authorization header
async function getSessionUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;

  const session = await env.DB.prepare(
    'SELECT s.token, s.user_id, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?'
  ).bind(token).first();

  return session;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    // --- AUTH: Login or Register ---
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const body = await request.json();
        const username = (body.username || '').trim().toLowerCase();
        const passphrase = (body.passphrase || '').trim();

        if (!username || !passphrase) {
          return jsonResponse({ error: 'Username and passphrase required' }, 400);
        }

        const passHash = await hashPassphrase(passphrase);

        // Check if user exists
        let user = await env.DB.prepare('SELECT id, username, passphrase_hash FROM users WHERE username = ?').bind(username).first();

        if (user) {
          if (user.passphrase_hash !== passHash) {
            return jsonResponse({ error: 'INVALID PASSPHRASE' }, 401);
          }
        } else {
          // Zero-friction registration: create user automatically on first login
          const userId = 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
          await env.DB.prepare('INSERT INTO users (id, username, passphrase_hash) VALUES (?, ?, ?)').bind(userId, username, passHash).run();
          user = { id: userId, username };
        }

        // Generate permanent infinite session token
        const token = 'tok_' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const expiresAt = '2099-12-31T23:59:59.000Z'; // Permanent session

        await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, user.id, expiresAt).run();

        return jsonResponse({
          success: true,
          token,
          user: { id: user.id, username: user.username }
        });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // --- AUTH: Validate Session ---
    if (url.pathname === '/api/auth/session' && request.method === 'GET') {
      const session = await getSessionUser(request, env);
      if (!session) {
        return jsonResponse({ error: 'SESSION_EXPIRED' }, 401);
      }
      return jsonResponse({ valid: true, user: { id: session.user_id, username: session.username } });
    }

    // --- AUTH: Logout ---
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const token = auth.replace('Bearer ', '').trim();
      if (token) {
        await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      }
      return jsonResponse({ success: true });
    }

    // --- LOGS: Get User Logs ---
    if (url.pathname === '/api/logs' && request.method === 'GET') {
      const session = await getSessionUser(request, env);
      if (!session) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);

      const rows = await env.DB.prepare(
        'SELECT id, exercise_id, weight_kg, reps, logged_at FROM workout_logs WHERE user_id = ? ORDER BY logged_at ASC'
      ).bind(session.user_id).all();

      return jsonResponse({ logs: rows.results || [] });
    }

    // --- LOGS: Push Set Log ---
    if (url.pathname === '/api/logs' && request.method === 'POST') {
      const session = await getSessionUser(request, env);
      if (!session) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);

      const body = await request.json();
      const id = body.id || ('log_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16));
      const exerciseId = body.exerciseId;
      const weightKg = parseFloat(body.weight);
      const reps = parseInt(body.reps, 10);
      const loggedAt = body.timestamp || new Date().toISOString();

      await env.DB.prepare(
        'INSERT INTO workout_logs (id, user_id, exercise_id, weight_kg, reps, logged_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(id, session.user_id, exerciseId, weightKg, reps, loggedAt).run();

      return jsonResponse({ success: true, id });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }
};
