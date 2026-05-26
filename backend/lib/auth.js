export function getUserFromEvent(event) {
  const userId = event.headers?.['x-user-id'] || event.headers?.['X-User-Id'] || '';
  const userRole = event.headers?.['x-user-role'] || event.headers?.['X-User-Role'] || '';
  return { userId, userRole };
}

export function requireRole(event, ...allowedRoles) {
  const { userId, userRole } = getUserFromEvent(event);
  if (!userId || !userRole) {
    return { authorized: false, userId: null, userRole: null, message: '인증 정보가 없습니다.' };
  }
  if (!allowedRoles.includes(userRole)) {
    return { authorized: false, userId, userRole, message: '권한이 없습니다.' };
  }
  return { authorized: true, userId, userRole, message: null };
}
