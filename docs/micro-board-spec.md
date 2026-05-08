# ミクロ掲示板仕様書 v1.0

## 1. 目的

ミクロは、掲示板というよりも「思考ログ整理ツール」として定義する。

ユーザーが日々書き出す断片的なメモ、チャットログ、思いつき、仮説、会議メモ、後でやること、調べたいことを、AIが評価せずに整理し、再利用しやすい形へ変換するための思考管理OSである。

既存の `/forum` は議論掲示板として維持する。ミクロは `/forum` とは完全に分離し、`/micro` ルートと `micro_*` テーブルだけを使う。`forum_threads`、`forum_posts`、`/api/forum/*` には依存しない。

## 2. 基本思想

- ミクロは投稿を競わせる場所ではなく、思考の素材を蓄積・整理・再利用する場所である。
- 中心データは `micro_posts` ではなく `micro_source_data` とする。
- AIは評価、採点、正誤判定、信頼判定、論理スコア付けをしない。
- AIの役割は、分解、要約、分類、グルーピング、ToDo抽出、表記ゆれ整理、再利用しやすい形への変換に限定する。
- 元データは必ず残し、AI整理結果やユーザー修正は `versions` として履歴化する。
- 削除ではなく `archived` による非表示を基本とし、復元可能にする。
- 表示優先順位は `updated_at`、`usage_count`、`pinned` を軸にする。
- `/forum` への自動連携、既存掲示板データへの書き込み、forum側の評価ロジック利用は行わない。

## 3. 画面構成

### `/micro`

思考ログ整理ツールのホーム画面。

主な表示:

- クイック入力欄
- フリーログモード切り替え
- スマートノートモード切り替え
- 最近更新された source_data
- ピン留めされた source_data / groups / todos
- AI整理済み summaries
- 抽出された todos
- グループ化された思考テーマ
- archived を除いた active データ一覧

### フリーログモード

思いついたことを構造化せず、そのまま保存するモード。

用途:

- 感情、違和感、仮説、メモ、会話の断片を素早く残す
- 後で整理する前提の未加工ログを保存する
- 書く負荷を最小化する

保存時の扱い:

- `micro_source_data.source_type = "free_log"`
- 初期 `status = "draft"` または `"active"`
- AI整理は任意
- 元文は `raw_content` に保存する

### スマートノートモード

入力時点でAI整理プレビューを行い、要点、グループ候補、ToDo候補を確認して保存するモード。

用途:

- 会議メモを整理する
- Chatログから要点を抜き出す
- 長めの思考メモを再利用しやすくする
- ToDoや論点をその場で分ける

保存時の扱い:

- `micro_source_data.source_type = "smart_note"`
- AI整理結果を `micro_summaries`、`micro_todos`、`micro_groups` に反映する
- AI出力とユーザー修正を `micro_versions` に保存する

### `/micro/source/[id]`

単一 source_data の詳細画面。

主な表示:

- 元ログ
- 整理済み要約
- 関連グループ
- 抽出ToDo
- versions 履歴
- status 切り替え
- pinned 切り替え
- archived からの復元

### `/micro/group/[id]`

関連する source_data をまとめた思考テーマ画面。

主な表示:

- グループタイトル
- グループ概要
- 所属 source_data
- 関連 summaries
- 関連 todos
- versions 履歴
- status 切り替え

### `/micro/todos`

AIまたはユーザーが抽出したToDoを一覧管理する画面。

主な表示:

- active todos
- draft todos
- archived todos
- source_data への参照
- group への参照
- pinned / usage_count / updated_at による優先表示

## 4. データ構造案

DBは `micro_*` の新規テーブルを前提にする。既存の `forum_*` テーブルは参照・更新しない。

### `micro_source_data`

思考ログの中心テーブル。元データを保持する。

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | source_data ID |
| `tenant_slug` | text | テナント識別子 |
| `source_type` | text | `free_log` / `smart_note` / `chat_log` / `imported_text` など |
| `title` | text nullable | ユーザーまたはAIが付けた短いタイトル |
| `raw_content` | text | 元ログ本文 |
| `normalized_content` | text nullable | 表記ゆれや改行だけを整えた本文 |
| `status` | text | `draft` / `active` / `archived` |
| `pinned` | boolean | 優先表示フラグ |
| `usage_count` | integer | 参照・編集・利用された回数 |
| `last_used_at` | timestamptz nullable | 最終利用日時 |
| `author_key` | text nullable | 匿名利用時の識別子 |
| `created_at` | timestamptz | 作成日時 |
| `updated_at` | timestamptz | 更新日時 |
| `archived_at` | timestamptz nullable | archived 化した日時 |

### `micro_summaries`

source_data または group の要約を保持する。

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | summary ID |
| `tenant_slug` | text | テナント識別子 |
| `target_type` | text | `source_data` / `group` |
| `target_id` | uuid | 対象ID |
| `summary_type` | text | `short` / `structured` / `todo_context` など |
| `content` | text | 要約本文 |
| `created_by` | text | `ai` / `user` |
| `version_id` | uuid nullable | 対応する version |
| `created_at` | timestamptz | 作成日時 |
| `updated_at` | timestamptz | 更新日時 |

### `micro_groups`

source_data をテーマ単位にまとめる。

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | group ID |
| `tenant_slug` | text | テナント識別子 |
| `title` | text | グループ名 |
| `description` | text nullable | グループ概要 |
| `status` | text | `draft` / `active` / `archived` |
| `pinned` | boolean | 優先表示フラグ |
| `usage_count` | integer | 参照・編集・利用された回数 |
| `last_used_at` | timestamptz nullable | 最終利用日時 |
| `created_at` | timestamptz | 作成日時 |
| `updated_at` | timestamptz | 更新日時 |
| `archived_at` | timestamptz nullable | archived 化した日時 |

### `micro_group_items`

source_data と group の関連を保持する中間テーブル。

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | 関連ID |
| `tenant_slug` | text | テナント識別子 |
| `group_id` | uuid | group ID |
| `source_data_id` | uuid | source_data ID |
| `created_by` | text | `ai` / `user` |
| `created_at` | timestamptz | 作成日時 |

### `micro_todos`

source_data から抽出されたToDo、またはユーザーが直接作成したToDoを保持する。

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | todo ID |
| `tenant_slug` | text | テナント識別子 |
| `source_data_id` | uuid nullable | 由来となる source_data |
| `group_id` | uuid nullable | 関連する group |
| `title` | text | ToDoタイトル |
| `description` | text nullable | 補足 |
| `status` | text | `draft` / `active` / `archived` |
| `todo_state` | text | `open` / `done` / `blocked` など |
| `due_at` | timestamptz nullable | 期限 |
| `pinned` | boolean | 優先表示フラグ |
| `usage_count` | integer | 参照・編集・利用された回数 |
| `created_by` | text | `ai` / `user` |
| `created_at` | timestamptz | 作成日時 |
| `updated_at` | timestamptz | 更新日時 |
| `archived_at` | timestamptz nullable | archived 化した日時 |

### `micro_versions`

AI処理履歴とユーザー修正履歴を保存する。

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | version ID |
| `tenant_slug` | text | テナント識別子 |
| `target_type` | text | `source_data` / `summary` / `group` / `todo` |
| `target_id` | uuid | 対象ID |
| `version_type` | text | `ai_generated` / `user_edit` / `status_change` / `archive_restore` |
| `input_snapshot` | jsonb nullable | AI処理または編集前の入力 |
| `output_snapshot` | jsonb nullable | AI出力または編集後の内容 |
| `prompt_name` | text nullable | 使用したAI処理名 |
| `model_name` | text nullable | 使用モデル名 |
| `created_by` | text | `ai` / `user` / `system` |
| `created_at` | timestamptz | 作成日時 |

## 5. API案

APIは `/api/micro/*` として新設する。ここでは案のみを示し、実装は行わない。

### `GET /api/micro/source-data`

source_data 一覧を取得する。

主なクエリ:

- `tenantSlug`
- `status`
- `sourceType`
- `groupId`
- `pinned`
- `sort`
- `limit`
- `cursor`

表示優先順位:

1. `pinned = true`
2. `updated_at` が新しいもの
3. `usage_count` が高いもの

### `POST /api/micro/source-data`

フリーログまたはスマートノートを保存する。

入力案:

- `tenantSlug`
- `sourceType`
- `rawContent`
- `title`
- `status`
- `pinned`

### `POST /api/micro/organize`

AI整理プレビューを行う。

入力案:

- `sourceDataId`
- `rawContent`
- `mode`: `free_log` / `smart_note`
- `options`: summaries / groups / todos の生成有無

返却案:

- `normalizedContent`
- `summaries`
- `groupCandidates`
- `todoCandidates`
- `versionPreview`

制約:

- 評価スコアを返さない。
- 正誤判定を返さない。
- 投稿者や内容の優劣を返さない。
- 出力は整理候補として扱い、確定前にユーザーが修正できる。

### `GET /api/micro/groups`

groups 一覧を取得する。

表示優先順位:

1. `pinned = true`
2. `updated_at` が新しいもの
3. `usage_count` が高いもの

### `GET /api/micro/todos`

todos 一覧を取得する。

主なクエリ:

- `tenantSlug`
- `status`
- `todoState`
- `sourceDataId`
- `groupId`
- `pinned`

### `GET /api/micro/versions`

対象データのAI処理履歴・ユーザー修正履歴を取得する。

主なクエリ:

- `tenantSlug`
- `targetType`
- `targetId`

## 6. UI表示ルール

- `/micro` は `/forum` と完全に別画面として扱う。
- 既存forumの評価、信頼、論理スコア、反論優劣を示すUIは使わない。
- AI出力は「整理案」「要約案」「ToDo候補」「グループ候補」と表示する。
- 「正しい」「間違い」「信頼できる」「論理的に弱い」「スコア」などの評価表現は表示しない。
- `status = archived` のデータは通常一覧から隠し、アーカイブ表示から復元可能にする。
- 削除ボタンではなく、原則として「アーカイブ」を表示する。
- 表示優先順位は `pinned`、`updated_at`、`usage_count` を組み合わせる。
- 背景色と文字色は必ずセットで指定し、コントラスト不足を避ける。
- Level 1 / Level 2 / Level 3 の情報階層を明確にする。
- Level 1 は主要な思考ログ、グループ、ToDoなどの主対象に使う。
- Level 2 は要約、関連項目、整理候補などの補助情報に使う。
- Level 3 はメタ情報、作成日時、version履歴、source参照などに使う。
- UI部品は既存の共通コンポーネントを優先する。
- `components/forum/*` がforum専用の意味を持つ場合は直接流用せず、共通化できる部品だけを `common` 相当として利用する。
- フリーログモードでは入力しやすさを最優先し、整理項目を押し付けない。
- スマートノートモードではAI整理プレビューを出すが、確定前にユーザーが修正できるようにする。

## 7. 実装ステップ

1. この設計ドキュメントを確定する。
2. `/micro` の情報設計を source_data / summaries / groups / todos / versions 中心に整理する。
3. `micro_*` テーブルのmigration案を作成する。
4. フリーログモードの保存フローを設計する。
5. スマートノートモードのAI整理フローを設計する。
6. ToDo抽出の入力、確認、保存、修正、archived 化の流れを設計する。
7. versions にAI処理履歴とユーザー修正履歴を保存する流れを設計する。
8. `pinned`、`updated_at`、`usage_count` による表示優先順位を実装方針に落とす。
9. archived の非表示・復元導線を設計する。
10. `/forum` に影響がないことを確認する。

## 8. 既存forumと共通化する部分

共通化してよいのは、ミクロの思想やデータに影響しない基盤部分に限定する。

共通化候補:

- Supabaseクライアントの作成方法
- テナントslugの取得方法
- 汎用ボタン、入力欄、見出し、カード、モーダル
- 日付表示フォーマット
- APIレスポンスの基本形
- エラー表示の基本UI
- アクセシビリティ方針
- 背景色と文字色の組み合わせルール
- Level 1 / Level 2 / Level 3 の情報階層ルール

注意点:

- forum専用の投稿分類、論理評価、信頼表示、反論表示は共通化しない。
- `components/forum/*` を使う場合は、見た目だけでなく意味がforumに依存していないか確認する。
- ミクロ用に再利用する場合は、将来的に共通コンポーネントへ移すことを前提にする。

## 9. 既存forumと分離する部分

必ず分離する部分:

- ルート: `/forum` ではなく `/micro`
- API: `/api/forum/*` ではなく `/api/micro/*`
- DB: `forum_*` ではなく `micro_*`
- 中心データ: `forum_posts` ではなく `micro_source_data`
- 要約: forum要約ではなく `micro_summaries`
- グループ: `forum_threads` ではなく `micro_groups`
- ToDo: forum投稿から派生させず `micro_todos`
- 履歴: forumの更新履歴ではなく `micro_versions`
- status管理: ミクロ側の `draft` / `active` / `archived`
- AIプロンプト: 評価ではなく整理専用
- ローカル保存キー: `forum_*` ではなく `micro_*`
- 管理導線: forum管理画面とは別

分離する理由:

- forumは議論掲示板であり、ミクロは思考ログ整理ツールであるため。
- forumには論理評価、信頼、反論、投稿分類などの概念があるが、ミクロでは評価をしないため。
- ミクロはNotion、Obsidian、Chatログ整理に近い思考管理OSとして扱うため。
- 既存 `/forum` の利用体験、データ、APIに副作用を出さないため。
- 将来的にforumへ転送する機能を作る場合も、明示的なユーザー操作による別機能として扱うため。
