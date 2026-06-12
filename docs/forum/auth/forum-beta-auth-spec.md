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
  status text not null default 'active',
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  disabled_at timestamptz,
  deleted_at timestamptz
);
```

`login_id_normalized` は `trim + lowercase` した値を保存する。

`display_name` は任意のハンドルネームを保存する。未入力の場合は `login_id` を表示名の代替として保存する。

`status` は `active` / `disabled` / `deleted` を使う。`disabled` と `deleted` はログイン不可とする。

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
- `normalizeForumBetaUserStatus()`
- `isForumBetaUserActive()`
- `validateForumBetaLoginInput()`
- `validateForumBetaPasswordInput()`
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
7. `status` が `active` でない場合は 401 を返す
8. パスワード不一致なら 401 を返す
9. 成功時に `createForumBetaSessionToken(user.id)` で Cookie を発行する
10. `last_login_at` を更新する
11. `{ ok: true }` を返す

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

Forumトップのログイン後メニューには、ログイン済みの場合だけ `アカウント管理` リンクを表示する。リンク先は `/{tenant}/forum/account` とする。

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

## 11. アカウント管理ページ

実装場所:

```txt
src/app/[tenant]/forum/account/page.tsx
```

表示方針:

- ログイン中ユーザー自身の情報だけを表示する
- 未ログインの場合はログインページへ誘導する
- ログインID、ハンドルネーム、最終ログイン日時を表示する
- ハンドルネーム変更フォームを表示する
- パスワード変更フォームを表示する
- 退会セクションを表示する
- ログアウトボタンとForumへ戻るリンクを表示する
- 管理者用の全ユーザー管理は行わない

## 12. アカウントAPI

実装場所:

```txt
src/app/api/forum/account/route.ts
```

GET:

1. `forum_beta_session` Cookie からログイン中ユーザーIDを取得する
2. 未ログインなら 401 を返す
3. `forum_beta_users` から自分の `login_id` / `display_name` / `created_at` / `last_login_at` だけを取得する
4. `password_hash` は返さない

PATCH:

1. `forum_beta_session` Cookie からログイン中ユーザーIDを取得する
2. 未ログインなら 401 を返す
3. request body の `displayName` を trim する
4. 空の場合は `login_id` を代替表示名として保存する
5. 入力する場合は 20文字以内に制限する
6. 自分の `forum_beta_users.display_name` だけを更新する
7. `password_hash` は触らない
8. 成功時 `{ ok: true }` を返す

## 13. パスワード変更API

実装場所:

```txt
src/app/api/forum/change-password/route.ts
```

処理:

1. `forum_beta_session` Cookie からログイン中ユーザーIDを取得する
2. 未ログインなら 401 を返す
3. request body の `currentPassword` / `newPassword` / `newPasswordConfirm` を読む
4. `newPassword` は 6〜128文字に制限する
5. `newPassword` と `newPasswordConfirm` が一致しない場合は 400 を返す
6. `currentPassword` を現在の `password_hash` と照合する
7. `currentPassword` が違う場合は 401 を返す
8. OKなら `hashForumBetaPassword(newPassword)` で `password_hash` を更新する
9. `currentPassword` / `newPasswordConfirm` は保存しない
10. 成功時 `{ ok: true }` を返す

## 14. 本人退会API

実装場所:

```txt
src/app/api/forum/account/delete/route.ts
```

処理:

1. `forum_beta_session` Cookie からログイン中ユーザーIDを取得する
2. 未ログインなら 401 を返す
3. request body の `currentPassword` / `confirmText` を読む
4. `confirmText` が `退会する` でなければ 400 を返す
5. `currentPassword` を現在の `password_hash` と照合する
6. `currentPassword` が違う場合は 401 を返す
7. OKなら `status` を `deleted` にし、`deleted_at` / `disabled_at` を現在時刻にする
8. `display_name` は `退会ユーザー` にする
9. 投稿は削除せず、原則として残して表示する
10. `forum_beta_session` Cookie を削除する

本人退会は完全削除ではなく、再ログイン不可にする安全な無効化として扱う。

## 15. ログアウトAPI

実装場所:

```txt
src/app/api/forum/logout/route.ts
```

`forum_beta_session` Cookie を削除し、`{ ok: true }` を返す。

## 16. ログイン状態確認API

実装場所:

```txt
src/app/api/forum/login/status/route.ts
```

`forum_beta_session` Cookie を検証し、ログイン状態を返す。

ログイン済みで `forum_beta_users` を参照でき、`status` が `active` の場合は、`login_id` と `display_name` も返す。`password_hash` は返さない。

## 17. ログイン必須の範囲

投稿・作成・AI整理系APIは、引き続き `isForumBetaLoggedIn()` でログイン確認を行う。

主な対象:

- `POST /api/forum/create-thread-from-draft`
- `POST /api/forum/add-post`
- `POST /api/forum/generate-issue`
- `POST /api/forum/organize-post`
- `GET /api/forum/thread-summary`
- 保存済み参考投稿や外部AI取り込み周辺API

未ログイン時は 401 を返し、本処理に入らない。

## 18. 未ログインでも可能な範囲

Forumトップ、スレッド詳細、使い方ページなどの閲覧は未ログインでも可能である。

## 19. author_key との関係

`forum_beta_session` はログイン状態を確認するCookieである。

`author_key` は同じブラウザ・端末を識別するためのCookieであり、ログイン認証の正本ではない。

今回の簡易登録では、既存投稿とユーザーIDの厳密な紐づけまでは行わない。

## 20. ADMIN_KEY との関係

管理系APIや高権限APIでは、ログイン済みであっても `ADMIN_KEY` が必要なものがある。

簡易登録ユーザーに管理者権限は付与しない。

管理画面入口 `/{tenant}/forum/admin` も `ADMIN_KEY` 入力後だけ管理メニューを表示する。`ADMIN_KEY` はDBに保存せず、APIリクエストでは既存管理APIと同じ `x-admin-key` ヘッダーで確認する。

`ADMIN_KEY` はCookie、`localStorage`、`sessionStorage` に保存しない。管理メニュー表示後も入力欄には残さず、ページを再読み込みした場合は再入力を必要とする。管理機能への導線でも `ADMIN_KEY` をURL queryに載せない。

## 21. 管理者用ユーザー管理

実装場所:

```txt
src/app/[tenant]/forum/admin/users/page.tsx
src/app/api/forum/admin/users/route.ts
src/app/api/forum/admin/users/[id]/reset-password/route.ts
src/app/api/forum/admin/users/[id]/disable/route.ts
src/app/api/forum/admin/users/[id]/delete/route.ts
```

管理者用ユーザー管理は `ADMIN_KEY` 必須とする。通常ログイン済みユーザーだけでは利用できない。

管理者が確認できる情報:

- ユーザーID
- 登録ID
- ハンドルネーム
- ステータス
- 作成日
- 最終ログイン日時
- 無効化日時
- 削除日時

管理者APIは `password_hash` を返さない。現在のパスワードは平文保存していないため、管理者でも閲覧できない。

管理者ができるパスワード操作:

- 現在のパスワード確認ではなく、新しいパスワードへの再設定のみ
- `newPassword` / `newPasswordConfirm` を受け取り、一致しない場合は 400 を返す
- 新しいパスワードは 6〜128文字に制限する
- `hashForumBetaPassword(newPassword)` で `password_hash` を更新する
- `newPasswordConfirm` は保存しない

管理者ができるアカウント操作:

- `active` から `disabled` への無効化
- `disabled` から `active` への復活
- `deleted` への削除状態変更

無効化・削除状態のユーザーは再ログイン不可とする。

投稿の扱い:

- 現時点では `forum_posts` と `forum_beta_users.id` の正式な紐づきがない
- そのため、ユーザー単位の投稿非表示・復活・完全削除は未対応
- 管理者削除時の投稿扱いは `投稿を残して表示` のみ対応する
- `投稿を残して非表示` / `投稿を完全削除` は、投稿とユーザーIDの正式な紐づき実装後に対応する
- API側でも `投稿を残して表示` 以外の投稿扱いが送られた場合は 400 で拒否する
- `author_key` だけを使った推測削除は行わない

## 22. セキュリティ上の注意

この方式はベータ向けの簡易方式であり、本格的なアカウント管理ではない。

最低限の制約:

- パスワードは平文保存しない
- `passwordConfirm` は保存しない
- `currentPassword` / `newPasswordConfirm` は保存しない
- パスワードをログ出力しない
- `password_hash` をAPIレスポンスに含めない
- 管理者APIは `ADMIN_KEY` 必須にする
- 通常ユーザーに全ユーザー一覧を見せない
- 管理者でも現在のパスワードは表示しない
- 退会・無効化・削除状態のユーザーはログイン不可にする
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
- 投稿とユーザーIDの正式な紐づけ
- ユーザー単位の投稿非表示・復活・完全削除
- 招待制やメール認証への移行

## 23. 確認項目

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
- ログイン後、アカウント管理ページを開ける
- アカウント管理ページでログインID、ハンドルネーム、最終ログイン日時を確認できる
- 自分のハンドルネームを変更できる
- 現在のパスワードが正しい場合だけパスワード変更できる
- 新しいパスワードと確認が一致しない場合は変更できない
- 自分のアカウント管理から退会できる
- 退会後、そのIDではログインできない
- ログイン後メニューにアカウント管理リンクが表示される
- 通常ユーザーだけでは管理画面入口に入れない
- `ADMIN_KEY` ありで管理者用ユーザー管理を利用できる
- `ADMIN_KEY` なしでは管理者用ユーザー管理APIを利用できない
- 管理者用ユーザー一覧に `password_hash` が含まれない
- 管理者は現在のパスワードを閲覧できず、新しいパスワードへ再設定だけできる
- 管理者はユーザーを無効化・復活できる
- 管理者はユーザーを削除状態にできる
- 投稿のユーザー単位非表示・完全削除は、正式なユーザーID紐づきがないため未対応と表示する
- ログイン後、投稿・外部AI取り込み・AI整理が使える

