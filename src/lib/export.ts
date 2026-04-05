import { Expense, Category } from '@/types';
import { MF_ACCOUNT_MAP, MF_TAX_MAP, FREEE_TAX_MAP, YAYOI_ACCOUNT_MAP, YAYOI_TAX_MAP, TAX_TYPES } from '@/data/mock';

function download(content: string, filename: string) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function dateStr() { return new Date().toISOString().slice(0, 10); }

// 通常CSV
export function exportCsv(expenses: Expense[], categories: Category[], submitterName: (id: number) => string) {
  const header = '日付,申請者,カテゴリ,説明,金額,税区分,適格区分,T番号,ステータス,精算状況,精算日,取引先';
  const statusMap: Record<string, string> = { draft: '下書き', pending_manager: '部長承認待', pending_accountant: '経理承認待', approved: '承認済', rejected: '却下' };
  const rows = expenses.map(e => {
    const catName = categories.find(c => c.id === e.category)?.name || '';
    const qualified = e.isQualifiedInvoice !== false ? '適格' : '非適格';
    const paidStatus = e.isPaid ? '精算済' : (e.status === 'approved' ? '未精算' : '-');
    const paidDate = e.paidAt ? new Date(e.paidAt).toLocaleDateString('ja-JP') : '';
    return `${e.date},${submitterName(e.userId)},${catName},"${e.description}",${e.amount},${e.taxType},${qualified},${e.invoiceNumber || ''},${statusMap[e.status] || e.status},${paidStatus},${paidDate},${e.vendorName || ''}`;
  });
  download(header + '\n' + rows.join('\n'), `経費一覧_${dateStr()}.csv`);
}

// 適格区分に応じた税区分サフィックス
function qualifiedSuffix(e: Expense): string {
  return e.isQualifiedInvoice === false ? '(80%控除)' : '';
}

// マネーフォワード仕訳CSV
export function exportMF(expenses: Expense[]) {
  const approved = expenses.filter(e => e.status === 'approved');
  const header = '取引No,取引日,借方勘定科目,借方補助科目,借方税区分,借方金額,貸方勘定科目,貸方補助科目,貸方税区分,貸方金額,摘要,適格区分,T番号';
  const rows = approved.flatMap((e, i) => {
    const items = e.lineItems || [{ category: e.category, amount: e.amount, taxType: e.taxType }];
    const qualified = e.isQualifiedInvoice !== false ? '適格' : '非適格';
    return items.map(li => {
      const acct = MF_ACCOUNT_MAP[li.category] || { mfDebit: '雑費' };
      const tax = (MF_TAX_MAP[li.taxType] || '対象外') + qualifiedSuffix(e);
      return `${i + 1},${e.date},${acct.mfDebit},,${tax},${li.amount},未払金,,対象外,${li.amount},${e.description},${qualified},${e.invoiceNumber || ''}`;
    });
  });
  download(header + '\n' + rows.join('\n'), `MF仕訳_${dateStr()}.csv`);
}

// freee仕訳CSV
export function exportFreee(expenses: Expense[]) {
  const approved = expenses.filter(e => e.status === 'approved');
  const header = '収支区分,管理番号,発生日,決済期日,取引先,勘定科目,税区分,金額,税計算区分,税額,備考,適格区分,T番号';
  const rows = approved.flatMap((e, i) => {
    const items = e.lineItems || [{ category: e.category, amount: e.amount, taxType: e.taxType }];
    const qualified = e.isQualifiedInvoice !== false ? '適格' : '非適格';
    return items.map(li => {
      const acct = MF_ACCOUNT_MAP[li.category] || { mfDebit: '雑費' };
      const tax = (FREEE_TAX_MAP[li.taxType] || '対象外') + qualifiedSuffix(e);
      const taxRate = TAX_TYPES.find(t => t.id === li.taxType)?.rate || 0;
      const taxAmt = Math.floor(li.amount * taxRate / (1 + taxRate));
      return `支出,${i + 1},${e.date},,${e.description},${acct.mfDebit},${tax},${li.amount},内税,${taxAmt},${e.memo || ''},${qualified},${e.invoiceNumber || ''}`;
    });
  });
  download(header + '\n' + rows.join('\n'), `freee仕訳_${dateStr()}.csv`);
}

// 弥生仕訳CSV
export function exportYayoi(expenses: Expense[]) {
  const approved = expenses.filter(e => e.status === 'approved');
  const header = '仕訳日付,借方勘定科目,借方補助科目,借方部門,借方税区分,借方金額,借方税金額,貸方勘定科目,貸方補助科目,貸方部門,貸方税区分,貸方金額,貸方税金額,摘要,番号,仕訳メモ,タイプ,生成元,適格区分,T番号';
  const rows = approved.flatMap((e, i) => {
    const items = e.lineItems || [{ category: e.category, amount: e.amount, taxType: e.taxType }];
    const qualified = e.isQualifiedInvoice !== false ? '適格' : '非適格';
    return items.map(li => {
      const acct = YAYOI_ACCOUNT_MAP[li.category] || '雑費';
      const tax = (YAYOI_TAX_MAP[li.taxType] || '対象外') + qualifiedSuffix(e);
      const taxRate = TAX_TYPES.find(t => t.id === li.taxType)?.rate || 0;
      const taxAmt = Math.floor(li.amount * taxRate / (1 + taxRate));
      return `${e.date},${acct},,,${tax},${li.amount},${taxAmt},未払金,,,対象外,${li.amount},0,${e.description},${i + 1},,仕訳,インポート,${qualified},${e.invoiceNumber || ''}`;
    });
  });
  download(header + '\n' + rows.join('\n'), `弥生仕訳_${dateStr()}.csv`);
}
