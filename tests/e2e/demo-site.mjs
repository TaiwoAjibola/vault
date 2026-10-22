/**
 * A tiny login page used as the "foreign website" in extension end-to-end
 * tests. It replaces the form with a success message after submit so the
 * extension can detect a completed login.
 */
import http from "node:http";

const page = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Demo Bank · Sign in</title>
<style>
  body { font-family: system-ui, sans-serif; background:#f4f4f2; color:#1c1c1c; margin:0; display:grid; place-items:center; min-height:100vh; }
  form { background:#fff; padding:28px 30px; border-radius:14px; box-shadow:0 10px 40px rgba(0,0,0,.08); width:320px; display:grid; gap:12px; }
  h1 { font-size:19px; margin:0 0 6px; }
  input { padding:10px 12px; border:1px solid #d8d8d4; border-radius:8px; font-size:14px; }
  button { padding:11px; border:0; border-radius:8px; background:#1c1c1c; color:#fff; font-size:14px; cursor:pointer; }
  .ok { color:#0a7c3d; font-size:13px; }
</style></head>
<body>
  <form id="login">
    <h1>Demo Bank</h1>
    <label>Email<input type="email" name="email" autocomplete="username" /></label>
    <label>Password<input type="password" name="password" autocomplete="current-password" /></label>
    <button type="submit">Sign in</button>
  </form>
  <script>
    document.getElementById('login').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target;
      const note = document.createElement('p');
      note.className = 'ok';
      note.textContent = 'Welcome back, ' + form.email.value;
      form.replaceWith(note);
    });
  </script>
</body></html>`;

export function createDemoSite() {
  return http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page);
  });
}
