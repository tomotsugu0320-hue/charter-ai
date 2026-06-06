# ミクロ掲示板 技術設計書

## 1. ディレクトリ構成案

ミクロは既存forumと完全分離し、画面・API・DB・状態管理を `/micro` と `micro_*` に閉じる。

案:

```text
src/
  app/
    [tenant]/
      micro/
        page.tsx
        source/
          [id]/
            page.tsx
        group/
          [id]/
            page.tsx
        todos/
          page.tsx
        archived/
          page.tsx
    api/
      micro/
        source-data/
          route.ts
          [id]/
            route.ts
        organize/
          route.ts
        summaries/
          route.ts
        groups/
          route.ts
          [id]/
            route.ts
        todos/
          route.ts
          [id]/
            route.ts
        versions/
          route.ts
  components/
    common/
    micro/
  lib/
    micro/
```

この構成は案であり、この設計書作成時点では実装ファイルを作らない。

## 2. App Router構成

### `/[tenant]/micro`

ミクロのホーム画面。

責務:

- フリーログ入力
- スマートノート入力
- 最近更新された source_data 表示
- pinned 項目表示
- summaries / groups / todos の概要表示
- archived を除いた active 中心の表示

### `/[tenant]/micro/source/[id]`

source_data 詳細画面。

責務:

- `micro_source_data` の元ログ表示
- summaries 表示
- 関連 groups 表示
- 抽出 todos 表示
- versions 履歴表示
- draft / active / archived の状態確認
- archived からの復元導線

### `/[tenant]/micro/group/[id]`

group 詳細画面。

責務:

- `micro_groups` の概要表示
- 所属 source_data 表示
- 関連 summaries 表示
- 関連 todos 表示
- versions 履歴表示

### `/[tenant]/micro/todos`

ToDo一覧画面。

責務:

- active todos 表示
- draft todos 表示
- archived todos 表示
- source_data / groups への参照表示
- pinned / updated_at / usage_count による優先表示

### `/[tenant]/micro/archived`

アーカイブ一覧画面。

責務:

- archived の source_data / groups / todos 表示
- 復元操作の入口
- 物理削除ではなく非表示状態として扱う

## 3. APIルート一覧

APIはすべて `/api/micro/*` に新設する。`/api/forum/*` は利用しない。

| ルート | メソッド | 用途 |
| --- | --- | --- |
| `/api/micro/source-data` | GET | source_data 一覧取得 |
| `/api/micro/source-data` | POST | free_log / smart_note 保存 |
| `/api/micro/source-data/[id]` | GET | source_data 詳細取得 |
| `/api/micro/source-data/[id]` | PATCH | source_data 更新、status変更、pinned変更 |
| `/api/micro/organize` | POST | AI整理プレビュー、summaries / groups / todos 候補生成 |
| `/api/micro/summaries` | GET | summaries 一覧取得 |
| `/api/micro/summaries` | POST | summary 確定保存 |
| `/api/micro/groups` | GET | groups 一覧取得 |
| `/api/micro/groups` | POST | group 作成 |
| `/api/micro/groups/[id]` | GET | group 詳細取得 |
| `/api/micro/groups/[id]` | PATCH | group 更新、status変更、pinned変更 |
| `/api/micro/todos` | GET | todos 一覧取得 |
| `/api/micro/todos` | POST | todo 作成、AI抽出todoの確定保存 |
| `/api/micro/todos/[id]` | GET | todo 詳細取得 |
| `/api/micro/todos/[id]` | PATCH | todo 更新、todo_state変更、status変更、pinned変更 |
| `/api/micro/versions` | GET | versions 履歴取得 |
| `/api/micro/versions` | POST | AI処理履歴・ユーザー修正履歴保存 |

共通クエリ方針:

- `tenantSlug` を必須にする。
- 通常一覧では `status = archived` を除外する。
- archived 一覧では `status = archived` のみを対象にする。
- 表示優先順位は `pinned`、`updated_at`、`usage_count` を使う。

## 4. DBテーブル一覧

DBは `micro_*` の新規テーブルのみを使う。

| テーブル | 役割 |
| --- | --- |
| `micro_source_data` | 思考ログの元データ。ミクロの中心 |
| `micro_summaries` | source_data / group の要約 |
| `micro_groups` | 関連する source_data をまとめる思考テーマ |
| `micro_group_items` | groups と source_data の中間テーブル |
| `micro_todos` | source_data から抽出されたToDo、または手動ToDo |
| `micro_versions` | AI処理履歴・ユーザー修正履歴 |

主要な共通カラム:

- `tenant_slug`
- `status`
- `pinned`
- `usage_count`
- `created_at`
- `updated_at`
- `archived_at`

`status` は `micro_source_data`、`micro_groups`、`micro_todos` に持たせる。

## 5. Supabase migration分割案

SQLはこの設計書には書かない。migrationは責務ごとに分割する。

案:

1. `micro_source_data` 作成
2. `micro_summaries` 作成
3. `micro_groups` と `micro_group_items` 作成
4. `micro_todos` 作成
5. `micro_versions` 作成
6. 一覧表示用index追加
7. archived / pinned / usage_count 用index追加
8. RLS方針追加

index方針:

- `tenant_slug`
- `status`
- `updated_at`
- `pinned`
- `usage_count`
- `source_data_id`
- `group_id`
- `target_type, target_id`

## 6. 共通コンポーネント方針

ミクロは思考管理OSとして、forum専用UIの意味を持ち込まない。

優先方針:

- まず既存の汎用コンポーネントを確認する。
- 汎用化できる部品は `common` 相当として使う。
- ミクロ専用の意味を持つ部品は `components/micro/*` に置く。
- forum専用の分類・評価・反論表示コンポーネントは使わない。

ミクロ専用コンポーネント候補:

- `MicroModeSwitch`
- `SourceDataEditor`
- `SmartNotePreview`
- `SummaryPanel`
- `GroupList`
- `TodoList`
- `VersionTimeline`
- `StatusBadge`
- `ArchiveRestoreAction`

UI階層:

- Level 1: source_data、groups、todos などの主対象
- Level 2: summaries、関連項目、整理候補
- Level 3: versions、日時、source参照、メタ情報

色指定:

- 背景色と文字色は必ずセットで指定する。
- 状態や階層を色だけに依存させない。
- archived は非表示が基本で、一覧に出す場合も復元可能な状態として見せる。

## 7. forumと共有するもの

共有してよいもの:

- Supabaseクライアント作成方法
- tenant slug の取得方法
- 汎用レイアウト幅
- 日付フォーマット
- 汎用ボタン
- 汎用入力欄
- 汎用カード
- 汎用モーダル
- APIレスポンスの基本形
- エラー表示の基本方針
- アクセシビリティ方針

共有時の条件:

- forum固有の意味を持たないこと。
- 評価、信頼、論理スコア、反論構造に依存しないこと。
- `forum_*` テーブルを参照しないこと。
- `/api/forum/*` を呼ばないこと。

## 8. forumと絶対に分離するもの

必ず分離するもの:

- ルート: `/forum` と `/micro`
- API: `/api/forum/*` と `/api/micro/*`
- DB: `forum_*` と `micro_*`
- 中心データ: `forum_posts` と `micro_source_data`
- スレッド概念: `forum_threads` と `micro_groups`
- 評価ロジック: forum側の logic_score / trust_status / prediction 系
- AIプロンプト: forum評価・議論整理用と micro整理専用
- 管理画面
- 削除・非表示処理
- ローカル保存キー
- SEOメタデータ

分離理由:

- forumは議論掲示板、microは思考ログ整理ツールで目的が異なる。
- microではAIが評価せず、整理だけを行う。
- forum側の論理評価や信頼表示をmicroに混ぜると、思考ログ管理の体験が変わってしまう。
- 既存 `/forum` のユーザー体験とデータに副作用を出さないため。

## 9. 実装順序

1. 技術設計書を確定する。
2. migration設計を `micro_*` テーブル単位で確定する。
3. `micro_source_data` の保存・取得方針を決める。
4. `/[tenant]/micro` の最小画面を設計する。
5. フリーログモードを実装する。
6. `micro_versions` にユーザー修正履歴を保存する流れを実装する。
7. スマートノートモードのAI整理プレビューを実装する。
8. `micro_summaries` を保存・表示する。
9. `micro_todos` の抽出・確認・保存・状態変更を実装する。
10. `micro_groups` と `micro_group_items` によるグルーピングを実装する。
11. archived 一覧と復元導線を実装する。
12. pinned / updated_at / usage_count による表示優先順位を調整する。
13. forumに影響がないことを確認する。

## 10. MVP最小構成

最初のMVPでは、思考ログ整理OSとして成立する最小機能に絞る。

含めるもの:

- `/[tenant]/micro`
- フリーログモード
- スマートノートモード
- `micro_source_data`
- `micro_summaries`
- `micro_todos`
- `micro_versions`
- `draft` / `active` / `archived`
- pinned
- updated_at による並び替え
- archived の非表示と復元

後回しにできるもの:

- `micro_groups`
- `micro_group_items`
- usage_count の高度な活用
- `/[tenant]/micro/group/[id]`
- `/[tenant]/micro/archived` の専用画面
- 関連source_data推薦
- Chatログの外部インポート

MVPの完了条件:

- ユーザーが思考ログを保存できる。
- AIが評価せず、要約とToDo候補だけを出せる。
- ユーザーがAI出力を修正して保存できる。
- 修正履歴が versions に残る。
- archived にしたデータが通常一覧から消え、復元できる。
- `/forum` の画面、API、DBに変更や副作用がない。
