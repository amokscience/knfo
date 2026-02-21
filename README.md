# KNFO

Minimal React + Go app that serves a web UI and runs:

- `kubectl get namespaces -A`

The output is shown in a table in the browser.

## Run
 
1. Ensure `kubectl` is installed and configured for your cluster/context.
2. Start the server:

```powershell
go run .
```

3. Open:

`http://localhost:8080`

4. Click **Run kubectl get namespaces -A**.

## Files

- `main.go` - Go HTTP server + `/api/namespaces` endpoint.
- `web/index.html` - React page host.
- `web/app.jsx` - React button + table rendering logic.
