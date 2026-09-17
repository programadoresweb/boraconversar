import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

export async function POST(request: Request) {
  try {
    const { usuario, subscription } = await request.json()

    if (!usuario || !subscription) {
      return NextResponse.json(
        { error: 'Dados incompletos.' },
        { status: 400 }
      )
    }

    if (usuario !== 'vitoria' && usuario !== 'gabriel') {
      return NextResponse.json(
        { error: 'Usuário inválido.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          usuario,
          subscription,
        },
        {
          onConflict: 'usuario',
        }
      )

    if (error) {
      console.error('Erro ao salvar subscription:', error)

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Erro interno.' },
      { status: 500 }
    )
  }
}
