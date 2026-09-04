# sync-smoke-gui

Visual black-box sync tester. Each running process represents one device. Start
multiple processes with different `--data-dir` values to simulate multiple
devices.

The app stores only test data in its own `device-state.json`; it does not touch
the Devboard production database.

## Run Two Devices

Device A:

```bash
go run ./cmd/sync-smoke-gui \
  --device A \
  --data-dir /tmp/devboard-sync-gui/A
```

Device B:

```bash
go run ./cmd/sync-smoke-gui \
  --device B \
  --data-dir /tmp/devboard-sync-gui/B
```

Configure WebDAV or Git from the GUI. Use the same remote settings in both
windows, then create records and click `Sync`.

## Remote Backends

WebDAV:

- Backend: `WebDAV`
- Root Dir: `/devboard-smoke-test`
- WebDAV URL / username / password

Git:

- Backend: `Git`
- Root Dir: `/sync`
- Git Worktree: a local Git working copy path

When the Git working copy has a remote, the app pulls with rebase before sync
and pushes after committing new sync files.

## Smoke Flow

1. Start device A and B with different `--data-dir`.
2. In both windows save the same remote config.
3. On A, create a record and click `Sync`.
4. On B, click `Sync`; A's record should appear.
5. On B, create a second record and click `Sync`.
6. On A, click `Sync`; both records should appear.
7. Edit the same record on both devices before syncing one side, then sync the
   other side; the later sync should report a conflict instead of overwriting.
