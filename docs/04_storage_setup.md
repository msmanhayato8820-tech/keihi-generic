# クラウドストレージの接続手順

| 所要時間 | 難易度 |
|---------|--------|
| 約5〜15分（サービスによる） | ★★☆（ふつう） |

領収書の画像をクラウドストレージに自動アップロードする設定です。電子帳簿保存法への対応にも有効です。7つのストレージサービスに対応しています。

ストレージの設定をしなくても、経費精算システムは利用できます（領収書はブラウザ内にのみ保存されます）。

---

## どのストレージを選ぶべき？

| サービス | おすすめ度 | 理由 |
|---------|-----------|------|
| **Google Drive** | ★★★ | 最もかんたん。Googleアカウントがあればすぐ使える |
| **Dropbox** | ★★★ | シンプルな設定。既にDropboxを使っている方向け |
| **OneDrive** | ★★☆ | Microsoft 365を使っている会社向け |
| **AWS S3** | ★★☆ | AWSを使っている会社向け。大量データに強い |
| **Box** | ★★☆ | セキュリティ重視の企業向け |
| **Backblaze B2** | ★☆☆ | 格安ストレージ。コスト重視の方向け |
| **Cloudflare R2** | ★☆☆ | エグレス（データ取り出し）無料。技術者向け |

迷ったら **Google Drive** がおすすめです。

---

## 共通の設定方法

すべてのストレージは、経費精算システムの設定画面から設定します。

1. 管理者アカウントでログイン
2. 左メニュー「設定」をクリック
3. 「クラウドストレージ設定」セクションでストレージを選択
4. 必要な情報を入力
5. 保存ボタンをクリック

---

## Google Drive

### APIキーの取得

1. https://console.cloud.google.com にアクセスします
2. 新しいプロジェクトを作成します（名前は「経費精算」など）
3. 「APIとサービス」→「ライブラリ」から「Google Drive API」を検索して有効にします
4. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuthクライアントID」を選択します
5. アプリケーションの種類は「ウェブアプリケーション」を選択します
6. 承認済みのJavaScriptオリジン（承認済みのオリジン）に、デプロイしたシステムのURL（例: `https://keihi-generic.vercel.app`）を追加します
7. 「作成」をクリックして、**クライアントID**をコピーします

### システムへの設定

1. 設定画面の「クラウドストレージ設定」で「Google Drive」を選択します
2. コピーしたクライアントIDを入力します
3. フォルダIDを入力します（Google Driveでフォルダを開いたときのURLの末尾の文字列です）
4. 「Drive設定を保存」をクリックします

![手順](images/storage_gdrive.png)

---

## AWS S3

### APIキーの取得

1. AWSコンソール（https://console.aws.amazon.com）にログインします
2. 「S3」サービスを開き、バケット（保存場所）を作成します
3. 「IAM」サービスを開き、新しいユーザーを作成します
4. ユーザーに「AmazonS3FullAccess」のポリシー（権限）を付与します
5. 「アクセスキーID」と「シークレットアクセスキー」をメモします

### システムへの設定

1. 設定画面で「AWS S3」を選択します
2. リージョン（例: ap-northeast-1）、バケット名、アクセスキーID、シークレットキーを入力します
3. プレフィックス（フォルダパス）は「receipts」のままでOKです
4. 「S3設定を保存」をクリックします

![手順](images/storage_s3.png)

---

## Microsoft OneDrive

### アプリの登録

1. https://portal.azure.com にアクセスします
2. 「Azure Active Directory」→「アプリの登録」→「新規登録」をクリックします
3. 名前を「経費精算」に設定します
4. リダイレクトURIに、デプロイしたシステムのログインURL（例: `https://keihi-generic.vercel.app/login`）を追加します
5. 「登録」をクリックして、**アプリケーション（クライアント）ID**をコピーします
6. 「APIのアクセス許可」で「Files.ReadWrite」を追加します

### システムへの設定

1. 設定画面で「OneDrive」を選択します
2. コピーしたクライアントIDを入力します
3. フォルダIDは空欄のままでOKです（ルートフォルダに保存されます）
4. 「OneDrive設定を保存」をクリックします

![手順](images/storage_onedrive.png)

---

## Dropbox

### アクセストークンの取得

1. https://www.dropbox.com/developers/apps にアクセスします
2. 「Create App」をクリックします
3. 「Scoped access」→「Full Dropbox」を選択します
4. アプリ名を「keihi-receipts」などに設定します
5. 「Create App」をクリックします
6. 「Permissions」タブで「files.content.write」にチェックを入れます
7. 「Settings」タブの「Generated access token」で「Generate」をクリックします
8. 表示された**アクセストークン**をコピーします

### システムへの設定

1. 設定画面で「Dropbox」を選択します
2. コピーしたアクセストークンを入力します
3. フォルダパスは「/receipts」のままでOKです
4. 「Dropbox設定を保存」をクリックします

![手順](images/storage_dropbox.png)

---

## Box

### アクセストークンの取得

1. https://developer.box.com にアクセスします
2. 「マイアプリ」→「新しいアプリを作成」をクリックします
3. 「カスタムアプリ」を選択します
4. 認証方式は「Developer Token」を選択します
5. 「Developer Token」を生成してコピーします

### システムへの設定

1. 設定画面で「Box」を選択します
2. コピーしたアクセストークンを入力します
3. フォルダIDは「0」（ルートフォルダ）のままでOKです
4. 「Box設定を保存」をクリックします

![手順](images/storage_box.png)

> **注意**: Developer Tokenは60分で期限切れになります。本番運用にはOAuth 2.0の設定が必要です。

---

## Backblaze B2

### APIキーの取得

1. https://www.backblaze.com/sign-up/cloud-storage にアクセスしてアカウントを作成します
2. 「Buckets」からバケットを作成します
3. 「App Keys」から新しいアプリケーションキーを作成します
4. **Application Key ID**と**Application Key**をメモします

### システムへの設定

1. 設定画面で「Backblaze B2」を選択します
2. Application Key ID、Application Key、Bucket ID、Bucket Name、Regionを入力します
3. 「B2設定を保存」をクリックします

![手順](images/storage_b2.png)

---

## Cloudflare R2

### APIキーの取得

1. https://dash.cloudflare.com にログインします
2. 「R2 Object Storage」→ バケットを作成します
3. 「R2 API トークンを管理」からAPIトークンを作成します
4. **Account ID**、**Access Key ID**、**Secret Access Key**をメモします

### システムへの設定

1. 設定画面で「Cloudflare R2」を選択します
2. Account ID、Access Key ID、Secret Access Key、Bucket Nameを入力します
3. 「R2設定を保存」をクリックします

![手順](images/storage_r2.png)

---

## 次のステップ

- [会社情報のカスタマイズ](05_customization.md)
- [FAQ](06_faq.md)
