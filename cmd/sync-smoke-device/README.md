# sync-smoke-device

Small black-box sync test app. Each process represents one device. Each device
uses its own `--data-dir`, so opening the app multiple times with different
directories simulates multiple devices.

## WebDAV

Device A:

```bash
go run ./cmd/sync-smoke-device \
  --device A \
  --data-dir /tmp/devboard-sync/A \
  --remote webdav \
  --webdav-url "https://example.com/dav" \
  --webdav-user "user" \
  --webdav-pass "pass" \
  --root-dir "/devboard-smoke-test"
```

Device B:

```bash
go run ./cmd/sync-smoke-device \
  --device B \
  --data-dir /tmp/devboard-sync/B \
  --remote webdav \
  --webdav-url "https://example.com/dav" \
  --webdav-user "user" \
  --webdav-pass "pass" \
  --root-dir "/devboard-smoke-test"
```

## Git

Use a separate working copy per device when testing a real Git remote.

```bash
go run ./cmd/sync-smoke-device \
  --device A \
  --data-dir /tmp/devboard-sync/A \
  --remote git \
  --git-repo /tmp/devboard-sync/repo-a \
  --root-dir "/sync"
```

If the Git working copy has a remote, the tool runs `git pull --rebase
--autostash` before sync and `git push` after commit.

## Commands

```text
create <text>       create a local record
update <id> <text>  update a local record
delete <id>         tombstone a local record
list                show visible records
list-all            show visible and deleted records
status              show local checkpoint and draft count
pull                pull remote manifest/op segments
push                push local draft records as an op segment
sync                pull then push
remote              show remote manifest
exit                quit
```

Scripted command mode:

```bash
go run ./cmd/sync-smoke-device \
  --device A \
  --data-dir /tmp/devboard-sync/A \
  --remote git \
  --git-repo /tmp/devboard-sync/repo \
  --root-dir "/sync" \
  --cmd "create hello; sync; status"
```
