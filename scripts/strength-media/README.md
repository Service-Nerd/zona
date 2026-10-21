# Strength demo media — evaluation kit (STRENGTH-MEDIA-01)

Everything needed to rebuild the 2026-10-21 evaluation. **No RepDB files are in this repo, deliberately:** the free
preview is CC BY-NC 4.0 (evaluation only) and must never be committed or deployed.

1. **Get the preview** (171 MB, no signup) into a folder outside the repo:
   `curl -sL -o repdb-preview.zip https://cdn.repdb.co/repdb-assets/site/repdb-preview.zip && unzip -q repdb-preview.zip -d files`
   (the page link is `https://repdb.co/download/preview?locale=en`, which redirects there).
2. **Recolour** the orange highlight to `--s-strength` and export 512 px animation + still:
   `python3 recolour.py <folder-holding-files/> <slug>` (needs Pillow; run it from a directory you control, not
   from inside the download). Output goes to `<folder>/recolour/`. Slugs used: `front-squat`,
   `barbell-reverse-lunge`, `one-arm-kettlebell-row`, `pull-up`.
3. **Prototype placement B** on a throwaway branch, never pushed:
   `git worktree add <dir> -b proto/strength-media-local main`, `git -C <dir> apply <repo>/scripts/strength-media/placement-b-prototype.patch`,
   symlink `node_modules`, copy `.env.local`, put the 8 recoloured files in `<dir>/public/proto-repdb/`,
   `npx next dev -p 3100` in `<dir>`, open `/strength-preview` and tap **media**. On a phone on the same Wi-Fi:
   `http://<mac-ip>:3100/strength-preview`.
