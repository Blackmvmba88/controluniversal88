# RUNBOOK — Remote Tunnel & Bookmarklet

This runbook explains how to manage tunnel tokens, rotate secrets, and debug remote E2E failures.

## Rotate Ngrok Token

1. Generate a new authtoken at https://dashboard.ngrok.com/get-started/your-authtoken
2. In GitHub repo `Settings > Secrets > Actions`, update the secret `NGROK_AUTH_TOKEN` with the new token.
3. Optionally remove older tokens or use scoped tokens per organization.
4. Re-run CI; confirm the `Start tunnel` step reports `Using ngrok with auth token`.

## Rotate Slack Webhook

1. If using Slack alerts, generate a new webhook and update `SLACK_WEBHOOK` in repo secrets.
2. Confirm notifications arrive in the channel when CI fails (use the `Notify Slack on failure` step). If missing, check step logs.

## Debugging Remote E2E Failures

- Check workflow logs for `Start tunnel` and `Create bookmarklet` steps. The pipeline uploads `bookmarklet.txt` as an artifact (see Artifacts tab).
- Confirm the `E2E Tunnel URL` comment was posted on the PR (if PR-triggered); the comment contains a link to `$LT_URL/bookmarklet.txt?url=...` which returns the bookmarklet text.
- From the public URL, try manually visiting `$LT_URL/monitor.html` and `$LT_URL/flightsim_stub.html`.
- To diagnose WebSocket connectivity, open the browser console on the public page and look for WebSocket connect logs in the Network tab and console logs (`Bookmarklet WS open` / `WS connected`).

## Security & Token Management

- Prefer using ngrok with short-lived tokens and rotate regularly.
- Store secrets in GitHub Actions secrets and grant minimal access.
- For very sensitive environments, prefer a self-hosted tunnel or VPN rather than public tunnels.

## Additional Notes

- The workflow prefers ngrok when `NGROK_AUTH_TOKEN` is set; otherwise it falls back to `localtunnel`.
- The `bookmarklet.txt` endpoint is accessible at `/$LT_URL/bookmarklet.txt?url=<encoded>` and returns the bookmarklet text (no auth required) — treat it as short-lived and replace the tunnel frequently.
- If you want per-PR ephemeral tokens or to rotate per-run, open an issue and we can implement ephemeral token injection and vault integration.
