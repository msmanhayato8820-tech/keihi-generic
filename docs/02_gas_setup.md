# Google Apps Script（GAS）の設定手順

| 所要時間 | 難易度 |
|---------|--------|
| 約10分 | ★★☆（ふつう） |

GAS（Google Apps Script）は、Googleが提供する無料のプログラム実行環境です。このシステムでは、データをGoogleスプレッドシートに保存するためにGASを使います。

GASを設定しなくても「デモモード」で動作しますが、データを永続的に保存したい場合はGASの設定が必要です。

---

## 前提条件

- Googleアカウント（Gmail）をお持ちであること

---

## 手順

### 1. Googleスプレッドシートを新規作成する

1. https://sheets.google.com にアクセスします
2. 「空白のスプレッドシート」をクリックして新規作成します
3. スプレッドシートの名前を「経費精算データ」などわかりやすい名前に変更します

![手順1](images/gas_spreadsheet.png)

### 2. シートを作成する

以下の5つのシートを作成してください。シート名は正確に入力してください。

| シート名 | 用途 |
|---------|------|
| users | ユーザー情報 |
| expenses | 経費データ |
| categories | 経費カテゴリ |
| departments | 部署情報 |
| vendors | 取引先マスタ |

1. 画面下部のシートタブを右クリックして「名前を変更」で「users」に変更します
2. 「+」ボタンをクリックして新しいシートを追加し、同様に名前を付けます
3. 5つのシートをすべて作成します

![手順2](images/gas_sheets.png)

### 3. Apps Scriptエディタを開く

1. スプレッドシートのメニューから「拡張機能」→「Apps Script」をクリックします
2. Apps Scriptのエディタ画面が開きます

![手順3](images/gas_editor.png)

### 4. GASスクリプトを貼り付ける

1. エディタに最初から書かれているコード（`function myFunction()`）をすべて削除します
2. 以下のコードをコピーして貼り付けます

```javascript
// ===== 経費精算システム GASバックエンド =====
const SS = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'init') {
    return jsonResponse(getAllData());
  }
  return jsonResponse({ error: 'Unknown action' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const sheet = body.sheet;
    const data = body.data;

    if (action === 'sendEmail' && body.to && body.subject) {
      GmailApp.sendEmail(body.to, body.subject, body.body, { from: body.from || '' });
      return jsonResponse({ success: true });
    }

    if (!sheet) return jsonResponse({ error: 'No sheet specified' });
    const ws = SS.getSheetByName(sheet);
    if (!ws) return jsonResponse({ error: 'Sheet not found: ' + sheet });

    if (action === 'upsert') {
      upsertRow(ws, data);
    } else if (action === 'delete') {
      deleteRow(ws, body.id);
    } else if (action === 'replace') {
      replaceAll(ws, data);
    }
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function getAllData() {
  const result = {};
  ['users', 'expenses', 'categories', 'departments', 'vendors'].forEach(name => {
    const ws = SS.getSheetByName(name);
    if (ws && ws.getLastRow() > 1) {
      const rows = ws.getDataRange().getValues();
      const headers = rows[0];
      result[name] = rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          let val = row[i];
          if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
            try { val = JSON.parse(val); } catch {}
          }
          obj[h] = val;
        });
        return obj;
      });
    } else {
      result[name] = [];
    }
  });
  return result;
}

function upsertRow(ws, data) {
  if (ws.getLastRow() === 0) {
    ws.appendRow(Object.keys(data));
  }
  const headers = ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0];
  const idCol = headers.indexOf('id');
  if (idCol === -1) {
    const row = headers.map(h => stringify(data[h]));
    ws.appendRow(row);
    return;
  }
  const dataRows = ws.getLastRow() > 1 ? ws.getRange(2, 1, ws.getLastRow() - 1, ws.getLastColumn()).getValues() : [];
  const rowIndex = dataRows.findIndex(r => String(r[idCol]) === String(data.id));
  const row = headers.map(h => stringify(data[h]));
  if (rowIndex >= 0) {
    ws.getRange(rowIndex + 2, 1, 1, row.length).setValues([row]);
  } else {
    ws.appendRow(row);
  }
}

function deleteRow(ws, id) {
  if (ws.getLastRow() <= 1) return;
  const headers = ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0];
  const idCol = headers.indexOf('id');
  if (idCol === -1) return;
  const dataRows = ws.getRange(2, 1, ws.getLastRow() - 1, ws.getLastColumn()).getValues();
  const rowIndex = dataRows.findIndex(r => String(r[idCol]) === String(id));
  if (rowIndex >= 0) ws.deleteRow(rowIndex + 2);
}

function replaceAll(ws, data) {
  if (!Array.isArray(data) || data.length === 0) return;
  ws.clearContents();
  const headers = Object.keys(data[0]);
  ws.appendRow(headers);
  data.forEach(item => {
    ws.appendRow(headers.map(h => stringify(item[h])));
  });
}

function stringify(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return val;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```

3. 「Ctrl + S」（Macの場合は「Cmd + S」）を押して保存します
4. プロジェクト名を「経費精算バックエンド」などに変更します

![手順4](images/gas_paste.png)

### 5. Web Appとしてデプロイする

1. 画面右上の「デプロイ」ボタン → 「新しいデプロイ」をクリックします
2. 歯車アイコンをクリックして「ウェブアプリ」を選択します
3. 以下の設定にします
   - **説明**: 経費精算システム（任意の名前でOK）
   - **次のユーザーとして実行**: 自分
   - **アクセスできるユーザー**: **全員**（重要！これを選ばないと外部からアクセスできません）
4. 「デプロイ」をクリックします
5. 「アクセスを承認」を求められたら、自分のGoogleアカウントを選択して承認します
6. **ウェブアプリのURL**が表示されます。このURLをコピーしてください

![手順5](images/gas_deploy.png)

> **重要**: 表示されたURLは `https://script.google.com/macros/s/xxxxx/exec` のような形式です。このURLを次の手順で使います。

### 6. システムの設定画面にURLを貼り付ける

1. 経費精算システムにログインします（管理者アカウント）
2. 左メニューから「設定」を開きます
3. 「Google Apps Script (GAS) URL 設定」セクションを探します
4. 先ほどコピーしたURLを貼り付けます
5. 「URLを保存」をクリックします

![手順6](images/gas_setting.png)

### 7. 動作確認

1. 設定画面の上部に「共有DB接続中」と表示されれば接続成功です
2. 経費を1件申請して、スプレッドシートの「expenses」シートにデータが追加されることを確認してください

---

## うまくいかない場合

| 症状 | 対処法 |
|------|--------|
| 「デモモード」のまま変わらない | URLが正しいか確認してください。`https://script.google.com/macros/s/`で始まるURLのみ有効です |
| 「アクセスを承認」で警告が出る | 「詳細」→「（プロジェクト名）に移動」をクリックして承認してください。自分で作成したスクリプトなので安全です |
| データが保存されない | スプレッドシートのシート名が正確か確認してください（大文字小文字も区別されます） |

---

## 次のステップ

- [通知の設定](03_slack_teams_webhook.md)（SlackやTeamsで通知を受け取りたい場合）
- [ストレージの設定](04_storage_setup.md)（領収書をクラウドに保存したい場合）
