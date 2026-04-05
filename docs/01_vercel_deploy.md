# Vercelへのデプロイ手順

| 所要時間 | 難易度 |
|---------|--------|
| 約5分 | ★☆☆（かんたん） |

このシステムをインターネット上に公開する手順です。Vercel（バーセル）という無料のホスティングサービスを使います。

---

## 前提条件

以下の2つのアカウントが必要です。いずれも無料で作成できます。

- **GitHubアカウント**: https://github.com でアカウントを作成してください
- **Vercelアカウント**: https://vercel.com でアカウントを作成してください（GitHubアカウントでログインできます）

---

## 手順

### 1. GitHubリポジトリをフォーク（コピー）する

1. 以下のURLにアクセスします
   - https://github.com/msmanhayato8820-tech/keihi-generic
2. 画面右上の「Fork」ボタンをクリックします
3. 「Create fork」をクリックします
4. 自分のアカウントにリポジトリがコピーされます

![手順1](images/fork.png)

### 2. Vercelにログインする

1. https://vercel.com にアクセスします
2. 「Log In」をクリックします
3. 「Continue with GitHub」を選択して、GitHubアカウントでログインします

![手順2](images/vercel_login.png)

### 3. プロジェクトをインポートする

1. Vercelのダッシュボードで「Add New...」→「Project」をクリックします
2. 「Import Git Repository」の一覧から、先ほどフォークした「keihi-generic」を探します
3. 「Import」ボタンをクリックします

![手順3](images/vercel_import.png)

### 4. デプロイ設定を確認する

1. 「Configure Project」画面が表示されます
2. **Framework Preset**: 自動で「Next.js」が選択されています。そのままでOKです
3. **環境変数**: 設定不要です（このシステムは環境変数を使いません。すべて設定画面から変更できます）
4. 「Deploy」ボタンをクリックします

![手順4](images/vercel_configure.png)

### 5. デプロイ完了を待つ

1. デプロイが始まります。通常1〜2分で完了します
2. 「Congratulations!」と表示されたら完了です
3. 表示されたURLをクリックすると、システムにアクセスできます

![手順5](images/vercel_done.png)

### 6. 動作確認

1. 表示されたURL（例: `https://keihi-generic-xxxxx.vercel.app`）にアクセスします
2. ログイン画面が表示されれば成功です
3. デモアカウント（admin@example.co.jp / パスワード: demo）でログインしてみてください

---

## うまくいかない場合

| 症状 | 対処法 |
|------|--------|
| デプロイが失敗する | Vercelのログを確認してください。「Build Logs」タブにエラーの詳細が表示されます |
| ページが表示されない | 数分待ってから再度アクセスしてください。DNSの反映に時間がかかる場合があります |
| GitHubにリポジトリが表示されない | Vercelの設定で「GitHub App」の権限を確認し、リポジトリへのアクセスを許可してください |

---

## 次のステップ

デプロイが完了したら、以下の設定に進みましょう。

- [GASの設定](02_gas_setup.md)（データの永続化に必要）
- [通知の設定](03_slack_teams_webhook.md)（SlackやTeamsで通知を受け取りたい場合）
- [会社情報のカスタマイズ](05_customization.md)（会社名やロゴの変更）
