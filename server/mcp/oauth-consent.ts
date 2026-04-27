// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { randomBytes } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import {
  KoveoMcpOAuthProvider,
  type McpRole,
} from './oauth-provider';

/**
 * Map a Koveo user account role to the role its OAuth-bound MCP session
 * should run as.
 *
 * - `super_admin` → `super_admin` (scoped to MCP-1/MCP-2 sandbox orgs)
 * - `admin`       → `admin` (scoped to that admin's own org memberships)
 * - `manager`     → `manager`
 * - everything else → `tenant`
 */
export function effectiveMcpRoleForUser(userRole: string | null | undefined): McpRole {
  if (userRole === 'super_admin') return 'super_admin';
  if (userRole === 'admin') return 'admin';
  if (userRole === 'manager') return 'manager';
  return 'tenant';
}

const COPY = {
  title: {
    en: 'Authorize MCP access',
    fr: "Autoriser l'accès MCP",
  },
  intro: {
    en: 'wants to connect to your Koveo Gestion data through the Model Context Protocol.',
    fr: 'souhaite se connecter à vos données Koveo Gestion via le Model Context Protocol.',
  },
  approve: { en: 'Approve', fr: 'Approuver' },
  deny: { en: 'Deny', fr: 'Refuser' },
  loginRequired: {
    en: 'Please sign in first, then return to this page to approve the request.',
    fr: 'Veuillez vous connecter, puis revenez à cette page pour approuver la demande.',
  },
  signIn: { en: 'Sign in', fr: 'Se connecter' },
  invalidFlow: {
    en: 'This authorization request is invalid or has expired.',
    fr: 'Cette demande d\u2019autorisation est invalide ou a expiré.',
  },
  invalidFlowHelp: {
    en: 'This usually happens when the consent link was opened twice, took too long to complete, or was started in another browser. To finish connecting, return to Claude (or the app you came from) and start the connection again.',
    fr: "Cela se produit généralement lorsque le lien d\u2019autorisation a été ouvert deux fois, a pris trop de temps ou a été démarré dans un autre navigateur. Pour terminer la connexion, retournez dans Claude (ou l\u2019application d\u2019où vous venez) et relancez la connexion.",
  },
  goHome: { en: 'Go to Koveo Gestion', fr: 'Aller à Koveo Gestion' },
  connecting: { en: 'Connecting…', fr: 'Connexion…' },
  scopesLabel: { en: 'Requested access', fr: 'Accès demandé' },
  signedInAs: { en: 'Signed in as', fr: 'Connecté en tant que' },
};

function invalidFlowHtml(lang: 'en' | 'fr'): string {
  return `<h1>${COPY.title[lang]}</h1>
<p>${COPY.invalidFlow[lang]}</p>
<p class="muted">${COPY.invalidFlowHelp[lang]}</p>
<div class="actions">
  <a class="primary" href="/" style="text-decoration:none;display:inline-block;padding:8px 16px;border-radius:8px">${COPY.goHome[lang]}</a>
</div>`;
}

function pickLang(req: Request): 'en' | 'fr' {
  const q = (req.query.lang as string | undefined)?.toLowerCase();
  if (q === 'fr' || q === 'en') return q;
  const al = req.headers['accept-language'] ?? '';
  return /fr/i.test(al) ? 'fr' : 'en';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&'
      ? '&amp;'
      : c === '<'
      ? '&lt;'
      : c === '>'
      ? '&gt;'
      : c === '"'
      ? '&quot;'
      : '&#39;',
  );
}

function shellHtml(lang: 'en' | 'fr', body: string): string {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Koveo Gestion \u2014 MCP</title>
<style>
  :root {
    color-scheme: light dark;
    --background: hsl(0, 0%, 100%);
    --foreground: hsl(210, 25%, 7.8431%);
    --card: hsl(180, 6.6667%, 97.0588%);
    --card-foreground: hsl(210, 25%, 7.8431%);
    --muted: hsl(240, 1.9608%, 90%);
    --muted-foreground: hsl(210, 6%, 40%);
    --border: hsl(201.4286, 30.4348%, 90.9804%);
    --input-bg: hsl(200, 23.0769%, 97.451%);
    --primary: hsl(203.8863, 88.2845%, 53.1373%);
    --primary-foreground: hsl(0, 0%, 100%);
    --ring: hsl(202.8169, 89.1213%, 53.1373%);
    --radius: 12px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --background: hsl(0, 0%, 0%);
      --foreground: hsl(200, 6.6667%, 91.1765%);
      --card: hsl(228, 9.8039%, 10%);
      --card-foreground: hsl(0, 0%, 85.098%);
      --muted: hsl(0, 0%, 9.4118%);
      --muted-foreground: hsl(210, 6%, 60%);
      --border: hsl(210, 5.2632%, 14.902%);
      --input-bg: hsl(207.6923, 27.6596%, 18.4314%);
      --primary: hsl(203.7736, 87.6033%, 52.549%);
      --primary-foreground: hsl(0, 0%, 100%);
    }
  }
  html, body { background: var(--background); color: var(--foreground); }
  body { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; max-width: 520px; margin: 6vh auto; padding: 24px; line-height: 1.5; }
  h1 { font-size: 1.4rem; margin: 0 0 12px; color: var(--card-foreground); }
  p { margin: 8px 0; }
  a { color: var(--primary); }
  .card {
    background: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    box-shadow: 0 1px 2px rgba(0,0,0,.08);
  }
  .muted { color: var(--muted-foreground); font-size: .9rem; }
  .row { margin: 16px 0; }
  label { display: block; font-weight: 600; margin-bottom: 6px; color: var(--card-foreground); }
  button {
    font: inherit;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--card-foreground);
  }
  button:focus { outline: 2px solid var(--ring); outline-offset: 1px; }
  .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
  button { cursor: pointer; }
  button.primary, a.primary { background: var(--primary); color: var(--primary-foreground); border: 1px solid var(--primary); }
  button.primary:hover, a.primary:hover { filter: brightness(1.05); }
  button.secondary { background: transparent; color: var(--card-foreground); border: 1px solid var(--border); }
  button.secondary:hover { background: var(--muted); }
  .lang { float: right; font-size: .85rem; }
  .lang a { color: var(--muted-foreground); text-decoration: none; margin-left: 8px; }
  .lang a:hover { color: var(--card-foreground); }
  .scopes {
    background: var(--muted);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    font-family: Menlo, ui-monospace, monospace;
    font-size: .85rem;
    word-break: break-word;
  }
</style>
</head>
<body>
  <div class="card">
    ${body}
  </div>
</body>
</html>`;
}

/**
 * Patch the outgoing Content-Security-Policy header for the OAuth consent
 * page so that:
 *   - the inline double-click-protection script is allowed via a per-request
 *     `'nonce-<value>'` entry on `script-src`, and
 *   - the 302 redirect from POST /oauth/consent to an external HTTPS OAuth
 *     callback (e.g. claude.ai) is permitted by adding `https:` to
 *     `form-action`.
 *
 * Helmet has already set the header by the time the route handler runs, so
 * we mutate the serialized header string in place. Other directives are
 * left untouched. If no CSP header is present (e.g. tests that bypass
 * helmet), this is a no-op.
 */
function patchConsentCsp(res: Response, nonce: string): void {
  const existing = res.getHeader('Content-Security-Policy');
  if (typeof existing !== 'string' || existing.length === 0) return;

  const directives = existing.split(';').map((d) => d.trim()).filter((d) => d.length > 0);
  let scriptSrcSeen = false;
  let formActionSeen = false;

  const updated = directives.map((directive) => {
    const spaceIdx = directive.indexOf(' ');
    const name = (spaceIdx === -1 ? directive : directive.slice(0, spaceIdx)).toLowerCase();
    const value = spaceIdx === -1 ? '' : directive.slice(spaceIdx + 1);

    if (name === 'script-src') {
      scriptSrcSeen = true;
      return `script-src ${value} 'nonce-${nonce}'`.trim();
    }
    if (name === 'form-action') {
      formActionSeen = true;
      if (/(^|\s)https:(\s|$)/.test(value)) return directive;
      return `form-action ${value} https:`.trim();
    }
    return directive;
  });

  if (!scriptSrcSeen) updated.push(`script-src 'self' 'nonce-${nonce}'`);
  if (!formActionSeen) updated.push(`form-action 'self' https:`);

  res.setHeader('Content-Security-Policy', updated.join('; '));
}

export function registerOAuthConsentRoutes(
  app: Express,
  provider: KoveoMcpOAuthProvider,
) {
  app.get('/oauth/consent', async (req: Request, res: Response) => {
    const lang = pickLang(req);
    const flow = (req.query.flow as string | undefined) ?? '';
    const row = await provider.getPendingFlow(flow);

    if (!row || row.expiresAt.getTime() < Date.now()) {
      const reason = !flow ? 'missing_flow_param' : !row ? 'flow_not_found' : 'expired';
      console.warn('[OAuth consent GET] rejecting:', reason, 'flowLen=', flow.length);
      res.status(400).type('html').send(shellHtml(lang, invalidFlowHtml(lang)));
      return;
    }

    // Idempotent: if the user reloads the consent URL after they already
    // approved (e.g. browser back/forward), and the issued auth code has not
    // yet been exchanged for a token, just re-redirect to the client with the
    // existing code instead of showing an error. The flow code IS the auth
    // code (see provider.authorize / finalizeAuthorization).
    if (
      row.status === 'issued' &&
      !row.used &&
      req.session?.userId &&
      row.userId === req.session.userId
    ) {
      console.info('[OAuth consent GET] re-redirecting already-issued flow for same user');
      const url = new URL(row.redirectUri);
      url.searchParams.set('code', flow);
      if (row.state) url.searchParams.set('state', row.state);
      res.redirect(url.toString());
      return;
    }

    if (row.status !== 'pending') {
      console.warn('[OAuth consent GET] rejecting bad_status:', row.status);
      res.status(400).type('html').send(shellHtml(lang, invalidFlowHtml(lang)));
      return;
    }

    const userId = req.session?.userId;
    if (!userId) {
      const next = encodeURIComponent(`/oauth/consent?flow=${encodeURIComponent(flow)}&lang=${lang}`);
      const otherLang = lang === 'en' ? 'fr' : 'en';
      const langLink = `<div class="lang"><a href="?flow=${encodeURIComponent(flow)}&lang=${otherLang}">${otherLang.toUpperCase()}</a></div>`;
      res
        .status(200)
        .type('html')
        .send(
          shellHtml(
            lang,
            `${langLink}
<h1>${COPY.title[lang]}</h1>
<p>${COPY.loginRequired[lang]}</p>
<div class="actions">
  <a class="primary" href="/auth/login?next=${next}" style="text-decoration:none;display:inline-block;padding:8px 16px;border-radius:8px">${COPY.signIn[lang]}</a>
</div>`,
          ),
        );
      return;
    }

    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userRows[0];
    const userEmail = user?.email ?? '';

    const clientInfo = await provider.clientsStore.getClient(row.clientId);
    const clientName = clientInfo?.client_name ?? row.clientId;
    const scopes = (row.scopes && row.scopes.length > 0
      ? row.scopes
      : ['mcp']
    ).join(' ');

    const otherLang = lang === 'en' ? 'fr' : 'en';
    const langLink = `<div class="lang"><a href="?flow=${encodeURIComponent(flow)}&lang=${otherLang}">${otherLang.toUpperCase()}</a></div>`;

    // Generate a per-request CSP nonce so the inline double-click-protection
    // script below is allowed in production (where 'unsafe-inline' is not
    // permitted on script-src). Also relax form-action so the POST handler's
    // 302 redirect to the external OAuth callback (e.g. claude.ai) is not
    // blocked by browsers that enforce form-action across the redirect chain.
    const cspNonce = randomBytes(16).toString('base64');
    res.locals.cspNonce = cspNonce;
    patchConsentCsp(res, cspNonce);

    res
      .type('html')
      .send(
        shellHtml(
          lang,
          `${langLink}
<h1>${COPY.title[lang]}</h1>
<p><strong>${escapeHtml(clientName)}</strong> ${COPY.intro[lang]}</p>
<p class="muted">${COPY.signedInAs[lang]}: ${escapeHtml(userEmail)}</p>
<form method="POST" action="/oauth/consent">
  <input type="hidden" name="flow" value="${escapeHtml(flow)}" />
  <input type="hidden" name="lang" value="${lang}" />
  <div class="row">
    <label>${COPY.scopesLabel[lang]}</label>
    <div class="scopes">${escapeHtml(scopes)}</div>
  </div>
  <div class="actions">
    <button type="submit" name="decision" value="deny" class="secondary" data-decision="deny">${COPY.deny[lang]}</button>
    <button type="submit" name="decision" value="approve" class="primary" data-decision="approve">${COPY.approve[lang]}</button>
  </div>
</form>
<script nonce="${cspNonce}">
  (function () {
    var form = document.querySelector('form[action="/oauth/consent"]');
    if (!form) return;
    var buttons = form.querySelectorAll('button[type="submit"]');
    var locked = false;
    var clickedDecision = null;
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        clickedDecision = btn.getAttribute('data-decision') || '';
      });
    });
    form.addEventListener('submit', function (ev) {
      if (locked) {
        ev.preventDefault();
        return;
      }
      locked = true;
      // Browsers only submit the name/value of the activated submit button.
      // Once we disable the buttons, that information is lost — so write the
      // chosen decision into a hidden field BEFORE disabling.
      if (clickedDecision) {
        var hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'decision';
        hidden.value = clickedDecision;
        form.appendChild(hidden);
      }
      buttons.forEach(function (btn) {
        btn.disabled = true;
        if (btn.getAttribute('data-decision') === 'approve') {
          btn.textContent = ${JSON.stringify(COPY.connecting[lang])};
        }
      });
    });
  })();
</script>`,
        ),
      );
  });

  app.post('/oauth/consent', async (req: Request, res: Response) => {
    const lang = pickLang(req);
    const flow = (req.body?.flow as string | undefined) ?? '';
    const decision = (req.body?.decision as string | undefined) ?? 'deny';

    const userId = req.session?.userId;
    if (!userId) {
      res.status(401).type('html').send(shellHtml(lang, `<h1>${COPY.title[lang]}</h1><p>${COPY.loginRequired[lang]}</p>`));
      return;
    }

    const row = await provider.getPendingFlow(flow);
    if (!row || row.expiresAt.getTime() < Date.now()) {
      const reason = !flow ? 'missing_flow_in_body' : !row ? 'flow_not_found' : 'expired';
      console.warn('[OAuth consent POST] rejecting:', reason, 'bodyKeys=', Object.keys(req.body ?? {}), 'flowLen=', flow.length, 'decision=', decision);
      res.status(400).type('html').send(shellHtml(lang, invalidFlowHtml(lang)));
      return;
    }

    // Idempotent re-submit: a double-clicked Approve button (or a refresh of
    // the POST after we already redirected once) lands here with the row
    // already in `issued` state. As long as the same user owns the flow and
    // the auth code has not yet been redeemed, replay the original redirect
    // instead of erroring out.
    if (
      row.status === 'issued' &&
      !row.used &&
      row.userId === userId &&
      decision === 'approve'
    ) {
      console.info('[OAuth consent POST] replaying redirect for already-issued flow');
      const url = new URL(row.redirectUri);
      url.searchParams.set('code', flow);
      if (row.state) url.searchParams.set('state', row.state);
      res.redirect(url.toString());
      return;
    }

    if (row.status !== 'pending') {
      console.warn('[OAuth consent POST] rejecting bad_status:', row.status, 'decision=', decision);
      res.status(400).type('html').send(shellHtml(lang, invalidFlowHtml(lang)));
      return;
    }

    if (decision !== 'approve') {
      const denied = await provider.denyAuthorization(flow);
      if (!denied) {
        res.status(400).type('html').send(shellHtml(lang, `<h1>${COPY.title[lang]}</h1><p>${COPY.invalidFlow[lang]}</p>`));
        return;
      }
      const url = new URL(denied.redirectUri);
      url.searchParams.set('error', 'access_denied');
      if (denied.state) url.searchParams.set('state', denied.state);
      res.redirect(url.toString());
      return;
    }

    const userRows = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId)))
      .limit(1);
    const user = userRows[0];
    if (!user) {
      res.status(401).type('html').send(shellHtml(lang, `<h1>${COPY.title[lang]}</h1><p>${COPY.loginRequired[lang]}</p>`));
      return;
    }

    // The OAuth-bound role is derived solely from the signed-in user's
    // account role. Admins connect as `manager` (MCP's highest supported
    // role); managers connect as `manager`; everyone else as `tenant`.
    const effective: McpRole = effectiveMcpRoleForUser(user.role);

    const finalized = await provider.finalizeAuthorization(flow, user.id, effective);
    const url = new URL(finalized.redirectUri);
    url.searchParams.set('code', finalized.code);
    if (finalized.state) url.searchParams.set('state', finalized.state);
    res.redirect(url.toString());
  });
}