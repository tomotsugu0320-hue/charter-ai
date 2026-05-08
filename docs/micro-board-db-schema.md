# ミクロ掲示板 Supabase DB設計書

## 1. micro_* テーブル一覧

ミクロ掲示板は、既存の `forum_*` テーブルに依存しない。DBは `micro_*` の新規テーブルだけで構成する。

中心テーブルは `micro_source_data` とする。投稿掲示板ではなく、思考ログ、チャットログ、メモ、会議メモ、仮説、ToDo候補などの元データを保存し、それを summaries / groups / todos / versions に展開する。

| テーブル | 役割 | MVP |
| --- | --- | --- |
| `micro_source_data` | 思考ログの元データ。ミクロの中心 | 必須 |
| `micro_summaries` | source_data / group の要約 | 必須 |
| `micro_todos` | source_data から抽出されたToDo、または手動ToDo | 必須 |
| `micro_versions` | AI処理履歴・ユーザー修正履歴 | 必須 |
| `micro_groups` | 関連する source_data をまとめる思考テーマ | 準必須 |
| `micro_group_items` | groups と source_data の中間テーブル | 準必須 |

作らないもの:

- `logic_score`
- `trust_status`
- `logic_break_type`
- `prediction_*`
- 評価スコア
- 正誤判定カラム
- 信頼度判定カラム

## 2. カラム一覧

### `micro_source_data`

思考ログの元データを保持する中心テーブル。

| カラム | 型 | 必須 | 用途 |
| --- | --- | --- | --- |
| `id` | uuid | yes | 主キー |
| `tenant_slug` | text | yes | テナント識別子 |
| `source_type` | text | yes | `free_log` / `smart_note` / `chat_log` / `imported_text` など |
| `title` | text | no | ユーザーまたはAIが付けた短いタイトル |
| `raw_content` | text | yes | 元ログ本文 |
| `normalized_content` | text | no | 改行、表記ゆれ、余分な空白だけを整えた本文 |
| `status` | text | yes | `draft` / `active` / `archived` |
| `pinned` | boolean | yes | 優先表示フラグ |
| `usage_count` | integer | yes | 参照、編集、利用された回数 |
| `last_used_at` | timestamptz | no | 最終利用日時 |
| `author_key` | text | no | 匿名利用時の識別子 |
| `created_at` | timestamptz | yes | 作成日時 |
| `updated_at` | timestamptz | yes | 更新日時 |
| `archived_at` | timestamptz | no | archived 化した日時 |

### `micro_summaries`

AIまたはユーザーが作成した要約を保持する。

| カラム | 型 | 必須 | 用途 |
| --- | --- | --- | --- |
| `id` | uuid | yes | 主キー |
| `tenant_slug` | text | yes | テナント識別子 |
| `target_type` | text | yes | `source_data` / `group` |
| `target_id` | uuid | yes | 対象ID |
| `summary_type` | text | yes | `short` / `structured` / `todo_context` など |
| `content` | text | yes | 要約本文 |
| `created_by` | text | yes | `ai` / `user` |
| `version_id` | uuid | no | 対応する `micro_versions.id` |
| `created_at` | timestamptz | yes | 作成日時 |
| `updated_at` | timestamptz | yes | 更新日時 |

### `micro_groups`

source_data をテーマ単位にまとめる。

| カラム | 型 | 必須 | 用途 |
| --- | --- | --- | --- |
| `id` | uuid | yes | 主キー |
| `tenant_slug` | text | yes | テナント識別子 |
| `title` | text | yes | グループ名 |
| `description` | text | no | グループ概要 |
| `status` | text | yes | `draft` / `active` / `archived` |
| `pinned` | boolean | yes | 優先表示フラグ |
| `usage_count` | integer | yes | 参照、編集、利用された回数 |
| `last_used_at` | timestamptz | no | 最終利用日時 |
| `created_at` | timestamptz | yes | 作成日時 |
| `updated_at` | timestamptz | yes | 更新日時 |
| `archived_at` | timestamptz | no | archived 化した日時 |

### `micro_group_items`

groups と source_data の関連を保持する。

| カラム | 型 | 必須 | 用途 |
| --- | --- | --- | --- |
| `id` | uuid | yes | 主キー |
| `tenant_slug` | text | yes | テナント識別子 |
| `group_id` | uuid | yes | `micro_groups.id` |
| `source_data_id` | uuid | yes | `micro_source_data.id` |
| `created_by` | text | yes | `ai` / `user` |
| `created_at` | timestamptz | yes | 作成日時 |

### `micro_todos`

source_data から抽出されたToDo、またはユーザーが直接作成したToDoを保持する。

| カラム | 型 | 必須 | 用途 |
| --- | --- | --- | --- |
| `id` | uuid | yes | 主キー |
| `tenant_slug` | text | yes | テナント識別子 |
| `source_data_id` | uuid | no | 由来となる `micro_source_data.id` |
| `group_id` | uuid | no | 関連する `micro_groups.id` |
| `title` | text | yes | ToDoタイトル |
| `description` | text | no | 補足 |
| `status` | text | yes | `draft` / `active` / `archived` |
| `todo_state` | text | yes | `open` / `done` / `blocked` など |
| `due_at` | timestamptz | no | 期限 |
| `pinned` | boolean | yes | 優先表示フラグ |
| `usage_count` | integer | yes | 参照、編集、利用された回数 |
| `created_by` | text | yes | `ai` / `user` |
| `version_id` | uuid | no | 抽出または編集に対応する `micro_versions.id` |
| `created_at` | timestamptz | yes | 作成日時 |
| `updated_at` | timestamptz | yes | 更新日時 |
| `archived_at` | timestamptz | no | archived 化した日時 |

### `micro_versions`

AI処理履歴とユーザー修正履歴を保存する。履歴は原則として追記のみとする。

| カラム | 型 | 必須 | 用途 |
| --- | --- | --- | --- |
| `id` | uuid | yes | 主キー |
| `tenant_slug` | text | yes | テナント識別子 |
| `target_type` | text | yes | `source_data` / `summary` / `group` / `todo` |
| `target_id` | uuid | yes | 対象ID |
| `version_type` | text | yes | `ai_generated` / `user_edit` / `status_change` / `archive_restore` / `todo_extract` / `group_assign` |
| `input_snapshot` | jsonb | no | AI処理または編集前の入力 |
| `output_snapshot` | jsonb | no | AI出力または編集後の内容 |
| `diff_summary` | text | no | 変更内容の短い説明 |
| `prompt_name` | text | no | 使用したAI処理名 |
| `model_name` | text | no | 使用モデル名 |
| `created_by` | text | yes | `ai` / `user` / `system` |
| `created_at` | timestamptz | yes | 作成日時 |

## 3. 型

基本型:

| 用途 | 型 |
| --- | --- |
| ID | uuid |
| テナント識別子 | text |
| 本文、要約、説明 | text |
| 状態値 | text |
| フラグ | boolean |
| 回数 | integer |
| 日時 | timestamptz |
| 履歴スナップショット | jsonb |

状態値はPostgres enumではなく、初期段階では text + 制約で管理する方針とする。理由は、`source_type`、`summary_type`、`version_type` が初期開発で変化しやすいため。

## 4. 主キー・外部キー

### 主キー

すべての `micro_*` テーブルは `id` を主キーにする。

| テーブル | 主キー |
| --- | --- |
| `micro_source_data` | `id` |
| `micro_summaries` | `id` |
| `micro_groups` | `id` |
| `micro_group_items` | `id` |
| `micro_todos` | `id` |
| `micro_versions` | `id` |

### 外部キー

DB制約として張る候補:

| テーブル | カラム | 参照先 |
| --- | --- | --- |
| `micro_group_items` | `group_id` | `micro_groups.id` |
| `micro_group_items` | `source_data_id` | `micro_source_data.id` |
| `micro_todos` | `source_data_id` | `micro_source_data.id` |
| `micro_todos` | `group_id` | `micro_groups.id` |
| `micro_todos` | `version_id` | `micro_versions.id` |
| `micro_summaries` | `version_id` | `micro_versions.id` |

アプリケーション側で整合性を保つもの:

- `micro_summaries.target_type` + `target_id`
- `micro_versions.target_type` + `target_id`

理由:

- `target_type` によって参照先が `source_data`、`group`、`summary`、`todo` に変わるため、単純な外部キー制約にしにくい。
- 初期実装ではDB制約よりも、API側で対象存在チェックを明示する方が扱いやすい。

## 5. index案

一覧表示、テナント分離、アーカイブ除外、優先表示に必要なindexを中心に置く。

### 共通index候補

対象:

- `micro_source_data`
- `micro_groups`
- `micro_todos`

候補:

| カラム | 用途 |
| --- | --- |
| `tenant_slug` | テナント単位の絞り込み |
| `status` | active / draft / archived の絞り込み |
| `pinned` | 優先表示 |
| `updated_at` | 最近更新順 |
| `usage_count` | 利用頻度順 |
| `tenant_slug, status, pinned, updated_at` | 通常一覧 |
| `tenant_slug, status, updated_at` | archived 一覧 |

### `micro_source_data`

| カラム | 用途 |
| --- | --- |
| `tenant_slug, source_type` | free_log / smart_note の絞り込み |
| `tenant_slug, author_key` | 匿名ユーザー単位の絞り込み |
| `last_used_at` | 最近利用したログ表示 |

### `micro_summaries`

| カラム | 用途 |
| --- | --- |
| `tenant_slug, target_type, target_id` | 対象ごとの要約取得 |
| `summary_type` | short / structured などの絞り込み |
| `version_id` | 履歴から要約を追跡 |

### `micro_group_items`

| カラム | 用途 |
| --- | --- |
| `tenant_slug, group_id` | group内 source_data 取得 |
| `tenant_slug, source_data_id` | source_data の所属group取得 |
| `group_id, source_data_id` | 重複登録防止 |

### `micro_todos`

| カラム | 用途 |
| --- | --- |
| `tenant_slug, todo_state` | open / done / blocked の絞り込み |
| `source_data_id` | 元ログからToDo取得 |
| `group_id` | group関連ToDo取得 |
| `due_at` | 期限順 |

### `micro_versions`

| カラム | 用途 |
| --- | --- |
| `tenant_slug, target_type, target_id` | 対象ごとの履歴取得 |
| `version_type` | AI生成、ユーザー修正、status変更などの絞り込み |
| `created_at` | 履歴タイムライン表示 |

## 6. status管理

`status` は次の3種類に統一する。

| status | 意味 |
| --- | --- |
| `draft` | 下書き、AI候補、未確定 |
| `active` | 通常表示対象 |
| `archived` | 通常一覧から非表示、復元可能 |

`status` を持つテーブル:

- `micro_source_data`
- `micro_groups`
- `micro_todos`

`status` を持たないテーブル:

- `micro_summaries`
- `micro_group_items`
- `micro_versions`

理由:

- summaries は対象データに紐づく派生情報として扱う。
- group_items は関連そのものであり、状態を持たせると整合性が複雑になる。
- versions は履歴であり、削除や非表示よりも追記保存を優先する。

状態変更ルール:

- `draft` から `active` へ変更できる。
- `active` から `archived` へ変更できる。
- `archived` から `active` へ復元できる。
- 状態変更時は `micro_versions` に `status_change` または `archive_restore` として記録する。

## 7. versions管理

`micro_versions` は、AI処理履歴とユーザー修正履歴を保存する監査ログである。

記録対象:

- AI要約生成
- AI ToDo抽出
- AI group候補生成
- ユーザーによる本文修正
- ユーザーによるsummary修正
- ユーザーによるtodo修正
- groupへの手動追加
- status変更
- archive / restore

`version_type` 候補:

| version_type | 用途 |
| --- | --- |
| `ai_generated` | AIがsummaryなどを生成した |
| `todo_extract` | AIがToDo候補を抽出した |
| `group_assign` | AIまたはユーザーがgroup関連を作った |
| `user_edit` | ユーザーが内容を修正した |
| `status_change` | draft / active / archived が変わった |
| `archive_restore` | archived から復元した |

管理方針:

- versions は原則追記のみ。
- AI出力は確定前でも保存可能にする。
- ユーザーがAI出力を修正した場合、AI出力とユーザー修正後の両方を追跡できるようにする。
- 評価値やスコアは保存しない。
- `input_snapshot` と `output_snapshot` には、必要な最小限の本文、候補、差分を保存する。

## 8. todos管理

ToDo抽出は正式機能として扱う。

ToDoの作成元:

- AIが source_data から抽出した候補
- ユーザーがスマートノート保存時に確定したToDo
- ユーザーが手動で作成したToDo

`status` と `todo_state` は役割を分ける。

| カラム | 役割 |
| --- | --- |
| `status` | 表示・保存上の状態。`draft` / `active` / `archived` |
| `todo_state` | 作業状態。`open` / `done` / `blocked` など |

ToDo候補の扱い:

- AI抽出直後は `status = draft` として扱う。
- ユーザーが採用したら `status = active` にする。
- 不要な候補は物理削除せず `archived` にできる。
- 完了したToDoは `todo_state = done` にする。
- 表示から消したい場合は `status = archived` にする。

関連:

- 由来がある場合は `source_data_id` を持つ。
- テーマに紐づく場合は `group_id` を持つ。
- 抽出や修正の履歴は `version_id` または `micro_versions.target_type = "todo"` で追跡する。

## 9. archive管理

ミクロでは物理削除ではなく archived を基本とする。

archive対象:

- `micro_source_data`
- `micro_groups`
- `micro_todos`

archive時の処理:

- `status = "archived"` にする。
- `archived_at` を設定する。
- `updated_at` を更新する。
- `micro_versions` に `status_change` または `archive_restore` を保存する。

restore時の処理:

- `status = "active"` または必要に応じて `draft` に戻す。
- `archived_at` を空にする。
- `updated_at` を更新する。
- `micro_versions` に `archive_restore` を保存する。

表示ルール:

- 通常一覧では `status != "archived"` を対象にする。
- archived 一覧では `status = "archived"` のみを対象にする。
- summaries と versions は対象データが archived でも保持する。
- groupを archived にしても、所属 source_data は自動で archived にしない。
- source_data を archived にしても、関連 todo を自動で archived にするかは実装方針で選択する。

## 10. 将来拡張

将来追加候補:

| テーブル | 用途 |
| --- | --- |
| `micro_tags` | タグを正規化して管理する |
| `micro_tag_items` | source_data / group / todo とタグの関連 |
| `micro_relations` | source_data 同士、group 同士の関連 |
| `micro_import_jobs` | Chatログや外部メモの取り込み履歴 |
| `micro_embeddings` | 類似検索用ベクトル |
| `micro_exports` | Markdown、CSV、外部ツール連携の履歴 |
| `micro_views` | ユーザーごとの表示設定 |

将来拡張時の原則:

- `forum_*` に依存しない。
- AI評価系カラムを追加しない。
- 元データを消さず、派生情報として追加する。
- AI処理とユーザー修正は `micro_versions` に残す。
- 削除ではなく archived を優先する。
- `micro_source_data` を中心に拡張する。
