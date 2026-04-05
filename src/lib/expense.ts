export function getStatusLabel(status: string): string {
  const m: Record<string, string> = {
    draft: '下書き',
    pending_manager: '部長承認待',
    pending_accountant: '経理承認待',
    approved: '承認済',
    rejected: '却下',
  };
  return m[status] || status;
}

export function actionLabel(action: string): string {
  const m: Record<string, string> = {
    submitted: '申請',
    approved_manager: '部長承認',
    approved_accountant: '経理承認',
    rejected: '却下',
  };
  return m[action] || action;
}
