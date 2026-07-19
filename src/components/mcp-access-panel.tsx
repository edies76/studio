'use client';

import { useEffect, useState } from 'react';

type Credential = { id: string; label: string; createdAt: number; lastUsedAt?: number; revokedAt?: number };

export default function McpAccessPanel() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [endpoint, setEndpoint] = useState('https://docss.studio/api/mcp');
  const [token, setToken] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'guest' | 'busy' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const load = async () => {
    setState('loading');
    try {
      const response = await fetch('/api/mcp/access');
      if (response.status === 401) { setState('guest'); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo cargar MCP.');
      setEndpoint(data.endpoint || endpoint);
      setCredentials(Array.isArray(data.credentials) ? data.credentials : []);
      setState('ready');
    } catch (error: any) { setMessage(error?.message || 'No se pudo cargar MCP.'); setState('error'); }
  };

  useEffect(() => { void load(); }, []);

  const create = async () => {
    setState('busy'); setMessage(''); setToken('');
    try {
      const response = await fetch('/api/mcp/access', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'My external agent' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo crear la credencial.');
      setEndpoint(data.endpoint || endpoint);
      setToken(data.credential.token);
      setCredentials((items) => [{ ...data.credential, token: undefined }, ...items]);
      setState('ready');
    } catch (error: any) { setMessage(error?.message || 'No se pudo crear la credencial.'); setState('error'); }
  };

  const revoke = async (id: string) => {
    setState('busy');
    try {
      const response = await fetch(`/api/mcp/access?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('No se pudo revocar la credencial.');
      setCredentials((items) => items.filter((item) => item.id !== id));
      setState('ready');
    } catch (error: any) { setMessage(error?.message || 'No se pudo revocar la credencial.'); setState('error'); }
  };

  return <aside className="mcp-access-panel">
    <p className="mcp-label">YOUR MCP ACCESS</p>
    <h3>Connect an agent to your workspace.</h3>
    {state === 'guest' ? <><p>Sign in with Google to create a personal token. It only grants access to your own documents.</p><a className="mcp-access-panel__button" href="/login?callbackUrl=%2Fmcp">Sign in with Google ↗</a></> : <>
      <p>Create one token, paste it into Claude, Codex, Cursor, or another Streamable HTTP MCP client. The token is shown once and has all MCP permissions.</p>
      {token && <div className="mcp-access-panel__token"><span>Copy this now — it will not be shown again.</span><code>{token}</code><button type="button" onClick={() => void navigator.clipboard.writeText(token)}>Copy token</button></div>}
      <code className="mcp-access-panel__endpoint">{endpoint}</code>
      <button type="button" disabled={state === 'loading' || state === 'busy'} className="mcp-access-panel__button" onClick={() => void create()}>{state === 'busy' ? 'Creating…' : 'Create personal token'}</button>
      {credentials.length > 0 && <div className="mcp-access-panel__list">{credentials.map((credential) => <div key={credential.id}><span><strong>{credential.label}</strong><small>{credential.lastUsedAt ? 'Used before' : 'Not used yet'}</small></span><button type="button" onClick={() => void revoke(credential.id)}>Revoke</button></div>)}</div>}
      {message && <p className="mcp-access-panel__error">{message}</p>}
    </>}
  </aside>;
}
