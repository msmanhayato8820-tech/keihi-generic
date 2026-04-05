# keihi-generic - 経費精算システム

GAS + Next.js製の経費精算システム。中小企業向けに設計されており、Vercel無料枠 + GASスプレッドシートで月額0円で運用可能です。

## デモ

**URL:** https://keihi-generic.vercel.app/login

| ロール | メール | パスワード |
|--------|--------|-----------|
| 管理者 | admin@example.co.jp | demo |
| 部長 | manager@example.co.jp | demo |
| 経理 | accountant@example.co.jp | demo |
| 一般社員 | employee@example.co.jp | demo |

## 主な機能

- **承認ワークフロー**: 社員 → 部長 → 経理の多段階承認
- **領収書OCR**: Tesseract.js (無料) / Gemini API (高精度)
- **通知**: Slack / Microsoft Teams / メール (GASリレー)
- **クラウドストレージ**: AWS S3 / Google Drive / OneDrive / Box / Dropbox / Backblaze B2 / Cloudflare R2
- **会計ソフト連携**: マネーフォワード / freee / 弥生 への仕訳CSV出力
- **GUI設定**: 会社名・ロゴ・カラー・デモアカウント・カテゴリ・税率すべて設定画面から変更可能
- **PWA対応**: スマートフォンでもネイティブアプリ風に使用可能

## 技術スタック

- Next.js 16.2.2 / React 19 / TypeScript
- Tailwind CSS 4
- Tesseract.js 7 (OCR)
- Google Apps Script (バックエンド / データベース)
- Vercel (ホスティング)

## セットアップ

### 1. クローン & インストール

```bash
git clone https://github.com/msmanhayato8820-tech/keihi-generic.git
cd keihi-generic
npm install
```

### 2. ローカル起動

```bash
npm run dev
```

http://localhost:3000 でアクセスできます。GAS未設定の場合はデモモードで動作します。

### 3. Vercelデプロイ

```bash
npx vercel --yes
```

### 4. GASスプレッドシート連携（任意）

1. Google スプレッドシートを新規作成
2. Apps Script エディタを開き、GASコードを貼り付け
3. ウェブアプリとしてデプロイし、URLを取得
4. 設定画面 → GAS URL 設定にURLを入力

### 5. 通知設定（任意）

設定画面から各サービスのWebhook URLを入力するだけで有効化されます。

- **Slack**: Incoming Webhook のURLを設定
- **Teams**: Incoming Webhook のURLを設定
- **メール**: GAS URL設定済みの場合、メール通知セクションでGASリレーを有効化

## カスタマイズ

設定画面（管理者ログイン → 設定）から以下をGUIで変更できます：

- 会社名・システム名
- ロゴ文字・テーマカラー
- メールドメイン
- デモアカウント
- 経費カテゴリ（追加・編集・並び替え・削除）
- 税率（追加・編集）
- ストレージプロバイダ
- 通知チャネル
- OCRエンジン

## ライセンス

MIT License
