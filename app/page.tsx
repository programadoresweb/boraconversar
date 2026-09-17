'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/supabase/client' 

// Mapeamos o nome do botão para o e-mail cadastrado no Supabase
const EMAILS_USUARIOS = {
  vitoria: 'vitoriasouza@gmail.com', // Coloque o e-mail que você cadastrou no Passo 1
  gabriel: 'ezequias@gmail.com'   // Coloque o e-mail que você cadastrou no Passo 1
}

interface Mensagem {
  id?: number;
  texto: string;
  autor: 'vitoria' | 'gabriel';
}

export default function Home() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [textoInput, setTextoInput] = useState('')
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const fimDasMensagensRef = useRef<HTMLDivElement>(null)

  const [tela, setTela] = useState<'escolha' | 'senha' | 'chat'>('escolha')
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<'vitoria' | 'gabriel' | null>(null)
  const [senhaInput, setSenhaInput] = useState('')
  const [erroSenha, setErroSenha] = useState('')

  // Verifica se o usuário já estava logado anteriormente ao abrir o site
  useEffect(() => {
    const checarSessao = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        const email = session.user.email
        if (email === EMAILS_USUARIOS.vitoria) setUsuarioSelecionado('vitoria')
        if (email === EMAILS_USUARIOS.gabriel) setUsuarioSelecionado('gabriel')
        setTela('chat')
      }
    }
    checarSessao()
  }, [supabase])

  // 1. CARREGAR HISTÓRICO E ATIVAR REALTIME
  useEffect(() => {
    if (tela !== 'chat') return

    const buscarMensagens = async () => {
      const { data, error } = await supabase
        .from('conversas')
        .select('id, texto')
        .order('id', { ascending: true })

      if (error) {
        console.error('Erro ao buscar mensagens:', error)
        return
      }

      if (data) {
        const mensagensFormatadas: Mensagem[] = data.map((item: any) => {
          if (item.texto && item.texto.startsWith('gabriel:')) {
            return { id: item.id, texto: item.texto.replace('gabriel:', ''), autor: 'gabriel' }
          } else if (item.texto && item.texto.startsWith('vitoria:')) {
            return { id: item.id, texto: item.texto.replace('vitoria:', ''), autor: 'vitoria' }
          }
          return { id: item.id, texto: item.texto || '', autor: 'vitoria' }
        })
        setMensagens(mensagensFormatadas)
      }
    }

    buscarMensagens()

    const canalConversas = supabase
      .channel('realtime_conversas')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversas' },
        (payload: any) => {
          const novaMsgRaw = payload.new.texto
          const idMsg = payload.new.id
          
          if (!novaMsgRaw) return

          let autor: 'vitoria' | 'gabriel' = 'vitoria'
          let textoLimpo = novaMsgRaw

          if (novaMsgRaw.startsWith('gabriel:')) {
            autor = 'gabriel'
            textoLimpo = novaMsgRaw.replace('gabriel:', '')
          } else if (novaMsgRaw.startsWith('vitoria:')) {
            autor = 'vitoria'
            textoLimpo = novaMsgRaw.replace('vitoria:', '')
          }

          setMensagens((prev) => {
            if (prev.some((m) => m.id === idMsg)) return prev
            return [...prev, { id: idMsg, texto: textoLimpo, autor }]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canalConversas)
    }
  }, [tela, supabase])

  // 2. LOGAR OFICIALMENTE NO SUPABASE
  const verificarSenha = async () => {
    if (!usuarioSelecionado) return
    setErroSenha('')

    const email = EMAILS_USUARIOS[usuarioSelecionado]

    // Faz a autenticação segura diretamente com a API do Supabase Auth
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: senhaInput,
    })

    if (error) {
      setErroSenha('Senha incorreta ou erro ao entrar. Tente novamente.')
    } else {
      setTela('chat')
      setSenhaInput('')
    }
  }

  // 3. LOGOUT SEGURO
  const deslogar = async () => {
    await supabase.auth.signOut()
    setTela('escolha')
    setUsuarioSelecionado(null)
    setSenhaInput('')
  }

  const enviar = async () => {
    if (textoInput.trim() === '' || !usuarioSelecionado) return
    const textoFormatadoParaOBanco = `${usuarioSelecionado}:${textoInput}`

    const { error } = await supabase
      .from('conversas')
      .insert([{ texto: textoFormatadoParaOBanco }])

    if (error) {
      console.error('Erro ao salvar no banco:', error)
    } else {
      setTextoInput('')
    }
  }

  const manipularKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') enviar()
  }

  useEffect(() => {
    if (tela === 'chat') {
      fimDasMensagensRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [mensagens, tela])

  if (tela === 'escolha') {
    return (
      <main className="w-full h-dvh flex flex-col items-center justify-center bg-gray-100 px-4">
        <div className="bg-white p-6 rounded-2xl shadow-md w-full max-w-sm text-center">
          <h2 className="text-xl font-bold mb-6 text-gray-800">Você é Vitória ou Gabriel?</h2>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => { setUsuarioSelecionado('vitoria'); setTela('senha'); }}
              className="w-full bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 rounded-xl transition"
            >
              Vitória
            </button>
            <button 
              onClick={() => { setUsuarioSelecionado('gabriel'); setTela('senha'); }}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl transition"
            >
              Gabriel
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (tela === 'senha') {
    return (
      <main className="w-full h-dvh flex flex-col items-center justify-center bg-gray-100 px-4">
        <div className="bg-white p-6 rounded-2xl shadow-md w-full max-w-sm text-center">
          <h2 className="text-xl font-bold mb-2 text-gray-800 capitalize">Olá, {usuarioSelecionado}!</h2>
          <p className="text-gray-500 text-sm mb-6">Digite sua senha para acessar o chat:</p>
          
          <input 
            type="password"
            value={senhaInput}
            onChange={(e) => setSenhaInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && verificarSenha()}
            placeholder="Sua senha"
            className="w-full border rounded-xl h-12 px-4 mb-2 text-black bg-white text-center focus:outline-blue-500"
          />

          {erroSenha && <p className="text-red-500 text-sm mb-4">{erroSenha}</p>}

          <div className="flex gap-2 mt-4">
            <button 
              onClick={() => { setTela('escolha'); setSenhaInput(''); setErroSenha(''); }}
              className="w-1/2 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 rounded-xl transition"
            >
              Voltar
            </button>
            <button 
              onClick={verificarSenha}
              className="w-1/2 bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded-xl transition"
            >
              Entrar
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="w-full h-dvh relative flex flex-col justify-between bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm">
        <span className="font-semibold text-gray-700 capitalize">Logado como: {usuarioSelecionado}</span>
        <button 
          onClick={deslogar}
          className="text-sm text-red-500 hover:underline"
        >
          Sair
        </button>
      </header>

      <div className="mx-4 my-4 flex flex-col gap-3 overflow-y-auto h-[calc(100dvh-140px)] pb-4">
        {mensagens.length === 0 ? (
          <p className="text-gray-400 italic text-center mt-10">Nenhuma mensagem enviada ainda...</p>
        ) : (
          mensagens.map((msg, index) => {
            const ehMinha = msg.autor === usuarioSelecionado
            return (
              <div 
                key={msg.id || index} 
                className={`flex flex-col max-w-[75%] ${ehMinha ? 'self-end items-end' : 'self-start items-start'}`}
              >
                <span className="text-[10px] text-gray-400 px-1 capitalize">{msg.autor}</span>
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
          })
        )}
        <div ref={fimDasMensagensRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 flex border-t bg-white">
        <input 
          type="text" 
          value={textoInput}
          onChange={(e) => setTextoInput(e.target.value)}
          onKeyDown={manipularKeyDown}
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
  );
}
