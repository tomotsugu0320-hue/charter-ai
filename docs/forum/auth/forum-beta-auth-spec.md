# AI知恵袋Forum ベータ認証仕様

## 1. 目的

AI知恵袋Forum の公開ベータでは、閲覧は未ログインでも可能にしつつ、投稿・外部AI取り込み・AI整理・新規スレッド作成はログイン必須にする。

本格的な会員登録サービスではなく、ベータ向けの簡易セルフ登録方式として運用する。

## 2. 認証方式

現在の主方式は、好きなIDとパスワードによる簡易セルフ登録である。

- 利用者はログイン画面で任意のIDとパスワードを入力する
- `login_id` が未登録なら、そのIDとパスワードで自動登録する
- `login_id` が登録済みなら、パスワードが一致した場合だけログインできる
- パスワードは平文保存しない
- ログイン成功時は既存の `forum_beta_session` Cookie を発行する

移行期間の救済として、既存の `FORUM_BETA_USERS_JSON` / `FORUM_BETA_USER` / `FORUM_BETA_PASSWORD` による共通ID fallback も残す。

## 3. DBテーブル

簡易セルフ登録ユーザーは `forum_beta_users` に保存する。

```sql
create table if not exists forum_beta_users (
  id uuid primary key default gen_random_uuid(),
  login_id text not null,
  login_id_normalized text not null unique,
  password_hash text not null,
  display_name text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
```

`login_id_normalized` は `trim + lowercase` した値を保存する。

## 4. パスワード保存

パスワードは Node 標準の `crypto.scrypt` でハッシュ化する。

保存形式:

```txt
scrypt$<salt>$<hash>
```

- salt はランダム生成する
- verify 時は保存済み salt で再計算する
- 比較には `timingSafeEqual` を使う
- 平文パスワードはDB・ログ・コードに保存しない

## 5. Cookie仕様

Cookie名:

```txt
forum_beta_session
```

Cookie属性:

- `httpOnly: true`
- `sameSite: "lax"`
- `secure: process.env.NODE_ENV === "production"`
- `path: "/"`
- `maxAge`: 14日
- `expires`: 14日後

Cookieの署名には `FORUM_BETA_SESSION_SECRET` を使う。

## 6. 認証ヘルパー

実装場所:

```txt
src/lib/forum-auth.ts
```

主な関数:

- `normalizeForumBetaLoginId()`
- `hashForumBetaPassword()`
- `verifyForumBetaPassword()`
- `createForumBetaSessionToken()`
- `verifyForumBetaSessionToken()`
- `isForumBetaLoggedIn()`
- `getForumBetaSessionUser()`

`isForumBetaLoggedIn()` は既存通り、`forum_beta_session` Cookie の署名と期限を検証する。投稿API側はこの判定を使う。

## 7. ログインAPI

実装場所:

```txt
src/app/api/forum/login/route.ts
```

処理:

1. request body の `user` / `password` を読む
2. `user` を trim し、`login_id_normalized` を作る
3. 入力値を検証する
4. `forum_beta_users` から `login_id_normalized` を検索する
5. 未登録なら `password_hash` を作って insert する
6. 登録済みなら `password_hash` を verify する
7. 成功時に `createForumBetaSessionToken(user.id)` で Cookie を発行する
8. `last_login_at` を更新する
9. `{ ok: true }` を返す

既存の共通ID fallback は移行用として残す。

## 8. ログインページ

実装場所:

```txt
src/app/[tenant]/forum/login/page.tsx
```

表示方針:

- 好きなIDとパスワードでログインできることを説明する
- 初めて使うIDは自動登録されることを説明する
- 閲覧は未ログインでもできることを説明する
- 実際のIDやパスワードは画面に表示しない
- 新規登録ボタンは分けず、ログインボタンだけにする

## 9. ログアウトAPI

実装場所:

```txt
src/app/api/forum/logout/route.ts
```

`forum_beta_session` Cookie を削除し、`{ ok: true }` を返す。

## 10. ログイン状態確認API

実装場所:

```txt
src/app/api/forum/login/status/route.ts
```

`forum_beta_session` Cookie を検証し、ログイン状態を返す。

## 11. ログイン必須の範囲

投稿・作成・AI整理系APIは、引き続き `isForumBetaLoggedIn()` でログイン確認を行う。

主な対象:

- `POST /api/forum/create-thread-from-draft`
- `POST /api/forum/add-post`
- `POST /api/forum/generate-issue`
- `POST /api/forum/organize-post`
- `GET /api/forum/thread-summary`
- 保存済み参考投稿や外部AI取り込み周辺API

未ログイン時は 401 を返し、本処理に入らない。

## 12. 未ログインでも可能な範囲

Forumトップ、スレッド詳細、使い方ページなどの閲覧は未ログインでも可能である。

## 13. author_key との関係

`forum_beta_session` はログイン状態を確認するCookieである。

`author_key` は同じブラウザ・端末を識別するためのCookieであり、ログイン認証の正本ではない。

今回の簡易セルフ登録では、既存投稿とユーザーIDの厳密な紐づけまでは行わない。

## 14. ADMIN_KEY との関係

管理系APIや高権限APIでは、ログイン済みであっても `ADMIN_KEY` が必要なものがある。

簡易セルフ登録ユーザーに管理者権限は付与しない。

## 15. セキュリティ上の注意

この方式はベータ向けの簡易方式であり、本格的なアカウント管理ではない。

最低限の制約:

- パスワードは平文保存しない
- パスワードをログ出力しない
- `login_id` は 3〜32文字
- パスワードは 6〜128文字
- `login_id` は英数字、ハイフン、アンダースコアを許可する
- 登録済みIDのパスワード不一致でも、ID存在を推測しにくいエラー文言にする

今後の課題:

- スパム・荒らし対策
- 試行回数制限
- アカウント停止
- パスワード変更
- 管理者によるユーザー管理
- 投稿とユーザーIDの正式な紐づけ
- 招待制やメール認証への移行

## 16. 確認項目

- 未ログインでも閲覧できる
- 未ログインで投稿しようとするとログインへ誘導される
- 好きなID・パスワードで初回ログインすると自動登録される
- 同じID・同じパスワードで再ログインできる
- 同じID・違うパスワードではログインできない
- ログイン後、投稿・外部AI取り込み・AI整理が使える
- ログアウトできる
- 既存の共通ID fallback でも移行期間中はログインできる

