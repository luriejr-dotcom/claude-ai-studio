export function canResetDemo(exec: boolean, name: string, isDemo: boolean) {
  return exec && isDemo && name.includes('(demo)')
}