'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/supabase/client'

// E-mails cadastrados no Supabase Auth
const EMAILS_USUARIOS = {
  vitoria: 'vitoriasouza@gmail.com',
  gabriel: 'ezequias@gmail.com',
}

interface Mensagem {
  id?: number
  texto: string
  autor: 'vitoria' | 'gabriel'
}

type Usuario = 'vitoria' | 'gabriel'

function converterChaveVapid(publicKey: string) {
  const padding = '='.repeat((4 - (publicKey.length % 4)) % 4)
  const base64 = (publicKey + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const rawData = window.atob(base64)

  return Uint8Array.from(rawData, (char) => char.charCodeAt(0))
}

function tocarSomNotificacao() {
  const audio = new Audio('/notification.mp3')
  audio.volume = 1
  void audio.play().catch(() => undefined)
}

export default function Home() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [textoInput, setTextoInput] = useState('')
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const fimDasMensagensRef = useRef<HTMLDivElement>(null)

  const [tela, setTela] = useState<
    'escolha' | 'senha' | 'chat'
  >('escolha')

  const [usuarioSelecionado, setUsuarioSelecionado] =
    useState<Usuario | null>(null)

  const [senhaInput, setSenhaInput] = useState('')
  const [erroSenha, setErroSenha] = useState('')

  // ID até onde a Vitória ocultou as mensagens
  const [ultimaOcultadaVitoria, setUltimaOcultadaVitoria] =
    useState(0)

  // ============================================================
  // SEMPRE EXIGIR LOGIN AO ABRIR O SITE
  // ============================================================

  useEffect(() => {
    const iniciarAplicacao = async () => {
      // Encerra qualquer sessão anterior
      await supabase.auth.signOut()

      setUsuarioSelecionado(null)
      setTela('escolha')
      setSenhaInput('')
      setErroSenha('')
      setMensagens([])
    }

    iniciarAplicacao()
  }, [supabase])

  // ============================================================
  // CARREGAR ÚLTIMA MENSAGEM OCULTADA DA VITÓRIA
  // ============================================================

  useEffect(() => {
    if (typeof window === 'undefined') return

    const valor = Number(
      localStorage.getItem('ultima_ocultada_vitoria') || '0'
    )

    setUltimaOcultadaVitoria(valor)
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const registrarServiceWorkerEmBackground = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        await registration.update()
        await navigator.serviceWorker.ready
      } catch (error) {
        console.error('Erro ao registrar Service Worker em background:', error)
      }
    }

    void registrarServiceWorkerEmBackground()
  }, [])

  // ============================================================
  // REGISTRAR NOTIFICAÇÕES PUSH
  // ============================================================

  const registrarNotificacoes = async (
    usuario: Usuario
  ) => {
    try {
      // Verifica suporte a Service Worker
      if (!('serviceWorker' in navigator)) {
        console.log(
          'Service Worker não é suportado neste navegador.'
        )
        return
      }

      // Verifica suporte a Push
      if (!('PushManager' in window)) {
        console.log(
          'Push Notifications não são suportadas neste navegador.'
        )
        return
      }

      // Verifica suporte a Notification
      if (!('Notification' in window)) {
        console.log(
          'Notificações não são suportadas neste navegador.'
        )
        return
      }

      // Pede permissão
      let permissao = Notification.permission

      if (permissao === 'default') {
        permissao =
          await Notification.requestPermission()
      }

      if (permissao !== 'granted') {
        console.log(
          'Permissão de notificações não concedida.'
        )
        return
      }

      // Registra o Service Worker
      const swUrl = new URL('/sw.js', window.location.origin).toString()

      const registration =
        await navigator.serviceWorker.register(swUrl, {
          scope: '/',
        })

      await registration.update()

      const activeRegistration =
        await navigator.serviceWorker.ready

      console.log(
        'Service Worker registrado:',
        activeRegistration.scope
      )

      // Obtém a chave pública VAPID
      const publicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!publicKey) {
        console.error(
          'NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada.'
        )
        return
      }

      // Verifica se já existe uma inscrição
      let subscription =
        await activeRegistration.pushManager.getSubscription()

      // Se não existe, cria uma
      if (!subscription) {
        subscription =
          await activeRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              converterChaveVapid(publicKey),
          })
      }

      // Salva no Supabase através da API
      const response = await fetch(
        '/api/push/subscribe',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            usuario,
            subscription,
          }),
        }
      )

      if (!response.ok) {
        const erro = await response.text()

        console.error(
          'Erro ao registrar inscrição Push:',
          erro
        )

        return
      }

      console.log(
        `Notificações Push ativadas para ${usuario}.`
      )
    } catch (error) {
      console.error(
        'Erro ao configurar notificações Push:',
        error
      )
    }
  }

  // ============================================================
  // CARREGAR HISTÓRICO + REALTIME
  // ============================================================

  useEffect(() => {
    if (
      tela !== 'chat' ||
      !usuarioSelecionado
    ) {
      return
    }

    let ativo = true

    const buscarMensagens = async () => {
      const { data, error } = await supabase
        .from('conversas')
        .select('id, texto')
        .order('id', { ascending: true })

      if (error) {
        console.error(
          'Erro ao buscar mensagens:',
          error
        )
        return
      }

      if (!ativo || !data) return

      const mensagensFormatadas: Mensagem[] =
        data.map((item) => {
          const texto = item.texto || ''

          if (texto.startsWith('gabriel:')) {
            return {
              id: item.id,
              texto: texto.replace(
                /^gabriel:/,
                ''
              ),
              autor: 'gabriel',
            }
          }

          if (texto.startsWith('vitoria:')) {
            return {
              id: item.id,
              texto: texto.replace(
                /^vitoria:/,
                ''
              ),
              autor: 'vitoria',
            }
          }

          return {
            id: item.id,
            texto,
            autor: 'vitoria',
          }
        })

      setMensagens(mensagensFormatadas)
    }

    buscarMensagens()

    // ==========================================================
    // REALTIME
    // ==========================================================

    const canalConversas = supabase
      .channel('realtime_conversas')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversas',
        },
        (payload) => {
          const novaMsgRaw =
            payload.new.texto

          const idMsg =
            payload.new.id

          if (!novaMsgRaw) return

          let autor: Usuario = 'vitoria'

          let textoLimpo =
            novaMsgRaw

          if (
            novaMsgRaw.startsWith(
              'gabriel:'
            )
          ) {
            autor = 'gabriel'

            textoLimpo =
              novaMsgRaw.replace(
                /^gabriel:/,
                ''
              )
          } else if (
            novaMsgRaw.startsWith(
              'vitoria:'
            )
          ) {
            autor = 'vitoria'

            textoLimpo =
              novaMsgRaw.replace(
                /^vitoria:/,
                ''
              )
          }

          if (autor !== usuarioSelecionado) {
            tocarSomNotificacao()
          }

          setMensagens((prev) => {
            // Evita duplicação
            if (
              prev.some(
                (m) => m.id === idMsg
              )
            ) {
              return prev
            }

            return [
              ...prev,
              {
                id: idMsg,
                texto: textoLimpo,
                autor,
              },
            ]
          })
        }
      )
      .subscribe()

    return () => {
      ativo = false

      supabase.removeChannel(
        canalConversas
      )
    }
  }, [
    tela,
    usuarioSelecionado,
    supabase,
  ])

  // ============================================================
  // LOGIN
  // ============================================================

  const verificarSenha = async () => {
    if (!usuarioSelecionado) return

    setErroSenha('')

    const email =
      EMAILS_USUARIOS[
        usuarioSelecionado
      ]

    const {
      error,
    } = await supabase.auth.signInWithPassword({
      email,
      password: senhaInput,
    })

    if (error) {
      console.error(
        'Erro no login:',
        error
      )

      setErroSenha(
        'Senha incorreta ou erro ao entrar. Tente novamente.'
      )

      return
    }

    setTela('chat')
    setSenhaInput('')

    // Ativa notificações Push
    await registrarNotificacoes(
      usuarioSelecionado
    )
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  const deslogar = async () => {
    await supabase.auth.signOut()

    setTela('escolha')
    setUsuarioSelecionado(null)
    setSenhaInput('')
    setErroSenha('')
    setMensagens([])
  }

  // ============================================================
  // APAGAR / OCULTAR CONVERSA
  // ============================================================

  const apagarTodasAsMensagens =
    async () => {
      if (!usuarioSelecionado) return

      // ========================================================
      // GABRIEL
      // Apaga do banco
      // ========================================================

      if (
        usuarioSelecionado ===
        'gabriel'
      ) {
        const confirmar =
          window.confirm(
            'Tem certeza que deseja apagar todo o histórico do banco? Essa ação não pode ser desfeita.'
          )

        if (!confirmar) return

        const {
          error,
        } = await supabase
          .from('conversas')
          .delete()
          .gte('id', 0)

        if (error) {
          console.error(
            'Erro ao deletar mensagens:',
            error
          )

          alert(
            `Não foi possível apagar o histórico.\n\n${error.message}`
          )

          return
        }

        setMensagens([])

        return
      }

      // ========================================================
      // VITÓRIA
      // Apenas esconde para ela
      // ========================================================

      const maiorId =
        Math.max(
          ...mensagens.map(
            (mensagem) =>
              mensagem.id || 0
          ),
          0
        )

      localStorage.setItem(
        'ultima_ocultada_vitoria',
        String(maiorId)
      )

      setUltimaOcultadaVitoria(
        maiorId
      )

      setMensagens(
        (mensagensAtuais) =>
          mensagensAtuais.filter(
            (mensagem) =>
              (mensagem.id || 0) >
              maiorId
          )
      )
    }

  // ============================================================
  // ENVIAR MENSAGEM
  // ============================================================

  const enviar = async () => {
    if (
      textoInput.trim() === '' ||
      !usuarioSelecionado
    ) {
      return
    }

    const texto =
      textoInput.trim()

    const textoFormatadoParaOBanco =
      `${usuarioSelecionado}:${texto}`

    // Salva a mensagem
    const {
      error,
    } = await supabase
      .from('conversas')
      .insert([
        {
          texto:
            textoFormatadoParaOBanco,
        },
      ])

    if (error) {
      console.error(
        'Erro ao salvar no banco:',
        error
      )

      return
    }

    // Limpa campo
    setTextoInput('')

    // Descobre destinatário
    const destinatario =
      usuarioSelecionado ===
      'vitoria'
        ? 'gabriel'
        : 'vitoria'

    // ========================================================
    // ENVIA NOTIFICAÇÃO PUSH
    // ========================================================

    try {
      const response =
        await fetch(
          '/api/push/send',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              destinatario,
              mensagem: texto,
            }),
          }
        )

      if (!response.ok) {
        console.error(
          'Erro HTTP ao enviar Push:',
          response.status
        )
      } else {
        const resultado =
          await response.json()

        console.log(
          'Resultado Push:',
          resultado
        )
      }
    } catch (error) {
      console.error(
        'Erro ao enviar notificação:',
        error
      )
    }
  }

  // ============================================================
  // ENTER PARA ENVIAR
  // ============================================================

  const manipularKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault()

      enviar()
    }
  }

  // ============================================================
  // ROLAGEM AUTOMÁTICA
  // ============================================================

  useEffect(() => {
    if (tela === 'chat') {
      fimDasMensagensRef.current?.scrollIntoView(
        {
          behavior: 'smooth',
        }
      )
    }
  }, [mensagens, tela])

  // ============================================================
  // MENSAGENS VISÍVEIS
  // ============================================================

  const mensagensVisiveis =
    usuarioSelecionado ===
    'vitoria'
      ? mensagens.filter(
          (mensagem) =>
            (mensagem.id || 0) >
            ultimaOcultadaVitoria
        )
      : mensagens

  // ============================================================
  // TELA DE ESCOLHA
  // ============================================================

  if (tela === 'escolha') {
    return (
      <main className="w-full h-dvh flex flex-col items-center justify-center bg-gray-100 px-4">
        <div className="bg-white p-6 rounded-2xl shadow-md w-full max-w-sm text-center">

          <h2 className="text-xl font-bold mb-6 text-gray-800">
            Você é Vitória ou Gabriel?
          </h2>

          <div className="flex flex-col gap-3">

            <button
              onClick={() => {
                setUsuarioSelecionado(
                  'vitoria'
                )

                setTela('senha')
              }}
              className="w-full bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 rounded-xl transition"
            >
              Vitória
            </button>

            <button
              onClick={() => {
                setUsuarioSelecionado(
                  'gabriel'
                )

                setTela('senha')
              }}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl transition"
            >
              Gabriel
            </button>

          </div>
        </div>
      </main>
    )
  }

  // ============================================================
  // TELA DE SENHA
  // ============================================================

  if (tela === 'senha') {
    return (
      <main className="w-full h-dvh flex flex-col items-center justify-center bg-gray-100 px-4">
        <div className="bg-white p-6 rounded-2xl shadow-md w-full max-w-sm text-center">

          <h2 className="text-xl font-bold mb-2 text-gray-800 capitalize">
            Olá, {usuarioSelecionado}!
          </h2>

          <p className="text-gray-500 text-sm mb-6">
            Digite sua senha para acessar o chat:
          </p>

          <input
            type="password"
            value={senhaInput}
            onChange={(e) =>
              setSenhaInput(
                e.target.value
              )
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                verificarSenha()
              }
            }}
            placeholder="Sua senha"
            className="w-full border rounded-xl h-12 px-4 mb-2 text-black bg-white text-center focus:outline-blue-500"
          />

          {erroSenha && (
            <p className="text-red-500 text-sm mb-4">
              {erroSenha}
            </p>
          )}

          <div className="flex gap-2 mt-4">

            <button
              onClick={() => {
                setTela('escolha')

                setUsuarioSelecionado(
                  null
                )

                setSenhaInput('')
                setErroSenha('')
              }}
              className="w-1/2 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 rounded-xl transition"
            >
              Voltar
            </button>

            <button
              onClick={
                verificarSenha
              }
              className="w-1/2 bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded-xl transition"
            >
              Entrar
            </button>

          </div>
        </div>
      </main>
    )
  }

  // ============================================================
  // CHAT
  // ============================================================

  return (
    <main className="w-full h-dvh relative flex flex-col justify-between bg-gray-50">

      {/* HEADER */}

      <header className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm">

        <div className="flex flex-col">

          <span className="font-semibold text-gray-700 capitalize">
            Logado como:{' '}
            {usuarioSelecionado}
          </span>

          <button
            onClick={
              apagarTodasAsMensagens
            }
            className="text-xs text-left text-amber-600 hover:underline mt-0.5"
          >
            {usuarioSelecionado ===
            'vitoria'
              ? 'Limpar conversa para mim'
              : 'Apagar histórico do banco'}
          </button>

        </div>

        <button
          onClick={deslogar}
          className="text-sm text-red-500 hover:underline"
        >
          Sair
        </button>

      </header>

      {/* MENSAGENS */}

      <div className="mx-4 my-4 flex flex-col gap-3 overflow-y-auto h-[calc(100dvh-140px)] pb-4">

        {mensagensVisiveis.length ===
        0 ? (

          <p className="text-gray-400 italic text-center mt-10">
            Nenhuma mensagem enviada ainda...
          </p>

        ) : (

          mensagensVisiveis.map(
            (msg, index) => {
              const ehMinha =
                msg.autor ===
                usuarioSelecionado

              return (
                <div
                  key={
                    msg.id || index
                  }
                  className={`flex flex-col max-w-[75%] ${
                    ehMinha
                      ? 'self-end items-end'
                      : 'self-start items-start'
                  }`}
                >

                  <span className="text-[10px] text-gray-400 px-1 capitalize">
                    {msg.autor}
                  </span>

                  <div
                    className={`px-4 py-2 rounded-2xl shadow-sm text-sm ${
                      ehMinha
                        ? 'bg-blue-500 text-white rounded-tr-none'
                        : 'bg-white text-gray-800 border rounded-tl-none'
                    }`}
                  >
                    {msg.texto}
                  </div>

                </div>
              )
            }
          )

        )}

        <div
          ref={
            fimDasMensagensRef
          }
        />

      </div>

      {/* CAMPO DE ENVIO */}

      <div className="absolute bottom-0 left-0 right-0 flex border-t bg-white">

        <input
          type="text"
          value={textoInput}
          onChange={(e) =>
            setTextoInput(
              e.target.value
            )
          }
          onKeyDown={
            manipularKeyDown
          }
          className="border-none w-[80%] h-12 px-4 bg-white text-black focus:outline-none"
          placeholder="Digite sua mensagem..."
        />

        <button
          onClick={enviar}
          className="w-[20%] h-12 bg-blue-500 text-white active:bg-blue-600 font-medium transition"
        >
          Enviar
        </button>

      </div>

    </main>
  )
}
