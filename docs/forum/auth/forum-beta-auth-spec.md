# AI知恵袋Forum ベータ認証仕様書

## 1. 目的

AI知恵袋Forum の限定ベータでは、身内ベータ / 限定ベータ向けに、共通ID・共通パスワードによる簡易ログインを導入している。

この認証は、次の目的で使う。

- 未ログインでも Forum の閲覧はできるようにする
- 投稿、新規スレッド作成、AI整理系APIの実行はログイン必須にする
- 未ログイン状態で OpenAI API や投稿作成APIが不要に実行されることを防ぐ
- 本格的なユーザー登録機能を入れる前に、限定ベータとして安全に運用する

この方式は本格的なユーザー認証ではない。ユーザーごとのアカウント、権限、投稿者識別、パスワード変更、招待管理などはまだ扱わない。全員が同じ共通ID・共通パスワードでログインする方式である。

## 2. 現在の認証方式

現在の認証方式は、DBを使わない簡易セッション方式である。

- 共通ID / 共通パスワード方式
- ID、パスワード、署名secretは環境変数で管理する
- ログイン成功時に `forum_beta_session` Cookie を発行する
- Cookie は `HttpOnly`
- Cookie は署名付きトークン
- Cookie は `SameSite=Lax`
- production では `Secure`
- Cookie は期限付き
- DB、Supabase、ユーザーテーブルは使わない

セッショントークンは `payload.signature` 形式で、payload を HMAC-SHA256 で署名する。payload には `sub`, `iat`, `exp`, `nonce`, `v` が含まれる。

現在の有効期限は 14日である。

## 3. 使用する環境変数

```env
FORUM_BETA_USER
FORUM_BETA_PASSWORD
FORUM_BETA_SESSION_SECRET
```

それぞれの用途は次の通り。

- `FORUM_BETA_USER`: 共通ログインID
- `FORUM_BETA_PASSWORD`: 共通ログインパスワード
- `FORUM_BETA_SESSION_SECRET`: `forum_beta_session` Cookie の署名に使うsecret

`FORUM_BETA_SESSION_SECRET` が未設定の場合、セッショントークンを安全に発行・検証できない。ログインAPIでは、必要な環境変数が未設定の場合に 500 を返す。

## 4. Cookie仕様

Cookie名:

```txt
forum_beta_session
```

発行条件:

- `POST /api/forum/login` に正しい共通ID・共通パスワードが送られた場合

Cookie属性:

- `httpOnly: true`
- `sameSite: "lax"`
- `secure: process.env.NODE_ENV === "production"`
- `path: "/"`
- `maxAge`: 14日
- `expires`: 14日後

削除条件:

- `POST /api/forum/logout` 実行時に、同名Cookieを `maxAge: 0` / `expires: new Date(0)` で上書きする

## 5. 共通認証ヘルパー

実装場所:

```txt
src/lib/forum-auth.ts
```

主な関数:

- `createForumBetaSessionToken()`
- `verifyForumBetaSessionToken()`
- `isForumBetaLoggedIn()`
- `getForumBetaSessionCookieOptions()`
- `getForumBetaSessionClearCookieOptions()`
- `isForumBetaAuthConfigured()`
- `verifyForumBetaCredentials()`

`isForumBetaLoggedIn()` は `Request` または `Headers` から `forum_beta_session` Cookie を読み取り、署名と期限を検証する。改ざんされたCookie、期限切れCookie、secret未設定時はログイン済みとみなさない。

## 6. ログイン関連API

### POST /api/forum/login

実装場所:

```txt
src/app/api/forum/login/route.ts
```

処理:

1. `FORUM_BETA_USER` / `FORUM_BETA_PASSWORD` / `FORUM_BETA_SESSION_SECRET` が設定済みか確認する
2. request body の `user` / `password` を読む
3. 環境変数の共通ID・共通パスワードと照合する
4. 一致したら `forum_beta_session` Cookie を発行する
5. `{ ok: true }` を返す

失敗時:

- 認証設定が未完了: 500
- IDまたはパスワード不一致: 401

### POST /api/forum/logout

実装場所:

```txt
src/app/api/forum/logout/route.ts
```

処理:

1. `forum_beta_session` Cookie を削除する
2. `{ ok: true }` を返す

### GET /api/forum/login/status

実装場所:

```txt
src/app/api/forum/login/status/route.ts
```

処理:

1. `forum_beta_session` Cookie を検証する
2. ログイン済みなら `{ ok: true, loggedIn: true }`
3. 未ログインなら `{ ok: true, loggedIn: false }`

このAPIは DB、Supabase、OpenAI を呼ばない軽量な状態確認APIである。

## 7. ログインページ

実装場所:

```txt
src/app/[tenant]/forum/login/page.tsx
```

URL:

```txt
/{tenant}/forum/login
```

画面要素:

- 共通ID入力欄
- パスワード入力欄
- ログインボタン
- エラー表示

ログイン成功後は、`next` query が安全な相対パスであればそこへ遷移する。`next` がない場合、または不正な値の場合は `/{tenant}/forum` へ戻る。

例:

```txt
/dev/forum/login?next=%2Fdev%2Fforum%23create
```

## 8. Forumトップ側のログイン連携

実装場所:

```txt
src/app/[tenant]/forum/page.tsx
```

Forumトップでは、次の用途で `GET /api/forum/login/status` を使う。

- 初期表示時にログイン状態を確認する
- 右上メニューでログイン済みなら「ログアウト」、未ログインなら「ログイン」を表示する
- 作成系操作の直前にログイン状態を確認する

未ログイン時に作成系操作を行った場合は、API本体を呼ぶ前に処理を止め、ログインページへ誘導する。

誘導先:

```txt
/{tenant}/forum/login?next=/{tenant}/forum#create
```

Forumトップの投稿・作成エリアには `id="create"` が付いており、ログイン後に作成エリアへ戻れる。

## 9. 現在ログイン必須のAPI

現在、次のAPIは `forum_beta_session` によるログイン確認を行う。

### 通常投稿

```txt
POST /api/forum/add-post
```

実装場所:

```txt
src/app/api/forum/add-post/route.ts
```

未ログイン時:

```json
{ "ok": false, "error": "Login required." }
```

HTTP status:

```txt
401
```

### 新規スレッド作成

```txt
POST /api/forum/create-thread-from-draft
```

実装場所:

```txt
src/app/api/forum/create-thread-from-draft/route.ts
```

未ログイン時は 401 を返し、スレッド作成処理には入らない。

### AI整理系API

```txt
POST /api/forum/generate-issue
POST /api/forum/organize-post
GET  /api/forum/thread-summary
```

実装場所:

```txt
src/app/api/forum/generate-issue/route.ts
src/app/api/forum/organize-post/route.ts
src/app/api/forum/thread-summary/route.ts
```

未ログイン時は 401 を返し、OpenAI API、Supabase取得、DB保存などの本処理に入らない。

## 10. 未ログインでも閲覧可能な範囲

現時点では、閲覧系のページやAPIは未ログインでも利用可能である。

想定:

- Forumトップ閲覧
- スレッド詳細閲覧
- トップサマリー取得
- スレッド詳細取得
- 一覧ページ閲覧
- 議論マップ閲覧

閲覧はベータ参加者以外にも開ける可能性があるため、限定ベータで完全クローズドにしたい場合は、別途 middleware または閲覧API側の認証が必要である。

## 11. 現時点で未保護または別認証の範囲

### まだ `forum_beta_session` では保護していないもの

次の系統は、現時点では限定ベータログインによるAPI保護が未完了である。

- 保存済み参考投稿の保存
- 保存済み参考投稿の一覧取得
- 近いスレッド検索
- スレッド非表示 / 復元
- 会員向け非表示 / 復元ページ

これらは次段階でログイン必須化を検討する。

### ADMIN_KEY を維持するもの

次の高権限APIは、`forum_beta_session` ではなく `x-admin-key === process.env.ADMIN_KEY` を必須とする。

- 完全削除
- AI論理スコア再評価
- 議論マップ再編案生成
- 管理者用ユーザー確認
- 管理者用投稿確認

ログイン済みであっても、ADMIN_KEY が必要な操作は ADMIN_KEY 必須のまま維持する。

## 12. author_key との関係

`author_key` は、ログイン認証ではなく端末識別用のCookieである。

現在の用途:

- 投稿者自身の投稿判定
- 自分のスレッド非表示などの一部操作
- 保存済み参考投稿の端末別管理

`forum_beta_session` は「限定ベータにログイン済みか」を見るためのCookieであり、`author_key` は「同じブラウザ・端末か」を見るためのCookieである。役割は別である。

共通ID・共通パスワード方式では、誰が投稿したかをユーザー単位で識別できない。将来的に本格ログインへ移行する場合は、`author_key` と `user_id` の関係を整理する必要がある。

## 13. localStorage / sessionStorage の現状

Forumトップでは、主に表示設定と下書き保持に browser storage を使っている。

- `localStorage`: 表示モード、文字サイズなど
- `sessionStorage`: Forumトップの投稿下書きなど

これらはログイン状態の正本ではない。ログイン判定は `forum_beta_session` Cookie をAPI側で検証する。

## 14. セキュリティ上の注意点

現在の方式は限定ベータ向けの簡易認証であり、次の制約がある。

- 共通ID・共通パスワードなので、ユーザーごとの識別はできない
- パスワードを共有された人全員が同じ権限になる
- Cookie失効は期限切れまたはログアウトが中心で、個別ユーザー単位の失効はできない
- DBにセッションを保存していないため、サーバー側から特定セッションだけを失効できない
- CSRF対策は `SameSite=Lax` に依存している
- 閲覧自体は未ログインでも可能

限定ベータの運用では、ID・パスワードを信頼できる範囲にだけ共有し、漏えい時は環境変数のパスワードまたは `FORUM_BETA_SESSION_SECRET` を変更する。

`FORUM_BETA_SESSION_SECRET` を変更すると、既存の `forum_beta_session` は署名検証に失敗し、実質的に全員ログアウトされる。

## 15. 今後の保護対象候補

次段階でログイン必須化を検討するAPI:

- `POST /api/forum/save-private-log`
- `GET /api/forum/private-import-logs`
- `POST /api/forum/search-related`
- `POST /api/forum/delete-thread`
- `POST /api/forum/restore-thread`
- `GET /api/forum/admin-threads`

特に、保存済み参考投稿、外部AI取り込み、近いスレッド検索は、投稿作成の周辺機能としてログイン必須化する優先度が高い。

## 16. 本格ログインへ移行する場合の方針

将来的にユーザー別ログインへ移行する場合は、次の対応が必要になる。

- ユーザーテーブルの設計
- パスワードハッシュ保存
- メール認証または招待制ログイン
- `forum_beta_session` とは別のユーザーセッション管理
- 投稿と `user_id` の紐づけ
- 既存の `author_key` 投稿をどう移行するか
- 保存済み参考投稿を端末依存からユーザー依存へ移すか
- 管理者権限と一般ユーザー権限の分離
- ログアウト、セッション失効、パスワード変更、退会処理

本格ログインに移行しても、完全削除やAI管理系APIは管理者権限を別途確認する必要がある。

## 17. 現在の確認方法

### ログイン状態確認

未ログイン:

```txt
GET /api/forum/login/status
=> { ok: true, loggedIn: false }
```

ログイン済み:

```txt
GET /api/forum/login/status
=> { ok: true, loggedIn: true }
```

### 未ログイン時の保護API確認

Cookieなしで次を実行すると 401 になる。

```txt
POST /api/forum/add-post
POST /api/forum/create-thread-from-draft
POST /api/forum/generate-issue
POST /api/forum/organize-post
GET  /api/forum/thread-summary
```

レスポンス例:

```json
{ "ok": false, "error": "Login required." }
```

### ログイン画面確認

```txt
/{tenant}/forum/login
```

確認項目:

- 間違ったID・パスワードでエラーになる
- 正しいID・パスワードでログインできる
- ログイン成功後に `next` があればそこへ戻る
- Forumトップ右上メニューでログイン / ログアウト表示が切り替わる
- ログアウト後は `forum_beta_session` Cookie が削除される

