import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { canResetDemo } from '@/lib/demo'

export function DemoControls({ name, isDemo }: { name: string; isDemo: boolean }) {
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const { data: available } = useQuery({ queryKey: ['demo-available'], queryFn: async () => {
    const { data, error } = await supabase.rpc('demo_available')
    if (error) throw error
    return data
  } })
  const reset = canResetDemo(true, name, isDemo)
  const load = useMutation({ mutationFn: async () => {
    const { error } = await supabase.rpc('load_demo', { _reset: reset })
    if (error) throw error
  }, onSuccess: async () => {
    setConfirm(false)
    await qc.cancelQueries()
    qc.clear()
    await qc.invalidateQueries()
    toast.success('Fictional demo data loaded')
  }, onError: (e: Error) => toast.error(e.message) })
  if (!available && !isDemo) return null
  return <div className="mb-5 space-y-3 border-y border-border py-3">
    {isDemo && <p className="text-sm font-semibold text-primary">Fictional demo — people, receipts and purchases are examples. No real money or emails.</p>}
    {(available || reset) && <Button variant="outline" size="sm" disabled={load.isPending} onClick={() => setConfirm(true)}>
      {reset ? <RotateCcw /> : <FlaskConical />}{load.isPending ? 'Loading…' : reset ? 'Reset demo' : 'Load demo data'}
    </Button>}
    <AlertDialog open={confirm} onOpenChange={setConfirm}>
      <AlertDialogContent><AlertDialogHeader>
        <AlertDialogTitle>{reset ? 'Reset fictional demo?' : 'Load fictional demo data?'}</AlertDialogTitle>
        <AlertDialogDescription>{reset ? 'This replaces this demo club’s sample records. It never resets a real club.' : 'Your empty club becomes Demo Business Club (demo), with fictional people, purchases and tasks. Your account stays signed in as a demo exec.'}</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={load.isPending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={load.isPending} onClick={e => { e.preventDefault(); load.mutate() }}>{reset ? 'Reset demo' : 'Load demo'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>
}