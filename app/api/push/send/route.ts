import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/supabase/server'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(request: Request) {
  try {
    const {
      destinatario,
      mensagem,
    } = await request.json()

    if (
      !destinatario ||
      !mensagem ||
      !['vitoria', 'gabriel'].includes(destinatario)
    ) {
      return NextResponse.json(
        { error: 'Dados inválidos.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('usuario', destinatario)
      .single()

    if (error || !data) {
      console.log(
        `Nenhuma subscription encontrada para ${destinatario}`
      )

      return NextResponse.json({
        success: false,
        message:
          'Usuário ainda não ativou as notificações.',
      })
    }

    try {
      const resultado = await webpush.sendNotification(
        data.subscription,
        JSON.stringify({
          title: 'Bora Conversar 💬',
          body: mensagem,
          url: '/',
        })
      )

      console.log(
        '🔔 RESULTADO DO WEB PUSH:',
        resultado
      )

      return NextResponse.json({
        success: true,
      })
    } catch (pushError: any) {
      console.error(
        '❌ ERRO AO ENVIAR WEB PUSH:',
        pushError
      )

      if (
        pushError.statusCode === 404 ||
        pushError.statusCode === 410
      ) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('usuario', destinatario)

        console.log(
          `🗑️ Subscription removida para ${destinatario}`
        )
      }

      return NextResponse.json(
        {
          error:
            'Não foi possível enviar a notificação.',
          detalhes:
            pushError?.message || 'Erro desconhecido',
        },
        {
          status: 500,
        }
      )
    }
  } catch (error) {
    console.error(
      '❌ ERRO INTERNO:',
      error
    )

    return NextResponse.json(
      {
        error: 'Erro interno.',
      },
      {
        status: 500,
      }
    )
  }
} 
