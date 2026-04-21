import express, { Express } from 'express';
import request from 'supertest';
import { sanitizeInputMiddleware } from '../../../server/middleware/input-sanitization';

function buildApp(): Express {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(sanitizeInputMiddleware);
  app.post('/mcp', (_req, res) => res.status(200).json({ ok: true }));
  app.get('/authorize', (_req, res) => res.status(200).json({ ok: true }));
  app.post('/register', (_req, res) => res.status(200).json({ ok: true }));
  app.post('/token', (_req, res) => res.status(200).json({ ok: true }));
  app.put('/token', (_req, res) => res.status(200).json({ ok: true }));
  app.post('/revoke', (_req, res) => res.status(200).json({ ok: true }));
  app.get('/.well-known/oauth-authorization-server', (_req, res) =>
    res.status(200).json({ ok: true }),
  );
  app.get('/.well-known/oauth-protected-resource/mcp', (_req, res) =>
    res.status(200).json({ ok: true }),
  );
  // Lookalike / shadow routes used in the regression tests below — these
  // must NOT inherit the OAuth bypass.
  app.post('/authorize-evil', (_req, res) => res.status(200).json({ ok: true }));
  app.post('/register/admin', (_req, res) => res.status(200).json({ ok: true }));
  app.get('/.well-known/oauth-authorization-server/evil', (_req, res) =>
    res.status(200).json({ ok: true }),
  );
  app.post('/api/other', (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('sanitizeInputMiddleware MCP/OAuth bypass', () => {
  const app = buildApp();

  it('does not block an MCP initialize JSON-RPC body', async () => {
    const body = {
      jsonrpc: '2.0',
      id: 0,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {
          extensions: {
            'io.modelcontextprotocol/ui': {
              mimeTypes: ['text/html;profile=mcp-app'],
            },
          },
        },
        clientInfo: { name: 'Anthropic/ClaudeAI', version: '1.0.0' },
      },
    };
    const res = await request(app).post('/mcp').send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('does not block an OAuth dynamic client registration body', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        client_name: 'Claude (claude.ai)',
        redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      });
    expect(res.status).toBe(200);
  });

  it('does not block an OAuth /authorize GET with PKCE params', async () => {
    const res = await request(app)
      .get('/authorize')
      .query({
        response_type: 'code',
        client_id: 'koveo-mcp-abc',
        redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
        scope: 'mcp',
        state: 'xyz',
      });
    expect(res.status).toBe(200);
  });

  it('does not block /token, /revoke, or well-known metadata endpoints', async () => {
    const tokenRes = await request(app)
      .post('/token')
      .send({
        grant_type: 'authorization_code',
        code: 'koac_abcdefg',
        redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
        client_id: 'koveo-mcp-abc',
        code_verifier: 'verifier_value',
      });
    expect(tokenRes.status).toBe(200);

    const revokeRes = await request(app)
      .post('/revoke')
      .send({ token: 'koat_xyz', client_id: 'koveo-mcp-abc' });
    expect(revokeRes.status).toBe(200);

    const meta1 = await request(app).get('/.well-known/oauth-authorization-server');
    expect(meta1.status).toBe(200);

    const meta2 = await request(app).get('/.well-known/oauth-protected-resource/mcp');
    expect(meta2.status).toBe(200);
  });

  it('still blocks dangerous payloads on non-MCP routes', async () => {
    const res = await request(app)
      .post('/api/other')
      .send({ q: "1; DROP TABLE users; --" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DANGEROUS_INPUT');
  });

  // ----- Regression tests for Task #100 (method-aware exact-path bypass) -----

  it('does NOT bypass a lookalike path /authorize-evil', async () => {
    // Same shape of dangerous payload as the non-MCP-route test above; the
    // bypass must not extend to a sibling/shadow path even if it shares
    // a prefix with /authorize.
    const res = await request(app)
      .post('/authorize-evil')
      .send({ q: "1; DROP TABLE users; --" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DANGEROUS_INPUT');
  });

  it('does NOT bypass a sub-route /register/admin', async () => {
    const res = await request(app)
      .post('/register/admin')
      .send({ q: "1; DROP TABLE users; --" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DANGEROUS_INPUT');
  });

  it('does NOT bypass a well-known sub-path that is not in the allow-list', async () => {
    const res = await request(app)
      .post('/.well-known/oauth-authorization-server/evil')
      .send({ q: "1; DROP TABLE users; --" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DANGEROUS_INPUT');
  });

  it('does NOT bypass /token on an unexpected HTTP method (PUT)', async () => {
    // /token only allows POST in the bypass map; a PUT must still be
    // sanitized so a future contributor cannot widen the surface by
    // accidentally routing extra verbs to the same path.
    const res = await request(app)
      .put('/token')
      .send({ q: "1; DROP TABLE users; --" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DANGEROUS_INPUT');
  });
});
