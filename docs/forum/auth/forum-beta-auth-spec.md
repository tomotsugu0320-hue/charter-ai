# AI知恵袋Forum ベータ認証仕様

## 1. 目的

AI知恵袋Forum の公開ベータでは、閲覧は未ログインでも可能にしつつ、投稿・外部AI取り込み・AI整理・新規スレッド作成はログイン必須にする。

本格的な会員登録サービスではなく、ベータ向けの簡易ID/password方式として運用する。

## 2. 認証方式

現在の方式は、ログインと新規登録を分離した簡易セルフ登録方式である。

- 新規登録ページで任意のIDとパスワードを作成する
- 新規登録時はパスワード確認入力を行う
- 新規登録時に任意のハンドルネームを登録できる
- ログインページでは登録済みIDだけを受け付ける
- ログインAPIでは未登録IDを自動登録しない
- 登録済みIDの場合だけ、保存済み `password_hash` と照合する
- パスワードは平文保存しない
- ログイン成功時は既存の `forum_beta_session` Cookie を発行する

旧共通ID fallback は通常ログインAPIでは使わない。

## 3. DBテーブル

簡易登録ユーザーは `forum_beta_users` に保存する。

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

`display_name` は任意のハンドルネームを保存する。未入力の場合は `login_id` を表示名の代替として保存する。

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
- `normalizeForumBetaDisplayName()`
- `validateForumBetaLoginInput()`
- `validateForumBetaPasswordConfirmation()`
- `validateForumBetaDisplayName()`
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
2. 入力値を検証する
3. `user` を trim し、`login_id_normalized` を作る
4. `forum_beta_users` から `login_id_normalized` を検索する
5. ユーザーが存在しない場合は 401 を返す
6. ユーザーが存在する場合だけ `password_hash` を verify する
7. パスワード不一致なら 401 を返す
8. 成功時に `createForumBetaSessionToken(user.id)` で Cookie を発行する
9. `last_login_at` を更新する
10. `{ ok: true }` を返す

ログインAPIでは `forum_beta_users` への insert を行わない。

## 8. 新規登録API

実装場所:

```txt
src/app/api/forum/register/route.ts
```

処理:

1. request body の `user` / `password` / `passwordConfirm` / `displayName` を読む
2. ID・パスワード・パスワード確認・ハンドルネームを検証する
3. `password` と `passwordConfirm` が一致しない場合は 400 を返す
4. `user` を trim し、`login_id_normalized` を作る
5. `forum_beta_users` から `login_id_normalized` を検索する
6. 既存IDなら 409 を返す
7. 未登録IDなら `password_hash` を作成し、`display_name` と一緒に insert する
8. `passwordConfirm` は保存しない
9. 登録成功時に `createForumBetaSessionToken(user.id)` で Cookie を発行する
10. `{ ok: true }` を返す

新規登録APIでのみ `forum_beta_users` に insert する。

ハンドルネームは任意で、trim 後 1〜20文字までを許可する。未入力の場合は `login_id` を `display_name` に保存する。

## 9. ログインページ

実装場所:

```txt
src/app/[tenant]/forum/login/page.tsx
```

表示方針:

- 登録済みIDでログインする画面として表示する
- 未登録IDは自動登録されない
- 初めての利用者には新規登録ページへのリンクを出す
- 閲覧は未ログインでもできることを説明する

## 10. 新規登録ページ

実装場所:

```txt
src/app/[tenant]/forum/register/page.tsx
```

表示方針:

- 新しいIDとパスワードを作成する画面として表示する
- パスワード確認入力欄を表示する
- 任意のハンドルネーム入力欄を表示する
- 登録後はログイン済みとしてForumへ戻す
- 既存IDの場合は「このIDはすでに使われています」と表示する
- すでにIDを持っている利用者にはログインページへのリンクを出す

## 11. ログアウトAPI

実装場所:

```txt
src/app/api/forum/logout/route.ts
```

`forum_beta_session` Cookie を削除し、`{ ok: true }` を返す。

## 12. ログイン状態確認API

実装場所:

```txt
src/app/api/forum/login/status/route.ts
```

`forum_beta_session` Cookie を検証し、ログイン状態を返す。

## 13. ログイン必須の範囲

投稿・作成・AI整理系APIは、引き続き `isForumBetaLoggedIn()` でログイン確認を行う。

主な対象:

- `POST /api/forum/create-thread-from-draft`
- `POST /api/forum/add-post`
- `POST /api/forum/generate-issue`
- `POST /api/forum/organize-post`
- `GET /api/forum/thread-summary`
- 保存済み参考投稿や外部AI取り込み周辺API

未ログイン時は 401 を返し、本処理に入らない。

## 14. 未ログインでも可能な範囲

Forumトップ、スレッド詳細、使い方ページなどの閲覧は未ログインでも可能である。

## 15. author_key との関係

`forum_beta_session` はログイン状態を確認するCookieである。

`author_key` は同じブラウザ・端末を識別するためのCookieであり、ログイン認証の正本ではない。

今回の簡易登録では、既存投稿とユーザーIDの厳密な紐づけまでは行わない。

## 16. ADMIN_KEY との関係

管理系APIや高権限APIでは、ログイン済みであっても `ADMIN_KEY` が必要なものがある。

簡易登録ユーザーに管理者権限は付与しない。

## 17. セキュリティ上の注意

この方式はベータ向けの簡易方式であり、本格的なアカウント管理ではない。

最低限の制約:

- パスワードは平文保存しない
- `passwordConfirm` は保存しない
- パスワードをログ出力しない
- `login_id` は 3〜32文字
- パスワードは 6〜128文字
- ハンドルネームは任意、入力する場合は 20文字以内
- `login_id` は英数字、ハイフン、アンダースコアを許可する
- 未登録IDでログインしても自動登録しない
- 登録済みIDのパスワード不一致でも、ID存在を推測しにくいエラー文言にする

今後の課題:

- スパム・荒らし対策
- 試行回数制限
- アカウント停止
- パスワード変更
- 管理者によるユーザー管理
- 投稿とユーザーIDの正式な紐づけ
- 招待制やメール認証への移行

## 18. 確認項目

- 未ログインでも閲覧できる
- 未ログインで投稿しようとするとログインへ誘導される
- 新規登録ページで新しいIDとパスワードを作成できる
- 新規登録ページでパスワード確認が一致しない場合は登録できない
- 新規登録ページで任意のハンドルネームを登録できる
- 登録後はログイン済みとしてForumへ戻る
- ログアウトできる
- ログインページで登録済みIDと正しいパスワードならログインできる
- 登録済みIDと違うパスワードではログインできない
- 未登録IDではログインページからログインできない
- 未登録IDは新規登録ページでのみ登録できる
- 既存IDは新規登録ページで登録できない
- ログイン後、投稿・外部AI取り込み・AI整理が使える

