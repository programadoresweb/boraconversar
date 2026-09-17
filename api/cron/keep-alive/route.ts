import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

export async function GET(request: Request) {
  // Verifica se a requisição veio realmente da Vercel Cron (Segurança)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Não autorizado', { status: 401 })
  }

  try {
    const supabase = await createClient()
    
    // Faz um select limitando a 1 resultado apenas para simular atividade
    // Substitua 'produtos' pelo nome de qualquer tabela que já exista no seu banco
    const { error } = await supabase
      .from('conversas') 
      .select('id')
      .limit(1)

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Supabase acordado com sucesso!' })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
